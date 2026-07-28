/* =========================================================================
   User navigation — what a person can achieve here.

   This is deliberately NOT `ia.js`. That file is the product inventory: 98
   destinations, 40 of which are mapped-but-unbuilt, and it answers the
   question "what capabilities exist". It is the right source for the command
   palette, the site map, the showcase and the coverage tests.

   It was also, until now, the source for every mega menu — which meant the
   ordinary visitor was reading an internal product map. Sixty of the ninety
   eight entries do not work; showing them as equal navigation destinations
   makes the product feel larger and heavier than it is.

   This registry answers the other question: "what can I do?". Only canonical,
   task-oriented entries that lead somewhere real. Nothing here carries PILOT
   or MAPPED, because nothing here is unbuilt.
   ========================================================================= */

window.Navigation = (function () {

  /* level: which preset opens with it. Everything stays reachable in every
     mode — level decides what leads, never what exists (§5). */
  const E = (label, url, desc, level = 'simple') => ({ label, url, desc, level });

  const SECTIONS = [
    {
      id: 'markets', label: 'Markets', url: '/markets',
      question: 'What is happening now?',
      primary: [
        E('Market overview',    '/markets',              'the day in one screen'),
        E('Why markets moved',  '/overview#why',         'move → factor → source'),
        E('Stocks',             '/markets?cls=stocks',   ''),
        E('Crypto',             '/markets?cls=crypto',   ''),
        E('Currencies',         '/markets?cls=forex',    '', 'standard'),
        E('Rates & commodities','/markets?cls=rates',    '', 'standard')
      ],
      more: [
        E('Indices',        '/markets?cls=indices',      ''),
        E('Market map',     '/markets#heatmap',          'the whole market at a glance'),
        E('Events',         '/overview#events',          'what is scheduled and what it touches'),
        E('News',           '/overview#news',            'grouped, with trust labels'),
        E('All market data','/markets',                  '49 instruments, one table')
      ]
    },

    {
      id: 'research', label: 'Research', url: '/research',
      question: 'What do I want to study?',
      primary: [
        E('Find an asset',      '/symbols/BTCUSD', 'one page per instrument'),
        E('Screener',           '/screeners',      'ask the market a question'),
        /* The entry used to describe the mode presets, which is a setting, not
           a reason to go there. What the page is now for is the one question a
           chart could never answer: what happened on that particular day. */
        E('Chart',              '/charts',         'click any candle and ask what happened that day'),
        E('Compare',            '/markets',        'side by side', 'standard'),
        E('Saved research',     '/money#saved',    'screens, journey, Copilot history', 'standard'),
        E('Ask Copilot',        '/research#search','explains the page you are on')
      ],
      more: [
        E('Fundamentals',       '/research#fundamentals', 'reporting, multiples, comparison', 'standard'),
        E('Macro & rates',      '/research#macro',        'event → markets → assets', 'standard'),
        E('Options',            '/research#options',      '', 'pro'),
        E('Strategies & testing','/research#strategies',  'replay, tester, journal', 'pro'),
        E('Pine',               '/research#pine',         'editor, scripts, docs', 'pro')
      ]
    },

    {
      id: 'money', label: 'My Money', url: '/money',
      question: 'Where does my money go, and what am I building?',
      /* The first entry is not Watchlists. Somebody opening this section is
         looking at their own money, not at instruments they follow. */
      primary: [
        E('This month',      '/money',              'income, spending, what is left'),
        E('Transactions',    '/money/transactions', 'the notebook, replaced'),
        E('Goals',           '/money/goals',        'what you are saving for'),
        E('Financial safety','/money/safety',       'reserve, debts, tax'),
        E('Net worth',       '/money/net-worth',    'what you own minus what you owe', 'standard'),
        E('Investing',       '/money/investing',    'only when it becomes relevant', 'standard')
      ],
      more: [
        E('Budget',            '/money/budget',     'planned against actual', 'standard'),
        E('Recurring payments','/money/budget#recurring', 'what repeats every month', 'standard'),
        E('Accounts',          '/money/accounts',   'cash, cards, deposits', 'standard'),
        E('Scenarios',         '/money/scenarios',  'what changes if you move money', 'pro'),
        E('Expert Marketplace','/capital/experts',  'a human adviser, matched to your situation')
      ]
    },

    {
      id: 'learn', label: 'Learn', url: '/learn',
      question: 'What do I need to understand next?',
      primary: [
        E('Start here',                  '/learn',              'six guided steps on live data'),
        E('Personal-finance foundations','/learn#money',        'before any market question'),
        E('Investing basics',            '/learn#investing',    'cash, deposits, bonds, ETFs', 'standard'),
        E('Trading basics',              '/learn#trading',      '', 'standard'),
        E('Guided Academy',              '/learn/academy',      'learning inside the product'),
        E('Paper Trading',               '/trade#practice',     'practice without money')
      ],
      more: [
        E('Chart skills',      '/learn#charts',  '', 'standard'),
        E('Pine Script',       '/learn#pine',    '', 'pro'),
        E('Strategy testing',  '/learn#strategy','', 'pro'),
        E('Expert-led tracks', '/learn/academy#tracks', 'opinions of their authors', 'standard'),
        E('Help',              '/learn#help',    '')
      ]
    },

    {
      id: 'community', label: 'Community', url: '/community',
      question: 'What are other people seeing, and who can help?',
      primary: [
        E('Editors’ Picks',      '/community#editors',   'curated, labelled, dated'),
        E('Ideas',               '/community#ideas',     'each with its author’s record', 'standard'),
        E('Discussions',         '/community#discussions','', 'standard'),
        E('Scripts',             '/community#scripts',   'indicators and strategies', 'pro'),
        E('Expert Marketplace',  '/capital/experts',     'a human adviser, matched'),
        E('Community Rewards',   '/community/rewards',   'one loop instead of four links')
      ],
      more: [
        E('Authors',      '/community#authors',      'profiles, history, disclosure', 'standard'),
        E('Following',    '/community#following',    '', 'standard'),
        E('Competitions', '/community#competitions', 'played on paper money', 'standard')
      ]
    },

    {
      id: 'practice', label: 'Practice', url: '/trade',
      /* §4.6 — called Practice, not Trade, because that is what it actually
         does. Paper trading works; broker connection does not exist. A
         section is renamed back to Trade when the real flow has depth. */
      question: 'How do I try this without risking money?',
      primary: [
        E('Paper Trading',          '/trade#practice', 'virtual balance, real prices'),
        E('First practice scenario','/trade#start',    'market → instrument → risk'),
        E('Trading journal',        '/trade#journal',  'why you entered, what happened', 'standard'),
        E('Bar replay',             '/charts',         'replay a past period', 'standard')
      ],
      more: [
        E('Broker comparison', '/trade#brokers',  'fees, markets, order types', 'standard'),
        E('Connected accounts','/trade#accounts', 'no connection exists on this stand', 'pro'),
        E('Trading terminal',  '/trade#terminal', '', 'pro')
      ]
    }
  ];

  /* Workspace lives behind the profile, not inside a section. Watchlists,
     alerts and saved research are things you keep — they are not a topic. */
  const WORKSPACE = {
    label: 'My workspace',
    items: [
      E('Watchlists',      '/money#watchlists', 'the symbols you follow'),
      E('Alerts',          '/money#alerts',     'price and event alerts'),
      E('Saved research',  '/money#saved',      'screens, journey, Copilot history'),
      E('Saved screeners', '/screeners#saved',  ''),
      E('Recent assets',   '/symbols/BTCUSD',   ''),
      E('What’s new',      '/new',              'what is new in this prototype')
    ]
  };

  const ORDER = { simple: 0, standard: 1, pro: 2 };

  /* What a section's menu opens with, and what sits under "More".
     Unlike the inventory split, nothing here is unbuilt — `more` is depth,
     not a list of things that do not exist. */
  function menu(sectionId, mode = 'simple') {
    const s = SECTIONS.find(x => x.id === sectionId);
    if (!s) return { rows: [], more: [] };
    const max = ORDER[mode] ?? 0;
    const fits = i => (ORDER[i.level] ?? 0) <= max;
    return {
      section: s,
      rows: s.primary.filter(fits),
      more: s.primary.filter(i => !fits(i)).concat(s.more)
    };
  }

  const byId = id => SECTIONS.find(s => s.id === id) || null;
  const all = () => SECTIONS.flatMap(s => s.primary.concat(s.more).map(i => ({ ...i, section: s.id })));

  return { SECTIONS, WORKSPACE, ORDER, menu, byId, all };
})();
