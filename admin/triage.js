/**
 * Triage console.
 *
 * The design constraint is throughput: the backlog is ~3400 items, so the tool
 * has to be drivable at roughly one keystroke per decision, without the hand
 * leaving the keyboard. Three things follow from that and explain most of the
 * code below.
 *
 *   · Every action auto-advances to the next open item. Reviewing is a stream,
 *     not a series of round trips to a list.
 *   · The list renders a window around the cursor, not 3400 rows. A full render
 *     costs about a second on this dataset, which is felt at this speed.
 *   · The raw record is fetched per item and prefetched a few ahead, so paging
 *     through the queue never waits on the network.
 *
 * Nothing here decides anything on the reviewer's behalf: proposals from the
 * import are shown as suggestions and still require the keypress that accepts
 * them.
 */

const $ = id => document.getElementById(id);

/** Rows kept in the DOM either side of the cursor. */
const WINDOW = 60;
/** How many items ahead to fetch raw context for. */
const PREFETCH = 3;

/** The types offered on the number keys, commonest first. */
const QUICK_TYPES = ['castle', 'settlement', 'structure', 'region', 'landmark',
  'stronghold', 'interior', 'non_place', 'location'];

const state = {
  items: [],
  filtered: [],
  cursor: 0,
  types: [],
  progress: null,
  contexts: new Map(),
  formOpen: null,
  inFlight: false,
  lastSeq: null,
  actor: localStorage.getItem('triage.actor') || ''
};

// ── data ──────────────────────────────────────────────────────────────────

