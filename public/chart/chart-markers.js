/* =========================================================================
   Event markers (§17.1).

   When the Copilot has found dated events, they can be put back on the chart.
   The rule that makes this honest: a marker is only ever placed on a session
   the data actually contains. An event that falls outside the loaded window
   is reported as unplaced rather than nudged onto the nearest bar — a marker
   two days from where the news landed is worse than no marker.
   ========================================================================= */

window.ChartMarkers = (function () {

  const COLOURS = {
    company: '#2962FF',
    earnings: '#089981',
    regulation: '#9C27B0',
    sector: '#FF9800',
    market: '#787B86',
    macro: '#F23645',
    technical: '#8A9099',
    flow: '#8A9099'
  };

  let markers = [];

  const list = () => markers;

  /* Intraday events carry a timestamp; the chart may be on daily bars. The
     session that contains the event is the one whose date it shares. */
  function sessionOf(candles, time, interval) {
    const exact = candles.findIndex(c => c.time === time);
    if (exact !== -1) return exact;
    const day = String(time || '').slice(0, 10);
    if (interval === '1d') {
      const i = candles.findIndex(c => c.time === day);
      if (i !== -1) return i;
    }
    const i = candles.findIndex(c => String(c.time).slice(0, 10) === day);
    return i === -1 ? -1 : i;
  }

  function add(events, candles, interval) {
    const placed = [];
    const unplaced = [];
    /* Several events on one session must not draw on top of each other; the
       lane is what keeps a busy day readable. */
    const laneByIndex = new Map();

    (events || []).forEach((e, n) => {
      const idx = sessionOf(candles, e.time || e.startedAt, interval);
      if (idx === -1) { unplaced.push(e); return; }
      const lane = laneByIndex.get(idx) || 0;
      laneByIndex.set(idx, lane + 1);
      placed.push({
        id: e.id || ('mk_' + n + '_' + Math.random().toString(36).slice(2, 7)),
        time: candles[idx].time,
        eventTime: e.time || e.startedAt || null,
        title: e.title || 'Event',
        category: e.category || 'company',
        colour: COLOURS[e.category] || COLOURS.company,
        url: e.url || null,
        sourceIds: e.sourceIds || [],
        lane
      });
    });

    markers = markers.concat(placed);
    return { placed, unplaced };
  }

  function clear() { markers = []; }

  const byId = id => markers.find(m => m.id === id) || null;

  return { list, add, clear, byId, COLOURS, sessionOf };
})();
