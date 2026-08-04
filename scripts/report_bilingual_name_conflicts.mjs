/**
 * Read-only. Lists every location record carrying BOTH `name_ro` and `name_en`
 * and sorts the pairs into OK / SUSPECT / NEDECIS.
 *
 * Writes nothing, ever. There is no --apply and no output file: the report is
 * stdout, and the decisions it feeds are made by a human in admin/triage.html.
 *
 * ── The suspicion criterion ───────────────────────────────────────────────────
 *
 * Not a text heuristic on the strings themselves. A pair is SUSPECT when one of
 * its two sides is *the principal name of a different record* in the same file —
 * i.e. the split parked, in this record's `name_ro`, a string that the data
 * itself already uses to name some other place.
 *
 * The one thing that needs spelling out is what counts as "the principal name",
 * because 4 records are named `Fortăreața Roșie / Debarcaderul Regelui`,
 * `Fortăreața Roșie (Red Keep) — implicit, locul scenei cu Kevan Lannister/Varys`
 * and so on. Comparing whole strings finds none of them. So each `name` is
 * decomposed into components with the separators the project already treats as
 * list separators inside a name (`triage.py:SPLIT_CANDIDATE` — `;` `,` ` / ` —
 * plus the em dash), and parentheses are peeled: `X (Y)` yields both `X` and `Y`.
 * The decomposition is mechanical and reversible; it never inspects meaning.
 *
 * The probe side is decomposed the same way, which is what catches
 * `white_harbor.name_en = "New Keep (White Harbor)"` against the record actually
 * named `White Harbor`.
 *
 * ── Why the audit list is seeded in as well ───────────────────────────────────
 *
 * Measured: the collision rule alone flags 5 of the 56 pairs, and only 3 of the
 * 8 that docs/VERIFICARE_FINALA.md CRITICAL-1 lists by hand. `the_eyrie`
 * (`Ținutul Eyrie` / `The Eyrie`) has no structural tell at all — no other record
 * is named `Ținutul Eyrie` — so nothing mechanical can separate it from
 * `turnul_regelui` (`Turnul Regelui` / `King's Tower`), which is a good pair.
 * Those findings are human readings with a source, so they are carried in as
 * SUSPECT with `audit:CRITICAL-1` as their reason rather than being re-derived.
 * Every SUSPECT row states which of the two put it there.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOCATIONS = join(ROOT, 'data/locations/locations.json');

/**
 * Hand-read pairs from docs/VERIFICARE_FINALA.md CRITICAL-1. Not re-derived
 * here; cited. The value is the note from that table.
 */
const AUDIT_CRITICAL_1 = {
  kings_landing: 'Fortăreața Roșie e o clădire ÎN oraș, nu orașul',
  white_harbor_city: 'Gâtul e o regiune la ~1000 de mile distanță',
  garda_apei_cenusii: 'perechi complet nelegate',
  fundatura_puricilor: 'Flea Bottom ≠ orașul',
  strada_otelului: 'stradă în oraș ≠ orașul',
  casa_celor_nemuritori: 'este House of the Undying, nu House of Dust',
  the_eyrie: '„Ținutul" = regiunea, nu castelul',
  white_harbor: 'New Keep e cetatea, Portul Alb e orașul'
};

const fold = value => String(value ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().trim().replace(/\s+/g, ' ');

/** `triage.py:SPLIT_CANDIDATE`, plus the em dash that the same data also uses. */
const SEPARATORS = /\s*[;,]\s*|\s+\/\s+|\s+[—–]\s+/;

/**
 * Every string that this `name` puts forward as naming a place: the whole
 * thing, each list part, and both sides of every parenthesis.
 */
function components(name) {
  const found = new Set();
  const push = value => {
    const key = fold(value);
    if (key) found.add(key);
  };
  push(name);
  for (const part of String(name ?? '').split(SEPARATORS)) {
    if (!part.trim()) continue;
    push(part);
    push(part.replace(/\s*\([^)]*\)/g, ' '));
    for (const [, inner] of part.matchAll(/\(([^)]*)\)/g)) push(inner);
  }
  return found;
}

const rows = JSON.parse(readFileSync(LOCATIONS, 'utf8'));

// component → ids of the records whose principal `name` produces it.
const owners = new Map();
for (const row of rows) {
  for (const key of components(row.name)) {
    if (!owners.has(key)) owners.set(key, new Set());
    owners.get(key).add(row.id);
  }
}
const nameOf = new Map(rows.map(row => [row.id, row.name]));

const pairs = rows.filter(row => row.name_ro && row.name_en);

