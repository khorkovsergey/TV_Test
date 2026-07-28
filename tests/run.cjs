/* =========================================================================
   Test runner.

   The suites drive the real server in jsdom rather than mocking it: they
   start `src/server.js` on a test port, open every route, execute every
   script the browser would execute, and assert what a visitor can actually
   see and do. That is a deliberate choice for a no-build-step stand — a type
   checker would prove nothing here, and a unit test of a function nobody
   calls proves less.

   Usage:
     npm test                 all suites
     npm test -- mode rel     only suites whose name matches

   Exit code is the number of failed suites, so CI can gate on it.
   ========================================================================= */

const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const PORT = Number(process.env.TEST_PORT || 3217);
const ROOT = path.join(__dirname, '..');
const DIR = path.join(__dirname, 'browser');

const SUITES = fs.readdirSync(DIR).filter(f => f.endsWith('.cjs')).sort();
const filter = process.argv.slice(2).filter(a => !a.startsWith('-'));
const chosen = filter.length ? SUITES.filter(s => filter.some(f => s.includes(f))) : SUITES;

if (!chosen.length) {
  console.error('No suite matches ' + filter.join(', ') + '. Available: ' + SUITES.join(', '));
  process.exit(1);
}

function waitForServer(timeoutMs = 20000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const r = await fetch(`http://127.0.0.1:${PORT}/api/health`);
        if (r.ok || r.status === 503) return resolve();
      } catch { /* not up yet */ }
      if (Date.now() - started > timeoutMs) return reject(new Error('server did not start'));
      setTimeout(tick, 250);
    };
    tick();
  });
}

const run = (cmd, args, opts) => new Promise(resolve => {
  const p = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  p.on('close', code => resolve(code));
});

(async () => {
  /* One server for every suite: booting it per suite would triple the run
     time and prove nothing extra. */
  const server = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
    stdio: ['ignore', 'ignore', 'inherit']
  });

  let failed = 0;
  try {
    await waitForServer();
    for (const suite of chosen) {
      console.log(`\n================ ${suite} ================`);
      const code = await run(process.execPath, [path.join(DIR, suite)], {
        cwd: __dirname,
        env: { ...process.env, TEST_BASE: `http://127.0.0.1:${PORT}` }
      });
      if (code !== 0) { failed++; console.log(`---- ${suite}: FAILED (exit ${code})`); }
    }
  } catch (e) {
    console.error('Runner error:', e.message);
    failed++;
  } finally {
    server.kill();
  }

  console.log(`\n${chosen.length - failed} of ${chosen.length} suites passed.`);
  process.exit(failed);
})();
