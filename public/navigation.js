/* =========================================================================
   User navigation — four stable product domains.

       Home · Market · Symbols · Economy

   This is deliberately NOT `ia.js`. That file is the product inventory: 98
   destinations, many of them mapped-but-unbuilt, and it answers the question
   "what capabilities exist". It is the right source for the command palette,
   the site map, the showcase and the coverage tests.

   This registry answers the other question: "where do I go?". Only canonical
   entries that lead somewhere real.

   WHAT CHANGED, AND WHY IT MATTERS

   Until now the top row was itself mode-dependent: Simple opened with
   `My Money · Learn · Markets · Research · Practice` and Professional with
   `Markets · Screeners · Charts · Research · Practice`. Two people using the
   same product could not describe it to each other, and a screenshot could
   not be read without first asking which mode took it. Worse, the top level
   was carrying personal services as if they were peers of the market itself.

   The four domains are now identical in every mode. A mode changes:

       which entries lead a domain's menu,
       in what order,
       how deeply the page composes,
       how much is explained.

   A mode never changes:

       the four domains,
       which domain owns a function,
       the routes,
       what is reachable.

   Every entry a mode does not lead with moves under "More in <domain>". That
   is the whole promise: nothing is removed, only re-ordered.

   CANONICAL OWNERSHIP

   Each function has exactly one owning domain. It may be aggregated
   elsewhere — Home shows the next macro event, Symbols shows the events for
   one ticker — but the calendar itself belongs to Economy, and a link from
   anywhere lands on the owner's page rather than on a second copy of it.
   ========================================================================= */

