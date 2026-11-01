const REASONS = new Set(['offline','network-or-cors','probe-timeout','http-4xx','http-5xx','http-other','load-rejected-url-reachable']);
const ERRORS = new Set(['NetworkError','SyntaxError','InvalidStateError','NotSupportedError','AbortError','TypeError','loader-exception']);
export function normalizeDiagnostic(ua, value) {
  if (!value || value.version !== 1) return null;
  const browser = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Chrome|CriOS/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Other';
  const device = /iPad|Tablet/.test(ua) || /Android/.test(ua) && !/Mobile/.test(ua) ? 'tablet' : /Mobile|iPhone|iPod/.test(ua) ? 'mobile' : 'desktop';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Macintosh|Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other';
  return { weight:Number.isInteger(value.weight) && value.weight >= 1 && value.weight <= 1000 ? value.weight : 0, reason:REASONS.has(value.reason) ? value.reason : 'unknown', error:ERRORS.has(value.error) ? value.error : 'unknown', browser, device, os };
}
export function failureStatement(req, db, font, value) {
  const d = normalizeDiagnostic(req.headers.get('user-agent') || '', value); if (!d) return null;
  const hour = new Date(Date.now() + 9*3600e3).toISOString().slice(0,13);
  return db.prepare('INSERT INTO preview_failures (hour,font,weight,reason,error,browser,device,os,n) VALUES (?,?,?,?,?,?,?,?,1) ON CONFLICT(hour,font,weight,reason,error,browser,device,os) DO UPDATE SET n=n+1').bind(hour,font,d.weight,d.reason,d.error,d.browser,d.device,d.os);
}
export async function failureReport(db, from) {
  const now = new Date(Date.now()+9*3600e3).toISOString().slice(0,13);
  const cutoff = new Date(Date.now()+9*3600e3-30*86400e3).toISOString().slice(0,13);
  await db.prepare('DELETE FROM preview_failures WHERE hour < ?').bind(cutoff).run();
  const rows = await db.prepare('SELECT hour,font,weight,reason,error,browser,device,os,n FROM preview_failures WHERE hour >= ? ORDER BY hour DESC LIMIT 500').bind(from+'T00').all();
  return { nowHour:now, retentionDays:30, limit:500, rows:rows.results };
}
