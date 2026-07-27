/* =========================================================================
   The information architecture, as data.

   Every destination the real platform offers is listed here once, with where
   it lives, whether this prototype actually implements it, and who it is for.
   Four surfaces render from this one structure — the nav panels, the ⌘K
   palette, the site map and the footer — which is the only way "listed once"
   can stay true as things move.

   status: 'live'    — works in this prototype
           'pilot'   — a deliberate stub; the flow is real, the depth is not
           'mapped'  — exists on the real platform, kept in the map so the
                       regrouping can be checked, not built here
   level:  'core'    — a beginner needs it
           'pro'     — depth. Marked, sorted lower, NEVER hidden: someone who
                       cannot see that a tool exists cannot grow into it.
   ========================================================================= */

window.IA = (function () {

  const D = (id, label, url, status, level, desc, keywords) =>
    ({ id, label, url, status, level, desc, keywords: keywords || '' });

  /* ---------------------------------------------------------------- doors */

  const DOORS = [
    /* Home is a door in the navigation but has no dropdown: the page itself is
       the menu. Its routes are listed here so the palette and the map can find
       them — "what is on the home page" is a fair thing to search for. */
    {
      id: 'home',
      label: 'Home',
      url: '/',
      noPanel: true,
      tagline: 'Pick a task, we set up the rest',
      groups: [
        {
          name: 'Tasks', items: [
            D('hm-brief', "Today's brief", '/#brief', 'live', 'core', 'the three biggest moves and why', 'brief today market movers understand'),
            D('hm-asset', 'Research one asset', '/symbol.html?symbol=BTCUSD', 'live', 'core', 'price → drivers → peers → event', 'research asset symbol study'),
            D('hm-idea', 'Find an idea', '/#ideas', 'live', 'core', 'curated, with tracked outcomes', 'idea find editors picks'),
            D('hm-track', 'Track my instruments', '/#watchlist', 'live', 'core', 'watchlist and alerts', 'track watchlist follow instruments'),
            D('hm-learn', 'Learn without risk', '/academy.html', 'live', 'core', 'guided lessons on live data', 'learn academy lessons risk-free'),
            D('hm-event', 'Prepare for an event', '/markets.html#events', 'pilot', 'core', 'what it historically touches', 'event fomc cpi prepare calendar'),
            D('hm-trade', 'Start trading', '/#brokers', 'pilot', 'core', 'through a licensed broker', 'trade start broker'),
            D('hm-skip', 'Skip the portal', '/charts.html', 'live', 'core', 'straight to the workspace', 'supercharts chart workspace skip pro')
          ]
        }
      ]
    },

    {
      id: 'markets',
      label: 'Markets',
      url: '/markets.html',
      tagline: 'Explore, filter, and watch what is coming',
      groups: [
        {
          name: 'Overview', items: [
            D('mk-all', 'All markets', '/markets.html', 'live', 'core', 'every instrument, one table', 'quotes prices world entire'),
            D('mk-movers', "Today's movers", '/markets.html#movers', 'live', 'core', 'biggest gains and falls', 'gainers losers active'),
            D('mk-heat', 'Heatmap', '/markets.html#heatmap', 'live', 'core', 'the whole market at a glance', 'heatmap map colour'),
            D('mk-news', 'News', '/directory.html#markets', 'mapped', 'core', 'headlines by market', 'news flow stories'),
            D('mk-countries', 'By country', '/directory.html#markets', 'mapped', 'core', 'markets of a single country', 'countries regions world')
          ]
        },
        {
          name: 'Find & filter', items: [
            D('sc-all', 'Screener', '/screener.html', 'live', 'core', 'ask the market a question', 'screener filter search scan'),
            D('sc-stocks', 'Stock screener', '/screener.html?cls=stocks', 'live', 'core', '', 'stocks equities screener'),
            D('sc-crypto', 'Crypto screener', '/screener.html?cls=crypto', 'live', 'core', '', 'crypto coins screener'),
            D('sc-etf', 'ETF screener', '/directory.html#markets', 'mapped', 'pro', '', 'etf funds screener'),
            D('sc-bonds', 'Bond screener', '/directory.html#markets', 'mapped', 'pro', '', 'bonds government corporate'),
            D('sc-pairs', 'CEX / DEX pairs', '/directory.html#markets', 'mapped', 'pro', '', 'cex dex pairs exchange'),
            D('sc-pine', 'Pine screener', '/directory.html#markets', 'mapped', 'pro', '', 'pine script screener')
          ]
        },
        {
          name: 'Events', items: [
            D('cal-econ', 'Economic calendar', '/markets.html#events', 'pilot', 'core', 'what is scheduled and what it touches', 'calendar economic fomc cpi events'),
            D('cal-earn', 'Earnings calendar', '/directory.html#markets', 'mapped', 'core', '', 'earnings reports calendar'),
            D('cal-div', 'Dividends calendar', '/directory.html#markets', 'mapped', 'pro', '', 'dividends calendar payout'),
            D('cal-ipo', 'IPO calendar', '/directory.html#markets', 'mapped', 'pro', '', 'ipo listings calendar')
          ]
        },
        {
          name: 'Analyze', items: [
            D('an-symbol', 'Symbol page', '/symbol.html?symbol=BTCUSD', 'live', 'core', 'price, drivers, peers, next step', 'symbol instrument quote ticker'),
            D('an-fund', 'Fundamental graphs', '/directory.html#markets', 'mapped', 'pro', '', 'fundamentals financials revenue'),
            D('an-yield', 'Yield curves', '/directory.html#markets', 'mapped', 'pro', '', 'yield curve bonds rates'),
            D('an-options', 'Options', '/directory.html#markets', 'mapped', 'pro', '', 'options chain derivatives'),
            D('an-macro', 'Macro maps', '/directory.html#markets', 'mapped', 'pro', '', 'macro inflation map economy'),
            D('an-newsflow', 'News Flow', '/directory.html#markets', 'mapped', 'pro', '', 'news flow terminal feed')
          ]
        },
        {
          name: 'By asset class', items: [
            D('cls-indices', 'Indices', '/markets.html?cls=indices', 'live', 'core', '', 'indices spx nasdaq dow'),
            D('cls-stocks', 'Stocks', '/markets.html?cls=stocks', 'live', 'core', '', 'stocks shares equities'),
            D('cls-crypto', 'Crypto', '/markets.html?cls=crypto', 'live', 'core', '', 'crypto bitcoin ethereum'),
            D('cls-forex', 'Forex', '/markets.html?cls=forex', 'live', 'core', '', 'forex currencies fx'),
            D('cls-comm', 'Commodities & futures', '/markets.html?cls=commodities', 'live', 'core', '', 'commodities gold oil futures'),
            D('cls-rates', 'Rates & volatility', '/markets.html?cls=rates', 'live', 'core', '', 'rates yields vix dollar'),
            D('cls-bonds', 'Government & corporate bonds', '/directory.html#markets', 'mapped', 'pro', '', 'bonds treasury corporate'),
            D('cls-etf', 'ETFs', '/directory.html#markets', 'mapped', 'pro', '', 'etf funds'),
            D('cls-econ', 'Economy', '/directory.html#markets', 'mapped', 'pro', '', 'economy gdp inflation indicators')
          ]
        }
      ]
    },

    {
      id: 'ideas',
      label: 'Ideas',
      url: '/#ideas',
      tagline: 'What other people think, and how it turned out',
      groups: [
        {
          name: 'From traders', items: [
            D('id-editors', "Editors' Picks", '/#ideas', 'live', 'core', 'reviewed, with the tracked outcome', 'ideas editors picks curated'),
            D('id-popular', 'Popular ideas', '/#ideas', 'live', 'core', 'unreviewed community feed', 'popular trending ideas'),
            D('id-newest', 'Newest ideas', '/#ideas', 'live', 'core', 'unfiltered, newest first', 'newest latest ideas'),
            D('id-scripts', 'Indicators & strategies', '/directory.html#ideas', 'mapped', 'pro', '', 'indicators strategies scripts pine'),
            D('id-education', 'Education ideas', '/directory.html#ideas', 'mapped', 'core', '', 'education learning ideas')
          ]
        },
        {
          name: 'Compete', items: [
            D('id-leap', 'The Leap', '/directory.html#ideas', 'mapped', 'core', 'risk-free competition', 'leap competition contest prizes')
          ]
        },
        {
          name: 'Pine Script', items: [
            D('pine-docs', 'Pine docs & wizards', '/directory.html#ideas', 'mapped', 'pro', '', 'pine script docs wizard'),
            D('pine-free', 'Pine freelancers', '/directory.html#ideas', 'mapped', 'pro', '', 'freelancers pine hire'),
            D('pine-spaces', 'Paid Spaces', '/directory.html#ideas', 'mapped', 'pro', '', 'paid spaces subscription creators')
          ]
        }
      ]
    },

    {
      id: 'academy',
      label: 'Academy',
      url: '/academy.html',
      tagline: 'Learn on live data, risk nothing',
      groups: [
        {
          name: 'Learn', items: [
            D('ac-track', 'Learning track', '/academy.html', 'live', 'core', 'six steps on live data', 'academy learn lessons track'),
            D('ac-lesson', 'Lesson: compare instruments', '/lesson.html', 'live', 'core', 'the interactive one', 'lesson chart compare interactive'),
            D('ac-expert', 'Expert tracks', '/academy.html#expert-tracks', 'pilot', 'core', 'reviewed author courses', 'expert tracks courses mentors')
          ]
        },
        {
          name: 'Practice', items: [
            D('ac-paper', 'Paper Trading', '/academy.html', 'pilot', 'core', 'your first trade, no money at risk', 'paper trading practice simulator demo'),
            D('ac-mode', 'Beginner mode', '/academy.html#modePill', 'live', 'core', 'what it hides, and how to turn it off', 'beginner mode complexity simple')
          ]
        },
        {
          name: 'Reference', items: [
            D('ac-help', 'Help centre', '/directory.html#academy', 'mapped', 'core', '', 'help support faq centre'),
            D('ac-glossary', 'Glossary', '/directory.html#academy', 'mapped', 'core', '', 'glossary terms dictionary')
          ]
        }
      ]
    },

    {
      id: 'experts',
      label: 'Experts',
      url: '/experts.html',
      tagline: 'A licensed human, matched to your question',
      groups: [
        {
          name: 'Marketplace', items: [
            D('ex-find', 'Find a consultant', '/experts.html', 'live', 'core', 'brief → match → booking', 'expert consultant advisor find help'),
            D('ex-how', 'How matching works', '/experts.html#how', 'pilot', 'core', '', 'matching how works jurisdiction'),
            D('ex-become', 'Become a consultant', '/directory.html#experts', 'mapped', 'pro', '', 'become consultant apply')
          ]
        },
        {
          name: 'Desk (staff)', items: [
            D('ex-desk', 'Consultant desk', '/staff.html', 'live', 'pro', 'staff token required', 'staff desk consultant notes summary'),
            D('ex-metrics', 'Pilot metrics', '/metrics.html', 'live', 'pro', 'booking rate, AI cost', 'metrics kpi cost pilot funnel')
          ]
        }
      ]
    },

    /* Trading is a task, not a door: it lives on the home page as route 07 and
       in the map. Giving it a permanent nav slot would put the one destination
       that costs money above the four that create the reason to spend it. */
    {
      id: 'trade',
      label: 'Trade',
      url: '/#brokers',
      navHidden: true,
      tagline: 'When you are ready — and not before',
      groups: [
        {
          name: 'Practice first', items: [
            D('tr-paper', 'Paper Trading', '/academy.html', 'pilot', 'core', 'the recommended start', 'paper trading practice first')
          ]
        },
        {
          name: 'Brokers', items: [
            D('tr-top', 'Top brokers', '/#brokers', 'pilot', 'core', '', 'brokers top list'),
            D('tr-compare', 'Compare brokers', '/directory.html#trade', 'mapped', 'core', '', 'compare brokers fees'),
            D('tr-open', 'Open an account', '/directory.html#trade', 'mapped', 'core', '', 'open account broker signup'),
            D('tr-awarded', 'Awarded brokers', '/directory.html#trade', 'mapped', 'pro', '', 'awarded best brokers')
          ]
        },
        {
          name: 'Positions', items: [
            D('tr-portfolio', 'Portfolios', '/directory.html#trade', 'mapped', 'pro', '', 'portfolio holdings positions'),
            D('tr-offers', 'Special offers', '/directory.html#trade', 'mapped', 'pro', 'CME, Eurex, US stocks bundles', 'offers cme eurex bundle')
          ]
        }
      ]
    },

    /* Personal objects had no home on the real platform's top level either;
       they were scattered across Products and the chart. One place, behind the
       avatar, where everything that belongs to you lives. */
    {
      id: 'my',
      label: 'My space',
      url: '/directory.html#my',
      navHidden: true,
      tagline: 'Everything that is yours',
      groups: [
        {
          name: 'Yours', items: [
            D('my-watch', 'Watchlist', '/#watchlist', 'live', 'core', 'the symbols you follow', 'watchlist saved symbols follow'),
            D('my-alerts', 'Alerts', '/charts.html', 'pilot', 'core', 'set from the Copilot or the chart', 'alerts notify price'),
            D('my-screens', 'Saved screens', '/screener.html', 'live', 'core', 'your screener questions', 'saved screens screener'),
            D('my-journey', 'Research journey', '/symbol.html?symbol=BTCUSD', 'live', 'core', 'where you have been, what is next', 'journey trail history research'),
            D('my-settings', 'Interface mode & density', '/charts.html', 'live', 'core', 'beginner, standard, pro', 'settings mode density interface')
          ]
        }
      ]
    }
  ];

  /* -------------------------------------------------------------- footer */

  /* Company content is not navigation. It keeps a home, at the bottom, where
     someone looking for careers or the privacy policy expects to find it. */
  const FOOTER = [
    {
      name: 'Product', items: [
        D('ft-charts', 'Supercharts', '/charts.html', 'live', 'core', '', 'supercharts chart workspace'),
        D('ft-pricing', 'Pricing', '/directory.html#company', 'mapped', 'core', '', 'pricing plans cost subscription'),
        D('ft-features', 'Features', '/directory.html#company', 'mapped', 'core', '', 'features list'),
        D('ft-whatsnew', "What's new", '/directory.html#company', 'mapped', 'core', '', 'whats new changelog release'),
        D('ft-mktdata', 'Market data', '/directory.html#company', 'mapped', 'core', '', 'market data vendors exchanges'),
        D('ft-gift', 'Gift plans', '/directory.html#company', 'mapped', 'pro', '', 'gift plans present'),
        D('ft-apps', 'Mobile & desktop apps', '/directory.html#company', 'mapped', 'core', '', 'apps mobile desktop download')
      ]
    },
    {
      name: 'For business', items: [
        D('ft-widgets', 'Widgets', '/directory.html#business', 'mapped', 'pro', '', 'widgets embed'),
        D('ft-libs', 'Charting libraries', '/directory.html#business', 'mapped', 'pro', '', 'charting library lightweight advanced'),
        D('ft-platform', 'Trading platform', '/directory.html#business', 'mapped', 'pro', '', 'trading platform white label'),
        D('ft-ads', 'Advertising', '/directory.html#business', 'mapped', 'pro', '', 'advertising ads'),
        D('ft-broker-int', 'Brokerage integration', '/directory.html#business', 'mapped', 'pro', '', 'brokerage integration partner'),
        D('ft-programs', 'Partner & education programs', '/directory.html#business', 'mapped', 'pro', '', 'partner education program')
      ]
    },
    {
      name: 'Company', items: [
        D('ft-about', 'About this prototype', '#about-prototype', 'live', 'core', 'what is real here and what is not', 'about prototype disclaimer'),
        D('ft-who', 'Who we are', '/directory.html#company', 'mapped', 'core', '', 'about who we are company'),
        D('ft-careers', 'Careers', '/directory.html#company', 'mapped', 'core', '', 'careers jobs hiring'),
        D('ft-blog', 'Blog and news', '/directory.html#company', 'mapped', 'core', '', 'blog news press'),
        D('ft-media', 'Media kit', '/directory.html#company', 'mapped', 'pro', '', 'media kit press logo'),
        D('ft-space', 'Space mission', '/directory.html#company', 'mapped', 'pro', '', 'space mission astronaut'),
        D('ft-merch', 'Merch & store', '/directory.html#company', 'mapped', 'pro', '', 'merch store tarot')
      ]
    },
    {
      name: 'Policies', items: [
        D('ft-terms', 'Terms of use', '/directory.html#policies', 'mapped', 'core', '', 'terms use legal'),
        D('ft-disc', 'Disclaimer', '#about-prototype', 'live', 'core', '', 'disclaimer risk'),
        D('ft-privacy', 'Privacy policy', '/directory.html#policies', 'mapped', 'core', '', 'privacy data gdpr'),
        D('ft-cookies', 'Cookies policy', '/directory.html#policies', 'mapped', 'core', '', 'cookies policy'),
        D('ft-a11y', 'Accessibility statement', '/directory.html#policies', 'mapped', 'core', '', 'accessibility a11y'),
        D('ft-security', 'Security tips', '/directory.html#policies', 'mapped', 'pro', '', 'security tips safety'),
        D('ft-bounty', 'Bug bounty programme', '/directory.html#policies', 'mapped', 'pro', '', 'bug bounty vulnerability'),
        D('ft-status', 'Status page', '/api/health', 'live', 'pro', 'the real health endpoint', 'status uptime health'),
        D('ft-rules', 'House rules & moderators', '/directory.html#policies', 'mapped', 'pro', '', 'house rules moderators community')
      ]
    }
  ];

  /* --------------------------------------------------------------- helpers */

  const NAV_DOORS = DOORS.filter(d => !d.navHidden);
  /* Doors that get a dropdown. Home is in the bar but the page is its menu. */
  const PANEL_DOORS = NAV_DOORS.filter(d => !d.noPanel);

  const allItems = () => {
    const out = [];
    for (const d of DOORS) for (const g of d.groups) for (const i of g.items) out.push({ ...i, door: d.label, group: g.name });
    for (const g of FOOTER) for (const i of g.items) out.push({ ...i, door: 'Footer', group: g.name });
    return out;
  };

  /* The five rows a menu shows: core first, in the order the groups declare
     them, and never more than five. Everything else is one click away on the
     section page — a menu that lists everything is the thing we are replacing. */
  function menuRows(door, limit = 5) {
    const core = [];
    for (const g of door.groups) for (const i of g.items) if (i.level === 'core') core.push({ ...i, group: g.name });
    return core.slice(0, limit);
  }

  const counts = () => {
    const all = allItems();
    return {
      total: all.length,
      live: all.filter(i => i.status === 'live').length,
      pilot: all.filter(i => i.status === 'pilot').length,
      mapped: all.filter(i => i.status === 'mapped').length
    };
  };

  return { DOORS, NAV_DOORS, PANEL_DOORS, FOOTER, allItems, menuRows, counts };
})();
