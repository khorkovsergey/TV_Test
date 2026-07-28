/* =========================================================================
   Research Copilot — drop-in widget for every page, plus a public API for
   pages that have something specific to say about what the user is looking at.

   Usage: <script src="/copilot.js" defer></script>

   The widget never holds an API key: it posts to /api/copilot and renders the
   normalised {text, sources, actions} the server returns.

   §8. What changed. The context used to be computed once at init and read from
   localStorage, so the chips were a snapshot of whatever the last tab stored
   and the panel had no idea which candle a visitor had clicked. Context is now
   a live object that any page can patch; the chips repaint from it; and the
   conversation records when it changed, because an answer about 27 July and an
   answer about 25 July should not sit in one thread pretending to be about the
   same thing.

   The panel can also dock: on the chart workspace it mounts into a column
   beside the chart instead of covering it.
   ========================================================================= */

(function () {
  'use strict';

  /* Storage can throw (private mode, blocked cookies) — never break the page. */
  function ls(k) { try { return localStorage.getItem(k); } catch { return null; } }
  function setLs(k, v) { try { localStorage.setItem(k, v); } catch {} }
  function jsonLs(k, fallback) {
    try { return JSON.parse(localStorage.getItem(k) || 'null') ?? fallback; } catch { return fallback; }
  }

  /* ---------- context ---------- */

  /* The page-derived base. Anything a page knows better — the chart knows its
     own symbol and selection — arrives later through updateContext(). */
  function baseContext() {
    const path = location.pathname;
    const page =
      path === '/' || path.endsWith('index.html') || path.endsWith('classic.html') ? 'portal_home' :
      path.includes('charts') ? 'chart_workspace' :
      path.includes('symbol') ? 'symbol' :
      path.includes('money') ? 'money' :
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
      /* §24 — the register is a central policy, not a per-page guess. The
         server shapes the answer from it; the panel caps its actions by it. */
      copilotProfile: window.ModeOrchestrator
        ? window.ModeOrchestrator.copilotProfile('copilot')
        : (window.Modes ? window.Modes.policy(
            window.Portal?.mode ? window.Portal.mode() : 'simple').copilotProfile : 'teacher'),
      journey: jsonLs('research_journey', []).slice(-5)
    };
  }

  const SUGGESTS = {
    portal_home: ['What moved markets today?', 'Explain the BTC move', 'Set an alert before the next CPI'],
    academy: ['Quiz me on lesson 2', 'Why do prices bounce off levels?', 'What should I learn next?'],
    chart_lesson: ['Explain this drop on the chart', 'Compare BTC vs ETH here', 'Set an alert at this level'],
    chart_workspace: ['Pick a candle to ask the Copilot about a specific day.',
                      'What is this instrument?', 'How do I read a candle?'],
    money: ['Where did most of my money go this month?', 'How do I build a reserve?', 'What should I do first?'],
    symbol: ['Why did it move today?', 'How does it compare with its peers?', 'What is the next event for it?'],
    experts: ['What should I ask a consultant?', 'Explain what a licence means here'],
    portal: ['Explain the move', 'Compare instruments', 'Help me with Pine Script']
  };

  /* §10 — what to offer once the visitor has pointed at something. */
  const CANDLE_PROMPTS = [
    'What happened on this day?',
    'What news came out in this period?',
    'Why was the fall this large?',
    'Was this the whole market or just this company?',
    'How did it move relative to Nasdaq and its sector?',
    'Show the events you found on the chart.'
  ];
  const RANGE_PROMPTS = [
    'Explain the move over this period.',
    'Which events mattered?',
    'Split the causes into company, sector and macro.',
    'Why did the recovery start where it did?',
    'Compare the period with Nasdaq.'
  ];
  const NO_SELECTION_HINT = 'Pick a candle to ask the Copilot about a specific day.';

  /* ---------- styles ---------- */
  const css = `
  .cp-fab{position:fixed;right:22px;bottom:22px;z-index:9000;display:flex;align-items:center;gap:9px;
    background:#2962FF;color:#fff;border:none;border-radius:999px;padding:13px 20px;cursor:pointer;
    font-family:'Trebuchet MS',Tahoma,sans-serif;font-size:14.5px;font-weight:700;box-shadow:0 6px 24px rgba(41,98,255,.45)}
  .cp-fab:hover{filter:brightness(1.1)}
  /* BUG-CHART-002 — same trap as the chart overlay: the hidden attribute gets
     its display:none from the browser stylesheet, and .cp-fab's display:flex
     beats it. On the chart the panel is docked and the floating button was
     hidden in code, yet stayed on screen and did nothing when pressed. */
  .cp-fab[hidden]{display:none !important}
  .cp-panel{position:fixed;top:0;right:0;bottom:0;width:380px;max-width:100vw;z-index:9001;background:#0C0E13;
    border-left:1px solid #2A2E39;display:flex;flex-direction:column;transform:translateX(100%);
    transition:transform .18s ease;font-family:'Trebuchet MS',Tahoma,sans-serif;color:#D1D4DC}
  .cp-panel.open{transform:none}
  /* Docked: the host page owns the geometry, so the panel stops being fixed
     and simply fills the column it was given. */
  .cp-panel.cp-docked{position:relative;top:auto;right:auto;bottom:auto;width:100%;max-width:none;
    height:100%;z-index:1;transform:none;border-left:none;transition:none}
  .cp-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #1F2430}
  .cp-title{font-size:15px;font-weight:700;color:#fff}
  .cp-sub{font-family:Consolas,monospace;font-size:10.5px;color:#5B8DFF;margin-top:2px}
  .cp-close{background:none;border:none;color:#787B86;font-size:16px;cursor:pointer}
  .cp-ctx{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px;border-bottom:1px solid #1F2430}
  .cp-chip{font-family:Consolas,monospace;font-size:10px;color:#5B8DFF;background:#0E1A3A;border:1px solid #1E3A80;border-radius:4px;padding:3px 7px}
  .cp-chip.sel{color:#fff;background:#1E3A80;border-color:#2962FF}
  .cp-chip-clear{font-family:Consolas,monospace;font-size:10px;color:#FF9800;background:#2A1D06;
    border:1px solid #4a3510;border-radius:4px;padding:3px 7px;cursor:pointer}
  .cp-body{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:11px}
  .cp-msg{max-width:92%;border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.5;white-space:pre-wrap}
  .cp-msg.user{align-self:flex-end;background:#0E1A3A;border:1px solid #1E3A80;border-radius:10px 10px 2px 10px;color:#D1D4DC}
  .cp-msg.ai{align-self:flex-start;background:#131722;border:1px solid #2A2E39;border-radius:10px 10px 10px 2px;color:#B2B5BE}
  .cp-msg.err{align-self:flex-start;background:#2B1518;border:1px solid #5c2029;color:#ffc2cb}
  .cp-msg .src{font-family:Consolas,monospace;font-size:9.5px;color:#50535E;margin-top:8px;white-space:normal}
  .cp-divider{align-self:stretch;display:flex;align-items:center;gap:8px;font-family:Consolas,monospace;
    font-size:10px;color:#FF9800;padding:2px 0}
  .cp-divider:before,.cp-divider:after{content:"";flex:1;height:1px;background:#2A2E39}
  .cp-divider-actions{display:flex;gap:6px;align-self:stretch;flex-wrap:wrap}
  .cp-tag{display:inline-block;font-family:Consolas,monospace;font-size:9.5px;color:#5B8DFF;background:#0E1A3A;border:1px solid #1E3A80;border-radius:4px;padding:2px 6px;margin-bottom:7px}
  .cp-tag.bare{color:#FF9800;background:#2A1D06;border-color:#4a3510}
  .cp-actions{display:flex;flex-direction:column;gap:5px;margin-top:9px}
  .cp-action{background:#0C0E13;border:1px solid #1F2430;border-radius:6px;padding:8px 10px;font-size:12px;color:#5B8DFF;cursor:pointer;text-align:left;font-family:inherit}
  .cp-action:hover{border-color:#1E3A80}
  .cp-action:disabled{color:#089981;cursor:default;border-color:#0d4f43}
  .cp-sources{margin-top:9px;display:flex;flex-direction:column;gap:6px}
  .cp-source{display:block;background:#0C0E13;border:1px solid #1F2430;border-radius:6px;padding:8px 10px;
    text-decoration:none;color:#B2B5BE}
  .cp-source:hover{border-color:#1E3A80}
  .cp-source .pub{font-family:Consolas,monospace;font-size:9.5px;color:#5B8DFF;text-transform:uppercase}
  .cp-source .ttl{font-size:12px;color:#D1D4DC;margin-top:3px;line-height:1.4}
  .cp-source .when{font-family:Consolas,monospace;font-size:9.5px;color:#787B86;margin-top:3px}
  .cp-source .rel{font-family:Consolas,monospace;font-size:9px;color:#FF9800;margin-top:2px}
  .cp-factors{margin-top:9px;display:flex;flex-direction:column;gap:5px}
  .cp-factor{font-size:12px;line-height:1.45;color:#B2B5BE;border-left:2px solid #1E3A80;padding:2px 0 2px 8px}
  .cp-factor b{font-family:Consolas,monospace;font-size:9.5px;color:#5B8DFF;display:block;text-transform:uppercase}
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

  /* A selection is described once, here, so the chips, the header and the
     divider cannot disagree about which day is being discussed. */
  function selectionLabel(sel) {
    if (!sel || sel.type === 'none') return null;
    if (sel.type === 'candle') {
      const pct = Number.isFinite(sel.changePct)
        ? `${sel.changePct >= 0 ? '+' : '−'}${Math.abs(sel.changePct).toFixed(2)}%` : '';
      return `${sel.time}${pct ? ' · ' + pct : ''}`;
    }
    return `${sel.from} → ${sel.to}`;
  }

  function init() {
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

    /* The live context. `patch` is what a page contributes; `base` is what the
       URL and storage can tell us on their own. */
    let patch = {};
    const context = () => ({ ...baseContext(), ...patch });

    const fab = h('<button type="button" class="cp-fab" aria-label="Open Research Copilot">✦ Copilot</button>');
    const panel = h(`
      <aside class="cp-panel" role="dialog" aria-label="Research Copilot" aria-hidden="true">
        <div class="cp-head">
          <div><div class="cp-title">✦ Research Copilot</div><div class="cp-sub" hidden></div></div>
          <button type="button" class="cp-close" aria-label="Close">✕</button></div>
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
    const sugg = panel.querySelector('.cp-suggests');
    const sub = panel.querySelector('.cp-sub');
    const body = panel.querySelector('.cp-body');
    const input = panel.querySelector('input');
    const sendBtn = panel.querySelector('.cp-input button');

    /* ---------- reactive chips ---------- */

    function paintChips() {
      const c = context();
      chips.innerHTML = '';
      const sel = c.chartSelection;

      const add = (text, cls) => chips.appendChild(
        h(`<span class="${cls || 'cp-chip'}">${esc(text)}</span>`));

      if (sel && sel.type === 'candle') {
        add(`${c.companyName || c.symbol} · ${c.symbol}`);
        add(`${c.interval || '1d'} candle`);
        add(sel.time, 'cp-chip sel');
        if (Number.isFinite(sel.open)) add('O ' + fmtPrice(sel.open));
        if (Number.isFinite(sel.high)) add('H ' + fmtPrice(sel.high));
        if (Number.isFinite(sel.low)) add('L ' + fmtPrice(sel.low));
        if (Number.isFinite(sel.close)) add('C ' + fmtPrice(sel.close));
        if (Number.isFinite(sel.changePct))
          add(`${sel.changePct >= 0 ? '+' : '−'}${Math.abs(sel.changePct).toFixed(2)}%`, 'cp-chip sel');
        if (Number.isFinite(sel.volume)) add('Vol ' + fmtVol(sel.volume));
      } else if (sel && sel.type === 'range') {
        add(c.symbol);
        add(c.interval || '1d');
        add(`${sel.from} → ${sel.to}`, 'cp-chip sel');
        add(`${sel.candleCount} candles`);
        if (Number.isFinite(sel.changePct))
          add(`${sel.changePct >= 0 ? '+' : '−'}${Math.abs(sel.changePct).toFixed(2)}%`, 'cp-chip sel');
        if (Number.isFinite(sel.high)) add('High ' + fmtPrice(sel.high));
        if (Number.isFinite(sel.low)) add('Low ' + fmtPrice(sel.low));
      } else {
        [c.page.toUpperCase().replace('_', ' '), c.symbol, c.chartRange, String(c.mode).toUpperCase()]
          .forEach(t => add(t));
      }

      if (sel && sel.type !== 'none') {
        const clear = h('<button type="button" class="cp-chip-clear">✕ Clear selection</button>');
        clear.addEventListener('click', () => {
          document.dispatchEvent(new CustomEvent('copilot:clear-selection'));
        });
        chips.appendChild(clear);
      }

      const label = selectionLabel(sel);
      sub.hidden = !label;
      sub.textContent = label ? `${c.symbol} · ${label} · ${c.interval || '1d'}` : '';
    }

    /* A free feed returns full float precision. `O 204.42999267578125` in a
       chip is not a price, it is a machine's internal state on display. */
    function fmtPrice(v) {
      if (!Number.isFinite(v)) return '—';
      if (window.ChartData?.price) return window.ChartData.price(v);
      const digits = Math.abs(v) >= 1 ? 2 : 4;
      return v.toFixed(digits);
    }

    function fmtVol(v) {
      if (!Number.isFinite(v)) return '—';
      if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
      if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
      if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
      return String(Math.round(v));
    }

    function paintSuggestions() {
      const c = context();
      const sel = c.chartSelection;
      sugg.innerHTML = '';

      let list;
      if (sel && sel.type === 'candle') list = CANDLE_PROMPTS;
      else if (sel && sel.type === 'range') list = RANGE_PROMPTS;
      else list = SUGGESTS[c.page] || SUGGESTS.portal;

      /* On the chart with nothing selected, say what to do rather than
         offering a question that has no subject. */
      if (c.page === 'chart_workspace' && (!sel || sel.type === 'none')) {
        sugg.appendChild(h(`<div class="cp-note">${esc(NO_SELECTION_HINT)}</div>`));
      }

      /* How many openers are offered is a policy number: three in Simple, five
         in Standard, eight in Professional (§8.1). The rest are still askable —
         the input has never been limited by the mode. */
      const cap = window.Modes ? window.Modes.policy(c.mode).maxPrimaryActions : 3;
      list.slice(0, cap).forEach(s => {
        const b = h('<button type="button" class="cp-suggest">' + esc(s) + '</button>');
        b.addEventListener('click', () => send(s));
        sugg.appendChild(b);
      });
    }

    /* §NEW-07 on the copilot surface — the moment an AI answer is not enough
       is the moment a person wants a human. Escalation lives here, permanently,
       not as a paywall that appears after the third question. */
    const esc_ = panel.querySelector('.cp-esc');
    const Fx = window.Features;
    if (Fx) {
      esc_.innerHTML = '<div class="t">WHEN AI IS NOT ENOUGH</div>' +
        [['NEW-07', 'Talk to a licensed expert', 'verified adviser, you choose what is shared'],
         ['NEW-06', 'AI Private', 'multi-step research, premium tier']]
          .map(([id, title, sub2]) => {
            const f = Fx.byId(id);
            if (!f) return '';
            Fx.track('strategic_feature_impression', f, { surface: 'copilot' });
            return `<a href="${f.route}?from=copilot" data-fid="${f.id}"><span>${f.icon}</span>
              <span><b>${title}</b> ${Fx.badge(f)}<br><span class="s">${sub2}</span></span></a>`;
          }).join('');
      esc_.addEventListener('click', e => {
        const a = e.target.closest('[data-fid]');
        if (a) Fx.track('strategic_feature_opened', Fx.byId(a.dataset.fid), { surface: 'copilot' });
      });
    }

    /* Conversation kept client-side; the server is stateless and gets the tail. */
    let history = [];
    let busy = false;
    /* What the last question was actually about, so a later change of candle
       can be reported rather than silently applied. */
    let threadSelection = null;
    /* The last question and answer, so "Save this research" saves the thing
       the visitor is looking at rather than a fresh, emptier version of it. */
    let lastAnswer = null;

    function scroll() { body.scrollTop = body.scrollHeight; }

    function setBusy(on) {
      busy = on;
      sendBtn.disabled = on;
      input.disabled = on;
    }

    /* ---------- rendering an answer ---------- */

    function sourceCard(s) {
      const RELATION = {
        'before-session': 'Published before the selected session',
        'during-session': 'Published during the selected session',
        'after-session': 'Published after the selected session',
        retrospective: 'Retrospective — written later about this period'
      };
      const card = h(`<a class="cp-source" target="_blank" rel="noopener noreferrer">
        <div class="pub"></div><div class="ttl"></div><div class="when"></div><div class="rel"></div></a>`);
      card.href = s.url || '#';
      card.querySelector('.pub').textContent = s.domain || s.publisher || 'source';
      card.querySelector('.ttl').textContent = s.title || s.url || '';
      const when = card.querySelector('.when');
      if (s.publishedAt) when.textContent = s.publishedAt;
      else { when.textContent = 'publication time not given by the source'; }
      const rel = card.querySelector('.rel');
      if (s.relation && RELATION[s.relation]) rel.textContent = RELATION[s.relation];
      else rel.hidden = true;
      return card;
    }

    function renderAnswer(data) {
      /* Structured sources are objects; older responses were an array of
         hostname strings. Both are accepted — the label must reflect what is
         actually there, and "AI · SOURCED" is not printed over an empty list. */
      const raw = Array.isArray(data.sources) ? data.sources : [];
      const structured = raw.filter(s => s && typeof s === 'object' && s.url);
      const sourced = raw.length > 0;

      const msg = h(`<div class="cp-msg ai">
        <span class="cp-tag ${sourced ? '' : 'bare'}">${sourced ? 'AI · SOURCED' : 'AI · MODEL KNOWLEDGE'}</span>
        <div class="cp-text"></div>
        <div class="cp-factors"></div>
        <div class="cp-actions"></div>
        <div class="cp-sources"></div>
      </div>`);
      msg.querySelector('.cp-text').textContent = data.text;

      const fx = msg.querySelector('.cp-factors');
      (data.factors || []).forEach(f => {
        const node = h('<div class="cp-factor"><b></b><span></span></div>');
        node.querySelector('b').textContent =
          `${String(f.relevance || 'medium').toUpperCase()} · ${f.category || 'company'}`;
        node.querySelector('span').textContent = f.title
          + (f.description ? ' — ' + f.description : '');
        fx.appendChild(node);
      });
      if (!fx.children.length) fx.remove();

      /* §24/§98 — the action cap is the same policy number the openers use.
         Hardcoding four here meant Professional and Simple got the same row of
         buttons no matter what the register was supposed to be. Nothing is
         removed: the server already ranked them, and the rest stay askable. */
      const acts = msg.querySelector('.cp-actions');
      const actionCap = window.Modes
        ? window.Modes.policy(context().mode).maxPrimaryActions : 4;
      (data.actions || []).slice(0, actionCap).forEach(a => {
        const b = h('<button type="button" class="cp-action">' + esc(a.label) + '</button>');
        b.addEventListener('click', () => runAction(a, b));
        acts.appendChild(b);
      });

      const srcBox = msg.querySelector('.cp-sources');
      if (structured.length) {
        structured.forEach(s => srcBox.appendChild(sourceCard(s)));
      } else if (sourced) {
        srcBox.appendChild(h('<div class="src">sources: ' + esc(raw.join(' · ')) + '</div>'));
      } else {
        srcBox.remove();
      }

      body.appendChild(msg);
      scroll();
      history.push({ role: 'assistant', content: data.text });
      lastAnswer = {
        question: [...history].reverse().find(m => m.role === 'user')?.content || '',
        text: data.text,
        sources: raw,
        factors: data.factors || []
      };
      return msg;
    }

    async function send(text) {
      if (busy || !text.trim()) return;
      const question = text.trim();
      const ctx = context();

      track('copilot_message_sent', { page: ctx.page, has_selection: Boolean(ctx.chartSelection && ctx.chartSelection.type !== 'none') });
      if (ctx.chartSelection && ctx.chartSelection.type !== 'none') {
        track('chart_copilot_question_submitted', {
          symbol: ctx.symbol, interval: ctx.interval,
          selection: ctx.chartSelection.type,
          at: ctx.chartSelection.time || ctx.chartSelection.from
        });
      }

      const userMsg = h('<div class="cp-msg user"></div>');
      userMsg.textContent = question;
      body.appendChild(userMsg);
      input.value = '';
      history.push({ role: 'user', content: question });
      threadSelection = ctx.chartSelection ? { ...ctx.chartSelection } : null;

      const pending = h('<div class="cp-msg ai"><span class="cp-tag">AI</span><div>thinking <span class="cp-dots"><i></i><i></i><i></i></span></div></div>');
      body.appendChild(pending);
      scroll();
      setBusy(true);

      try {
        const r = await fetch('/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history.slice(-10), context: ctx })
        });
        const data = await r.json();
        pending.remove();

        if (!r.ok) {
          history.pop();                      // do not keep an unanswered turn
          showError(data.error || 'Something went wrong.', question);
          return;
        }
        renderAnswer(data);
        if (Array.isArray(data.sources) && data.sources.length) {
          track('chart_news_search_completed', { sources: data.sources.length });
        } else if (ctx.chartSelection && ctx.chartSelection.type !== 'none') {
          track('chart_news_search_empty', { symbol: ctx.symbol });
        }
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

    /* ---------- context changes inside a live conversation ---------- */

    /* §18.3. When the selection moves under an existing conversation the user
       is offered the choice rather than having one made for them — except for
       a different instrument, where continuing would be nonsense. */
    function noteContextChange(previous, next) {
      /* The divider belongs to a conversation the visitor can see, so the
         test for "is there a conversation" is the visible one. Keying it off
         the private history array meant the same thing in practice and made
         the rule impossible to check from outside. */
      if (!body.querySelector('.cp-msg')) return;
      const from = selectionLabel(previous) || 'no selection';
      const to = selectionLabel(next) || 'no selection';
      if (from === to) return;

      const div = h('<div class="cp-divider"></div>');
      div.textContent = `Chart context changed: ${from} → ${to}`;
      body.appendChild(div);

      const row = h('<div class="cp-divider-actions"></div>');
      const cont = h('<button type="button" class="cp-action">Continue with this candle</button>');
      const fresh = h('<button type="button" class="cp-action">Start a new thread</button>');
      cont.addEventListener('click', () => { row.remove(); input.focus(); });
      fresh.addEventListener('click', () => { row.remove(); startNewThread(); });
      row.appendChild(cont); row.appendChild(fresh);
      body.appendChild(row);
      scroll();
      track('chart_context_changed', { from, to });
    }

    function startNewThread(contextPatch) {
      history = [];
      body.querySelectorAll('.cp-msg, .cp-divider, .cp-divider-actions').forEach(n => n.remove());
      if (contextPatch) patch = { ...patch, ...contextPatch };
      paintChips(); paintSuggestions();
      track('copilot_thread_started', { page: context().page });
    }

    /* ---------- actions ---------- */

    const CHART_ACTIONS = new Set([
      'mark_chart_events', 'compare_selected_period', 'expand_selected_range',
      'create_event_alert', 'save_research', 'clear_chart_selection'
    ]);

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

        track('copilot_action_completed', { action: a.id, page: context().page });

        /* Chart actions are validated by the endpoint above and applied by the
           page that owns the chart. The panel asks; it does not reach into the
           renderer, and it does not draw anything the server refused.

           Nothing reports success before the page has actually done it — the
           §17.3 rule about alerts, applied to every chart action. */
        if (CHART_ACTIONS.has(a.id)) {
          const ev = new CustomEvent('copilot:chart-action', {
            detail: { id: a.id, payload: data, request: a.payload || {}, answer: lastAnswer }
          });
          document.dispatchEvent(ev);
          const result = ev.detail.result;
          if (result && result.error) {
            btn.disabled = false;
            btn.textContent = original;
            showError(result.error, '');
            return;
          }
          btn.textContent = '✓ ' + ((result && result.confirm) || data.confirm || original);
          return;
        }

        if (a.id === 'add_watchlist') {
          const list = jsonLs('watchlist', []);
          if (!list.includes(a.payload.symbol)) list.push(a.payload.symbol);
          setLs('watchlist', JSON.stringify(list));
        }
        /* The alert store owns alerts. The widget used to push a raw object
           into the same localStorage key, which left two shapes in one list
           and skipped the dedupe — §UI-002 all over again, one layer up. */
        if (a.id === 'create_alert') {
          if (window.Alerts?.create) {
            window.Alerts.create({
              symbol: a.payload.symbol,
              condition: a.payload.condition,
              value: a.payload.value ?? null,
              note: a.payload.note || 'proposed by the Copilot'
            });
          } else {
            const alerts = jsonLs('alerts', []);
            alerts.push({ ...a.payload, created_at: new Date().toISOString() });
            setLs('alerts', JSON.stringify(alerts));
          }
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

          track('copilot_to_chart', { from_page: context().page, symbol: data.symbol || '' });
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

    /* ---------- open / close ---------- */

    let docked = false;

    function open(opts) {
      const o = opts || {};
      const before = context().chartSelection;

      if (o.contextPatch) {
        const prevSymbol = patch.symbol;
        patch = { ...patch, ...o.contextPatch };
        /* A different instrument is a different subject: the brief's default
           is a new thread, and continuing would carry the wrong company into
           the next answer. */
        if (o.contextPatch.symbol && prevSymbol && o.contextPatch.symbol !== prevSymbol) {
          startNewThread();
        } else {
          noteContextChange(before, context().chartSelection);
        }
      }

      paintChips();
      paintSuggestions();

      if (docked) {
        if (onReveal) onReveal();
      } else {
        panel.classList.add('open');
        panel.setAttribute('aria-hidden', 'false');
      }
      track('copilot_opened', { page: context().page, reason: o.reason || 'user' });

      if (o.prefill) {
        input.value = o.prefill;
        if (o.autoSend === true) send(o.prefill);
      }
      /* Never send without a person pressing something. */
      try { input.focus(); } catch {}
    }

    function close() {
      if (docked) return;
      panel.classList.remove('open');
      panel.setAttribute('aria-hidden', 'true');
      /* Focus has to land somewhere deliberate, or it falls to the body and a
         keyboard user starts again from the top of the page. */
      const back = document.querySelector('[data-copilot-return]');
      if (back && back.focus) { try { back.focus(); } catch {} }
    }

    function updateContext(contextPatch) {
      if (!contextPatch) return;
      const before = context().chartSelection;
      patch = { ...patch, ...contextPatch };
      paintChips();
      paintSuggestions();
      noteContextChange(before, context().chartSelection);
    }

    /* Mount the panel inside a host element. The page owns the geometry from
       that point on: the chart gets a narrower area and redraws, instead of
       being covered by a fixed panel. */
    /* `onReveal` is how a docked panel gets shown: the host page owns the
       column, so `open()` has to ask it rather than toggle a class that means
       nothing here. Without it, every route into the Copilot — the header
       button, the FAB, a programmatic open — silently did nothing. */
    let onReveal = null;

    function mountInto(hostEl, reveal) {
      if (!hostEl) return;
      docked = true;
      onReveal = typeof reveal === 'function' ? reveal : null;
      panel.classList.add('cp-docked', 'open');
      panel.setAttribute('aria-hidden', 'false');
      hostEl.appendChild(panel);
      /* The floating button STAYS. Hiding it here was a mistake: docked, the
         Copilot lives behind one of three tabs and is not the active one, so
         removing the button removed the Copilot from the screen entirely. It
         is the affordance people know from every other page; on this one it
         reveals the docked panel instead of sliding a new one over the chart. */
      fab.hidden = false;
      fab.style.display = '';
      fab.setAttribute('aria-label', 'Show Research Copilot');
    }

    fab.addEventListener('click', () => open({ reason: 'fab' }));
    panel.querySelector('.cp-close').addEventListener('click', close);
    sendBtn.addEventListener('click', () => send(input.value));
    input.addEventListener('keydown', e => { if (e.key === 'Enter') send(input.value); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    paintChips();
    paintSuggestions();

    window.ResearchCopilot = {
      open, close, updateContext, startNewThread, mountInto,
      focusInput() { try { input.focus(); } catch {} },
      context,
      isDocked: () => docked,
      send,
      /* Exposed so the chart can render the same prompt list beside the chart
         without duplicating the wording. */
      CANDLE_PROMPTS, RANGE_PROMPTS, NO_SELECTION_HINT
    };
    document.dispatchEvent(new CustomEvent('copilot-ready'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