window.Navigation = (function () {

  /* An entry. `plain` is the Simple wording where a plain-language label
     genuinely helps; without it the same label is used in all three modes.
     Renaming an entry per mode is a cost — a person who learns "Screeners"
     in Standard should still recognise it in Professional — so `plain` is
     used only where the ordinary label assumes knowledge a beginner has not
     been given yet. */
  const E = (id, label, url, desc, plain, group) =>
    ({ id, label, url, desc, plain: plain || null, group: group || null });

  /* A named block inside a domain's menu. Home carries one: the Personal
     Wealth Hub, which is where somebody's own money lives — this month, net
     worth, goals, safety, accounts. It is a heading rather than a link,
     because the hub is the sum of the pages under it and sending the heading
     to one of them would make that one look like the whole thing.

     The block is shown in ALL THREE modes. What a mode changes is how many of
     its rows lead: Simple opens with the three a beginner can act on today,
     Professional opens with net worth and scenarios. */
  const WEALTH = 'Personal Wealth Hub';

  const DOMAINS = [
    /* ------------------------------------------------------------- Home */
    {
      id: 'home', label: 'Home', url: '/',
      question: 'What matters to me today, and what should I do next?',
      role: 'Entry point of the portal. Aggregates markets, news, ideas and content modules.',
      entries: [
        E('today',    'Today',              '/overview',          'what moved, and why'),
        E('money',    'My Budget',          '/money',             'income, spending, what is left', 'Manage my money', WEALTH),
        E('tx',       'Transactions',       '/money/transactions', 'the notebook, replaced', null, WEALTH),
        E('budget',   'Budget',             '/money/budget',      'planned against actual', null, WEALTH),
        E('goals',    'Goals',              '/money/goals',       'what you are saving for', null, WEALTH),
        E('safety',   'Financial safety',   '/money/safety',      'reserve, debts, tax', null, WEALTH),
        E('accounts', 'Accounts',           '/money/accounts',    'cash, cards, deposits', null, WEALTH),
        E('networth', 'Net worth',          '/money/net-worth',   'what you own minus what you owe', null, WEALTH),
        E('investing','Investing',          '/money/investing',   'only when it becomes relevant', null, WEALTH),
        E('scenarios','Scenarios',          '/money/scenarios',   'what changes if you move money', null, WEALTH),
        E('community','Community',          '/community',         'curated, labelled, dated', 'Ideas for beginners'),
        E('continue', 'Saved work',         '/money#saved',       'screens, journey, Copilot history', 'Continue my work'),
        E('recent',   'Recent symbols',     '/symbols/BTCUSD',    'the instruments you opened'),
        E('watchlists','Watchlists',        '/money#watchlists',  'the symbols you follow'),
        E('alerts',   'Alerts',             '/money#alerts',      'price and event alerts'),
        E('screens',  'Saved Screeners',    '/screeners#saved',   'the questions you keep asking'),
        /* Human help is the same offer at every level: somebody with money
           questions deserves the same door whether they call themselves a
           beginner or a professional. It leads Home's menu in all three
           modes, in the same place — this is the one entry deliberately
           exempt from per-mode ordering. */
        E('experts',  'Expert Marketplace', '/capital/experts',   'a human adviser, matched to your situation'),
        E('rewards',  'Community Rewards',  '/community/rewards', 'one loop instead of four links'),
        E('space',    'My space',           '/money#saved',       'everything you keep, in one place'),
        E('new',      'What’s New',         '/new',               'what is new in this prototype')
      ],
      lead: {
        /* Шесть строк — потолок панели. Safety уезжает в блок под More
           вместе с остальным кошельком, а не выталкивает Experts. */
        simple:   ['today', 'money', 'goals', 'community', 'continue', 'experts'],
        standard: ['today', 'money', 'tx', 'goals', 'networth', 'community', 'continue', 'experts', 'new'],
        pro:      ['continue', 'alerts', 'watchlists', 'screens', 'networth', 'scenarios', 'investing', 'money', 'experts', 'space', 'new']
      }
    },

    /* ----------------------------------------------------------- Market */
    {
      id: 'market', label: 'Market', url: '/markets',
      question: 'What is happening across asset classes?',
      role: 'Overview pages for asset classes.',
      entries: [
        E('overview',  'Market overview',        '/markets',                  'the day in one screen'),
        E('stocks',    'Stocks',                 '/markets?cls=stocks',       ''),
        E('crypto',    'Crypto',                 '/markets?cls=crypto',       ''),
        E('forex',     'Forex',                  '/markets?cls=forex',        '', 'Currencies'),
        E('futures',   'Futures & Commodities',  '/markets?cls=commodities',  ''),
        E('bonds',     'Bonds',                  '/markets?cls=rates',        'bonds and volatility as instruments'),
        E('indices',   'Indices',                '/markets?cls=indices',      ''),
        /* No separate ETF class exists in this pilot's 49-instrument universe.
           The honest destination is the screener, not a heading with nothing
           behind it. */
        E('etfs',      'ETFs & Funds',           '/screeners',                'filter for funds — no separate class in this pilot'),
        E('map',       'Market Map',             '/markets#heatmap',          'the whole market at a glance'),
        E('screeners', 'Screeners',              '/screeners',                'ask the market a question', 'Find instruments'),
        E('movers',    'Movers',                 '/overview#brief',           'the three biggest moves and why'),
        E('breadth',   'Market breadth',         '/overview#modules',         'how much of the market is participating'),
        E('news',      'Market News',            '/overview#news',            'grouped, with trust labels'),
        E('saved',     'Saved market views',     '/screeners#saved',          'the screens you keep'),
        E('compare',   'Compare Markets',        '/markets',                  'side by side')
      ],
      lead: {
        simple:   ['overview', 'stocks', 'crypto', 'forex', 'map', 'screeners'],
        standard: ['overview', 'stocks', 'crypto', 'forex', 'futures', 'bonds', 'etfs', 'indices', 'screeners', 'map', 'movers', 'news'],
        pro:      ['screeners', 'map', 'stocks', 'crypto', 'forex', 'futures', 'bonds', 'etfs', 'indices', 'breadth', 'saved']
      }
    },

    /* ---------------------------------------------------------- Symbols */
    {
      id: 'symbols', label: 'Symbols', url: '/symbols/BTCUSD',
      question: 'What is happening with this instrument?',
      role: 'Individual instrument pages: chart, fundamentals, technicals, news and ideas.',
      entries: [
        E('find',      'Find Symbol',           '/research#search',            'assets, pages, actions', 'Find an asset'),
        E('hub',       'Asset Hub',             '/symbols/BTCUSD',             'one page per instrument', 'Understand an asset'),
        E('chart',     'Chart',                 '/charts',                     'click any candle and ask what happened that day', 'Open Chart'),
        E('overview',  'Overview',              '/symbols/BTCUSD?tab=overview',''),
        E('why',       'Why it moved',          '/symbols/BTCUSD?tab=why',     'move → factor → source'),
        E('metrics',   'Fundamentals',          '/symbols/BTCUSD?tab=metrics', 'the reported numbers'),
        E('financials','Financials',            '/research#fundamentals',      'reporting, multiples, comparison'),
        E('technicals','Technicals',            '/symbols/BTCUSD?tab=why',     'ranges, trend, position'),
        E('news',      'News',                  '/symbols/BTCUSD?tab=news',    'for this instrument'),
        E('ideas',     'Ideas',                 '/symbols/BTCUSD?tab=ideas',   'each with its author’s record'),
        E('events',    'Events',                '/symbols/BTCUSD?tab=events',  'what is scheduled for this ticker', 'News and events'),
        E('peers',     'Peers / Compare',       '/markets',                    'side by side', 'Compare assets'),
        E('options',   'Options',               '/research#options',           ''),
        E('strategies','Strategies & Testing',  '/research#strategies',        'replay, tester, journal'),
        E('pine',      'Pine',                  '/research#pine',              'editor, scripts, docs'),
        E('ai',        'AI Private',            '/research/ai-private',        'private research, on your terms'),
        E('saved',     'Saved Research',        '/money#saved',                'screens, journey, Copilot history'),
        E('copilot',   'Chart Copilot',         '/charts',                     'ask about the candle you selected')
      ],
      lead: {
        simple:   ['find', 'hub', 'chart', 'why', 'peers', 'events'],
        standard: ['find', 'hub', 'chart', 'overview', 'metrics', 'financials', 'technicals', 'news', 'ideas', 'events', 'peers'],
        pro:      ['chart', 'technicals', 'financials', 'options', 'strategies', 'pine', 'peers', 'ai', 'saved', 'copilot']
      }
    },

    /* ---------------------------------------------------------- Economy */
    {
      id: 'economy', label: 'Economy', url: '/economy',
      question: 'Which macro indicators and events are moving markets?',
      role: 'Macro data and events: countries, indicators, earnings.',
      entries: [
        E('overview',   'Economy Overview',     '/economy',             'what is scheduled, and what it touches', 'What affects markets'),
        E('calendar',   'Economic Calendar',    '/economy#events',      'dated, with the markets each event touches'),
        E('rates',      'Central Bank Rates',   '/economy#rates',       'policy rates and what they mean', 'Rates and inflation'),
        E('inflation',  'Inflation',            '/economy#rates',       'prices, and the rate response'),
        E('why',        'Why Markets Moved',    '/economy#why',         'event → factor → market'),
        E('earnings',   'Earnings Calendar',    '/economy#earnings',    'who reports, and when', 'Earnings'),
        E('markets',    'Affected Markets',     '/economy#markets',     'which classes an event touches'),
        E('symbols',    'Affected Symbols',     '/economy#symbols',     'the instruments in the blast radius'),
        E('reaction',   'Historical Reaction',  '/economy#reaction',    'what the chart did last time'),
        E('impact',     'Event Impact',         '/economy#markets',     'markets and symbols, together'),
        E('countries',  'Countries',            '/economy#countries',   ''),
        E('indicators', 'Macro Indicators',     '/economy#indicators',  '', 'More indicators'),
        E('gdp',        'GDP',                  '/economy#indicators',  ''),
        E('employment', 'Employment',           '/economy#indicators',  ''),
        E('curves',     'Yield Curves',         '/economy#curves',      ''),
        E('dividends',  'Dividends',            '/economy#dividends',   ''),
        E('ipo',        'IPO Calendar',         '/economy#ipo',         ''),
        E('compare',    'Country Compare',      '/economy#compare',     ''),
        E('macronews',  'Macro News',           '/overview#news',       'grouped, with trust labels')
      ],
      lead: {
        simple:   ['overview', 'calendar', 'rates', 'earnings', 'countries', 'indicators'],
        standard: ['overview', 'countries', 'indicators', 'rates', 'inflation', 'gdp', 'employment', 'calendar', 'earnings', 'macronews', 'impact'],
        pro:      ['calendar', 'rates', 'curves', 'compare', 'indicators', 'earnings', 'dividends', 'ipo', 'impact', 'reaction']
      }
    }
,

    /* --------------------------------------------------------- Academy

       The fifth domain, and the one that is NOT in the top row of every mode.

       Simple leads with it, after the four core domains; Standard and
       Professional keep it in the `More` door. That is a deliberate exception
       to the rule the previous release established, and it is worth naming:
       somebody who finds the Academy in Simple and then switches to Standard
       loses it from the header. The cost is real. What buys it back is that
       the domain is still ONE press away in `More` in every mode, carries the
       active state when you are inside it, and never stops existing — so the
       exception is "less prominent", not "gone".

       It holds everything that teaches: the guided course, the tracks, the
       answers, and the practice surfaces, because practising without money is
       learning rather than trading. Practice therefore leaves Home. */
    {
      id: 'academy', label: 'Academy', url: '/learn/academy',
      question: 'What do I need to understand next, and how do I try it safely?',
      role: 'Everything that teaches: the guided course, the tracks, the answers and the practice surfaces.',
      entries: [
        E('academy',   'Guided Academy',        '/learn/academy',        'six lessons on live data'),
        E('lesson',    'Interactive lesson',    '/learn/academy/lesson', 'read a level on a real chart'),
        E('start',     'Start here',            '/learn#start',          'ten steps through the product'),
        E('hub',       'All learning tracks',   '/learn',                'the whole curriculum in one place'),
        E('money',     'Personal-finance basics','/learn#money',         'before any market question'),
        E('investing', 'Investing basics',      '/learn#investing',      'cash, deposits, bonds, ETFs'),
        E('trading',   'Trading basics',        '/learn#trading',        'analysis, orders, risk'),
        E('charts',    'Chart skills',          '/learn#charts',         'reading a chart without guessing'),
        E('pine',      'Pine Script',           '/learn#pine',           'syntax, debugging, publication'),
        E('strategy',  'Strategy testing',      '/learn#strategy',       'evidence for a rule, not an opinion'),
        E('expertled', 'Expert-led tracks',     '/learn/academy#tracks', 'written by the advisers, with their record'),
        E('qa',        'Structured Q&A',        '/learn#qa',             'short answer, then the explanation'),
        E('help',      'Help centre',           '/learn#help',           ''),
        /* Practice belongs here: a paper trade is a lesson you are allowed to
           get wrong. It left Home in this release. */
        E('paper',     'Paper Trading',         '/trade#practice',       'virtual balance, real prices'),
        E('scenario',  'First practice scenario','/trade#start',         'market → instrument → risk'),
        E('replay',    'Bar replay',            '/charts',               'replay a past period'),
        E('journal',   'Trading journal',       '/trade#journal',        'why you entered, what happened')
      ],
      lead: {
        simple:   ['academy', 'start', 'money', 'investing', 'paper', 'qa'],
        standard: ['academy', 'hub', 'investing', 'trading', 'charts', 'paper', 'journal', 'qa'],
        pro:      ['pine', 'strategy', 'journal', 'replay', 'expertled', 'academy', 'hub']
      }
    }
  ];

  /* Things you KEEP, behind the profile rather than inside a domain. Derived
     from Home's own entries so there is one list, not two that drift. */
  const WORKSPACE = {
    label: 'My space',
    items: ['watchlists', 'alerts', 'continue', 'screens', 'recent', 'new']
      .map(id => DOMAINS[0].entries.find(e => e.id === id)).filter(Boolean)
  };

  const ORDER = { simple: 0, standard: 1, pro: 2 };

  /* `SECTIONS` keeps its name because five surfaces read it and the shape is
     unchanged: an id, a label, a url and a question. What it contains is now
     four domains rather than six mixed sections. */
  const SECTIONS = DOMAINS;

  const TOP_LEVEL_DOMAINS = DOMAINS.map(d => d.id);

  const byId = id => DOMAINS.find(d => d.id === id) || null;

  /* The label a mode shows for an entry. Simple prefers plain wording where
     one was written for it; the other two use the product's own name. */
  const labelFor = (entry, mode) =>
    (mode === 'simple' && entry.plain) ? entry.plain : entry.label;

  /* What a domain's menu opens with, and what sits under "More". Every entry
     appears in exactly one of the two lists, in every mode — which is what
     makes "nothing disappears" a property of the data rather than a claim in
     a comment. */
  function menu(domainId, mode = 'simple') {
    const d = byId(domainId);
    if (!d) return { rows: [], more: [] };
    const m = ORDER[mode] === undefined ? 'simple' : mode;
    const lead = d.lead[m] || d.lead.simple;

    const relabel = e => ({ ...e, label: labelFor(e, m) });
    const rows = lead.map(id => d.entries.find(e => e.id === id)).filter(Boolean).map(relabel);
    const led = new Set(rows.map(r => r.id));
    const more = d.entries.filter(e => !led.has(e.id)).map(relabel);

    return { section: d, domain: d, rows, more };
  }

  const all = () => DOMAINS.flatMap(d => d.entries.map(e => ({ ...e, section: d.id, domain: d.id })));

  /* ------------------------------------------------------- the top row

     Four domains, in one order, in every mode. `topNav` keeps its shape so
     the renderer does not have to know that the architecture stopped being
     mode-dependent — but nothing at the top level is displaced any more,
     because there is nothing left to displace.

     `MORE_EXTRAS` are not domains and never were: the site map and the
     product-updates page are utilities. They live in the More door so that
     the four domains stay four. */

  const R = (id, label, url, desc) => ({ type: 'route', id, label, url, desc });
  const SEC = domainId => ({ type: 'section', sectionId: domainId });

  const MORE_EXTRAS = [
    R('new', 'Product innovations', '/new', 'what is new in this prototype'),
    R('space', 'My space', '/money#saved', 'watchlists, alerts, saved research'),
    R('sitemap', 'Full site map', '/sitemap', 'every destination and whether it works here')
  ];

  /* Professional keeps two compact shortcuts beside the domains, because a
     screener and a chart are destinations a professional types towards and a
     submenu row costs a click every time. §3.1: they sit BESIDE the four
     domains and never replace one. */
  const PRO_SHORTCUTS = [
    R('screeners', 'Screener', '/screeners', 'ask the market a question'),
    R('charts', 'Chart', '/charts', 'the workspace')
  ];

  /* The four that never move. Academy is a domain too, but it is not part of
     this row's promise — see its own comment above. */
  const CORE_DOMAIN_IDS = ['home', 'market', 'symbols', 'economy'];
  const CORE = CORE_DOMAIN_IDS.map(SEC);

  const PROFILES = {
    /* Simple leads with the Academy after the four core domains: at this level
       the next useful action is usually a lesson, and a beginner should not
       have to open a door to find one. */
    simple:   { lead: CORE.concat([SEC('academy')]), more: MORE_EXTRAS.slice() },
    standard: { lead: CORE.slice(), more: [SEC('academy')].concat(MORE_EXTRAS) },
    pro:      { lead: CORE.concat(PRO_SHORTCUTS), more: [SEC('academy')].concat(MORE_EXTRAS) }
  };

  const profile = m => PROFILES[m] || PROFILES.standard;

  function resolve(entry) {
    if (!entry) return null;
    if (entry.type === 'section') {
      const d = byId(entry.sectionId);
      return d ? { type: 'section', id: d.id, label: d.label, url: d.url, section: d } : null;
    }
    return entry;
  }

  const topNav = m => ({
    lead: profile(m).lead.map(resolve).filter(Boolean),
    more: profile(m).more.map(resolve).filter(Boolean)
  });

  /* The invariant, kept from the previous release and now trivially true:
     nothing a mode displaces may become unreachable. */
  function everySectionReachable(m) {
    const nav = topNav(m);
    const seen = new Set(nav.lead.concat(nav.more)
      .filter(e => e.type === 'section').map(e => e.id));
    return DOMAINS.every(d => seen.has(d.id));
  }

  /* Every entry of every domain is in rows-or-more, in every mode. The one
     property the whole regrouping rests on. */
  function everyEntryReachable(m) {
    return DOMAINS.every(d => {
      const { rows, more } = menu(d.id, m);
      const seen = new Set(rows.concat(more).map(e => e.id));
      return d.entries.every(e => seen.has(e.id));
    });
  }

  /* The FOUR CORE domains must read identically, in the same order, in all
     three modes. Academy is deliberately excluded from this promise: it leads
     in Simple and lives in `More` elsewhere. Narrowing the assertion is the
     honest way to make an exception — the alternative is deleting the check
     and calling the property true by silence. */
  function domainsAreStable() {
    const read = m => topNav(m).lead
      .filter(e => e.type === 'section' && CORE_DOMAIN_IDS.includes(e.id))
      .map(e => e.label).join(' · ');
    return read('simple') === read('standard') && read('standard') === read('pro')
      && read('simple') === 'Home · Market · Symbols · Economy';
  }

  /* Where Academy sits in a given mode. Named so a page or a test can ask
     rather than infer it from the rendered menu. */
  function academyPlacement(m) {
    const nav = topNav(m);
    if (nav.lead.some(e => e.id === 'academy')) return 'lead';
    if (nav.more.some(e => e.id === 'academy')) return 'more';
    return 'absent';
  }

  /* Kept so `nav.js` does not have to change: ordering now lives in `lead`,
     so there is nothing left to re-sort afterwards. */
  const prioritise = (_domainId, _mode, items) => items;

  /* Which domain owns a route. Used by the header's active state, by search
     result labels and by the site map. Longest match wins, so
     `/learn/academy` resolves before `/learn`. */
  const ROUTE_OWNER = [
    ['/economy',        'economy'],
    ['/markets',        'market'],
    ['/screeners',      'market'],
    ['/symbols',        'symbols'],
    ['/charts',         'symbols'],
    ['/research/ai-private', 'symbols'],
    ['/research',       'symbols'],
    ['/money',          'home'],
    /* Learning and practice belong to Academy now — including `/trade`, which
       is paper trading rather than trading. */
    ['/learn',          'academy'],
    ['/trade',          'academy'],
    ['/community',      'home'],
    ['/capital/experts','home'],
    ['/capital',        'home'],
    ['/new',            'home'],
    ['/overview',       'home'],
    ['/',               'home']
  ];

  function ownerOf(pathname) {
    const p = String(pathname || '/');
    let best = null;
    for (const [prefix, domain] of ROUTE_OWNER) {
      if (prefix === '/' ? p === '/' : p.startsWith(prefix)) {
        if (!best || prefix.length > best[0].length) best = [prefix, domain];
      }
    }
    return best ? best[1] : null;
  }

  const ownerLabel = pathname => {
    const d = byId(ownerOf(pathname));
    return d ? d.label : null;
  };

  return {
    DOMAINS, TOP_LEVEL_DOMAINS, SECTIONS, WORKSPACE, ORDER,
    menu, byId, all, labelFor,
    PROFILES, PRO_SHORTCUTS, profile, resolve, topNav,
    everySectionReachable, everyEntryReachable, domainsAreStable,
    CORE_DOMAIN_IDS, academyPlacement, WEALTH,
    prioritise, ROUTE_OWNER, ownerOf, ownerLabel
  };
})();
