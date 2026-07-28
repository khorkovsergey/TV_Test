/* =========================================================================
   Route registry — one source for every canonical path.

   §ROUTE-001. The Copilot's action endpoint returned `/charts.html`, a path
   that has been a 301 redirect for two releases. It worked, so nobody noticed:
   the visitor got an extra round trip and the analytics recorded a legacy URL.
   That is what happens when route strings live in whichever module needs them.

   Express routing, the client navigation registry, the command palette, the
   feature registry, the redirects and the route tests all read from here.
   ========================================================================= */

export const ROUTES = {
  home:        '/',
  classic:     '/classic',

  overview:    '/overview',
  research:    '/research',
  trade:       '/trade',
  learn:       '/learn',
  community:   '/community',

  markets:     '/markets',
  screeners:   '/screeners',
  charts:      '/charts',
  symbol:      '/symbols',            // + /:SYMBOL

  academy:     '/learn/academy',
  lesson:      '/learn/academy/lesson',
  experts:     '/capital/experts',
  rewards:     '/community/rewards',
  money:        '/money',
  moneyTx:      '/money/transactions',
  moneyBudget:  '/money/budget',
  moneyAccounts:'/money/accounts',
  moneyGoals:   '/money/goals',
  moneySafety:  '/money/safety',
  moneyNetWorth:'/money/net-worth',
  moneyInvesting:'/money/investing',
  moneyScenarios:'/money/scenarios',
  wealth:      '/capital/wealth',
  aiPrivate:   '/research/ai-private',
  everywhere:  '/new/everywhere',
  geoAeo:      '/new/geo-aeo',

  whatsNew:    '/new',
  showcase:    '/showcase',
  sitemap:     '/sitemap',
  staff:       '/staff',
  metrics:     '/metrics'
};

/* The file each canonical route serves. */
export const PAGE_OF = {
  [ROUTES.overview]:   'overview.html',
  [ROUTES.research]:   'research.html',
  [ROUTES.trade]:      'trade.html',
  [ROUTES.learn]:      'learn.html',
  [ROUTES.community]:  'community.html',
  [ROUTES.markets]:    'markets.html',
  [ROUTES.screeners]:  'screener.html',
  [ROUTES.charts]:     'charts.html',
  [ROUTES.academy]:    'academy.html',
  [ROUTES.lesson]:     'lesson.html',
  [ROUTES.experts]:    'experts.html',
  [ROUTES.rewards]:    'rewards.html',
  [ROUTES.money]:         'money.html',
  [ROUTES.moneyTx]:       'money.html',
  [ROUTES.moneyBudget]:   'money.html',
  [ROUTES.moneyAccounts]: 'money.html',
  [ROUTES.moneyGoals]:    'money.html',
  [ROUTES.moneySafety]:   'money.html',
  [ROUTES.moneyNetWorth]: 'money.html',
  [ROUTES.moneyInvesting]:'money.html',
  [ROUTES.moneyScenarios]:'money.html',
  [ROUTES.aiPrivate]:  'ai-private.html',
  [ROUTES.everywhere]: 'everywhere.html',
  [ROUTES.geoAeo]:     'geo-aeo.html',
  [ROUTES.whatsNew]:   'new.html',
  [ROUTES.showcase]:   'showcase.html',
  [ROUTES.sitemap]:    'directory.html',
  [ROUTES.staff]:      'staff.html',
  [ROUTES.metrics]:    'metrics.html',
  [ROUTES.classic]:    'classic.html'
};

export const symbolRoute = sym => `${ROUTES.symbol}/${encodeURIComponent(String(sym || 'BTCUSD').toUpperCase())}`;
export const chartRoute = (sym, range) => {
  const q = new URLSearchParams();
  if (sym) q.set('symbol', String(sym).toUpperCase());
  if (range) q.set('range', range);
  const s = q.toString();
  return s ? `${ROUTES.charts}?${s}` : ROUTES.charts;
};

/* Paths earlier releases used. Kept so links people saved keep working, and
   listed here rather than inline so the redirect table and the tests agree. */
export const LEGACY = {
  '/index.html':      ROUTES.home,
  '/classic.html':    ROUTES.classic,
  '/overview.html':   ROUTES.overview,
  '/research.html':   ROUTES.research,
  '/capital.html':    ROUTES.money,
  '/trade.html':      ROUTES.trade,
  '/learn.html':      ROUTES.learn,
  '/community.html':  ROUTES.community,
  '/markets.html':    ROUTES.markets,
  '/screener.html':   ROUTES.screeners,
  '/screeners.html':  ROUTES.screeners,
  '/charts.html':     ROUTES.charts,
  '/academy.html':    ROUTES.academy,
  '/lesson.html':     ROUTES.lesson,
  '/experts.html':    ROUTES.experts,
  /* The marketplace moved from Community to Capital: it belongs with somebody's
     money, not with the forum. The old address keeps working. */
  '/community/experts': ROUTES.experts,
  /* §3.2 — Capital was abstract and investment-first. The section is My Money
     now, and it starts with everyday money rather than a portfolio. */
  '/capital':        ROUTES.money,
  '/capital/wealth': ROUTES.money,
  /* `/overview` keeps serving the market narrative — three Markets menu
     entries point at its sections. What §3.1 removes is the duplicate
     TOP-LEVEL entry, not the page. */
  '/directory.html':  ROUTES.sitemap,
  '/staff.html':      ROUTES.staff,
  '/metrics.html':    ROUTES.metrics,
  '/demo.html':       ROUTES.home
};
