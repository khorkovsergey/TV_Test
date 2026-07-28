/* =========================================================================
   Market data — the layer that turns the portal from a shell into a product.

   Everything a visitor sees on the markets, screener, symbol and chart
   surfaces comes from here: real quotes for a fixed universe of instruments,
   fetched server-side, cached, and labelled with where they came from and how
   old they are.

   Two rules this module exists to keep:

   1. Never invent a number. If a source fails, the instrument comes back with
      ok:false and a reason, and the UI shows a gap rather than a plausible
      figure. A stand that quietly fakes market data is worse than one that
      admits it has none.
   2. Say what is derived. Daily change, weekly and monthly performance and the
      technical readings are computed here from the daily closes, not taken from
      a vendor, so they are marked as computed.

   Source: Yahoo Finance's public chart endpoint. Delayed, free, no key, and
   good enough to make a pilot honest — it is not a market-data licence.
   ========================================================================= */

const HOST = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const RANGE = 'range=1mo&interval=1d';
const UA = 'Mozilla/5.0 (compatible; case-study-prototype/1.0)';

const TTL_MS = Number(process.env.MARKET_TTL_MS || 60_000);
/* Six seconds, not nine: with 49 symbols at a concurrency of 16 the worst case
   is now about twelve seconds instead of forty-five, which is the difference
   between a slow page and a page that looks broken. */
const TIMEOUT_MS = Number(process.env.MARKET_TIMEOUT_MS || 6_000);
const CONCURRENCY = 16;

/* ---------------------------------------------------------------- universe */

/* Display symbols follow platform convention (SPX, XAUUSD, US10Y); the second
   field is what the data source calls the same instrument. Keeping the mapping
   in one table means no page ever has to know about the vendor's tickers. */
export const CLASSES = [
  { id: 'indices',     label: 'Indices' },
  { id: 'stocks',      label: 'Stocks' },
  { id: 'crypto',      label: 'Crypto' },
  { id: 'forex',       label: 'Forex' },
  { id: 'commodities', label: 'Commodities' },
  { id: 'rates',       label: 'Rates & volatility' }
];

