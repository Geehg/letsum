(() => {
  const form = document.querySelector('#contactForm'); if (!form) return;
  const status = document.querySelector('#contactStatus'), submit = form.querySelector('button[type=submit]');
  let id = crypto.randomUUID(), busy = false, sent = false, uncertain = false;
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || sent || uncertain || !form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form)); data.id = id; data.agree = form.elements.agree.checked;
    busy = true; submit.disabled = true; submit.textContent = '전송 중…'; status.dataset.state = ''; status.textContent = '문의 내용을 전송하고 있습니다.';
    try {
      const response = await fetch('/api/contact', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      const result = await response.json();
      if (!response.ok || !result.ok) {
        uncertain = !!result.uncertain;
        status.dataset.state = 'error'; status.textContent = (result.error || '전송하지 못했습니다. 잠시 후 다시 시도해 주세요.') + (result.id ? '\n접수 번호: '+result.id : '');
      } else {
        sent = true; status.dataset.state = 'success'; status.textContent = '문의 메일이 발송되었습니다. 렛섬운영 담당자가 확인 후 입력하신 이메일로 회신합니다.\n접수 번호: '+result.id;
        form.reset(); form.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);
      }
    } catch {
      // A lost response does not prove that sending failed. Keep the request ID and content.
      uncertain = true; status.dataset.state = 'error'; status.textContent = '연결이 끊겨 전송 결과를 확인하지 못했습니다. 중복 발송을 막기 위해 다시 전송하지 않습니다. 작성 내용과 접수 번호를 보관해 주세요.\n접수 번호: '+id;
    } finally {
      busy = false; submit.disabled = sent || uncertain; submit.textContent = sent ? '발송 완료' : uncertain ? '전송 결과 확인 필요' : '문의 보내기';
      status.focus();
    }
  });
  window.addEventListener('beforeunload', event => { if (!sent && form.elements.message.value.trim()) {event.preventDefault();event.returnValue='';} });
})();
