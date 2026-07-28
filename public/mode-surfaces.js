/* =========================================================================
   Surface composition matrix (§8).

   Until now the mode was applied by each page for itself: `SIMPLE_ROUTES` in
   `index.html`, a complexity bucket in `hub.js`, a prompt cap in `copilot.js`,
   a `data-min` sweep in `charts.html`. Every one of them was a local answer to
   the same question, which is why Professional ended up as "Standard plus one
   block" on the home page and byte-identical to Standard in five of six menus.

   This file is that question answered once. A surface declares what it opens
   with, in what order, and which actions lead — per mode. Pages read the
   composition; they no longer each invent one.

   What a composition may NOT do: remove a destination, change a number, or
   gate a feature. `overflow` and `advanced` are placements, not deletions.
   ========================================================================= */

window.ModeSurfaces = (function () {

  /* lead        the one module the page opens with
     primary     shown, in order
     secondary   shown, below the fold
     collapsed   present, folded into a disclosure
     overflow    present, behind a "More" affordance
     advanced    present, behind an explicit advanced drawer            */
  const PLACEMENTS = ['lead', 'primary', 'secondary', 'collapsed', 'overflow', 'advanced'];

  /* Shorthand: `c(objective, order, placement, actions, extra)`. Written out
     rather than generated, because this table is meant to be read by a person
     deciding what a mode should feel like. */
  const c = (objective, moduleOrder, modulePlacement, primaryActions, extra) => ({
    objective, moduleOrder, modulePlacement,
    primaryActions: primaryActions || [],
    overflowActions: (extra && extra.overflowActions) || [],
    primaryTabs: extra && extra.primaryTabs,
    overflowTabs: extra && extra.overflowTabs,
    defaultOpenSections: (extra && extra.defaultOpenSections) || [],
    visibleColumns: extra && extra.visibleColumns,
    formProfile: extra && extra.formProfile,
    copilotProfile: extra && extra.copilotProfile
  });

  const SURFACES = {

    /* ------------------------------------------------------------- home */

    home: {
      surface: 'home',
      /* The same six modules in all three modes — what differs is which one
         leads and where the rest sit. Writing different module lists per mode
         would have been the old bug in a new file: a module that exists in one
         composition and simply is not mentioned in another. */
      simple: c(
        'Help the visitor pick the first useful thing to do.',
        ['tasks', 'flagship', 'brief', 'journey', 'continue', 'desk'],
        { tasks: 'lead', flagship: 'primary', brief: 'secondary', journey: 'collapsed',
          continue: 'overflow', desk: 'overflow' },
        ['manage_money'],
        { defaultOpenSections: ['tasks'], copilotProfile: 'teacher' }
      ),
      standard: c(
        'Continue yesterday’s work.',
        ['continue', 'brief', 'tasks', 'flagship', 'journey', 'desk'],
        { continue: 'lead', brief: 'primary', tasks: 'primary', flagship: 'secondary',
          journey: 'secondary', desk: 'overflow' },
        ['open_recent', 'open_watchlist'],
        { copilotProfile: 'researcher' }
      ),
      pro: c(
        'Open a tool, or resume the workspace.',
        ['desk', 'continue', 'brief', 'tasks', 'flagship', 'journey'],
        { desk: 'lead', continue: 'primary', brief: 'primary', tasks: 'collapsed',
          flagship: 'collapsed', journey: 'overflow' },
        ['open_chart', 'open_screener', 'search_symbol'],
        { copilotProfile: 'analyst' }
      )
    },

    /* --------------------------------------------------------- overview */

    overview: {
      surface: 'overview',
      simple: c('What moved, and why.',
        ['why', 'events', 'assets', 'news', 'breadth'],
        { why: 'lead', events: 'primary', assets: 'secondary', news: 'collapsed', breadth: 'overflow' },
        ['explain_move']),
      standard: c('The day, in one screen.',
        ['brief', 'events', 'news', 'why', 'breadth'],
        { brief: 'lead', events: 'primary', news: 'primary', why: 'secondary', breadth: 'collapsed' },
        ['open_markets', 'follow_event']),
      pro: c('Breadth, volatility, rates and factor context.',
        ['breadth', 'brief', 'events', 'news', 'why'],
        { breadth: 'lead', brief: 'primary', events: 'primary', news: 'secondary', why: 'overflow' },
        ['open_screener', 'open_chart', 'compare_regions'])
    },

    /* ---------------------------------------------------------- markets */

    markets: {
      surface: 'markets',
      simple: c('What moved, why, and what to study next.',
        ['movers', 'table', 'heatmap', 'events'],
        { movers: 'lead', table: 'primary', heatmap: 'collapsed', events: 'secondary' },
        ['explain_move', 'open_symbol'],
        /* Keys are the page's own column keys, not prose: a matrix that names
           columns the table does not have is a matrix nobody can apply. */
        { visibleColumns: ['symbol', 'name', 'changePct', 'price', 'why'] }),
      standard: c('The market, filtered the way you work.',
        ['table', 'movers', 'heatmap', 'events'],
        { table: 'lead', movers: 'primary', heatmap: 'primary', events: 'secondary' },
        ['open_symbol', 'open_chart', 'add_watchlist'],
        { visibleColumns: ['symbol', 'name', 'price', 'changePct', 'change', 'w1', 'm1', 'spark'] }),
      pro: c('Dense table first, everything else beside it.',
        ['table', 'breadth', 'heatmap', 'movers', 'events'],
        { table: 'lead', breadth: 'primary', heatmap: 'secondary', movers: 'secondary', events: 'collapsed' },
        ['open_chart', 'open_screener', 'add_watchlist', 'compare'],
        { visibleColumns: ['symbol', 'name', 'price', 'changePct', 'change', 'w1', 'm1', 'volume', 'range', 'spark'] })
    },

    /* --------------------------------------------------------- research */

    research: {
      surface: 'research',
      /* Ids match what `research.html` labels its modules. Professional leads
         with the options desk because that is the module a professional opens
         the page for; Simple leads with fundamentals because it is the one a
         beginner can read. */
      simple: c('Find something, understand it, keep it.',
        ['fundamentals', 'macro', 'options', 'options-desk', 'correlation', 'seasonality'],
        { fundamentals: 'lead', macro: 'primary', options: 'more',
          'options-desk': 'more', correlation: 'more', seasonality: 'more' },
        ['find_asset', 'ask_copilot', 'open_chart']),
      standard: c('The everyday research desk.',
        ['fundamentals', 'macro', 'correlation', 'seasonality', 'options', 'options-desk'],
        { fundamentals: 'lead', macro: 'primary', correlation: 'collapsed',
          seasonality: 'collapsed', options: 'collapsed', 'options-desk': 'more' },
        ['open_screener', 'open_chart', 'find_asset', 'ask_copilot', 'compare']),
      pro: c('Straight to the tool.',
        ['options-desk', 'correlation', 'seasonality', 'options', 'fundamentals', 'macro'],
        { 'options-desk': 'lead', correlation: 'primary', seasonality: 'primary',
          options: 'primary', fundamentals: 'secondary', macro: 'secondary' },
        ['open_screener', 'open_chart', 'open_pine', 'open_strategies', 'compare', 'saved_work'])
    },

    /* --------------------------------------------------------- screener */

    screener: {
      surface: 'screener',
      simple: c('Ask the market a question in words.',
        ['presets', 'results', 'filters', 'saved'],
        { presets: 'lead', results: 'primary', filters: 'collapsed', saved: 'overflow' },
        ['run_preset', 'explain_match'],
        { formProfile: 'wizard', visibleColumns: ['symbol', 'name', 'changePct', 'why', 'act'] }),
      standard: c('Filter, sort, save.',
        ['filters', 'results', 'presets', 'saved'],
        { filters: 'lead', results: 'primary', presets: 'primary', saved: 'secondary' },
        ['apply_filters', 'save_screen', 'compare_selected'],
        { formProfile: 'grouped',
          visibleColumns: ['symbol', 'name', 'cls', 'price', 'changePct', 'w1', 'm1', 'act'] }),
      pro: c('Everything open, keyboard first.',
        ['filters', 'results', 'saved', 'presets'],
        { filters: 'lead', results: 'primary', saved: 'primary', presets: 'secondary' },
        ['apply_filters', 'save_screen', 'compare_selected', 'bulk_select', 'export'],
        { formProfile: 'dense',
          visibleColumns: ['symbol', 'name', 'cls', 'price', 'changePct', 'w1', 'm1', 'range', 'spark', 'act'] })
    },

    /* -------------------------------------------------------- asset hub */

    'asset-hub': {
      surface: 'asset-hub',
      simple: c('What is it, and why did it move.',
        ['summary', 'why', 'chart', 'events', 'more'],
        { summary: 'lead', why: 'primary', chart: 'primary', events: 'secondary', more: 'overflow' },
        ['add_watchlist', 'create_alert', 'open_chart'],
        { primaryTabs: ['overview', 'why', 'chart', 'events'], overflowTabs: ['metrics', 'technicals', 'news', 'ideas'] }),
      standard: c('The full asset page.',
        ['summary', 'chart', 'metrics', 'technicals', 'events', 'news', 'ideas'],
        { summary: 'lead', chart: 'primary', metrics: 'primary', technicals: 'primary', events: 'secondary', news: 'secondary', ideas: 'secondary' },
        ['add_watchlist', 'create_alert', 'open_chart', 'compare', 'open_screener'],
        { primaryTabs: ['overview', 'chart', 'metrics', 'technicals', 'events', 'news', 'ideas'] }),
      pro: c('Dense, with every reading in reach.',
        ['chart', 'metrics', 'technicals', 'summary', 'events', 'news', 'ideas'],
        { chart: 'lead', metrics: 'primary', technicals: 'primary', summary: 'primary', events: 'primary', news: 'secondary', ideas: 'secondary' },
        ['open_chart', 'compare', 'open_screener', 'create_alert', 'add_watchlist', 'practice', 'ask_copilot'])
    },

    /* ------------------------------------------------------------ chart */

    chart: {
      surface: 'chart',
      simple: c('Point at a day and ask what happened.',
        ['plot', 'copilot', 'watchlist', 'details'],
        { plot: 'lead', copilot: 'primary', watchlist: 'secondary', details: 'collapsed' },
        ['select_candle', 'ask_copilot', 'create_alert'],
        { copilotProfile: 'teacher' }),
      standard: c('Research a candle or a period.',
        ['plot', 'copilot', 'watchlist', 'details'],
        { plot: 'lead', copilot: 'primary', watchlist: 'primary', details: 'secondary' },
        ['select_candle', 'select_period', 'compare', 'create_alert', 'save_research'],
        { copilotProfile: 'researcher' }),
      pro: c('The full workspace.',
        ['plot', 'copilot', 'details', 'watchlist'],
        { plot: 'lead', copilot: 'primary', details: 'primary', watchlist: 'primary' },
        ['select_candle', 'select_period', 'compare', 'create_alert', 'save_research', 'layouts', 'export_context'],
        { copilotProfile: 'analyst' })
    },

    /* ------------------------------------------------------------ money */

    money: {
      surface: 'money',
      simple: c('Replace the notebook.',
        ['totals', 'recent', 'nextStep', 'goals', 'categories', 'safety', 'netWorth', 'accounts', 'scenarios'],
        { totals: 'lead', recent: 'primary', nextStep: 'primary', goals: 'secondary',
          categories: 'collapsed', safety: 'collapsed', netWorth: 'overflow', accounts: 'overflow', scenarios: 'advanced' },
        ['quick_add'],
        { formProfile: 'wizard' }),
      standard: c('Plan the month, and what it is building.',
        ['totals', 'categories', 'recent', 'goals', 'safety', 'netWorth', 'accounts', 'nextStep', 'scenarios'],
        { totals: 'lead', categories: 'primary', recent: 'primary', goals: 'primary',
          safety: 'primary', netWorth: 'secondary', accounts: 'secondary', nextStep: 'secondary', scenarios: 'collapsed' },
        ['quick_add', 'add_goal', 'set_budget'],
        { formProfile: 'grouped' }),
      pro: c('The structure, and what to do with it.',
        ['netWorth', 'accounts', 'totals', 'categories', 'scenarios', 'safety', 'goals', 'recent', 'nextStep'],
        { netWorth: 'lead', accounts: 'primary', totals: 'primary', categories: 'primary',
          scenarios: 'primary', safety: 'secondary', goals: 'secondary', recent: 'secondary', nextStep: 'collapsed' },
        ['quick_add', 'add_account', 'add_goal', 'import', 'export'],
        { formProfile: 'dense' })
    },

    /* ------------------------------------------------------------ learn */

    learn: {
      surface: 'learn',
      simple: c('Take the next step you can actually take.',
        ['current', 'foundations', 'academy', 'practice', 'tracks'],
        { current: 'lead', foundations: 'primary', academy: 'primary', practice: 'secondary', tracks: 'collapsed' },
        ['continue_track']),
      standard: c('Learn what your work needs next.',
        ['current', 'academy', 'tracks', 'foundations', 'practice'],
        { current: 'lead', academy: 'primary', tracks: 'primary', foundations: 'secondary', practice: 'secondary' },
        ['continue_track', 'browse_tracks']),
      pro: c('Advanced tracks and tooling.',
        ['tracks', 'academy', 'current', 'practice', 'foundations'],
        { tracks: 'lead', academy: 'primary', current: 'secondary', practice: 'secondary', foundations: 'overflow' },
        ['browse_tracks', 'open_pine'])
    },

    academy: {
      surface: 'academy',
      simple: c('One lesson at a time, on real data.',
        ['current', 'lessons', 'progress', 'advanced'],
        { current: 'lead', lessons: 'primary', progress: 'secondary', advanced: 'collapsed' },
        ['continue_lesson']),
      standard: c('The track, and where you are in it.',
        ['lessons', 'current', 'progress', 'advanced'],
        { lessons: 'lead', current: 'primary', progress: 'primary', advanced: 'secondary' },
        ['continue_lesson', 'choose_track']),
      pro: c('Advanced material, no preamble.',
        ['advanced', 'lessons', 'progress', 'current'],
        { advanced: 'lead', lessons: 'primary', progress: 'secondary', current: 'secondary' },
        ['choose_track'])
    },

    /* -------------------------------------------------------- community */

    community: {
      surface: 'community',
      simple: c('Curated, dated and labelled.',
        ['editors', 'ideas', 'discussions', 'authors', 'scripts'],
        { editors: 'lead', ideas: 'secondary', discussions: 'collapsed', authors: 'overflow', scripts: 'overflow' },
        ['read_pick']),
      standard: c('What is relevant to you.',
        ['foryou', 'ideas', 'discussions', 'authors', 'editors', 'scripts'],
        { foryou: 'lead', ideas: 'primary', discussions: 'primary', authors: 'secondary', editors: 'secondary', scripts: 'collapsed' },
        ['open_idea', 'follow_author']),
      pro: c('The full feed and the scripts.',
        ['feed', 'scripts', 'discussions', 'authors', 'ideas', 'editors'],
        { feed: 'lead', scripts: 'primary', discussions: 'primary', authors: 'primary', ideas: 'secondary', editors: 'collapsed' },
        ['open_script', 'open_idea', 'follow_author'])
    },

    /* --------------------------------------------------------- practice */

    practice: {
      surface: 'practice',
      simple: c('Try it without money.',
        ['paper', 'firstScenario', 'journal', 'replay', 'broker'],
        { paper: 'lead', firstScenario: 'primary', journal: 'secondary', replay: 'collapsed', broker: 'overflow' },
        ['start_paper']),
      standard: c('Practise, review, repeat.',
        ['paper', 'replay', 'journal', 'firstScenario', 'broker'],
        { paper: 'lead', replay: 'primary', journal: 'primary', firstScenario: 'secondary', broker: 'secondary' },
        ['start_paper', 'open_replay', 'open_journal']),
      pro: c('A practice desk.',
        ['paper', 'journal', 'replay', 'broker', 'firstScenario'],
        { paper: 'lead', journal: 'primary', replay: 'primary', broker: 'primary', firstScenario: 'overflow' },
        ['start_paper', 'open_journal', 'risk_controls'])
    },

    /* ----------------------------------------------- expert marketplace */

    'expert-marketplace': {
      surface: 'expert-marketplace',
      simple: c('One question at a time.',
        ['intake', 'explain', 'profiles', 'compare'],
        { intake: 'lead', explain: 'primary', profiles: 'secondary', compare: 'collapsed' },
        ['start_request'],
        { formProfile: 'wizard' }),
      standard: c('Describe the task and compare advisers.',
        ['intake', 'profiles', 'compare', 'explain'],
        { intake: 'lead', profiles: 'primary', compare: 'primary', explain: 'secondary' },
        ['start_request', 'compare_profiles'],
        { formProfile: 'grouped' }),
      pro: c('Full context and credentials.',
        ['intake', 'profiles', 'compare', 'explain'],
        { intake: 'lead', profiles: 'primary', compare: 'primary', explain: 'collapsed' },
        ['start_request', 'compare_profiles', 'share_context'],
        { formProfile: 'dense' })
    },

    /* ---------------------------------------------------------- copilot */

    copilot: {
      surface: 'copilot',
      simple: c('Explain it, then offer one next step.',
        ['answer', 'sources', 'actions', 'factors'],
        { answer: 'lead', sources: 'primary', actions: 'primary', factors: 'collapsed' },
        [], { copilotProfile: 'teacher' }),
      standard: c('Research it, with the evidence.',
        ['answer', 'factors', 'sources', 'actions'],
        { answer: 'lead', factors: 'primary', sources: 'primary', actions: 'primary' },
        [], { copilotProfile: 'researcher' }),
      pro: c('Structured evidence, compact.',
        ['answer', 'factors', 'sources', 'actions'],
        { answer: 'lead', factors: 'primary', sources: 'primary', actions: 'primary' },
        [], { copilotProfile: 'analyst' })
    },

    /* --------------------------------------------------------- what's new */

    'whats-new': {
      surface: 'whats-new',
      simple: c('What is new, in plain words.',
        ['flagship', 'concepts', 'core'],
        { flagship: 'lead', concepts: 'primary', core: 'secondary' }, []),
      standard: c('What is new and what it changes.',
        ['flagship', 'core', 'concepts'],
        { flagship: 'lead', core: 'primary', concepts: 'primary' }, []),
      pro: c('The full list with maturity.',
        ['flagship', 'core', 'concepts'],
        { flagship: 'lead', core: 'primary', concepts: 'primary' }, [])
    },

    /* ------------------------------------------------------- navigation */

    navigation: {
      surface: 'navigation',
      simple: c('Lead with what a beginner can act on.',
        [], {}, [], { primaryTabs: ['money', 'learn', 'markets', 'research', 'practice'] }),
      standard: c('The current six sections, unchanged.',
        [], {}, [], { primaryTabs: ['markets', 'research', 'money', 'learn', 'community', 'practice'] }),
      pro: c('Tools first.',
        [], {}, [], { primaryTabs: ['markets', 'screeners', 'charts', 'research', 'practice'] })
    }
  };

  const SURFACE_IDS = Object.keys(SURFACES);

  /* A composition is normalised before it is handed out: any module another
     mode declares but this one forgot is appended at `overflow`. That makes
     "nothing disappears between modes" true by construction rather than by
     everyone remembering to list every module in every mode — which is
     exactly the discipline the old per-page conditionals failed at. */
  const normalised = new Map();

  function normalise(surfaceId) {
    if (normalised.has(surfaceId)) return normalised.get(surfaceId);
    const s = SURFACES[surfaceId];
    if (!s) return null;
    const modes = ['simple', 'standard', 'pro'];
    const union = [];
    modes.forEach(m => (s[m].moduleOrder || []).forEach(id => {
      if (!union.includes(id)) union.push(id);
    }));
    const out = {};
    for (const m of modes) {
      const order = (s[m].moduleOrder || []).slice();
      const placement = { ...s[m].modulePlacement };
      for (const id of union) {
        if (!order.includes(id)) { order.push(id); placement[id] = placement[id] || 'overflow'; }
      }
      out[m] = { ...s[m], moduleOrder: order, modulePlacement: placement };
    }
    normalised.set(surfaceId, out);
    return out;
  }

  function get(surface, mode) {
    const s = normalise(surface);
    if (!s) return null;
    const m = (window.Modes && window.Modes.isMode(mode)) ? mode : 'simple';
    return s[m] || s.simple;
  }

  const placementOf = (surface, mode, moduleId) => {
    const comp = get(surface, mode);
    if (!comp) return 'primary';
    return comp.modulePlacement[moduleId] || 'secondary';
  };

  /* A module never disappears — the weakest placement is still a door. This is
     the invariant the whole matrix exists to keep, so it is checkable. */
  function everyModuleReachable(surface) {
    const s = normalise(surface);
    if (!s) return true;
    const modes = ['simple', 'standard', 'pro'];
    const union = new Set();
    modes.forEach(m => s[m].moduleOrder.forEach(id => union.add(id)));
    return modes.every(m => [...union].every(id =>
      s[m].moduleOrder.includes(id) && s[m].modulePlacement[id]));
  }

  return { SURFACES, SURFACE_IDS, PLACEMENTS, get, placementOf, everyModuleReachable };
})();
