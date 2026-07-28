/* =========================================================================
   The information architecture, as data — six sections.

   Overview · Research · Capital · Trade · Learn · Community.

   Every destination the real platform offers is listed here once, with where
   it lives, whether this prototype implements it, and the mode from which it
   is worth showing. Five surfaces render from this one structure — the nav
   panels, the Ctrl K palette, the section hubs, the site map and the footer —
   which is the only way "listed once" survives a change.

   status: 'live'   — works here
           'pilot'  — a deliberate stub: the flow is real, the depth is not
           'mapped' — exists on the real platform, kept so the regrouping can
                      be checked, not built here
   level:  'simple'   — a beginner needs it
           'standard' — an active investor needs it
           'pro'      — depth
   Level changes what is offered first, never what is reachable: §7.4 of the
   brief forbids locking anyone out of the full interface.
   ========================================================================= */

window.IA = (function () {

  const D = (id, label, url, status, level, desc, keywords) =>
    ({ id, label, url, status, level, desc, keywords: keywords || '' });

  const SECTIONS = [
    {
      id: 'overview', label: 'Overview', url: '/overview',
      question: 'What is happening right now, and what of it matters to me?',
      groups: [
        { name: 'Today', items: [
          D('ov-today', 'Today', '/overview', 'live', 'simple', 'the day in one screen', 'today overview start pulse'),
          D('ov-brief', "Market brief", '/overview#brief', 'live', 'simple', 'three biggest moves and why', 'brief movers biggest moves'),
          D('ov-why', 'Why the market moves', '/overview#why', 'live', 'simple', 'move → factor → source', 'why moves reason driver factor')
        ]},
        { name: 'Markets', items: [
          D('mk-all', 'All markets', '/markets', 'live', 'simple', '49 instruments, one table', 'markets quotes prices all'),
          D('mk-stocks', 'Stocks', '/markets?cls=stocks', 'live', 'simple', '', 'stocks shares equities'),
          D('mk-indices', 'Indices', '/markets?cls=indices', 'live', 'simple', '', 'indices spx nasdaq dow'),
          D('mk-crypto', 'Crypto', '/markets?cls=crypto', 'live', 'simple', '', 'crypto bitcoin ethereum coins'),
          D('mk-forex', 'Forex & currencies', '/markets?cls=forex', 'live', 'standard', '', 'forex currencies fx pairs'),
          D('mk-comm', 'Futures & commodities', '/markets?cls=commodities', 'live', 'standard', '', 'futures commodities gold oil'),
          D('mk-rates', 'Bonds & rates', '/markets?cls=rates', 'live', 'standard', '', 'bonds rates yields treasury vix'),
          D('mk-etf', 'ETFs & funds', '/sitemap#overview', 'mapped', 'standard', '', 'etf funds'),
          D('mk-options', 'Options', '/research#options', 'mapped', 'pro', '', 'options derivatives chain'),
          D('mk-macro', 'Macroeconomy', '/research#macro', 'mapped', 'standard', '', 'macro economy gdp inflation'),
          D('mk-heat', 'Market map', '/markets#heatmap', 'live', 'simple', 'the whole market at a glance', 'heatmap map colour')
        ]},
        { name: 'News & events', items: [
          D('ov-news', 'News', '/overview#news', 'pilot', 'simple', 'grouped, with trust labels', 'news headlines stories feed'),
          D('ov-events', 'Events', '/overview#events', 'pilot', 'simple', 'what is scheduled and what it touches', 'events calendar economic'),
          D('cal-earn', 'Earnings calendar', '/sitemap#overview', 'mapped', 'standard', '', 'earnings reports calendar'),
          D('cal-div', 'Dividends calendar', '/sitemap#overview', 'mapped', 'pro', '', 'dividends calendar'),
          D('cal-ipo', 'IPO calendar', '/sitemap#overview', 'mapped', 'pro', '', 'ipo listings calendar')
        ]}
      ]
    },

    {
      id: 'research', label: 'Research', url: '/research',
      question: 'How do I find, study and check an opportunity?',
      groups: [
        { name: 'Find', items: [
          D('rs-search', 'Search everything', '/research#search', 'live', 'simple', 'Ctrl K — assets, pages, actions', 'search find command palette'),
          D('rs-asset', 'Asset Hub', '/symbols/BTCUSD', 'live', 'simple', 'one page per instrument', 'asset hub symbol instrument ticker'),
          D('rs-screeners', 'Screeners', '/screeners', 'live', 'simple', 'ask the market a question', 'screener filter scan stocks etf bonds crypto'),
          D('rs-maps', 'Market maps', '/markets#heatmap', 'live', 'standard', 'heatmaps by class and sector', 'heatmap map sectors countries')
        ]},
        { name: 'Study', items: [
          D('rs-charts', 'Charts', '/charts', 'live', 'simple', 'Simple, Standard and Pro presets', 'chart supercharts candles drawing'),
          D('rs-fund', 'Fundamentals', '/research#fundamentals', 'pilot', 'standard', 'reporting, multiples, comparison', 'fundamentals financials multiples revenue'),
          D('rs-macro', 'Macro & rates', '/research#macro', 'pilot', 'standard', 'event → markets → assets → chart', 'macro rates inflation yield curve'),
          D('rs-options', 'Options & derivatives', '/research#options', 'mapped', 'pro', '', 'options iv open interest strikes')
        ]},
        { name: 'Check', items: [
          D('rs-strategies', 'Strategies & testing', '/research#strategies', 'pilot', 'pro', 'replay, tester, journal', 'strategy tester backtest replay'),
          D('rs-pine', 'Pine', '/research#pine', 'mapped', 'pro', 'editor, scripts, docs', 'pine script editor indicator')
        ]}
      ]
    },

    {
      id: 'capital', label: 'Capital', url: '/capital',
      question: 'How are my watching, investments, money and goals connected?',
      groups: [
        { name: 'Watching', items: [
          D('cp-watch', 'Watchlists', '/capital#watchlists', 'live', 'simple', 'the symbols you follow', 'watchlist follow symbols saved'),
          D('cp-alerts', 'Alerts', '/capital#alerts', 'pilot', 'simple', 'price, indicator and event alerts', 'alerts notify price trigger')
        ]},
        { name: 'Money', items: [
          D('cp-portfolio', 'Portfolio', '/capital#portfolio', 'pilot', 'standard', 'positions, result, allocation', 'portfolio holdings positions allocation'),
          /* Strategic features open by default at every level (§2.3): a mode
             may change how they are presented, never whether they exist. */
          D('cp-wealth', 'Wealth Hub', '/capital/wealth', 'live', 'simple', 'market assets, cash, deposits, currency', 'wealth hub capital cash deposits savings'),
          /* The marketplace lives with the money, not with the forum. Somebody
             looking for a human is looking at their capital, not reading other
             people's ideas — and Community is where the reading happens. */
          D('cp-experts', 'Expert Marketplace', '/capital/experts', 'live', 'simple', 'a human adviser, matched to your situation', 'expert consultant advisor marketplace licensed human help'),
          D('cp-goals', 'Goals & scenarios', '/capital#goals', 'pilot', 'standard', 'what changes if the market falls', 'goals scenarios target horizon')
        ]},
        { name: 'Kept', items: [
          D('cp-saved', 'Saved research', '/capital#saved', 'live', 'simple', 'screens, journey, Copilot history', 'saved research notes screens journey')
        ]}
      ]
    },

    {
      id: 'trade', label: 'Trade', url: '/trade',
      question: 'How do I test an idea without risk, or place a trade?',
      groups: [
        { name: 'Start', items: [
          D('td-start', 'Start here', '/trade#start', 'pilot', 'simple', 'market → instrument → risk → practice', 'start trading first steps'),
          D('td-practice', 'Practice', '/trade#practice', 'pilot', 'simple', 'paper trading, replay, journal', 'paper trading practice simulator replay')
        ]},
        { name: 'Brokers', items: [
          D('td-brokers', 'Brokers', '/trade#brokers', 'pilot', 'standard', 'catalogue with filters', 'brokers list catalogue'),
          D('td-compare', 'Compare brokers', '/trade#compare', 'pilot', 'standard', 'fees, markets, order types', 'compare brokers fees spread'),
          D('td-accounts', 'Connected accounts', '/trade#accounts', 'mapped', 'pro', '', 'accounts connection broker link')
        ]},
        { name: 'Execute', items: [
          D('td-terminal', 'Terminal', '/trade#terminal', 'mapped', 'pro', 'orders, positions, journal', 'terminal orders positions trading')
        ]}
      ]
    },

    {
      id: 'learn', label: 'Learn', url: '/learn',
      question: 'How do I master the market without being overwhelmed?',
      groups: [
        { name: 'Start', items: [
          D('ln-start', 'Start here', '/learn#start', 'live', 'simple', 'ten steps through the product', 'start here first steps beginner'),
          D('ln-academy', 'Guided Academy', '/learn/academy', 'live', 'simple', 'six steps on live data', 'academy lessons track guided'),
          D('ln-lesson', 'Interactive lesson', '/learn/academy/lesson', 'live', 'simple', 'read a level on a real chart', 'lesson chart interactive compare')
        ]},
        { name: 'Tracks', items: [
          D('ln-invest', 'Investing', '/learn#investing', 'pilot', 'simple', 'asset classes, risk, horizon', 'investing portfolio dividends diversification'),
          D('ln-trading', 'Trading', '/learn#trading', 'pilot', 'standard', 'analysis, orders, risk management', 'trading technical analysis orders risk'),
          D('ln-pine', 'Pine Script', '/learn#pine', 'mapped', 'pro', '', 'pine script programming indicator')
        ]},
        { name: 'Answers', items: [
          D('ln-qa', 'Structured Q&A', '/learn#qa', 'pilot', 'simple', 'short answer, then the explanation', 'question answer faq qa explain'),
          D('ln-help', 'Help centre', '/learn#help', 'mapped', 'simple', '', 'help support faq troubleshooting')
        ]}
      ]
    },

    {
      id: 'community', label: 'Community', url: '/community',
      question: 'What do other people think, build and recommend?',
      groups: [
        { name: 'Read', items: [
          D('cm-foryou', 'For you', '/community#for-you', 'pilot', 'simple', 'follows your watchlist', 'for you personal feed'),
          D('cm-editors', "Editors' Picks", '/community#editors', 'live', 'simple', 'reviewed, outcome tracked', 'editors picks curated reviewed ideas'),
          D('cm-ideas', 'Ideas', '/community#ideas', 'live', 'standard', 'technical, fundamental, educational', 'ideas trading analysis community'),
          D('cm-disc', 'Discussions', '/community#discussions', 'mapped', 'standard', '', 'discussions minds comments')
        ]},
        { name: 'Build', items: [
          D('cm-scripts', 'Scripts', '/community#scripts', 'mapped', 'pro', 'indicators and strategies', 'scripts indicators strategies pine'),
          D('cm-authors', 'Authors', '/community#authors', 'mapped', 'standard', '', 'authors profiles wizards reputation')
        ]},
        { name: 'Ask & win', items: [
          D('cm-comp', 'Competitions', '/community#competitions', 'mapped', 'standard', 'The Leap', 'leap competition contest prizes'),
          D('cm-rewards', 'Rewards', '/community/rewards', 'pilot', 'simple', 'one loop: ideas, teaching, referrals', 'rewards referral gift store program points')
        ]}
      ]
    }
  ];

  /* Personal shortcuts live behind the avatar, not in the bar: they are a view
     onto Capital, not a seventh section. */
  const MY_SPACE = {
    id: 'my', label: 'My space', url: '/capital',
    question: 'Everything that is yours',
    groups: [{ name: 'Yours', items: [
      D('my-watch', 'Watchlists', '/capital#watchlists', 'live', 'simple', 'the symbols you follow', 'watchlist'),
      D('my-alerts', 'Alerts', '/capital#alerts', 'pilot', 'simple', '', 'alerts'),
      D('my-saved', 'Saved research', '/capital#saved', 'live', 'simple', 'screens, journey, notes', 'saved research'),
      D('my-mode', 'Interface mode', '/learn#modes', 'live', 'simple', 'Simple, Standard, Pro', 'mode simple standard pro settings'),
      D('my-sitemap', 'Full site map', '/sitemap', 'live', 'simple', 'every destination and its status', 'sitemap map directory')
    ]}]
  };

  /* The home page is the entry, not a section: its routes are listed so the
     palette and the map can find them. */
  const HOME = {
    id: 'home', label: 'Home', url: '/',
    question: 'What do you want to do today?',
    groups: [{ name: 'Task routes', items: [
      D('hm-brief', "Understand today's market", '/#brief', 'live', 'simple', '', 'understand market today brief'),
      D('hm-asset', 'Research one asset', '/symbols/BTCUSD', 'live', 'simple', '', 'research asset symbol'),
      D('hm-idea', 'Find an idea', '/#ideas', 'live', 'simple', '', 'idea find picks'),
      D('hm-track', 'Track my instruments', '/#watchlist', 'live', 'simple', '', 'track watchlist follow'),
      D('hm-learn', 'Learn without risk', '/learn', 'live', 'simple', '', 'learn academy risk-free'),
      D('hm-event', 'Prepare for an event', '/overview#events', 'pilot', 'simple', '', 'event prepare fomc cpi'),
      D('hm-trade', 'Start trading', '/trade#start', 'pilot', 'simple', '', 'trade start broker'),
      D('hm-skip', 'Skip the portal', '/charts', 'live', 'pro', 'straight to the workspace', 'supercharts workspace skip')
    ]}]
  };

  /* Company content is not navigation (§4). It keeps a home at the bottom. */
  const FOOTER = [
    { name: 'Company', items: [
      D('ft-about', 'About this prototype', '#about-prototype', 'live', 'simple', '', 'about prototype disclaimer'),
      D('ft-who', 'About', '/sitemap#company', 'mapped', 'simple', '', 'about company who'),
      D('ft-blog', 'Blog', '/sitemap#company', 'mapped', 'simple', '', 'blog news press'),
      D('ft-careers', 'Careers', '/sitemap#company', 'mapped', 'simple', '', 'careers jobs'),
      D('ft-media', 'Media kit', '/sitemap#company', 'mapped', 'standard', '', 'media kit press')
    ]},
    { name: 'Product & plans', items: [
      D('ft-features', 'Features', '/sitemap#company', 'mapped', 'simple', '', 'features'),
      D('ft-pricing', 'Pricing', '/sitemap#company', 'mapped', 'simple', '', 'pricing plans cost'),
      D('ft-mktdata', 'Market data', '/sitemap#company', 'mapped', 'simple', '', 'market data exchanges'),
      D('ft-apps', 'Apps', '/sitemap#company', 'mapped', 'simple', '', 'apps mobile desktop'),
      D('ft-gift', 'Gift plans', '/sitemap#company', 'mapped', 'standard', '', 'gift plans')
    ]},
    { name: 'For business', items: [
      D('ft-widgets', 'Widgets', '/sitemap#business', 'mapped', 'pro', '', 'widgets embed'),
      D('ft-libs', 'Charting libraries', '/sitemap#business', 'mapped', 'pro', '', 'charting library lightweight advanced'),
      D('ft-brokerint', 'Broker integration', '/sitemap#business', 'mapped', 'pro', '', 'brokerage integration'),
      D('ft-ads', 'Advertising', '/sitemap#business', 'mapped', 'pro', '', 'advertising ads'),
      D('ft-partner', 'Partner program', '/sitemap#business', 'mapped', 'pro', '', 'partner program education')
    ]},
    { name: 'Support', items: [
      D('ft-help', 'Help centre', '/learn#help', 'mapped', 'simple', '', 'help support'),
      D('ft-status', 'Status', '/api/health', 'live', 'standard', 'the real health endpoint', 'status uptime health'),
      D('ft-security', 'Security', '/sitemap#policies', 'mapped', 'standard', '', 'security safety'),
      D('ft-a11y', 'Accessibility', '/sitemap#policies', 'mapped', 'simple', '', 'accessibility a11y')
    ]},
    { name: 'Legal', items: [
      D('ft-terms', 'Terms', '/sitemap#policies', 'mapped', 'simple', '', 'terms use legal'),
      D('ft-privacy', 'Privacy', '/sitemap#policies', 'mapped', 'simple', '', 'privacy data'),
      D('ft-cookies', 'Cookies', '/sitemap#policies', 'mapped', 'simple', '', 'cookies'),
      D('ft-disc', 'Disclaimer', '#about-prototype', 'live', 'simple', '', 'disclaimer risk')
    ]},
    { name: 'Community extras', items: [
      D('ft-store', 'Store', '/community#rewards', 'mapped', 'standard', '', 'store merch'),
      D('ft-refer', 'Refer a friend', '/community#rewards', 'mapped', 'standard', '', 'referral refer friend'),
      D('ft-wall', 'Wall of Love', '/sitemap#company', 'mapped', 'standard', '', 'wall of love testimonials'),
      D('ft-rules', 'House rules', '/sitemap#policies', 'mapped', 'pro', '', 'house rules moderators')
    ]}
  ];

  /* --------------------------------------------------------------- helpers */

  const ORDER = { simple: 0, standard: 1, pro: 2 };
  const ALL_DOORS = [HOME, ...SECTIONS, MY_SPACE, { id: 'company', label: 'Company', url: '/sitemap#company', question: 'Kept out of the navigation on purpose', groups: FOOTER }];

  function allItems() {
    const out = [];
    for (const d of ALL_DOORS) for (const g of d.groups) for (const i of g.items) {
      out.push({ ...i, door: d.label, section: d.id, group: g.name });
    }
    return out;
  }

  /* What a menu shows.

     This used to drop every row above the visitor's level, which meant Simple
     silently deleted forty-four destinations — Wealth Hub and Rewards among
     them — with no affordance saying they existed. §7.1 of the mode brief is
     explicit: navigation categories never disappear by mode, only ordering,
     grouping and density may change.

     So the split is now shown, not applied: `rows` are the ones this level
     opens with, `more` is everything else, and the caller renders `more`
     behind a "More tools" disclosure. Nothing leaves the menu. */
  function menuSplit(section, mode = 'simple', limit = 6) {
    const max = ORDER[mode] ?? 0;
    const fit = [], rest = [];
    for (const g of section.groups) for (const i of g.items) {
      ((ORDER[i.level] ?? 0) <= max ? fit : rest).push({ ...i, group: g.name });
    }
    /* Anything past the cap is not lost either — it joins `more`, in order. */
    return { rows: fit.slice(0, limit), more: fit.slice(limit).concat(rest) };
  }

  /* Kept for callers that only want the default rows. */
  function menuRows(section, mode = 'simple', limit = 6) {
    return menuSplit(section, mode, limit).rows;
  }

  const bySection = id => ALL_DOORS.find(d => d.id === id) || null;

  function counts() {
    const all = allItems();
    return {
      total: all.length,
      live: all.filter(i => i.status === 'live').length,
      pilot: all.filter(i => i.status === 'pilot').length,
      mapped: all.filter(i => i.status === 'mapped').length
    };
  }

  /* ------------------------------------------------- four-domain metadata

     The inventory keeps its six legacy sections and all of its destination
     IDs — the coverage tests, the site map and the showcase read them, and
     renaming an ID would lose the audit trail for no gain. What is added is
     the answer to a question the inventory could not previously answer:
     WHICH OF THE FOUR DOMAINS OWNS THIS.

     Ownership is derived from the URL, not hand-listed, so a destination
     cannot drift out of sync with where it actually goes. `Navigation.ownerOf`
     is the same resolver the header and the palette use; the fallback here
     exists only for the case where `navigation.js` has not loaded. */

  const DOMAINS = [
    { id: 'home',    label: 'Home',    question: 'What matters to me today and what should I do next?' },
    { id: 'market',  label: 'Market',  question: 'What is happening across asset classes?' },
    { id: 'symbols', label: 'Symbols', question: 'What is happening with this instrument?' },
    { id: 'economy', label: 'Economy', question: 'Which macro indicators and events are moving markets?' }
  ];

  const FALLBACK_OWNER = [
    ['/economy', 'economy'], ['/markets', 'market'], ['/screeners', 'market'],
    ['/symbols', 'symbols'], ['/charts', 'symbols'], ['/research', 'symbols']
  ];

  function ownerDomain(url) {
    const path = String(url || '').split('#')[0].split('?')[0] || '/';
    if (window.Navigation && window.Navigation.ownerOf) {
      const d = window.Navigation.ownerOf(path);
      if (d) return d;
    }
    for (const [prefix, domain] of FALLBACK_OWNER) if (path.startsWith(prefix)) return domain;
    return 'home';
  }

  /* `scope` says what a destination is ABOUT, which is not the same as who
     owns it: a watchlist is personal but lives under Home, and a screener is
     market-scoped but is reached from Market. Both are needed — search ranks
     on scope, navigation groups on owner. */
  function scopeOf(url) {
    const path = String(url || '').split('#')[0].split('?')[0] || '/';
    if (path.startsWith('/economy')) return 'macro';
    if (path.startsWith('/symbols') || path.startsWith('/charts')) return 'symbol';
    if (path.startsWith('/markets') || path.startsWith('/screeners')) return 'market';
    if (path.startsWith('/money') || path.startsWith('/learn') || path.startsWith('/trade')) return 'personal';
    return 'global';
  }

  /* Every destination, with its owning domain attached. The inventory itself
     is untouched; this is a view over it. */
  const withDomains = () => allItems().map(i =>
    ({ ...i, ownerDomain: ownerDomain(i.url), scope: scopeOf(i.url) }));

  const byDomain = domainId => withDomains().filter(i => i.ownerDomain === domainId);

  /* The invariant: no destination is silently unowned. */
  const everyDestinationOwned = () =>
    withDomains().every(i => DOMAINS.some(d => d.id === i.ownerDomain));

  return {
    SECTIONS, MY_SPACE, HOME, FOOTER, ALL_DOORS, ORDER,
    DOMAINS, ownerDomain, scopeOf, withDomains, byDomain, everyDestinationOwned,
    allItems, menuRows, menuSplit, bySection, counts,
    /* kept so older callers do not break */
    NAV_DOORS: SECTIONS, PANEL_DOORS: SECTIONS, DOORS: ALL_DOORS
  };
})();
