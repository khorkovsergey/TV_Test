/* =========================================================================
   Мелкая моторика интерфейса. Ничего критичного для работы сервиса здесь нет:
   если скрипт не загрузится, страницы останутся полностью функциональными.
   ========================================================================= */

(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------- появление блоков при прокрутке */
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -40px 0px', threshold: .05 });

  function observe(root = document) {
    root.querySelectorAll('.io:not(.in)').forEach(el => {
      if (reduced) { el.classList.add('in'); return; }
      io.observe(el);
    });
  }

  /* ------------------------------------------ счётчик, набегающий до числа */
  function countUp(el) {
    const raw = el.textContent.trim();
    const m = /^(-?[\d.]+)(.*)$/.exec(raw);
    if (!m) return;
    const target = parseFloat(m[1]);
    if (!isFinite(target)) return;
    const suffix = m[2] || '';
    const decimals = (m[1].split('.')[1] || '').length;
    if (reduced || target === 0) { el.textContent = raw; return; }

    const dur = 620, t0 = performance.now();
    const tick = now => {
      const p = Math.min(1, (now - t0) / dur);
      // ease-out: быстро стартует, мягко останавливается
      const v = target * (1 - Math.pow(1 - p, 3));
      el.textContent = v.toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = raw;
    };
    requestAnimationFrame(tick);
  }

  function countAll(root = document) {
    root.querySelectorAll('.n[data-count]:not([data-counted])').forEach(el => {
      el.setAttribute('data-counted', '1');
      countUp(el);
    });
  }

  /* -------------------------------------- индикатор занятости на кнопке */
  function busy(btn, on) {
    if (!btn) return;
    btn.classList.toggle('busy', !!on);
    btn.disabled = !!on;
  }

  /* Публичный минимум для страниц. */
  window.UX = { observe, countAll, busy, reduced };

  const boot = () => { observe(); countAll(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* Новые узлы, добавленные скриптами страниц, тоже подхватываются. */
  new MutationObserver(muts => {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        observe(node);
        countAll(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