export const UNIVERSE = [
  ['SPX',    '^GSPC',     'indices',     'S&P 500'],
  ['NDQ',    '^IXIC',     'indices',     'Nasdaq Composite'],
  ['DJI',    '^DJI',      'indices',     'Dow Jones Industrial Average'],
  ['RUT',    '^RUT',      'indices',     'Russell 2000'],
  ['UKX',    '^FTSE',     'indices',     'FTSE 100'],
  ['DAX',    '^GDAXI',    'indices',     'DAX'],
  ['NKY',    '^N225',     'indices',     'Nikkei 225'],
  ['HSI',    '^HSI',      'indices',     'Hang Seng'],

  ['AAPL',   'AAPL',      'stocks',      'Apple'],
  ['MSFT',   'MSFT',      'stocks',      'Microsoft'],
  ['NVDA',   'NVDA',      'stocks',      'NVIDIA'],
  ['GOOGL',  'GOOGL',     'stocks',      'Alphabet'],
  ['AMZN',   'AMZN',      'stocks',      'Amazon'],
  ['META',   'META',      'stocks',      'Meta Platforms'],
  ['TSLA',   'TSLA',      'stocks',      'Tesla'],
  ['AMD',    'AMD',       'stocks',      'AMD'],
  ['MU',     'MU',        'stocks',      'Micron Technology'],
  ['NFLX',   'NFLX',      'stocks',      'Netflix'],
  ['JPM',    'JPM',       'stocks',      'JPMorgan Chase'],
  ['XOM',    'XOM',       'stocks',      'ExxonMobil'],
  ['WMT',    'WMT',       'stocks',      'Walmart'],
  ['COIN',   'COIN',      'stocks',      'Coinbase'],
  ['HOOD',   'HOOD',      'stocks',      'Robinhood'],
  ['INTC',   'INTC',      'stocks',      'Intel'],

  ['BTCUSD', 'BTC-USD',   'crypto',      'Bitcoin'],
  ['ETHUSD', 'ETH-USD',   'crypto',      'Ethereum'],
  ['SOLUSD', 'SOL-USD',   'crypto',      'Solana'],
  ['XRPUSD', 'XRP-USD',   'crypto',      'XRP'],
  ['BNBUSD', 'BNB-USD',   'crypto',      'BNB'],
  ['DOGEUSD','DOGE-USD',  'crypto',      'Dogecoin'],
  ['ADAUSD', 'ADA-USD',   'crypto',      'Cardano'],
  ['LINKUSD','LINK-USD',  'crypto',      'Chainlink'],

  ['EURUSD', 'EURUSD=X',  'forex',       'Euro / US Dollar'],
  ['GBPUSD', 'GBPUSD=X',  'forex',       'British Pound / US Dollar'],
  ['USDJPY', 'JPY=X',     'forex',       'US Dollar / Japanese Yen'],
  ['AUDUSD', 'AUDUSD=X',  'forex',       'Australian Dollar / US Dollar'],
  ['USDCAD', 'CAD=X',     'forex',       'US Dollar / Canadian Dollar'],
  ['USDCHF', 'CHF=X',     'forex',       'US Dollar / Swiss Franc'],
  ['NZDUSD', 'NZDUSD=X',  'forex',       'New Zealand Dollar / US Dollar'],
  ['EURGBP', 'EURGBP=X',  'forex',       'Euro / British Pound'],

  ['XAUUSD', 'GC=F',      'commodities', 'Gold'],
  ['XAGUSD', 'SI=F',      'commodities', 'Silver'],
  ['USOIL',  'CL=F',      'commodities', 'Crude Oil (WTI)'],
  ['NATGAS', 'NG=F',      'commodities', 'Natural Gas'],
  ['COPPER', 'HG=F',      'commodities', 'Copper'],

  ['US10Y',  '^TNX',      'rates',       'US 10-Year Treasury Yield'],
  ['US30Y',  '^TYX',      'rates',       'US 30-Year Treasury Yield'],
  ['DXY',    'DX-Y.NYB',  'rates',       'US Dollar Index'],
  ['VIX',    '^VIX',      'rates',       'CBOE Volatility Index']
].map(([symbol, vendor, cls, name]) => ({ symbol, vendor, cls, name }));

const BY_SYMBOL = new Map(UNIVERSE.map(i => [i.symbol, i]));
export const find = sym => BY_SYMBOL.get(String(sym || '').toUpperCase()) || null;

/* Instruments quoted as a percentage rather than a price. */
const IS_YIELD = new Set(['US10Y', 'US30Y']);

/* ------------------------------------------------------------- derivations */

const pct = (a, b) => (Number.isFinite(a) && Number.isFinite(b) && b !== 0) ? (a / b - 1) * 100 : null;

function sma(values, n) {
  if (values.length < n) return null;
  const tail = values.slice(-n);
  return tail.reduce((a, b) => a + b, 0) / n;
}

/* Wilder's RSI over the closes we have. With a month of daily bars this is a
   14-period reading on ~20 points — enough to be real, short enough that the
   UI has to say where it came from. */
