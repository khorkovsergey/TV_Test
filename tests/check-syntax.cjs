/* Syntax gate over everything that ships — server modules, browser modules and
   the inline scripts inside the HTML pages. The old `npm run check` covered
   four server files and missed `market.js`, `copilot.js`, every `public/*.js`
   and every inline block, which is where most of the code actually lives. */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
let checked = 0, failed = 0;

const fail = (file, err) => {
  failed++;
  console.log(`  FAIL ${file}\n        ${String(err.message || err).split('\n')[0]}`);
};

function checkScript(code, file, opts) {
  try {
    new vm.Script(code, { filename: file, ...opts });
    checked++;
  } catch (e) { fail(file, e); }
}

/* ESM cannot be validated with vm.Script (import/export are syntax errors
   there), so server modules go through node --check instead. */
const { execFileSync } = require('node:child_process');
function checkModule(file) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    checked++;
  } catch (e) { fail(path.relative(ROOT, file), new Error(String(e.stderr || e).split('\n').slice(0, 3).join(' '))); }
}

const walk = (dir, ext) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return walk(p, ext);
  return e.name.endsWith(ext) ? [p] : [];
});

console.log('\n[Syntax] Server modules (ESM)');
for (const f of walk(path.join(ROOT, 'src'), '.js')) checkModule(f);

console.log('\n[Syntax] Browser modules');
for (const f of walk(path.join(ROOT, 'public'), '.js')) {
  checkScript(fs.readFileSync(f, 'utf8'), path.relative(ROOT, f));
}

console.log('\n[Syntax] Inline scripts inside HTML');
for (const f of walk(path.join(ROOT, 'public'), '.html')) {
  const html = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f);
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, n = 0;
  while ((m = re.exec(html))) {
    const attrs = m[1] || '';
    // JSON-LD and other data blocks are not JavaScript.
    if (/type\s*=\s*["'](?!text\/javascript|module)/i.test(attrs)) continue;
    n++;
    const before = html.slice(0, m.index).split('\n').length;
    checkScript(m[2], `${rel} (inline #${n}, line ${before})`);
  }
}

console.log(`\n${checked} files/blocks parsed, ${failed} failed.\n`);
process.exit(failed ? 1 : 0);