async function api(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`);
  return payload;
}

async function loadQueue(keepCursor = false) {
  const previousId = keepCursor ? current()?.id : null;
  const data = await api('/api/triage/queue');
  state.items = data.items;
  state.types = data.types;
  state.progress = data.progress;
  buildFilterOptions();
  applyFilter();
  if (previousId) {
    const index = state.filtered.findIndex(item => item.id === previousId);
    if (index >= 0) state.cursor = index;
  }
  renderAll();
}

function current() {
  return state.filtered[state.cursor] || null;
}

async function context(itemId) {
  if (state.contexts.has(itemId)) return state.contexts.get(itemId);
  const promise = api(`/api/triage/item?id=${encodeURIComponent(itemId)}`)
    .catch(error => ({ error: error.message }));
  state.contexts.set(itemId, promise);
  return promise;
}

function prefetch() {
  for (let offset = 1; offset <= PREFETCH; offset++) {
    const item = state.filtered[state.cursor + offset];
    if (item) context(item.id);
  }
}

// ── filtering ─────────────────────────────────────────────────────────────

function buildFilterOptions() {
  const fill = (select, values) => {
    const chosen = select.value;
    select.innerHTML = '<option value="">toate</option>' +
      values.map(value => `<option value="${value}">${value}</option>`).join('');
    select.value = chosen;
  };
  fill($('filter-source'), [...new Set(state.items.map(item => item.source))].sort());
  fill($('filter-problem'), [...new Set(state.items.map(item => item.problem))].sort());
}

function applyFilter() {
  const source = $('filter-source').value;
  const problem = $('filter-problem').value;
  const status = $('filter-status').value;
  state.filtered = state.items.filter(item =>
    (!source || item.source === source) &&
    (!problem || item.problem === problem) &&
    (!status || item.status === status));
  if (state.cursor >= state.filtered.length) state.cursor = Math.max(0, state.filtered.length - 1);
}

// ── rendering ─────────────────────────────────────────────────────────────

function renderAll() {
  renderProgress();
  renderList();
  renderDetail();
}

function renderProgress() {
  const progress = state.progress;
  if (!progress) return;
  const percent = progress.total ? (progress.done / progress.total) * 100 : 0;
  $('progress-fill').style.width = `${percent}%`;
  const perSource = Object.entries(progress.bySource)
    .map(([source, counts]) => `${source} ${counts.done}/${counts.total}`)
    .join(' · ');
  $('progress-text').textContent =
    `${progress.done} / ${progress.total} rezolvate (${percent.toFixed(1)}%) — ${perSource}`;
}

function renderList() {
  const list = $('list');
  const total = state.filtered.length;
  $('list-count').textContent = total
    ? `${state.cursor + 1} din ${total} în filtrul curent`
    : 'niciun element în filtrul curent';

  const from = Math.max(0, state.cursor - WINDOW);
  const to = Math.min(total, state.cursor + WINDOW);
  list.innerHTML = '';

  // A spacer above and below keeps the scrollbar proportional to the whole
  // queue even though only a window of rows exists.
  const spacer = height => {
    const li = document.createElement('li');
    li.style.height = `${height}px`;
    li.style.padding = '0';
    li.style.pointerEvents = 'none';
    li.setAttribute('aria-hidden', 'true');
    return li;
  };
  const ROW = 28;
  if (from > 0) list.appendChild(spacer(from * ROW));

  for (let index = from; index < to; index++) {
    const item = state.filtered[index];
    const li = document.createElement('li');
    li.className = (index === state.cursor ? 'active ' : '') + (item.status === 'open' ? '' : 'done');
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(index === state.cursor));
    const title = document.createElement('span');
    title.className = 'row-title';
    title.textContent = item.title || item.entityId || item.id;
    const badge = document.createElement('span');
    badge.className = 'row-badge';
    badge.textContent = item.source.replace(/^needs_/, '');
    li.append(title, badge);
    li.addEventListener('click', () => { state.cursor = index; renderAll(); prefetch(); });
    list.appendChild(li);
  }
  if (to < total) list.appendChild(spacer((total - to) * ROW));

  const active = list.querySelector('.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

async function renderDetail() {
  const item = current();
  $('detail').hidden = !item;
  $('detail-empty').hidden = Boolean(item);
  if (!item) return;

  $('detail-title').textContent = item.title || item.entityId || item.id;
  $('detail-meta').textContent =
    [item.entityId && `id: ${item.entityId}`, item.file, `sursă: ${item.source}`, `problemă: ${item.problem}`]
      .filter(Boolean).join('   ·   ');
  const status = $('detail-status');
  status.textContent = item.status;
  status.className = `detail-status ${item.status}`;
  $('detail-hint').textContent = item.hint || '—';
  $('detail-hint').hidden = !item.hint;

  renderActions(item);

  const raw = $('detail-raw');
  raw.textContent = 'se încarcă…';
  const loaded = await context(item.id);
  // The cursor may have moved on while this was in flight.
  if (current()?.id !== item.id) return;
  raw.textContent = loaded.error
    ? `eroare: ${loaded.error}`
    : loaded.raw
      ? JSON.stringify(loaded.raw, null, 2)
      : 'Elementul nu trimite la o entitate din date (coadă de note sau de referințe nerezolvate).';
}

function renderActions(item) {
  const hasEntity = Boolean(item.file && item.entityId);
  const buttons = [
    ['t', 'tip / mappable / parent', hasEntity],
    ['n', 'name_ro / name_en', hasEntity],
    ['d', 'duplicat', hasEntity],
    ['s', 'sparge', hasEntity],
    ['x', 'respinge', true],
    ['a', 'arhivează', true],
    ['u', 'anulează ultima', true]
  ];
  $('detail-actions').innerHTML = buttons
    .filter(([, , enabled]) => enabled)
    .map(([key, label]) => `<button type="button" data-key="${key}"><kbd>${key}</kbd> ${label}</button>`)
    .join('');
  for (const button of $('detail-actions').querySelectorAll('button')) {
    button.addEventListener('click', () => handleKey(button.dataset.key));
  }
}

// ── forms ─────────────────────────────────────────────────────────────────

function closeForm() {
  state.formOpen = null;
  $('detail-form').hidden = true;
  $('detail-form').innerHTML = '';
  $('list').focus();
}

function openForm(kind, html, onMount) {
  state.formOpen = kind;
  const form = $('detail-form');
  form.hidden = false;
  form.innerHTML = html;
  onMount?.(form);
  // Focus must land on an editable field, never on one of the shortcut buttons
  // a form may offer. A focused button is not "typing", so the keydown handler
  // would treat the next letter as a global command and Enter would not submit.
  if (!form.contains(document.activeElement)) {
    const first = form.querySelector('input:not([readonly]), select, textarea');
    first?.focus();
    first?.select?.();
  }
}

function formError(message) {
  const form = $('detail-form');
  let box = form.querySelector('.form-error');
  if (!box) {
    box = document.createElement('div');
    box.className = 'form-error';
    form.appendChild(box);
  }
  box.textContent = message;
}

async function openTypeForm() {
  const item = current();
  const loaded = await context(item.id);
  const raw = loaded.raw || {};
  const proposal = item.proposal || {};
  openForm('type', `
    <h4>Tip, mappable, parent_id</h4>
    <div class="type-grid">
      ${state.types.map(type => `<button type="button" data-type="${type}"${
        type === proposal.type ? ' class="suggested"' : ''}>${type}</button>`).join('')}
    </div>
    <div class="form-row">
      <label for="f-type">type</label>
      <input id="f-type" type="text" value="${raw.type || proposal.type || ''}" autocomplete="off">
    </div>
    <div class="form-row">
      <label for="f-mappable">mappable</label>
      <select id="f-mappable">
        <option value="">(nemodificat)</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </div>
    <div class="form-row">
      <label for="f-parent">parent_id</label>
      <input id="f-parent" type="text" value="${raw.parent_id || ''}" autocomplete="off">
    </div>
    <div class="form-help">Click pe un tip îl completează. <kbd>Enter</kbd> salvează, <kbd>Esc</kbd> renunță.</div>
  `, form => {
    const typeInput = form.querySelector('#f-type');
    const mappable = form.querySelector('#f-mappable');
    if (typeof raw.mappable === 'boolean') mappable.value = String(raw.mappable);
    else if (typeof proposal.mappable === 'boolean') mappable.value = String(proposal.mappable);
    for (const button of form.querySelectorAll('.type-grid button')) {
      button.addEventListener('click', () => { typeInput.value = button.dataset.type; typeInput.focus(); });
    }
    typeInput.focus();
    typeInput.select();
  });
}

async function openNamesForm() {
  const item = current();
  const loaded = await context(item.id);
  const raw = loaded.raw || {};
  const escape = value => String(value ?? '').replace(/"/g, '&quot;');
  openForm('names', `
    <h4>Nume pe limbă</h4>
    <div class="form-row"><label>name (brut)</label><input type="text" value="${escape(raw.name)}" readonly></div>
    <div class="form-row"><label for="f-ro">name_ro</label><input id="f-ro" type="text" value="${escape(raw.name_ro)}" autocomplete="off"></div>
    <div class="form-row"><label for="f-en">name_en</label><input id="f-en" type="text" value="${escape(raw.name_en)}" autocomplete="off"></div>
    <div class="form-help">Numele proprii de univers nu se traduc automat (CLAUDE.md §5.3). <kbd>Tab</kbd> între câmpuri, <kbd>Enter</kbd> salvează.</div>
  `);
}

async function openDuplicateForm() {
  const item = current();
  const loaded = await context(item.id);
  const candidates = loaded.duplicateCandidates || [];
  openForm('duplicate', `
    <h4>Marchează drept duplicat</h4>
    <div class="form-row">
      <label for="f-dup">duplicate_of</label>
      <input id="f-dup" type="text" placeholder="id-ul entității păstrate" autocomplete="off">
    </div>
    ${candidates.length ? `<div class="dup-candidates">${candidates
      .map(c => `<button type="button" data-id="${c.id}">${c.name} <kbd>${c.id}</kbd></button>`).join('')}</div>`
      : '<div class="form-help">Niciun candidat cu același nume în acest fișier.</div>'}
    <div class="form-help">Nu șterge nimic: scrie <code>duplicate_of</code> pe această înregistrare.</div>
  `, form => {
    for (const button of form.querySelectorAll('.dup-candidates button')) {
      button.addEventListener('click', () => { form.querySelector('#f-dup').value = button.dataset.id; submitForm(); });
    }
  });
}

async function openSplitForm() {
  const item = current();
  const loaded = await context(item.id);
  const raw = loaded.raw || {};
  const suggestion = (item.splitSuggestion || []).join('\n');
  openForm('split', `
    <h4>Sparge în N entități</h4>
    <div class="form-help" style="margin:0 0 0.4rem">Original: <code>${(raw.name || '').replace(/</g, '&lt;')}</code></div>
    <textarea id="f-split" spellcheck="false">${suggestion}</textarea>
    <div class="form-row" style="margin-top:0.4rem">
      <label for="f-split-type">type pentru părți</label>
      <input id="f-split-type" type="text" value="${raw.type || ''}" autocomplete="off">
    </div>
    <div class="form-help">Un nume pe linie. Originalul se păstrează și primește <code>split_into</code>.
      <kbd>Ctrl</kbd>+<kbd>Enter</kbd> salvează.</div>
  `);
}

function submitForm() {
  const kind = state.formOpen;
  const item = current();
  if (!kind || !item) return;
  const value = id => $(id)?.value.trim() ?? '';

  if (kind === 'type') {
    const mappable = value('f-mappable');
    return send({
      action: 'assign_type',
      type: value('f-type') || null,
      mappable: mappable === '' ? null : mappable === 'true',
      parent_id: value('f-parent') || null
    });
  }
  if (kind === 'names') {
    return send({ action: 'set_names', name_ro: value('f-ro') || null, name_en: value('f-en') || null });
  }
  if (kind === 'duplicate') {
    return send({ action: 'mark_duplicate', duplicateOf: value('f-dup') });
  }
  if (kind === 'split') {
    const names = value('f-split').split('\n').map(line => line.trim()).filter(Boolean);
    return send({ action: 'split', names, type: value('f-split-type') || null });
  }
}

// ── actions ───────────────────────────────────────────────────────────────

function toast(message, isError = false) {
  const element = $('toast');
  element.textContent = message;
  element.className = `triage-toast${isError ? ' error' : ''}`;
  element.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { element.hidden = true; }, isError ? 6000 : 2200);
}

async function send(payload) {
  const item = current();
  if (!item) return;
  // A reviewer going at one keypress per item will out-run the round trip.
  // Without this the next keystroke lands while the cursor is still on the
  // item being written, and the same record gets two decisions.
  if (state.inFlight) return;
  state.inFlight = true;
  try {
    const result = await api('/api/triage/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, itemId: item.id, actor: state.actor })
    });
    state.lastSeq = result.entry.seq;
    state.progress = result.progress;
    state.contexts.delete(item.id);
    // Update in place instead of reloading the whole queue: a reload here would
    // cost a round trip on every single decision.
    item.status = payload.action === 'reject' ? 'rejected'
      : payload.action === 'archive' ? 'archived' : 'resolved';
    item.resolvedAction = payload.action;
    closeForm();
    toast(`#${result.entry.seq} ${payload.action} — ${item.title || item.id}`.slice(0, 90));
    advance();
  } catch (error) {
    formError(error.message);
    toast(error.message, true);
  } finally {
    state.inFlight = false;
  }
}

