/* Research Copilot — drop-in widget for every page.
   Usage: <script src="/copilot.js" defer></script>

   The widget never holds an API key: it posts to /api/copilot and renders the
   normalised {text, sources, actions} the server returns. */
(function () {
  'use strict';

  /* ---------- context detection ---------- */
  function getContext() {
    const path = location.pathname;
    const page =
      path === '/' || path.endsWith('index.html') || path.endsWith('classic.html') ? 'portal_home' :
      path.includes('charts') ? 'chart_workspace' :
      path.includes('symbol') ? 'symbol' :
      path.includes('academy') ? 'academy' :
      path.includes('lesson') ? 'chart_lesson' :
      path.includes('experts') ? 'experts' :
      path.includes('metrics') ? 'metrics' :
      path.includes('staff') ? 'staff' : 'portal';
    return {
      page,
      url: path,
      // Portal owns ui_mode; the fallback strips the quotes older builds wrote.
      mode: window.Portal?.mode ? window.Portal.mode() : (ls('ui_mode') || 'beginner').replace(/^"|"$/g, ''),
      symbol: ls('active_symbol') || 'BTCUSD',
      chartRange: ls('chart_range') || '1D',
      journey: jsonLs('research_journey', []).slice(-5)
    };
  }

  /* Storage can throw (private mode, blocked cookies) — never break the page. */
  function ls(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function setLs(k, v) { try { localStorage.setItem(k, v); } catch {} }
  function jsonLs(k, fallback) {
    try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fallback; } catch { return fallback; }
  }

  const SUGGESTS = {
    portal_home: ['What moved markets today?', 'Explain the BTC move', 'Set an alert before the next CPI'],
    academy: ['Quiz me on lesson 2', 'Why do prices bounce off levels?', 'What should I learn next?'],
    chart_lesson: ['Explain this drop on the chart', 'Compare BTC vs ETH here', 'Set an alert at this level'],
    chart_workspace: ['Explain the move on this chart', 'Compare it with ETH', 'Set an alert at this level'],
    symbol: ['Why did it move today?', 'How does it compare with its peers?', 'What is the next event for it?'],
    experts: ['What should I ask a consultant?', 'Explain what a licence means here'],
    portal: ['Explain the move', 'Compare instruments', 'Help me with Pine Script']
  };

  /* ---------- styles ---------- */
  const css = `
  .cp-fab{position:fixed;right:22px;bottom:22px;z-index:9000;display:flex;align-items:center;gap:9px;
    background:#2962FF;color:#fff;border:none;border-radius:999px;padding:13px 20px;cursor:pointer;
    font-family:'Trebuchet MS',Tahoma,sans-serif;font-size:14.5px;font-weight:700;box-shadow:0 6px 24px rgba(41,98,255,.45)}
  .cp-fab:hover{filter:brightness(1.1)}
  .cp-panel{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:100vw;z-index:9001;background:#0C0E13;
    border-left:1px solid #2A2E39;display:flex;flex-direction:column;transform:translateX(100%);
    transition:transform .18s ease;font-family:'Trebuchet MS',Tahoma,sans-serif;color:#D1D4DC}
  .cp-panel.open{transform:none}
  .cp-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #1F2430}
  .cp-title{font-size:15px;font-weight:700;color:#fff}
  .cp-close{background:none;border:none;color:#787B86;font-size:16px;cursor:pointer}
  .cp-ctx{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px;border-bottom:1px solid #1F2430}
  .cp-chip{font-family:Consolas,monospace;font-size:10px;color:#5B8DFF;background:#0E1A3A;border:1px solid #1E3A80;border-radius:4px;padding:3px 7px}
  .cp-body{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:11px}
  .cp-msg{max-width:92%;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.5;white-space:pre-wrap}
  .cp-msg.user{align-self:flex-end;background:#0E1A3A;border:1px solid #1E3A80;border-radius:10px 10px 2px 10px;color:#D1D4DC}
  .cp-msg.ai{align-self:flex-start;background:#131722;border:1px solid #2A2E39;border-radius:10px 10px 10px 2px;color:#B2B5BE}
  .cp-msg.err{align-self:flex-start;background:#2B1518;border:1px solid #5c2029;color:#ffc2cb}
  .cp-msg .src{font-family:Consolas,monospace;font-size:9.5px;color:#50535E;margin-top:8px;white-space:normal}
  .cp-tag{display:inline-block;font-family:Consolas,monospace;font-size:9.5px;color:#5B8DFF;background:#0E1A3A;border:1px solid #1E3A80;border-radius:4px;padding:2px 6px;margin-bottom:7px}
  .cp-tag.bare{color:#FF9800;background:#2A1D06;border-color:#4a3510}
  .cp-actions{display:flex;flex-direction:column;gap:5px;margin-top:9px}
  .cp-action{background:#0C0E13;border:1px solid #1F2430;border-radius:6px;padding:8px 10px;font-size:12px;color:#5B8DFF;cursor:pointer;text-align:left;font-family:inherit}
  .cp-action:hover{border-color:#1E3A80}
  .cp-action:disabled{color:#089981;cursor:default;border-color:#0d4f43}
  .cp-suggests{display:flex;flex-direction:column;gap:6px}
  .cp-suggest{background:#131722;border:1px solid #2A2E39;border-radius:8px;padding:9px 11px;font-size:12.5px;color:#5B8DFF;cursor:pointer;text-align:left;font-family:inherit}
  .cp-note{font-size:11.5px;color:#787B86;line-height:1.5}
  .cp-input{display:flex;gap:8px;padding:13px 16px;border-top:1px solid #1F2430}
  .cp-input input{flex:1;background:#131722;border:1px solid #2A2E39;border-radius:999px;padding:10px 15px;
    color:#fff;font-family:inherit;font-size:13px;outline:none}
  .cp-input input:focus{border-color:#2962FF}
  .cp-input button{background:#2962FF;border:none;border-radius:999px;width:38px;height:38px;color:#fff;font-size:15px;cursor:pointer}
  .cp-input button:disabled{opacity:.5;cursor:default}
  .cp-esc{margin-top:auto;padding:10px 14px;border-top:1px solid var(--tv-line);background:rgba(41,98,255,.05)}
.cp-esc .t{font-size:10px;letter-spacing:.08em;color:var(--tv-ghost);font-family:var(--tv-mono, monospace)}
.cp-esc a{display:flex;gap:8px;align-items:center;margin-top:6px;font-size:12.5px;color:var(--tv-white);text-decoration:none}
.cp-esc a:hover{color:#5B8DFF}
.cp-esc a b{font-weight:600}
.cp-esc a span.s{color:var(--tv-faint);font-size:11.5px}
.cp-disc{font-family:Consolas,monospace;font-size:9px;color:#50535E;padding:0 16px 12px;text-align:center}
  .cp-dots{display:inline-flex;gap:4px;vertical-align:middle}
  .cp-dots i{width:5px;height:5px;border-radius:50%;background:#5B8DFF;animation:cpb 1s infinite}
  .cp-dots i:nth-child(2){animation-delay:.15s}.cp-dots i:nth-child(3){animation-delay:.3s}
  @keyframes cpb{0%,60%,100%{opacity:.25}30%{opacity:1}}
  @media (prefers-reduced-motion:reduce){.cp-panel{transition:none}.cp-dots i{animation:none;opacity:.7}}`;

  function h(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Analytics stub — swap the body for a real sink. Also mirrors into the
     Academy buffer when it is present, so all pilot events live in one place. */
  function track(event, props) {
    console.log('[analytics]', event, props || {});
    if (window.Academy?.track) window.Academy.track(event, props);
    // Portal counts the same interaction towards the home funnel; it does not
    // re-log the event, so nothing is double-counted.
    if (window.Portal?.observe) window.Portal.observe(event, props);
  }

  function init() {
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    const ctx = getContext();

    const fab = h('<button type="button" class="cp-fab" aria-label="Open Research Copilot">✦ Copilot</button>');
    const panel = h(`
      <aside class="cp-panel" role="dialog" aria-label="Research Copilot" aria-hidden="true">
        <div class="cp-head"><div class="cp-title">✦ Research Copilot</div><button type="button" class="cp-close" aria-label="Close">✕</button></div>
        <div class="cp-ctx"></div>
        <div class="cp-body">
          <div class="cp-note">I can explain moves, compare instruments, link news to the chart, set up alerts and help with Pine Script. I see the page you are on — not your money, and not your positions.</div>
          <div class="cp-suggests"></div>
        </div>
        <div class="cp-esc"></div>
        <div class="cp-input"><input type="text" placeholder="Ask about markets…" aria-label="Ask about markets"><button type="button" aria-label="Send">➤</button></div>
        <div class="cp-disc">AI ANSWERS · NOT INVESTMENT ADVICE</div>
      </aside>`);
    document.body.appendChild(fab);
    document.body.appendChild(panel);

    const chips = panel.querySelector('.cp-ctx');
    [ctx.page.toUpperCase().replace('_', ' '), ctx.symbol, ctx.chartRange, ctx.mode.toUpperCase()]
      .forEach(t => chips.appendChild(h('<span class="cp-chip">' + esc(t) + '</span>')));

    /* How many openers are offered is a policy number: three in Simple, five
       in Standard, eight in Pro (§8.1). The rest are still askable — the input
       has never been limited by the mode. */
    const sugg = panel.querySelector('.cp-suggests');
    const cap = window.Modes ? window.Modes.policy(ctx.mode).maxPrimaryActions : 3;
    (SUGGESTS[ctx.page] || SUGGESTS.portal).slice(0, cap).forEach(s => {
      const b = h('<button type="button" class="cp-suggest">' + esc(s) + '</button>');
      b.addEventListener('click', () => send(s));
      sugg.appendChild(b);
    });

    /* §NEW-07 on the copilot surface — the moment an AI answer is not enough
       is the moment a person wants a human. Escalation lives here, permanently,
       not as a paywall that appears after the third question. */
    const esc_ = panel.querySelector('.cp-esc');
    const Fx = window.Features;
    if (Fx) {
      esc_.innerHTML = '<div class="t">WHEN AI IS NOT ENOUGH</div>' +
        [['NEW-07', 'Talk to a licensed expert', 'verified adviser, you choose what is shared'],
         ['NEW-06', 'AI Private', 'multi-step research, premium tier']]
          .map(([id, title, sub]) => {
            const f = Fx.byId(id);
            if (!f) return '';
            Fx.track('strategic_feature_impression', f, { surface: 'copilot' });
            return `<a href="${f.route}?from=copilot" data-fid="${f.id}"><span>${f.icon}</span>
              <span><b>${title}</b> ${Fx.badge(f)}<br><span class="s">${sub}</span></span></a>`;
          }).join('');
      esc_.addEventListener('click', e => {
        const a = e.target.closest('[data-fid]');
        if (a) Fx.track('strategic_feature_opened', Fx.byId(a.dataset.fid), { surface: 'copilot' });
      });
    }

    const body = panel.querySelector('.cp-body');
    const input = panel.querySelector('input');
    const sendBtn = panel.querySelector('.cp-input button');

    /* Conversation kept client-side; the server is stateless and gets the tail. */
    const history = [];
    let busy = false;

    function scroll() { body.scrollTop = body.scrollHeight; }

    function setBusy(on) {
      busy = on;
      sendBtn.disabled = on;
      input.disabled = on;
    }

    function renderAnswer(data, question) {
      const sourced = Array.isArray(data.sources) && data.sources.length;
      const msg = h(`<div class="cp-msg ai">
        <span class="cp-tag ${sourced ? '' : 'bare'}">${sourced ? 'AI · SOURCED' : 'AI · MODEL KNOWLEDGE'}</span>
        <div class="cp-text"></div>
        <div class="cp-actions"></div>
        ${sourced ? '<div class="src">sources: ' + esc(data.sources.join(' · ')) + '</div>' : ''}
      </div>`);
      msg.querySelector('.cp-text').textContent = data.text;

      const acts = msg.querySelector('.cp-actions');
      (data.actions || []).forEach(a => {
        const b = h('<button type="button" class="cp-action">' + esc(a.label) + '</button>');
        b.addEventListener('click', () => runAction(a, b));
        acts.appendChild(b);
      });

      body.appendChild(msg);
      scroll();
      history.push({ role: 'assistant', content: data.text });
    }

    async function send(text) {
      if (busy || !text.trim()) return;
      const question = text.trim();

      track('copilot_message_sent', { page: ctx.page });
      const userMsg = h('<div class="cp-msg user"></div>');
      userMsg.textContent = question;
      body.appendChild(userMsg);
      input.value = '';
      history.push({ role: 'user', content: question });

      const pending = h('<div class="cp-msg ai"><span class="cp-tag">AI</span><div>thinking <span class="cp-dots"><i></i><i></i><i></i></span></div></div>');
      body.appendChild(pending);
      scroll();
      setBusy(true);

      try {
        const r = await fetch('/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history.slice(-10), context: getContext() })
        });
        const data = await r.json();
        pending.remove();

        if (!r.ok) {
          history.pop();                      // do not keep an unanswered turn
          showError(data.error || 'Something went wrong.', question);
          return;
        }
        renderAnswer(data, question);
      } catch (err) {
        pending.remove();
        history.pop();
        showError('Network error: ' + err.message, question);
      } finally {
        setBusy(false);
      }
    }

    function showError(message, question) {
      const box = h('<div class="cp-msg err"><div class="cp-text"></div><div class="cp-actions"></div></div>');
      box.querySelector('.cp-text').textContent = message;
      const retry = h('<button type="button" class="cp-action">Try again</button>');
      retry.addEventListener('click', () => { box.remove(); send(question); });
      box.querySelector('.cp-actions').appendChild(retry);
      body.appendChild(box);
      scroll();
    }

    /* ---------- actions ---------- */
    async function runAction(a, btn) {
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = '…';
      try {
        const r = await fetch('/api/copilot/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: a.id, payload: a.payload || {} })
        });
        const data = await r.json();
        if (!r.ok) { btn.disabled = false; btn.textContent = original; showError(data.error || 'Action failed', ''); return; }

        track('copilot_action_completed', { action: a.id, page: ctx.page });

        if (a.id === 'add_watchlist') {
          const list = jsonLs('watchlist', []);
          if (!list.includes(a.payload.symbol)) list.push(a.payload.symbol);
          setLs('watchlist', JSON.stringify(list));
        }
        if (a.id === 'create_alert') {
          const alerts = jsonLs('alerts', []);
          alerts.push({ ...a.payload, created_at: new Date().toISOString() });
          setLs('alerts', JSON.stringify(alerts));
        }

        if (data.navigate) {
          // Carry the context across the navigation so the next page opens on
          // the same instrument the conversation was about.
          setLs('active_symbol', data.symbol || a.payload.symbol || '');
          if (data.range) setLs('chart_range', data.range);
          if (data.compare) setLs('compare_symbols', JSON.stringify(data.compare));
          const journey = jsonLs('research_journey', []);
          journey.push(data.symbol || a.payload.symbol || a.id);
          setLs('research_journey', JSON.stringify(journey.slice(-20)));

          track('copilot_to_chart', { from_page: ctx.page, symbol: data.symbol || '' });
          btn.textContent = '✓ opening…';
          location.href = data.navigate;
          return;
        }

        btn.textContent = '✓ ' + (data.confirm || original);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = original;
        showError('Network error: ' + err.message, '');
      }
    }

    /* ---------- wiring ---------- */
    function open() {
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
      track('copilot_opened', { page: ctx.page });
      input.focus();
    }
    function close() {
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
    }

    fab.addEventListener('click', open);
    panel.querySelector('.cp-close').addEventListener('click', close);
    sendBtn.addEventListener('click', () => send(input.value));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(input.value); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