const report = pairs.map(row => {
  const collisions = [];
  for (const side of ['name_ro', 'name_en']) {
    for (const key of components(row[side])) {
      for (const other of owners.get(key) ?? []) {
        if (other !== row.id) collisions.push({ side, value: key, other });
      }
    }
  }

  const audit = AUDIT_CRITICAL_1[row.id] ?? null;
  const reasons = [];
  if (collisions.length) {
    const seen = new Set();
    for (const hit of collisions) {
      const label = `${hit.side}="${hit.value}" → ${hit.other}`;
      if (!seen.has(label)) { seen.add(label); reasons.push(`collision:${label}`); }
    }
  }
  if (audit) reasons.push(`audit:CRITICAL-1 (${audit})`);

  // The pair keeps the extracted string on one side and adds a translation on
  // the other — the shape a correct split leaves behind.
  const anchored = fold(row.name) === fold(row.name_ro) || fold(row.name) === fold(row.name_en);

  const bucket = reasons.length ? 'SUSPECT' : (anchored ? 'OK' : 'NEDECIS');
  return { row, bucket, reasons, collisions, anchored };
});

const order = { SUSPECT: 0, NEDECIS: 1, OK: 2 };
report.sort((a, b) => order[a.bucket] - order[b.bucket] || a.row.id.localeCompare(b.row.id));

// `--json` prints the same classification to stdout for the marking step to
// consume. Still read-only: it opens no file for writing. Keeping the rule in
// one place is the point — the marker must not re-derive who is suspect.
if (process.argv.includes('--json')) {
  const payload = report.map(entry => ({
    id: entry.row.id,
    bucket: entry.bucket,
    name: entry.row.name,
    name_ro: entry.row.name_ro,
    name_en: entry.row.name_en,
    type: entry.row.type,
    reasons: entry.reasons,
    conflicts_with: [...new Set(entry.collisions.map(hit => hit.other))],
    evidence: [...new Set(entry.collisions.map(hit =>
      `${hit.side}="${hit.value}" este nume principal la ${hit.other} ("${nameOf.get(hit.other)}")`))],
    audit: AUDIT_CRITICAL_1[entry.row.id] ?? null
  }));
  console.log(JSON.stringify({
    generated_by: 'scripts/report_bilingual_name_conflicts.mjs',
    source_file: 'data/locations/locations.json',
    records: rows.length,
    pairs: pairs.length,
    items: payload
  }, null, 2));
  process.exit(0);
}

const pad = (value, width) => String(value ?? '').padEnd(width);
const W = [30, 34, 26, 26, 14];

console.log(`locations.json: ${rows.length} înregistrări · ${pairs.length} cu name_ro ȘI name_en\n`);
console.log([pad('id', W[0]), pad('name', W[1]), pad('name_ro', W[2]), pad('name_en', W[3]), 'type'].join(' '));
console.log('─'.repeat(W.reduce((a, b) => a + b + 1, 0)));

let bucket = null;
for (const entry of report) {
  if (entry.bucket !== bucket) {
    bucket = entry.bucket;
    const count = report.filter(other => other.bucket === bucket).length;
    console.log(`\n### ${bucket} — ${count}\n`);
  }
  const { row } = entry;
  console.log([pad(row.id, W[0]), pad(row.name, W[1]), pad(row.name_ro, W[2]),
    pad(row.name_en, W[3]), row.type].join(' '));
  for (const reason of entry.reasons) console.log(`${' '.repeat(4)}↳ ${reason}`);
}

const counts = Object.fromEntries(['OK', 'SUSPECT', 'NEDECIS']
  .map(name => [name, report.filter(entry => entry.bucket === name).length]));

console.log('\n' + '─'.repeat(80));
console.log(`TOTAL ${pairs.length}  ·  OK ${counts.OK}  ·  SUSPECT ${counts.SUSPECT}  ·  NEDECIS ${counts.NEDECIS}`);

const byCollision = report.filter(entry => entry.collisions.length).map(entry => entry.row.id);
const byAuditOnly = report.filter(entry => !entry.collisions.length && AUDIT_CRITICAL_1[entry.row.id])
  .map(entry => entry.row.id);
console.log(`SUSPECT prin criteriul de coliziune : ${byCollision.length} — ${byCollision.join(', ')}`);
console.log(`SUSPECT numai din auditul CRITICAL-1: ${byAuditOnly.length} — ${byAuditOnly.join(', ')}`);

console.log('\nÎnregistrările cu care se ciocnesc:');
for (const entry of report.filter(item => item.collisions.length)) {
  const others = [...new Set(entry.collisions.map(hit => hit.other))];
  for (const other of others) {
    console.log(`  ${pad(entry.row.id, 24)} ↔ ${pad(other, 34)} "${nameOf.get(other)}"`);
  }
}

console.log('\nid-urile de marcat name_review_status="contested":');
console.log(JSON.stringify(report.filter(entry => entry.bucket === 'SUSPECT').map(entry => entry.row.id), null, 0));