async function undoLast() {
  if (state.lastSeq === null) {
    const journal = await api('/api/triage/journal?limit=50');
    const last = [...journal.entries].reverse()
      .find(entry => entry.action !== 'undo' && !journal.entries.some(other => other.undoOf === entry.seq));
    if (!last) return toast('Nimic de anulat.', true);
    state.lastSeq = last.seq;
  }
  try {
    const result = await api('/api/triage/undo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seq: state.lastSeq })
    });
    toast(`anulat #${state.lastSeq}${result.entry.keptAfterUndo?.length
      ? ` (păstrate: ${result.entry.keptAfterUndo.join(', ')})` : ''}`);
    state.lastSeq = null;
    state.contexts.clear();
    await loadQueue(true);
  } catch (error) {
    toast(error.message, true);
  }
}

/**
 * Move to the next item still open. Resolving an item does not remove it from
 * the rendered list — that would shift every row under the cursor mid-session —
 * so the cursor steps over what is already decided instead.
 */
function advance() {
  for (let index = state.cursor + 1; index < state.filtered.length; index++) {
    if (state.filtered[index].status === 'open') {
      state.cursor = index;
      renderAll();
      prefetch();
      return;
    }
  }
  renderAll();
  toast('Ultimul element deschis din filtru.');
}