function rsi(values, n = 14) {
  if (values.length < n + 1) return null;
  let gain = 0, loss = 0;
  for (let i = values.length - n; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  if (loss === 0) return 100;
  const rs = (gain / n) / (loss / n);
  return 100 - 100 / (1 + rs);
}

/* ------------------------------------------------------------- the fetching */

async function fetchOne(item) {
  const url = HOST + encodeURIComponent(item.vendor) + '?' + RANGE;
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new Error('source returned HTTP ' + res.status);

  const body = await res.json();
  const result = body?.chart?.result?.[0];
  if (!result) throw new Error(body?.chart?.error?.description || 'source returned no data');

  const meta = result.meta || {};
  const closes = (result.indicators?.quote?.[0]?.close || []).filter(Number.isFinite);
  const price = Number.isFinite(meta.regularMarketPrice) ? meta.regularMarketPrice : closes.at(-1);
  if (!Number.isFinite(price)) throw new Error('source returned no price');

  /* The last daily bar is today and still moving, so yesterday's close is the
     one before it — using the vendor's chartPreviousClose here would silently
     give a one-month change labelled as a daily one. */
  const prevClose = closes.length > 1 ? closes.at(-2) : meta.chartPreviousClose;

  return {
    symbol: item.symbol,
    name: item.name || meta.longName || meta.shortName || item.symbol,
    cls: item.cls,
    ok: true,
    price,
    prevClose: Number.isFinite(prevClose) ? prevClose : null,
    change: Number.isFinite(prevClose) ? price - prevClose : null,
    changePct: pct(price, prevClose),
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    wk52High: meta.fiftyTwoWeekHigh ?? null,
    wk52Low: meta.fiftyTwoWeekLow ?? null,
    volume: meta.regularMarketVolume ?? null,
    currency: meta.currency || 'USD',
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    isYield: IS_YIELD.has(item.symbol),
    perf: {
      d1: pct(price, prevClose),
      w1: pct(price, closes.at(-6)),
      m1: pct(price, closes[0])
    },
    series: closes.slice(-20),
    quotedAt: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null
  };
}

/* Bounded concurrency: forty-eight simultaneous requests is a good way to be
   rate-limited by a free endpoint. */
async function fetchAll(items) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      const item = items[i];
      try {
        out[i] = await fetchOne(item);
      } catch (err) {
        out[i] = {
          symbol: item.symbol, name: item.name, cls: item.cls,
          ok: false, error: String(err?.message || err)
        };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
  return out;
}

/* ---------------------------------------------------------------- the cache */

let cache = null;          // { at, items }
let inflight = null;

/* §MKT-001 — the confirmed bug.

   `fetchAll` turns every individual failure into `{ ok: false }` and never
   throws, so `refresh()` never threw either. The comment on `snapshot()`
   promised that a total outage would keep serving the previous snapshot; in
   fact the previous snapshot was overwritten with 49 failures, and the whole
   portal went to "no data" until the provider recovered.

   Quality is now decided before the cache is replaced, and a symbol that
   failed this round keeps its last known value, labelled stale. */
export class MarketDataUnavailableError extends Error {
  constructor(msg) { super(msg); this.name = 'MarketDataUnavailableError'; this.code = 'MARKET_UNAVAILABLE'; }
}

const MIN_REFRESH_SUCCESS_RATIO = 0.5;

function mergeWithPrevious(previous, items) {
  if (!previous) return items;
  const before = new Map(previous.map(i => [i.symbol, i]));
  return items.map(i => {
    if (i.ok) return i;
    const old = before.get(i.symbol);
    if (!old || !old.ok) return i;
    /* Old but labelled beats empty — and "retained" has to be visible, or the
       page would present a stale number as a current one. */
    return { ...old, retained: true, retained_error: i.error, retained_at: previous_at };
  });
}

let previous_at = null;

async function refresh() {
  const items = await fetchAll(UNIVERSE);
  const okCount = items.filter(i => i.ok).length;
  const ratio = items.length ? okCount / items.length : 0;

  if (okCount === 0) {
    /* Nothing came back. Without a cache this is a real outage the caller has
       to hear about; with one, the caller keeps what it had. */
    throw new MarketDataUnavailableError('No quotes were refreshed');
  }
  if (cache && ratio < MIN_REFRESH_SUCCESS_RATIO) {
    throw new MarketDataUnavailableError(
      `Refresh quality too low to replace the snapshot: ${okCount} of ${items.length}`);
  }

  previous_at = cache?.at ?? null;
  const merged = mergeWithPrevious(cache?.items, items);
  cache = { at: Date.now(), items: merged, quality: { ok: okCount, total: items.length, ratio } };
  return cache;
}

/* One refresh at a time, shared by every request that arrives during it. On a
   total failure the previous snapshot is served and flagged stale rather than
   thrown away — old-but-labelled beats empty. */
export async function snapshot() {
  const fresh = cache && (Date.now() - cache.at) < TTL_MS;
  if (!fresh) {
    if (!inflight) inflight = refresh().finally(() => { inflight = null; });
    try {
      await inflight;
    } catch (err) {
      if (!cache) throw err;
    }
  }

  const ageMs = Date.now() - cache.at;
  const failed = cache.items.filter(i => !i.ok);
  const retained = cache.items.filter(i => i.retained);

  return {
    asOf: new Date(cache.at).toISOString(),
    age_ms: ageMs,
    stale: ageMs > TTL_MS * 3,
    source: 'Yahoo Finance (free, delayed)',
    note: 'Delayed quotes from a free public endpoint. Daily change, weekly and monthly performance are computed here from daily closes.',
    universe: UNIVERSE.length,
    ok_count: cache.items.length - failed.length,
    /* Provider health, so a page can say "some of this is a minute older"
       instead of quietly mixing fresh and retained numbers. */
    quality: cache.quality || null,
    retained_count: retained.length,
    retained: retained.map(i => i.symbol),
    failed: failed.map(i => ({ symbol: i.symbol, error: i.error })),
    items: cache.items
  };
}

export async function one(sym) {
  const item = find(sym);
  if (!item) return null;

  const snap = await snapshot();
  const quote = snap.items.find(i => i.symbol === item.symbol);
  if (!quote || !quote.ok) return { ...(quote || { symbol: item.symbol }), asOf: snap.asOf, source: snap.source };

  const closes = quote.series;
  const s5 = sma(closes, 5), s20 = sma(closes, 20), r = rsi(closes, 14);

  /* Facts about the series, not a verdict on it. The platform this stand is
     modelled on prints a Buy/Sell rating here; the case argues that a computed
     signal presented as a recommendation is exactly the "success feel" the
     research complained about, so the readings ship without one. */
  const technicals = {
    computed_from: `${closes.length} daily closes`,
    sma5: s5, sma20: s20, rsi14: r,
    above_sma20: (s20 != null) ? quote.price > s20 : null,
    rsi_zone: r == null ? null : r >= 70 ? 'above 70 — stretched by this measure'
      : r <= 30 ? 'below 30 — stretched by this measure' : 'between 30 and 70 — neutral zone',
    range_position: (Number.isFinite(quote.wk52High) && Number.isFinite(quote.wk52Low) && quote.wk52High > quote.wk52Low)
      ? (quote.price - quote.wk52Low) / (quote.wk52High - quote.wk52Low) : null,
    disclaimer: 'Computed from recent daily closes. A description of past prices, not a recommendation.'
  };

  const peers = snap.items
    .filter(i => i.ok && i.cls === quote.cls && i.symbol !== quote.symbol)
    .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
    .slice(0, 5)
    .map(({ symbol, name, price, changePct, currency }) => ({ symbol, name, price, changePct, currency }));

  return { ...quote, technicals, peers, asOf: snap.asOf, source: snap.source, note: snap.note };
}

/* ---------------------------------------------------------------- movers */

/* Warm the cache at boot so the first visitor after a deploy is not the one who
   pays for forty-nine upstream requests. Failure here is not fatal: the next
   request will try again. */
export function warm() {
  return refresh()
    .then(c => console.log(`  markets: warmed ${c.items.filter(i => i.ok).length}/${UNIVERSE.length} instruments`))
    .catch(err => console.log('  markets: warm-up failed, will retry on first request —', err.message));
}

export async function movers(limit = 6) {
  const snap = await snapshot();
  const live = snap.items.filter(i => i.ok && Number.isFinite(i.changePct));
  const by = (arr, dir) => [...arr].sort((a, b) => dir * ((a.changePct ?? 0) - (b.changePct ?? 0))).slice(0, limit);

  return {
    asOf: snap.asOf,
    source: snap.source,
    stale: snap.stale,
    gainers: by(live, -1),
    losers: by(live, 1),
    /* "Most active" needs turnover, which a free chart endpoint does not give
       for every class — so this is the largest absolute daily move instead, and
       it is named for what it actually is. */
    biggest_moves: [...live].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, limit)
  };
}
