/* =========================================================================
   Alert store — one place, shared by every surface that touches an alert.

   §UI-002. "Create an alert" on the asset hub opened the Copilot panel. So did
   "Ask the Copilot", the button next to it. Two different promises, one
   behaviour, and neither of them created an alert — the alerts list on
   /capital stayed empty no matter how many times you pressed it.

   This is the smallest honest fix: alerts are real objects with a symbol, a
   condition and a threshold; they persist; they show up wherever alerts are
   listed; and they can be removed. What they do not do is fire — nothing here
   watches the market on your behalf, and the UI says so rather than implying
   a notification will arrive.
   ========================================================================= */

window.Alerts = (function () {

  const KEY = 'alerts';

  const read = () => {
    try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; }
    catch { return []; }
  };
  const write = list => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {} };

  const CONDITIONS = {
    above:  'rises above',
    below:  'falls below',
    move:   'moves more than',
    event:  'has a scheduled event',
    /* Added with the chart Copilot: the two things a person asks for after
       reading why a candle moved are "tell me before the next one of those"
       and "tell me if this volume happens again". Both are conditions about an
       event rather than about a price level, so they belong in the same store
       rather than in a second list somewhere. */
    volume: 'trades at unusual volume'
  };

  const list = () => read();
  const forSymbol = symbol => read().filter(a => a.symbol === symbol);

  function create({ symbol, condition, value, note, context }) {
    if (!symbol || !CONDITIONS[condition]) return null;
    const all = read();
    /* The same alert twice is a mistake, not an intention. */
    const dup = all.find(a => a.symbol === symbol && a.condition === condition && a.value === value);
    if (dup) return dup;

    const alert = {
      id: 'al_' + Math.random().toString(36).slice(2, 10),
      symbol, condition, value: value ?? null,
      note: note || '',
      /* Which candle or period the alert came out of. Six weeks later "why did
         I set this?" is the question, and the answer is worth one string. */
      context: context || null,
      createdAt: new Date().toISOString(),
      /* Honest by construction: nothing polls the market for this, so the
         alert is armed in the prototype's sense only. */
      state: 'armed_in_prototype'
    };
    all.push(alert);
    write(all);
    window.Portal?.track?.('alert_created', { symbol, condition, value });
    window.Portal?.meaningful?.('alert_created', { symbol });
    document.dispatchEvent(new CustomEvent('alerts-changed', { detail: { alert } }));
    return alert;
  }

  function remove(id) {
    const all = read().filter(a => a.id !== id);
    write(all);
    window.Portal?.track?.('alert_removed', { id });
    document.dispatchEvent(new CustomEvent('alerts-changed', { detail: { removed: id } }));
    return all;
  }

  const describe = a => {
    const what = CONDITIONS[a.condition] || a.condition;
    return a.value != null ? `${a.symbol} ${what} ${a.value}` : `${a.symbol} ${what}`;
  };

  /* The dialog. Deliberately three fields and one sentence of disclosure —
     an alert nobody understands is an alert nobody trusts. */
  function open(symbol, price) {
    if (document.querySelector('.alert-back')) return;

    const back = document.createElement('div');
    back.className = 'alert-back';
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-modal', 'true');
    back.setAttribute('aria-label', 'Create an alert');
    back.innerHTML = `<div class="alert-box">
      <div class="hd"><b>Alert on ${symbol}</b><button type="button" class="x" aria-label="Close">✕</button></div>
      <div class="filters mt-16">
        <div class="f"><label for="alCond">When the price</label>
          <select id="alCond">
            <option value="above">rises above</option>
            <option value="below">falls below</option>
            <option value="move">moves more than (%)</option>
          </select></div>
        <div class="f"><label for="alVal">Value</label>
          <input type="number" id="alVal" step="any" value="${Number.isFinite(price) ? price : ''}"></div>
      </div>
      <div class="f mt-16"><label for="alNote">Why you are watching this (optional)</label>
        <input type="text" id="alNote" maxlength="140" placeholder="e.g. waiting for it to come back to the range"></div>
      <div class="row mt-16" style="gap:8px;flex-wrap:wrap">
        <button type="button" class="btn btn-primary" id="alSave">Create alert</button>
        <button type="button" class="btn btn-quiet" id="alCancel">Cancel</button>
      </div>
      <div class="mono" style="font-size:11px;color:var(--tv-orange);margin-top:14px;line-height:1.6">
        Prototype: the alert is saved on this device and appears in your alerts list. Nothing
        watches the market for you and no notification will be sent.
      </div>
    </div>`;
    document.body.appendChild(back);

    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);

    back.addEventListener('click', e => {
      if (e.target === back || e.target.closest('.x') || e.target.closest('#alCancel')) return close();
      if (!e.target.closest('#alSave')) return;
      const condition = back.querySelector('#alCond').value;
      const raw = back.querySelector('#alVal').value;
      const value = raw === '' ? null : Number(raw);
      if (value === null || Number.isNaN(value)) {
        back.querySelector('#alVal').focus();
        return;
      }
      create({ symbol, condition, value, note: back.querySelector('#alNote').value.trim() });
      close();
    });

    back.querySelector('#alVal').focus();
  }

  return { list, forSymbol, create, remove, describe, open, CONDITIONS };
})();
