/* =========================================================================
   Economy hub (§19).

   The fourth domain. It answers three questions and refuses to answer more
   than it can:

       Which event happened?
       How did the indicator change?
       Which markets and instruments did it touch?

   WHAT IS REAL HERE

   The instruments are live. `US10Y`, `VIX`, `DXY` and `GOLD` come from the
   same market layer as every other page, with the same honest `ok:false` when
   the provider is down. The historical reaction is real too: it reads the
   OHLCV history endpoint and shows what the named instrument actually did
   around the event date, rather than a sentence about what usually happens.

   WHAT IS NOT

   The calendar is a fixed pilot with two dated entries. Countries, indicators,
   GDP, employment, yield curves, dividends, IPOs and country comparison are
   MAPPED: the architecture and the address exist, the data feed does not.
   They are rendered as visible mapped entries rather than omitted, because a
   reviewer needs to see where they would live — and rendered as mapped rather
   than filled with invented numbers, because inventing macro data is the one
   thing this hub must never do.
   ========================================================================= */

(function () {
  const $ = id => document.getElementById(id);
  const P = window.Portal;
  const Q = window.Quotes;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ------------------------------------------------------------ the pilot

     Two events, dated, each naming the instruments it historically touched.
     "Historically touched" is a probability and is labelled as one; the hub
     never says an event will move anything. */
  const EVENTS = [
    {
      id: 'fomc', title: 'FOMC rate decision', when: 'Next scheduled meeting',
      impact: 'high', country: 'United States',
      what: 'The US central bank sets its policy rate. The decision itself matters less than the wording that comes with it.',
      classes: ['rates', 'indices', 'crypto'],
      symbols: ['US10Y', 'GOLD', 'BTCUSD'],
      reaction: 'US10Y'
    },
    {
      id: 'cpi', title: 'US CPI release', when: 'This week',
      impact: 'high', country: 'United States',
      what: 'Consumer prices for the month. It is the number the rate decision is arguing about.',
      classes: ['rates', 'crypto', 'forex'],
      symbols: ['BTCUSD', 'DXY', 'US10Y'],
      reaction: 'BTCUSD'
    }
  ];

  /* The instruments the brief leads with — the four a macro reader checks
     first, and all four exist in the 49-instrument universe. */
  const BRIEF = ['US10Y', 'VIX', 'DXY', 'GOLD'];

  /* Mapped modules: address and architecture now, data later. Each one says
     what it would contain and what it would need. */
  const MAPPED = [
    ['countries',  'Countries',       'One page per country: policy rate, inflation, GDP, employment, currency and the instruments that track it.', 'a macro data feed'],
    ['indicators', 'Macro Indicators','Every published series with its release schedule, revisions and the market reaction to each print.', 'a macro data feed'],
    ['curves',     'Yield Curves',    'The whole curve rather than one tenor, with the shape compared against its own history.', 'full-curve yield data'],
    ['dividends',  'Dividends',       'Who pays, when the record date falls, and what the yield is against the current price.', 'a corporate-actions feed'],
    ['ipo',        'IPO Calendar',    'Upcoming listings with the price range, the float and the lock-up expiry.', 'a listings feed'],
    ['compare',    'Country Compare', 'Two or more countries on the same axes — rates, inflation, growth, employment.', 'a macro data feed']
  ];

  /* --------------------------------------------------------------- chrome */

  /* Every module carries the same four facts, in the same place: what it is,
     how mature it is, where the numbers came from and when. A module that
     cannot say all four does not get to look like one that can. */
  function head(title, maturity, source, stamp) {
    const tone = maturity === 'LIVE' ? 'tag-ok' : 'tag-warn';
    return `<div class="row" style="justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
        <h2 style="font-size:20px;font-weight:700;color:var(--tv-white);margin:0">${esc(title)}</h2>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <span class="tag ${tone}">${esc(maturity)}</span>
          <span class="mono" style="font-size:10px;color:var(--tv-ghost)">${esc(source)}${stamp ? ' · ' + esc(stamp) : ''}</span>
        </div>
      </div>`;
  }

  const impactTag = i => i === 'high'
    ? '<span class="mono" style="font-size:10px;color:var(--tv-orange);letter-spacing:.08em">HIGH IMPACT</span>'
    : '<span class="mono" style="font-size:10px;color:#5B8DFF;letter-spacing:.08em">SCHEDULED</span>';

  /* ---------------------------------------------------------------- state */

  let selected = EVENTS[0].id;
  const event = () => EVENTS.find(e => e.id === selected) || EVENTS[0];
  const mode = () => P?.mode?.() || 'simple';

  /* --------------------------------------------------------------- brief */

  async function paintBrief() {
    const box = $('econBrief');
    if (!box) return;
    box.innerHTML = `${head('Economy Brief', 'LIVE', 'market layer', '')}
      <div class="mono mt-16" style="font-size:11.5px;color:var(--tv-faint)">Loading the four instruments a macro reader checks first…</div>`;

    let snap = null;
    try { snap = await Q.snapshot(); } catch { /* handled below */ }

    if (!snap || !snap.items) {
      box.innerHTML = `${head('Economy Brief', 'LIVE', 'market layer', '')}
        <div class="mt-16" style="font-size:13.5px;color:var(--tv-muted)">
          The market layer did not answer. Nothing is shown rather than a stale number
          presented as a current one.</div>`;
      return;
    }

    const rows = BRIEF.map(sym => snap.items.find(i => i.symbol === sym)).filter(Boolean);
    const stamp = snap.captured_at ? Q.ago(snap.captured_at) : '';

    box.innerHTML = `${head('Economy Brief', 'LIVE', snap.isSample ? 'bundled snapshot' : 'Yahoo Finance', stamp)}
      <div style="font-size:13.5px;color:var(--tv-muted);margin-top:10px;line-height:1.6"
        data-explain-level="context">Rates, volatility, the dollar and gold. Between them they
        describe most of what a macro headline is about to move.</div>
      <div class="stubs mt-16">${rows.map(i => `
        <div class="tv-card">
          <div class="mono" style="font-size:10.5px;color:var(--tv-faint);letter-spacing:.08em">${esc(i.symbol)}</div>
          <p class="title mt-16" style="margin-bottom:4px">${esc(i.name || i.symbol)}</p>
          <div class="row" style="justify-content:space-between;align-items:baseline;gap:10px">
            <span class="mono" style="font-size:18px;color:var(--tv-white)">${Q.price(i)}</span>
            <span class="mono" style="font-size:13px">${Q.pct(i)}</span>
          </div>
          <div class="row mt-16" style="gap:8px">
            <a class="btn btn-quiet" href="/symbols/${esc(i.symbol)}" style="padding:7px 12px;font-size:12px">Open</a>
            <a class="btn btn-quiet" href="/charts?symbol=${esc(i.symbol)}" style="padding:7px 12px;font-size:12px">Chart</a>
          </div>
        </div>`).join('')}</div>`;
  }

  /* -------------------------------------------------------------- events */

  function paintEvents() {
    const box = $('econEvents');
    if (!box) return;
    const m = mode();
    box.innerHTML = `${head('Upcoming Economic Events', 'PILOT', 'fixed examples — no calendar feed is connected', '')}
      <div style="font-size:13.5px;color:var(--tv-muted);margin-top:10px;line-height:1.6"
        data-explain-level="context">Two dated entries, kept deliberately small. Selecting one
        changes what the three modules below are about.</div>
      <div class="stubs mt-16">${EVENTS.map(e => `
        <div class="tv-card" data-event="${esc(e.id)}"
          style="cursor:pointer;${e.id === selected ? 'border-color:#2962FF' : ''}">
          <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap">
            ${impactTag(e.impact)}
            <span class="mono" style="font-size:10px;color:var(--tv-ghost)">${esc(e.when)}</span>
          </div>
          <p class="title mt-16" style="margin-bottom:4px">${esc(e.title)}</p>
          <div style="font-size:13px;color:var(--tv-muted);line-height:1.55">${esc(e.what)}</div>
          <div class="mono mt-16" style="font-size:10.5px;color:var(--tv-faint)">
            ${esc(e.country)} · historically touches ${e.symbols.map(esc).join(' · ')}</div>
          ${m === 'simple' ? `<div class="mono" style="font-size:10.5px;color:var(--tv-ghost);margin-top:8px">
            "historically" is a probability, not a rule</div>` : ''}
        </div>`).join('')}</div>`;

    box.querySelectorAll('[data-event]').forEach(card =>
      card.addEventListener('click', () => {
        selected = card.dataset.event;
        P?.track?.('economy_event_selected', { event: selected, mode: mode() });
        paintEvents(); paintImpact(); paintReaction(); paintWhy();
      }));
  }

  /* --------------------------------------------------------------- rates */

  async function paintRates() {
    const box = $('econRates');
    if (!box) return;
    let item = null;
    try {
      const snap = await Q.snapshot();
      item = snap?.items?.find(i => i.symbol === 'US10Y') || null;
    } catch { /* handled below */ }

    box.innerHTML = `${head('Rates and Inflation', item ? 'PARTLY LIVE' : 'MAPPED',
        item ? 'US10Y is live · policy rates and CPI are not connected' : 'no macro feed', '')}
      <div style="font-size:13.5px;color:var(--tv-muted);margin-top:10px;line-height:1.6"
        data-explain-level="context">The ten-year yield is a market price, so it is here and it is
        real. The policy rate and the inflation print are published numbers, and this stand has no
        feed for them — so they are named, not guessed.</div>
      ${item ? `<div class="tv-card mt-16">
        <div class="row" style="justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">
          <div><p class="title" style="margin:0">${esc(item.name || 'US 10-year yield')}</p>
            <div class="mono" style="font-size:10.5px;color:var(--tv-faint);margin-top:4px">US10Y · live</div></div>
          <div class="row" style="gap:14px;align-items:baseline">
            <span class="mono" style="font-size:20px;color:var(--tv-white)">${Q.price(item)}</span>
            <span class="mono" style="font-size:13px">${Q.pct(item)}</span>
          </div>
        </div>
      </div>` : ''}
      <div class="tv-card mt-16">
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <span class="tag tag-warn">MAPPED</span>
          <span class="mono" style="font-size:10.5px;color:var(--tv-ghost)">central-bank rates · CPI · PPI · core measures</span>
        </div>
        <div style="font-size:13px;color:var(--tv-muted);margin-top:10px;line-height:1.55">
          Would carry each central bank's current rate, the date of the next decision, and the
          inflation series the decision is responding to. Needs a macro data feed.</div>
      </div>`;
  }

  /* ----------------------------------------------------------------- why */

  function paintWhy() {
    const box = $('econWhy');
    if (!box) return;
    const e = event();
    box.innerHTML = `${head('Why Markets Moved', 'PILOT', 'reasoning is stated, not modelled', '')}
      <div class="tv-card mt-16">
        <div class="mono" style="font-size:10.5px;color:var(--tv-faint);letter-spacing:.08em">
          EVENT → FACTOR → MARKET</div>
        <p class="title mt-16" style="margin-bottom:6px">${esc(e.title)}</p>
        <div style="font-size:13.5px;color:var(--tv-muted);line-height:1.6">${esc(e.what)}</div>
        <div class="mono mt-16" style="font-size:11px;color:var(--tv-ghost);line-height:1.7">
          This is a stated relationship, not a computed one. The hub does not claim to have
          measured that this event caused a move — it names which instruments have historically
          been sensitive to it, and gives you the chart to check.</div>
        <div class="row mt-16" style="gap:8px;flex-wrap:wrap">
          <a class="btn btn-quiet" href="/overview#why" style="padding:8px 14px;font-size:12.5px">Today's moves and their factors →</a>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------- impact */

  async function paintImpact() {
    const mkBox = $('econMarkets');
    const symBox = $('econSymbols');
    if (!mkBox || !symBox) return;
    const e = event();

    const CLASS_LABEL = {
      rates: 'Bonds & volatility', indices: 'Indices', crypto: 'Crypto',
      forex: 'Forex', stocks: 'Stocks', commodities: 'Futures & commodities'
    };

    mkBox.innerHTML = `${head('Affected Markets', 'PILOT', 'classes named per event', '')}
      <div class="row mt-16" style="gap:8px;flex-wrap:wrap">
        ${e.classes.map(c => `<a class="btn btn-quiet" href="/markets?cls=${esc(c)}"
          style="padding:8px 14px;font-size:12.5px">${esc(CLASS_LABEL[c] || c)} →</a>`).join('')}
      </div>
      <div class="mono" style="font-size:10.5px;color:var(--tv-ghost);margin-top:12px">
        each opens the Market domain filtered to that class</div>`;

    symBox.innerHTML = `${head('Affected Symbols', 'LIVE', 'quotes from the market layer', '')}
      <div class="mono mt-16" style="font-size:11.5px;color:var(--tv-faint)">Loading…</div>`;

    let snap = null;
    try { snap = await Q.snapshot(); } catch { /* handled below */ }
    const items = (snap?.items || []).filter(i => e.symbols.includes(i.symbol));

    symBox.innerHTML = `${head('Affected Symbols', items.length ? 'LIVE' : 'UNAVAILABLE',
        items.length ? (snap.isSample ? 'bundled snapshot' : 'Yahoo Finance') : 'the market layer did not answer',
        snap?.captured_at ? Q.ago(snap.captured_at) : '')}
      ${items.length ? `<div class="tv-card mt-16" style="padding:0;overflow-x:auto">
        <table class="q-table"><thead><tr>
          <th style="text-align:left">Symbol</th><th style="text-align:left">Name</th>
          <th style="text-align:right">Price</th><th style="text-align:right">Today</th>
          <th></th></tr></thead>
        <tbody>${items.map(i => `<tr>
          <td class="mono">${esc(i.symbol)}</td>
          <td>${esc(i.name || '')}</td>
          <td class="mono" style="text-align:right">${Q.price(i)}</td>
          <td class="mono" style="text-align:right">${Q.pct(i)}</td>
          <td style="text-align:right"><a href="/charts?symbol=${esc(i.symbol)}">Chart</a></td>
        </tr>`).join('')}</tbody></table></div>`
      : `<div class="mt-16" style="font-size:13.5px;color:var(--tv-muted)">
          No quotes to show. The instruments are named above; nothing is invented to fill the table.</div>`}`;
  }

  /* ------------------------------------------------------------ reaction

     The one module here that is genuinely computed. It reads the same OHLCV
     history the chart reads, and shows what the instrument actually did over
     the last month — which is the honest version of "how markets react to
     this event": here is the record, look at it yourself. */
  async function paintReaction() {
    const box = $('econReaction');
    if (!box) return;
    const e = event();
    const sym = e.reaction;

    box.innerHTML = `${head('Historical Reaction', 'LIVE', 'OHLCV history endpoint', '')}
      <div class="mono mt-16" style="font-size:11.5px;color:var(--tv-faint)">Reading ${esc(sym)} history…</div>`;

    let data = null;
    try {
      const r = await fetch(`/api/market/history/${encodeURIComponent(sym)}?interval=1d&range=1mo`);
      if (r.ok) data = await r.json();
    } catch { /* handled below */ }

    const candles = (data && data.ok !== false && Array.isArray(data.candles)) ? data.candles : [];
    if (candles.length < 2) {
      box.innerHTML = `${head('Historical Reaction', 'UNAVAILABLE', 'history endpoint did not answer', '')}
        <div class="mt-16" style="font-size:13.5px;color:var(--tv-muted)">
          ${esc(sym)} history is not available right now. There is no fallback narrative here:
          without the candles there is nothing honest to say about the reaction.</div>`;
      return;
    }

    const first = candles[0], last = candles[candles.length - 1];
    const chg = ((last.close - first.close) / first.close) * 100;
    const hi = Math.max(...candles.map(c => c.high));
    const lo = Math.min(...candles.map(c => c.low));
    const colour = chg >= 0 ? 'var(--tv-green,#26A69A)' : 'var(--tv-red,#EF5350)';

    box.innerHTML = `${head('Historical Reaction', 'LIVE', 'OHLCV history · ' + esc(sym), candles.length + ' sessions')}
      <div style="font-size:13.5px;color:var(--tv-muted);margin-top:10px;line-height:1.6"
        data-explain-level="context">What ${esc(sym)} has actually done over the last month. This is
        the record, not a forecast — the event above is a reason to read it, not a prediction of
        where it goes next.</div>
      <div class="tv-card mt-16">
        <div class="row" style="gap:24px;flex-wrap:wrap">
          <div><div class="mono" style="font-size:10px;color:var(--tv-faint)">ONE MONTH</div>
            <div class="mono" style="font-size:20px;color:${colour};margin-top:4px">${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%</div></div>
          <div><div class="mono" style="font-size:10px;color:var(--tv-faint)">HIGH</div>
            <div class="mono" style="font-size:16px;color:var(--tv-white);margin-top:6px">${hi.toFixed(2)}</div></div>
          <div><div class="mono" style="font-size:10px;color:var(--tv-faint)">LOW</div>
            <div class="mono" style="font-size:16px;color:var(--tv-white);margin-top:6px">${lo.toFixed(2)}</div></div>
          <div><div class="mono" style="font-size:10px;color:var(--tv-faint)">SESSIONS</div>
            <div class="mono" style="font-size:16px;color:var(--tv-white);margin-top:6px">${candles.length}</div></div>
        </div>
        <div class="row mt-16" style="gap:8px;flex-wrap:wrap">
          <a class="btn btn-secondary" href="/charts?symbol=${esc(sym)}" style="padding:8px 14px;font-size:12.5px">
            Open the chart and ask about a day →</a>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------ earnings */

  function paintEarnings() {
    const box = $('econEarnings');
    if (!box) return;
    box.innerHTML = `${head('Earnings Calendar', 'MAPPED', 'no corporate-actions feed', '')}
      <div class="tv-card mt-16">
        <div style="font-size:13.5px;color:var(--tv-muted);line-height:1.6">
          Who reports and when, filterable by the instruments you follow, with the previous
          reaction attached to each name. The global calendar belongs to Economy; the earnings
          entry for one ticker belongs to that ticker's page, and both read the same source.</div>
        <div class="row mt-16" style="gap:8px;flex-wrap:wrap">
          <a class="btn btn-quiet" href="/symbols/NVDA?tab=events" style="padding:8px 14px;font-size:12.5px">
            See the per-symbol version →</a>
        </div>
        <div class="mono" style="font-size:10.5px;color:var(--tv-ghost);margin-top:12px">
          needs a corporate-actions feed</div>
      </div>`;
  }

  /* -------------------------------------------------------------- mapped */

  function paintMapped() {
    const box = $('econMapped');
    if (!box) return;
    const m = mode();
    /* Professional opens this on arrival; the other two get a door. Either
       way the entries exist and carry their own anchor, so a link from the
       menu lands on the right one. */
    const open = m === 'pro';
    box.innerHTML = `<details class="advanced" id="mappedFold"${open ? ' open' : ''}>
        <summary>Mapped, not built — ${MAPPED.length} more areas of Economy <span class="n">${MAPPED.length}</span></summary>
        <div class="body">
          <div class="mono" style="font-size:10.5px;color:var(--tv-ghost);line-height:1.7;margin-bottom:12px">
            These have an address and a place in the architecture. They do not have data. They are
            shown so the shape of the domain can be reviewed — and shown as mapped, because filling
            them with invented macro numbers would make the whole hub unreadable as evidence.</div>
          <div class="stubs">${MAPPED.map(([id, title, what, needs]) => `
            <div class="tv-card" id="${esc(id)}">
              <div class="row" style="gap:8px;flex-wrap:wrap">
                <span class="tag tag-warn">MAPPED</span>
              </div>
              <p class="title mt-16" style="margin-bottom:4px">${esc(title)}</p>
              <div style="font-size:13px;color:var(--tv-muted);line-height:1.55">${esc(what)}</div>
              <div class="mono mt-16" style="font-size:10.5px;color:var(--tv-ghost)">needs ${esc(needs)}</div>
            </div>`).join('')}</div>
        </div>
      </details>`;

    box.querySelector('#mappedFold')?.addEventListener('toggle', ev => {
      P?.track?.(ev.target.open ? 'temporary_advanced_opened' : 'temporary_advanced_closed',
        { surface: 'economy_mapped', mode: mode() });
    });
  }

  /* ---------------------------------------------------------------- mode */

  /* §16 — the mode composes the page. Simple leads with what an event means;
     Professional leads with the calendar and the record. The modules are the
     same modules and the same data — only the order and the folding move, and
     the module nodes are re-ordered rather than re-rendered so nothing that
     was loaded has to load again. */
  const ORDERS = {
    simple:   ['events', 'why', 'brief', 'markets', 'symbols', 'rates', 'reaction', 'earnings', 'mapped'],
    standard: ['brief', 'events', 'rates', 'why', 'markets', 'symbols', 'reaction', 'earnings', 'mapped'],
    pro:      ['events', 'reaction', 'rates', 'brief', 'markets', 'symbols', 'why', 'earnings', 'mapped']
  };

  function applyMode() {
    const m = mode();
    const host = $('econModules');
    if (!host) return;
    const order = ORDERS[m] || ORDERS.simple;
    for (const id of order) {
      const node = host.querySelector(`[data-module="${id}"]`);
      if (node) host.appendChild(node);   // moves, never re-creates
    }
    document.body.dataset.economyMode = m;
    $('econLead').textContent = {
      simple: 'Start with what is scheduled, then read what it usually touches.',
      standard: 'The macro picture, the calendar, and the instruments each event reaches.',
      pro: 'Calendar and record first. The narrative modules are below them.'
    }[m] || '';
    P?.applyExplain?.(window.Modes?.policy(m).explanationDepth);
  }

  /* --------------------------------------------------------------- boot */

  function boot() {
    paintEvents();
    paintWhy();
    paintEarnings();
    paintMapped();
    paintBrief();
    paintRates();
    paintImpact();
    paintReaction();
    applyMode();

    document.addEventListener('ui-mode-changed', () => {
      applyMode();
      paintEvents();
      paintWhy();
      paintMapped();
    });

    /* §29 — Economy's state adapter. Which event is selected and whether the
       mapped fold is open are page state, and a recomposition must not reset
       either of them. */
    window.ModeOrchestrator?.registerStateAdapter('economy', {
      capture: () => ({
        event: selected,
        mappedOpen: !!$('mappedFold')?.open,
        scroll: window.scrollY
      }),
      restore(own) {
        if (!own) return;
        if (own.event && EVENTS.some(e => e.id === own.event)) {
          selected = own.event;
          paintEvents(); paintImpact(); paintReaction(); paintWhy();
        }
        const fold = $('mappedFold');
        if (fold) fold.open = !!own.mappedOpen;
        if (typeof own.scroll === 'number') window.scrollTo({ top: own.scroll });
      }
    });

    P?.pushJourney?.({
      from: P.lastKind?.() || 'entry', to: 'economy',
      rule: 'open_economy', label: 'The macro picture'
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
