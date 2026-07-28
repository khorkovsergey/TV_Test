/* Copy gate (§ARCH-006, §EXP-001).

   Two things this catches that nothing else does:

   1. Misspellings that keep coming back — "Standart", "Marketpalce",
      "Experts Marketplace". A lint rule is cheaper than another release
      where the header calls a mode by a name the product does not use.

   2. Claims the prototype cannot honour. The marketplace runs on demo
      consultants whose licences are not checked against any registry, so no
      user-facing page may call an adviser "verified" or state that a licence
      was verified. That contradiction was live on the stand and it is the
      single most damaging line in a case study about trust. */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
let failed = 0, checked = 0;

const walk = (dir, exts) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p, exts);
  return exts.some(x => e.name.endsWith(x)) ? [p] : [];
});

const BANNED = [
  [/Standart/g,            'misspelling — the mode is "Standard"'],
  [/Marketpalce/gi,        'misspelling — "Marketplace"'],
  [/Experts Marketplace/g, 'the feature is "Expert Marketplace", singular'],
  [/Beginner mode/gi,      'the level is "Simple", "Beginner" was retired']
];

/* Verification claims. The registry entry, the escalation copy and the
   marketplace page may describe matching, licences on file and jurisdiction —
   they may not claim the licence was checked. */
const VERIFY = [
  /verified by regulator/i,
  /regulator[- ]verified/i,
  /licence[s]? (are |is )?verified/i,
  /license[s]? (are |is )?verified/i,
  /verified advis[eo]r/i,
  /verified expert/i
];

const files = [
  ...walk(path.join(ROOT, 'public'), ['.html', '.js']),
  ...walk(path.join(ROOT, 'src'), ['.js']),
  path.join(ROOT, 'README.md')
].filter(f => fs.existsSync(f));

console.log('\n[Copy] Banned spellings');
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const text = fs.readFileSync(f, 'utf8');
  checked++;
  for (const [re, why] of BANNED) {
    // check-copy.cjs itself has to contain the patterns it bans
    if (rel === path.join('tests', 'check-copy.cjs')) continue;
    const hits = text.match(re);
    if (hits) { failed++; console.log(`  FAIL ${rel}: “${hits[0]}” — ${why}`); }
  }
}

console.log('\n[Copy] No unverifiable verification claims');
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const text = fs.readFileSync(f, 'utf8');
  for (const re of VERIFY) {
    const m = text.match(re);
    if (!m) continue;
    /* A sentence that denies the claim is exactly what we want to see. */
    const around = text.slice(Math.max(0, m.index - 160), m.index + 160);
    if (/not |never |no |simulat|unverified|does not/i.test(around)) continue;
    failed++;
    console.log(`  FAIL ${rel}: “${m[0]}” — licences are demo data and are not checked against any registry`);
  }
}

console.log(`\n${checked} files scanned, ${failed} problems.\n`);
process.exit(failed ? 1 : 0);