function move(delta) {
  const next = Math.min(Math.max(0, state.cursor + delta), Math.max(0, state.filtered.length - 1));
  if (next === state.cursor) return;
  state.cursor = next;
  renderAll();
  prefetch();
}

function cycleSelect(select) {
  select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
  applyFilter();
  renderAll();
  toast(`${select.previousSibling ? '' : ''}${select.id.replace('filter-', '')}: ${select.value || 'toate'}`);
}

// ── keyboard ──────────────────────────────────────────────────────────────

function handleKey(key) {
  const item = current();
  if (key === 't' && item?.entityId) return openTypeForm();
  if (key === 'n' && item?.entityId) return openNamesForm();
  if (key === 'd' && item?.entityId) return openDuplicateForm();
  if (key === 's' && item?.entityId) return openSplitForm();
  if (key === 'x') return send({ action: 'reject' });
  if (key === 'a') return send({ action: 'archive' });
  if (key === 'u') return undoLast();
}

document.addEventListener('keydown', event => {
  const help = $('help');
  if (!help.hidden) {
    if (event.key === 'Escape' || event.key === '?') { help.hidden = true; event.preventDefault(); }
    return;
  }

  const typing = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  const inForm = state.formOpen && $('detail-form').contains(document.activeElement);

  // Inside a form only Enter, Ctrl+Enter and Escape are commands; everything
  // else has to reach the field, or names could not contain the letter "n".
  // Keyed on containment rather than on the tag, so a focused shortcut button
  // inside the form cannot leak keystrokes back to the global bindings.
  if (inForm) {
    if (event.key === 'Escape') { event.preventDefault(); closeForm(); }
    if (event.key === 'Enter') {
      const multiline = document.activeElement.tagName === 'TEXTAREA';
      if (!multiline || event.ctrlKey || event.metaKey) { event.preventDefault(); submitForm(); }
    }
    return;
  }
  if (typing) {
    if (event.key === 'Escape') document.activeElement.blur();
    return;
  }

  const key = event.key;
  if (key === '?') { event.preventDefault(); help.hidden = false; return; }
  if (key === 'Escape') { closeForm(); return; }

  if (key === 'j' || key === 'ArrowDown') { event.preventDefault(); return move(1); }
  if (key === 'k' || key === 'ArrowUp') { event.preventDefault(); return move(-1); }
  if (key === 'J' || key === 'PageDown') { event.preventDefault(); return move(10); }
  if (key === 'K' || key === 'PageUp') { event.preventDefault(); return move(-10); }
  if (key === 'g' || key === 'Home') { event.preventDefault(); state.cursor = 0; renderAll(); return prefetch(); }
  if (key === 'G' || key === 'End') {
    event.preventDefault();
    state.cursor = Math.max(0, state.filtered.length - 1);
    renderAll();
    return prefetch();
  }

  if (key === 'f') { event.preventDefault(); return cycleSelect($('filter-source')); }
  if (key === 'F') { event.preventDefault(); return cycleSelect($('filter-problem')); }
  if (key === 'o') { event.preventDefault(); return cycleSelect($('filter-status')); }

  if (/^[1-9]$/.test(key)) {
    const type = QUICK_TYPES[Number(key) - 1];
    const item = current();
    if (type && item?.entityId) { event.preventDefault(); send({ action: 'assign_type', type }); }
    return;
  }

  if ('tndsxau'.includes(key)) { event.preventDefault(); handleKey(key); }
});

// ── boot ──────────────────────────────────────────────────────────────────

for (const id of ['filter-source', 'filter-problem', 'filter-status']) {
  $(id).addEventListener('change', () => { applyFilter(); renderAll(); prefetch(); });
}
$('actor').value = state.actor;
$('actor').addEventListener('change', event => {
  state.actor = event.target.value.trim();
  localStorage.setItem('triage.actor', state.actor);
});
$('help-btn').addEventListener('click', () => { $('help').hidden = false; });
$('help').addEventListener('click', event => { if (event.target === $('help')) $('help').hidden = true; });

loadQueue()
  .then(() => { $('list').focus(); prefetch(); })
  .catch(error => toast(`Nu am putut încărca coada: ${error.message}`, true));
