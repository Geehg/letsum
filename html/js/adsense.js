// Loaded only by the gated build, on explicitly allowed editorial pages.
(() => {
  'use strict';
  if (location.hostname !== 'letsum.app' || location.search || location.hash || navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
  const unit = document.querySelector('.ls-ad .adsbygoogle');
  if (!unit) return;
  let started = false;
  function start() {
    if (started || !unit.getBoundingClientRect().width) return;
    started = true;
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + unit.dataset.adClient;
    // Google's published CMP handles applicable consent; no homemade consent bypass.
    document.head.appendChild(script);
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { observer.disconnect(); start(); }
    }, {rootMargin:'300px'});
    observer.observe(unit);
  } else start();
})();
