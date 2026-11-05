// Fixed-recipient contact delivery. No message contents or raw IPs are stored in D1.
const reply = (data, status = 200) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const fail = (error, status = 400) => reply({error}, status);
const TOPICS = new Set(['광고·제휴', '폰트 정보·권리 문의', '서비스 이용 문의', '기타']);
export function validateContact(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null;
  if (b.website) return null;
  const {id, name, email, subject, message, topic, agree} = b;
  if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) return null;
  if (!TOPICS.has(topic) || agree !== true) return null;
  if (typeof name !== 'string' || !name.trim() || name.length > 60 || /[\x00-\x1f\x7f]/.test(name)) return null;
  if (typeof email !== 'string' || email.length > 254 || !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(email) || email.includes('..')) return null;
  if (typeof subject !== 'string' || !subject.trim() || subject.length > 100 || /[\x00-\x1f\x7f]/.test(subject)) return null;
  if (typeof message !== 'string' || message.trim().length < 10 || message.length > 5000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(message)) return null;
  return {id, name:name.trim(), email, subject:subject.trim(), message:message.trim(), topic};
}
async function boundedJson(req) {
  if (Number(req.headers.get('content-length')) > 24576) throw new Error('large');
  if (!req.body) return null;
  const reader = req.body.getReader(); const chunks = []; let size = 0;
  while (true) { const {done,value} = await reader.read(); if (done) break; size += value.byteLength; if (size > 24576) {await reader.cancel(); throw new Error('large');} chunks.push(value); }
  const bytes = new Uint8Array(size); let pos = 0; for (const c of chunks) {bytes.set(c,pos); pos += c.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
async function fingerprint(value, salt) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt+'|'+value));
  return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function contact(req, env, voter) {
  const url = new URL(req.url);
  if (url.hostname !== 'letsum.app' || req.headers.get('origin') !== 'https://letsum.app') return fail('허용되지 않은 요청입니다.',403);
  if (!env.CONTACT_EMAIL || env.CONTACT_ENABLED !== 'true') return fail('문의 전송 연결을 준비 중입니다. 잠시 후 다시 방문해 주세요.',503);
  let b; try {b = validateContact(await boundedJson(req));} catch {return fail('입력 형식 또는 용량을 확인해 주세요.');}
  if (!b) return fail('이름·이메일·제목·문의 내용(10~5,000자)과 동의를 확인해 주세요.');
  const now = Math.floor(Date.now()/1000);
  const hash = await fingerprint(JSON.stringify([b.name,b.email,b.subject,b.message,b.topic]),env.VOTER_SALT);
  await env.DB.prepare('DELETE FROM contact_deliveries WHERE created < ?').bind(now-7*86400).run();
  const old = await env.DB.prepare('SELECT voter, body_hash, status FROM contact_deliveries WHERE id = ?').bind(b.id).first();
  if (old) {
    if (old.voter !== voter || old.body_hash !== hash) return fail('이미 사용한 전송 번호입니다. 새로고침 후 다시 작성해 주세요.',409);
    if (old.status === 'sent') return reply({ok:true,id:b.id});
    return reply({error:'이 문의의 전송 결과를 확인 중입니다. 중복 발송을 막기 위해 다시 보내지 않았습니다.',uncertain:true,id:b.id},409);
  }
  // One atomic insertion enforces per-sender and global limits, including concurrent requests.
  const result = await env.DB.prepare(`INSERT OR IGNORE INTO contact_deliveries (id,voter,body_hash,status,created)
    SELECT ?,?,?,'pending',? WHERE
    (SELECT COUNT(*) FROM contact_deliveries WHERE voter=? AND created>?) < 3 AND
    (SELECT COUNT(*) FROM contact_deliveries WHERE voter=? AND created>?) < 10 AND
    (SELECT COUNT(*) FROM contact_deliveries WHERE created>?) < 100`).bind(b.id,voter,hash,now,voter,now-600,voter,now-86400,now-86400).run();
  if (!result.meta.changes) return fail('짧은 시간에 문의가 많이 접수되었습니다. 잠시 후 다시 시도해 주세요.',429);
  try {
    const sent = await env.CONTACT_EMAIL.send({
      from:{email:'contact@letsum.app',name:'렛섬 문의 접수'},
      to:{email:'interq4@naver.com',name:'렛섬운영 담당자'},
      replyTo:{email:b.email,name:b.name},
      subject:`[LETSUM 문의] ${b.topic} · ${b.subject}`,
      text:`렛섬 홈페이지에서 접수된 문의입니다.\n\n분류: ${b.topic}\n작성자: ${b.name}\n회신 이메일: ${b.email}\n제목: ${b.subject}\n접수 번호: ${b.id}\n\n${b.message}\n\n---\n개인정보 수집·이용 동의: 확인\n보유 기간: 문의 처리 완료 후 1년 (권리자 요청 처리 기록 3년)\n이 메일에 답장하면 작성자의 회신 이메일로 전송됩니다.`
    });
    if (!sent?.messageId) throw new Error('unknown');
    await env.DB.prepare("UPDATE contact_deliveries SET status='sent' WHERE id=?").bind(b.id).run();
    return reply({ok:true,id:b.id});
  } catch {
    // Delivery may have succeeded before a connection/DB error. Never retry automatically.
    return reply({error:'전송 결과를 확인하지 못했습니다. 중복 발송을 막기 위해 자동으로 재전송하지 않습니다. 작성 내용과 접수 번호를 보관해 주세요.',uncertain:true,id:b.id},503);
  }
}
