/* =========================================================================
   Strategic Feature Registry — the single source for what is new here.

   The previous phase solved hierarchy and, in doing so, hid the innovation:
   ninety-five navigation entries all labelled live/pilot/mapped, and not one
   of them saying "this is a new product idea". This registry is the fix. Every
   badge, launchpad card, contextual promo, palette entry and coverage test
   reads from here — §VIS-001 forbids a second copy on each page.

   status  — what the visitor is actually getting:
     new       a new capability that works here
     beta      works, incomplete
     concept   a strategic idea shown honestly as a prototype, not a product
     premium   a paid tier, shown as a concept with an interest signal
     improved  a major enhancement of an existing journey

   The distinction between `new` and `concept` is the one that matters most:
   a stand that dresses an idea up as a working feature is worse than one that
   has fewer features.
   ========================================================================= */

window.Features = (function () {

  const F = [
    {
      id: 'NEW-01', name: 'Simple Mode + Guided Academy', shortName: 'Guided Academy',
      /* §25 — the mode changes prominence, never maturity and never access. */
      modeRole: { simple: 'flagship', standard: 'contextual', pro: 'advanced' },
      prominence: 'flagship', maturity: 'beta', releaseMarker: 'new', commercialTier: 'included', priority: 'strategic', icon: '◔',
      problem: 'A first-time visitor is handed a professional terminal and no idea what to do with it.',
      solution: 'A simplified mode plus six guided steps that happen inside the product, on live data, each ending in a real action.',
      audience: 'Someone who has never invested',
      route: '/learn/academy',
      surfaces: ['home', 'megaMenu', 'commandPalette', 'search', 'academy', 'whatsNew', 'showcase', 'onboarding'],
      related: ['NEW-02', 'NEW-07'],
      metric: 'Academy completion · Simple → Standard conversion',
      depth: 4, searchTerms: 'learn beginner start course tutorial academy teach me how to begin first steps'
    },
    {
      id: 'NEW-02', name: 'Personal Research Copilot', shortName: 'Research Copilot',
      /* §25 — the mode changes prominence, never maturity and never access. */
      modeRole: { simple: 'flagship', standard: 'contextual', pro: 'contextual' },
      prominence: 'flagship', maturity: 'beta', releaseMarker: 'new', commercialTier: 'included', priority: 'strategic', icon: '✦',
      problem: 'Research means opening eight tabs and holding the thread in your head.',
      solution: 'One AI research surface on every page: it knows your level, the page, the symbol, the period and where you have been, answers in words, cites sources and proposes actions you confirm.',
      audience: 'Everyone, at every level',
      route: '/research#search',
      surfaces: ['home', 'megaMenu', 'commandPalette', 'search', 'assetHub', 'chart', 'screener', 'portfolio', 'academy', 'whatsNew', 'showcase'],
      related: ['NEW-06', 'NEW-01'],
      metric: 'Copilot action completion rate',
      depth: 4, searchTerms: 'ai assistant copilot ask a question research explain analyse chat'
    },
    {
      id: 'NEW-03', name: 'TradingView Everywhere', shortName: 'Everywhere',
      /* §25 — the mode changes prominence, never maturity and never access. */
      modeRole: { simple: 'concept', standard: 'concept', pro: 'advanced' },
      prominence: 'concept', maturity: 'concept', releaseMarker: 'new', commercialTier: null, priority: 'strategic', icon: '⇥',
      problem: 'Research starts in a Telegram card, an article or an embedded chart, and every entry throws the context away at the door.',
      solution: 'A deep link carries the symbol, the timeframe, the event and the original question, so the portal opens where the reading left off.',
      audience: 'Anyone arriving from outside',
      route: '/new/everywhere',
      surfaces: ['whatsNew', 'showcase', 'commandPalette', 'search'],
      related: ['NEW-02', 'NEW-04'],
      metric: 'External context restored · entry → research action',
      depth: 3, searchTerms: 'deep link telegram embed widget share context open from outside integration'
    },
    {
      id: 'NEW-04', name: 'GEO / AEO — answerable pages', shortName: 'GEO / AEO',
      /* §25 — the mode changes prominence, never maturity and never access. */
      modeRole: { simple: 'concept', standard: 'concept', pro: 'concept' },
      prominence: 'concept', maturity: 'prototype', releaseMarker: 'improved', commercialTier: null, priority: 'strategic', icon: '⌖',
      problem: 'Generative search answers financial questions from pages that were written for crawlers, not for people.',
      solution: 'Public pages answer one question directly: short answer, explanation, source, update time, and a link into a real research action.',
      audience: 'Anyone who asks an AI before asking a platform',
      route: '/new/geo-aeo',
      surfaces: ['whatsNew', 'showcase', 'commandPalette', 'search'],
      related: ['NEW-03', 'NEW-02'],
      metric: 'AI citations · referral → research action',
      depth: 2, searchTerms: 'seo geo aeo answer engine llm citation faq schema structured data'
    },
    {
      id: 'NEW-05', name: 'Personal Wealth Hub', shortName: 'My Money', userFacingName: 'My Money',
      /* §25 — the mode changes prominence, never maturity and never access. */
      modeRole: { simple: 'flagship', standard: 'flagship', pro: 'advanced' },
      prominence: 'flagship', maturity: 'beta', releaseMarker: 'new', commercialTier: 'included', priority: 'strategic', icon: '◈',
      problem: 'Most people need to understand everyday money long before they need a portfolio terminal — and the platform only ever asked about instruments.',
      solution: 'A personal-finance workspace: income, expenses, cash flow, categories, goals, a reserve and net worth — which opens education, then practice, then market research, only as each becomes relevant.',
      audience: 'Anyone who wants to understand their own money — including people who do not invest and may never want to',
      route: '/money',
      surfaces: ['home', 'megaMenu', 'commandPalette', 'search', 'portfolio', 'today', 'copilot', 'whatsNew', 'showcase'],
      related: ['NEW-06', 'NEW-07'],
      metric: 'Wealth profile created · scenario saved',
      depth: 4, searchTerms: 'wealth savings deposit cash net worth capital allocation goal money i have'
    },
    {
      id: 'NEW-06', name: 'AI Private', shortName: 'AI Private',
      /* §25 — the mode changes prominence, never maturity and never access. */
      modeRole: { simple: 'advanced', standard: 'contextual', pro: 'flagship' },
      prominence: 'concept', maturity: 'concept', releaseMarker: 'new', commercialTier: 'premium', priority: 'strategic', icon: '◆',
      problem: 'Deep research — statements, scenarios, portfolio risk — takes an analyst, and most private investors do not have one.',
      solution: 'A premium research tier: multi-step company analysis, scenario work, portfolio risk review and hypotheses that update themselves when the facts change.',
      audience: 'Affluent private investors',
      route: '/research/ai-private',
      surfaces: ['whatsNew', 'showcase', 'assetHub', 'portfolio', 'copilot', 'commandPalette', 'search'],
      related: ['NEW-02', 'NEW-05'],
      metric: 'Interest signal · sample report opened',
      depth: 2, searchTerms: 'premium subscription analyst deep research private tier paid report'
    },
    {
      id: 'NEW-07', name: 'Expert Marketplace', shortName: 'Expert Marketplace',
      /* §25 — the mode changes prominence, never maturity and never access. */
      modeRole: { simple: 'flagship', standard: 'contextual', pro: 'advanced' },
      prominence: 'flagship', maturity: 'prototype', releaseMarker: 'new', commercialTier: null, priority: 'strategic', icon: '◉',
      problem: 'At some point a person needs a human — and the internet offers them an unlicensed one with a course to sell.',
      solution: 'Advisers matched to country, capital and question, with explicit control over what context is shared and a standardised written result. Licence and jurisdiction are shown on every profile — and in this prototype they are demo records, checked against no registry.',
      audience: 'Anyone who has hit the limit of doing it alone',
      route: '/capital/experts',
      surfaces: ['home', 'megaMenu', 'commandPalette', 'search', 'assetHub', 'portfolio', 'wealthHub', 'academy', 'copilot', 'whatsNew', 'showcase'],
      related: ['NEW-05', 'NEW-02'],
      metric: 'Matching completed · booking · repeat booking',
      depth: 5, searchTerms: 'expert experts adviser advisor consultant human help me licensed professional talk to someone marketplace book a call financial adviser'
    },
    {
      id: 'NEW-08', name: 'Community Rewards', shortName: 'Community Rewards',
      /* §25 — the mode changes prominence, never maturity and never access. */
      modeRole: { simple: 'contextual', standard: 'contextual', pro: 'advanced' },
      prominence: 'concept', maturity: 'concept', releaseMarker: 'new', commercialTier: null, priority: 'strategic', icon: '◇',
      problem: 'Store, gifts, referrals and the education programme are four disconnected links that add up to no loop at all.',
      solution: 'One reward system with clear earning rules, history and progress — for ideas, teaching, referrals and Pine work.',
      audience: 'Creators and the people who bring others in',
      route: '/community/rewards',
      surfaces: ['megaMenu', 'commandPalette', 'search', 'community', 'academy', 'whatsNew', 'showcase'],
      related: ['NEW-01'],
      metric: 'Reward earned · referral → activation',
      depth: 2, searchTerms: 'rewards points referral gifts store loyalty earn creator programme'
    },

    {
      id: 'TUNE-10', name: 'Chart Research Copilot', shortName: 'Chart Copilot',
      /* §25 — the mode changes prominence, never maturity and never access. */
      modeRole: { simple: 'contextual', standard: 'flagship', pro: 'flagship' },
      prominence: 'flagship', maturity: 'beta', releaseMarker: 'new', commercialTier: 'included',
      priority: 'strategic', icon: '◫',
      problem: 'A chart shows what the price did and never what happened. To find out, a person leaves the chart, opens a search engine and tries to remember which day they were looking at.',
      solution: 'Select any candle or period and ask what happened. The Copilot sees the exact session, searches around that date rather than today, separates company, sector and macro factors, shows dated sources, and puts the events it found back on the chart.',
      audience: 'Anyone who has looked at a chart and wondered why',
      route: '/charts',
      surfaces: ['chart', 'whatsNew', 'showcase', 'commandPalette', 'search', 'academy'],
      related: ['NEW-02', 'NEW-01'],
      metric: 'Candle selected → question asked → sourced answer → chart action',
      depth: 4,
      searchTerms: 'chart candle why did it move what happened that day news for this date select candle explain the drop ohlc volume spike'
    },

    /* Improvements to journeys that already existed — badged so the demo can
       point at them, not so they shout at an end user forever. */
    { id: 'CORE-01', name: 'Task-based Home', shortName: 'Task Home', maturity: 'live', releaseMarker: 'improved', commercialTier: 'included', priority: 'core', icon: '▤',
      problem: 'The first screen sold a slogan and a subscription.', solution: 'Three mode-specific home compositions instead of one product showcase: a guided task, your day, or a working desk.',
      audience: 'Every new visitor', route: '/', surfaces: ['whatsNew', 'showcase'], related: [], metric: 'Time to first meaningful action', depth: 5, searchTerms: 'home start page first screen tasks' },
    { id: 'CORE-02', name: 'Progressive Complexity', shortName: 'Simple / Standard / Pro', maturity: 'live', releaseMarker: 'improved', commercialTier: 'included', priority: 'core', icon: '▥',
      problem: 'Forty tools on the first visit and no way to grow into them.', solution: 'Three modes changing density, tabs, panels and explanations — never access.',
      audience: 'Beginners and professionals in the same product', route: '/learn#modes', surfaces: ['whatsNew', 'showcase'], related: ['NEW-01'], metric: 'Simple → Standard conversion', depth: 5, searchTerms: 'simple standard pro mode complexity level density' },
    { id: 'CORE-03', name: 'Contextual Research Journey', shortName: 'Research Journey', maturity: 'live', releaseMarker: 'improved', commercialTier: 'included', priority: 'core', icon: '▧',
      problem: 'Every screen was a dead end; the next step was whatever was popular.', solution: 'A rule graph: symbol → peers → sector → ETF, event → affected assets, chart → the news of the period you selected.',
      audience: 'Anyone researching anything', route: '/symbols/BTCUSD', surfaces: ['whatsNew', 'showcase'], related: ['NEW-02'], metric: 'Second meaningful action rate', depth: 4, searchTerms: 'next step journey related peers sector where to go next' },
    { id: 'CORE-04', name: 'Trust-first labelling', shortName: 'Trust-first', maturity: 'live', releaseMarker: 'improved', commercialTier: 'included', priority: 'core', icon: '▨',
      problem: 'A quote, an algorithm, an opinion and an advert all looked the same.', solution: 'Every block states its type, source, time, delay and method — and a technical rating explains itself instead of printing Buy.',
      audience: 'Everyone, especially beginners', route: '/symbols/BTCUSD', surfaces: ['whatsNew', 'showcase'], related: [], metric: 'Trust survey · misread rate', depth: 4, searchTerms: 'trust source delay disclosure rating labelling honest' },
    { id: 'CORE-05', name: 'Value-first conversion', shortName: 'Value-first', maturity: 'live', releaseMarker: 'improved', commercialTier: 'included', priority: 'core', icon: '▩',
      problem: 'Registration was demanded before anything of value existed.', solution: 'The account is asked for after the first watchlist, alert or saved research — and pricing only when a limit is actually met.',
      audience: 'Anonymous visitors', route: '/#watchlist', surfaces: ['whatsNew', 'showcase'], related: [], metric: 'Value action → registration', depth: 4, searchTerms: 'signup registration paywall pricing account when to register' }
  ];

  /* Three independent dimensions, because one field was doing three jobs and
     doing the most important one wrong: Expert Marketplace was labelled NEW
     and its copy claimed a regulator check that happens nowhere in this
     prototype — its consultants are demo records.

       maturity        how much of it really works
       releaseMarker   whether it is new or a rebuild — a marketing fact
       commercialTier  whether it would be paid — a commercial fact

     A feature can be new and barely built; that combination is now
     expressible instead of being flattened into a single flattering word. */
  const BADGE = {
    live:      { label: 'LIVE',      title: 'Works here end to end' },
    beta:      { label: 'BETA',      title: 'Works, but the flow is not complete' },
    prototype: { label: 'PROTOTYPE', title: 'A working demonstration, not a product — data and verification are simulated' },
    concept:   { label: 'CONCEPT',   title: 'A strategic idea shown as a prototype — not a working product' }
  };

  const MARKER = {
    new:      { label: 'NEW',      title: 'A new capability in this release' },
    improved: { label: 'IMPROVED', title: 'A major improvement to a journey that already existed' }
  };

  const TIER = {
    premium: { label: 'PREMIUM', title: 'A paid tier, shown here as a concept with an interest signal' }
  };

  const byId = id => F.find(f => f.id === id) || null;
  const onSurface = surface => F.filter(f => f.surfaces.includes(surface));
  const strategic = () => F.filter(f => f.priority === 'strategic');
  /* §15.2 — prominence is a fourth dimension: four journeys carry the case
     and get a large card, the other four are compact concepts. Eight equally
     weighted cards made every one of them forgettable. */
  /* §25 — the role a feature plays in a given mode. `prominence` stays the
     feature's own, mode-independent standing; `roleIn` is how loudly a given
     mode should say it. A mode changes prominence and nothing else: maturity,
     route and availability are identical in all three, which is why this
     function cannot return "hidden". */
  const ROLE_ORDER = { flagship: 0, contextual: 1, advanced: 2, concept: 3 };

  const roleIn = (f, mode) =>
    (f && f.modeRole && f.modeRole[mode]) ||
    (f && f.prominence === 'flagship' ? 'flagship' : 'concept');

  /* What a surface should lead with in this mode, most prominent first. */
  const byRole = (mode, role) =>
    F.filter(f => f.priority === 'strategic' && roleIn(f, mode) === role);

  const rankedFor = mode => F.filter(f => f.priority === 'strategic')
    .slice()
    .sort((a, b) => ROLE_ORDER[roleIn(a, mode)] - ROLE_ORDER[roleIn(b, mode)]);

  const flagship = mode => mode
    ? F.filter(f => roleIn(f, mode) === 'flagship')
    : F.filter(f => f.prominence === 'flagship');
  const concepts2 = () => F.filter(f => f.priority === 'strategic' && f.prominence !== 'flagship');
  const core = () => F.filter(f => f.priority === 'core');
  const working = () => F.filter(f => f.maturity === 'live' || f.maturity === 'beta');
  const concepts = () => F.filter(f => f.maturity === 'concept' || f.maturity === 'prototype');

  /* One badge component, used everywhere (§VIS-002). It carries a text label
     rather than relying on colour, and a title that says what the status
     means — a coloured dot alone tells a colour-blind visitor nothing. */
  const chip = (kind, key, def, extraClass) => {
    const b = def[key];
    if (!b) return '';
    return `<span class="fbadge fbadge-${key} ${extraClass || ''}" title="${b.title}" role="note" aria-label="${kind}: ${b.label}">${b.label}</span>`;
  };

  /* Accepts a feature (preferred) or a bare maturity string (older callers).
     Maturity always leads: what it is comes before how new it is. */
  function badge(featureOrStatus, extraClass) {
    if (typeof featureOrStatus === 'string') return chip('Status', featureOrStatus, BADGE, extraClass);
    const f = featureOrStatus;
    if (!f) return '';
    return [
      chip('Maturity', f.maturity, BADGE, extraClass),
      chip('Release', f.releaseMarker, MARKER, extraClass),
      chip('Tier', f.commercialTier, TIER, extraClass)
    ].filter(Boolean).join(' ');
  }

  function track(event, feature, props) {
    const rec = {
      feature_id: feature?.id, feature_status: feature?.maturity,
      feature_marker: feature?.releaseMarker, feature_tier: feature?.commercialTier,
      surface: props?.surface || 'unknown', mode: window.Portal?.mode?.(),
      route: location.pathname, ...(props || {})
    };
    window.Portal?.track?.(event, rec);
  }

  const isShowcase = () => {
    try {
      if (new URLSearchParams(location.search).get('showcase') === '1') {
        localStorage.setItem('showcase_mode', '1');
        return true;
      }
      return localStorage.getItem('showcase_mode') === '1';
    } catch { return new URLSearchParams(location.search).get('showcase') === '1'; }
  };

  const setShowcase = on => {
    try { on ? localStorage.setItem('showcase_mode', '1') : localStorage.removeItem('showcase_mode'); } catch {}
  };

  /* §VIS-006 — one contextual promo component. Any surface can ask for a
     feature by id and get the same card, so the eight surfaces Expert
     Marketplace has to appear on cannot drift apart into eight designs. */
  function promo(id, surface, opts) {
    const f = byId(id);
    if (!f) return '';
    const o = opts || {};
    const href = f.route + (o.query ? (f.route.includes('?') ? '&' : '?') + o.query : '');
    track('strategic_feature_impression', f, { surface });
    return `<a class="fpromo" href="${href}" data-fid="${f.id}" data-surface="${surface}">
      <span class="ic">${f.icon}</span>
      <span class="txt"><b>${o.title || f.shortName} ${badge(f)}</b>
        <span>${o.line || f.problem}</span></span>
      <span class="go">→</span></a>`;
  }

  return { ALL: F, BADGE, MARKER, TIER, flagship, roleIn, byRole, rankedFor, ROLE_ORDER, secondary: concepts2, byId, onSurface, promo, strategic, core, working, concepts, badge, track, isShowcase, setShowcase };
})();
