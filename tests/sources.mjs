// Regression checks for provenance folding (js/utils/sources.js).
// Run with: node tests/sources.mjs
//
// The layout half of the change needs a browser; this covers the half that does
// not — which shapes count as a citation, how they fold per book, and where a
// concatenated claim is allowed to be split.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectClaimVariants, collectSources, groupSourcesByBook, normalizeSource, splitConcatenatedClaim
} from '../js/utils/sources.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const characters = JSON.parse(readFileSync(join(root, 'data/characters/characters.json'), 'utf8'));
const fail = message => { throw new Error(message); };
const byId = id => characters.find(character => character.id === id) || fail(`missing character ${id}`);

// ── Field names ────────────────────────────────────────────────────────────
// WikiPage.sourceBlock used to look for `book`/`carte` only. No character record
// carries either, which is why the book name was missing from every citation.
if (characters.some(character => character.titles?.some(title => title.surse?.some(source => source.book)))) {
  fail('a title now uses `book`; the alias list in sources.js must be re-checked');
}
const bookField = normalizeSource({ source_book: 'Foc și Sânge', source_page: '120, 145' });
if (bookField.book !== 'Foc și Sânge') fail('source_book is not read as the book');
if (bookField.pages.length !== 2) fail(`expected 2 pages, got ${bookField.pages.length}`);
if (normalizeSource({ confidence: 'confirmed' })) fail('a record citing nothing must not become a citation');
if (normalizeSource('https://awoiaf.example/x')?.url !== 'https://awoiaf.example/x') fail('a URL must stay a link, not become a book title');

// ── Grouping ───────────────────────────────────────────────────────────────
// Three claims out of one volume are one line, not three.
const grouped = groupSourcesByBook([
  normalizeSource({ source_book: 'Foc și Sânge', source_page: '200' }),
  normalizeSource({ source_book: 'Foc și Sânge', source_page: '120, 145', source_fragment: '3.2' }),
  normalizeSource({ source_book: 'Iureșul Săbiilor', source_page: '52–55' })
]);
if (grouped.length !== 2) fail(`expected 2 book groups, got ${grouped.length}`);
if (grouped[0].pages.join(', ') !== '120, 145, 200') fail(`pages not merged in order: ${grouped[0].pages.join(', ')}`);
if (grouped[0].count !== 2) fail('group must count the claims it folds');

// ── Splitting a concatenated claim ─────────────────────────────────────────
// Only a `(din Fragment N)` marker licenses a split; a semicolon on its own is
// punctuation inside one sentence and splitting on it would mangle the text.
const plain = 'a murit la Hellholt, Dorne; circumstanțe incerte';
if (splitConcatenatedClaim(plain).length !== 1) fail('a claim with no fragment marker must stay whole');
const marked = splitConcatenatedClaim('moartă în 130 D.C. (din Fragment 4.3); vie la final (din Fragment 4.2)');
if (marked.length !== 2) fail(`expected 2 readings, got ${marked.length}`);
if (marked[0].fragment !== '4.3') fail(`fragment not lifted out: ${marked[0].fragment}`);
if (marked[0].text.includes('Fragment')) fail('the marker must move to the citation, not stay in the text');

// ── The record the change exists for ───────────────────────────────────────
const rhaenyra = byId('rhaenyra_targaryen');
const variants = collectClaimVariants(rhaenyra.moarte);
if (variants.length < 4) fail(`Rhaenyra's death claim should split into several readings, got ${variants.length}`);
if (variants.some(variant => variant.text.includes('din Fragment'))) fail('a reading still carries its raw marker');
if (!variants.some(variant => variant.sources.some(source => source.fragment === '4.3'))) {
  fail('the 4.3 reading lost its attribution');
}
const titleSources = rhaenyra.titles.flatMap(title => collectSources(title));
if (!titleSources.length) fail('Rhaenyra titles cite nothing');
if (groupSourcesByBook(titleSources).length > 3) fail('title citations are not folding per book');

// ── Dataset-wide ───────────────────────────────────────────────────────────
// Splitting must be conservative: it may not fire on records with no marker, and
// it must never lose a reading it was handed.
let split = 0;
let withVariants = 0;
for (const character of characters) {
  const claim = character.moarte;
  if (!claim || typeof claim !== 'object') continue;
  const readings = collectClaimVariants(claim);
  if (readings.length > 1) split += 1;
  if (Array.isArray(claim.variante) && claim.variante.length) {
    withVariants += 1;
    if (!readings.length) fail(`${character.id}: variante present but no reading produced`);
  }
  const description = claim.descriere || '';
  if (description && !/\(\s*din\s+Fragment/i.test(description) && readings[0]?.text !== description.trim()) {
    fail(`${character.id}: an unmarked claim was altered`);
  }
}

console.table([
  { check: 'Death claims rendered as several readings', actual: split },
  { check: 'Death claims carrying a `variante` array', actual: withVariants },
  { check: 'Rhaenyra readings', actual: variants.length },
  { check: 'Rhaenyra title citations (before folding)', actual: titleSources.length },
  { check: 'Rhaenyra title citations (book groups)', actual: groupSourcesByBook(titleSources).length }
]);
console.log('\nSource folding tests passed.');
