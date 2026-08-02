import { DataManager } from '../js/data/DataManager.js';
import { MapRenderer } from '../js/map/MapRenderer.js';
import { MapInteraction, screenToMapPoint } from '../js/map/MapInteraction.js';
import { getPolygonBounds, isPointInPolygon, pathToPolygon } from '../js/map/RegionSelector.js';

const API = '../api/save-coordinates';
const ISLANDS = new Set(['bear_island','arbor','claw_isle','dragonstone','driftmark','pyke','tarth','skagos','lys','tyrosh','lorath','gogossos']);
const CLICK_TOLERANCE = 10;

class MapEditor {
  constructor() { this.selectedId = null; this.overrides = {}; this.undoStack = []; this.filter = ''; this.type = 'all'; this.drag = null; this.carrying = null; this.carryOrigin = null; this.carryOverrideOrigin = undefined; this.carryHadOverride = false; this.carryTemporary = false; this.view = 'map'; this.adminSort = { key: 'name', dir: 1 }; this.adminFilter = ''; this.editing = null; }
  async init() {
    this.checkServer();
    this.dataManager = new DataManager({ basePath: '../' }); await this.dataManager.loadAll();
    const regionsData = await (await fetch('../data/map/regions.json')).json(); this.regions = new Map(regionsData.regions.map(r => [r.id, r.path]));
    this.dataManager.data.mapCatalog.maps.world.terrain.src = `../${this.dataManager.data.mapCatalog.maps.world.terrain.src}`;
    this.renderer = new MapRenderer('map-container'); this.renderer.disableLabelCulling = true; this.renderer.init(); await this.renderer.renderMap({ year: 1, regions: {}, locations: {} });
    this.interaction = new MapInteraction(this.renderer.svg); console.log('[map-editor] locations loaded:', this.dataManager.getAllLocations().length);
    this.renderSidebar(); this.bindMap(); this.select(this.locations[0]?.id, false); this.switchView('map');
  }
  async checkServer() { try { const response = await fetch('../api/ping'); const payload = await response.json(); if (!response.ok || payload?.ok !== true) throw Error('invalid ping'); } catch { this.serverWarning = 'Serverul admin nu răspunde corect pe /api — verifică să rulezi python server.py din rădăcina proiectului și că niciun alt server nu ocupă portul 8000.'; this.renderServerWarning(); } }
  renderServerWarning() { const host = document.querySelector('#editor-sidebar'); if (host && this.serverWarning && !document.querySelector('#server-warning')) host.insertAdjacentHTML('afterbegin', `<p id="server-warning" class="editor-server-warning">${this.serverWarning}</p>`); }
  get locations() { return this.dataManager.getAllLocations().slice().sort((a, b) => a.name.localeCompare(b.name)); }
  coordinate(id) { return this.overrides[id] === null ? null : (this.overrides[id] || this.dataManager.getWorldCoordinate(id)); }
  hasCoordinate(id) { return Boolean(this.coordinate(id)); }
  renderSidebar() {
    if (this.view !== 'map') {
      document.querySelector('#editor-sidebar').innerHTML = `<h1>Atlas Admin</h1>${this.navMarkup()}<p class="admin-side-note">Gestionare permanentă în JSON, cu căutare și coloane sortabile.</p>`;
      return this.bindNav();
    }
    const locations = this.locations, calibrated = locations.filter(l => this.hasCoordinate(l.id)).length;
    const matches = l => (this.type === 'all' || l.type === this.type) && l.name.toLowerCase().includes(this.filter.toLowerCase());
    const grouped = new Map(), placed = locations.filter(l => matches(l) && this.hasCoordinate(l.id));
    locations.filter(l => matches(l) && !this.hasCoordinate(l.id)).forEach(l => { const key = `${l.continent || 'unknown'} — ${l.region || 'unassigned'}`; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(l); });
    const item = (l, draggable = true) => `<button class="editor-location ${l.id === this.selectedId ? 'selected' : ''}" data-id="${l.id}" data-draggable="${draggable}"><span class="location-drag-grip" aria-hidden="true">⠿</span><span class="location-kind-icon" aria-hidden="true">${this.locationIcon(l)}</span><span class="status-dot ${this.hasCoordinate(l.id) ? 'set' : ''}">${this.hasCoordinate(l.id) ? '●' : '○'}</span>${this.escape(l.name)}</button>`;
    const placedOpen = Boolean(this.filter) || placed.some(l => l.id === this.selectedId);
    document.querySelector('#editor-sidebar').innerHTML = `${this.serverWarning ? `<p id="server-warning" class="editor-server-warning">${this.serverWarning}</p>` : ''}<h1>Map Editor</h1><p class="editor-subtitle">Coordonate canonice 1500 × 1000</p><p class="editor-drag-help">Click pe o locație ca să o ridici cu cursorul, apoi click pe hartă pentru plasare. Drag-and-drop rămâne disponibil.</p><div class="editor-progress">${calibrated} / ${locations.length} locații calibrate</div><div class="editor-controls"><input data-filter placeholder="Caută o locație" value="${this.escape(this.filter)}"><select data-type><option value="all">Toate tipurile</option><option value="castle">Castele</option><option value="city">Orașe</option><option value="town">Târguri</option><option value="fortress">Fortărețe</option><option value="ruins">Ruine</option><option value="landmark">Landmark-uri</option></select><button class="editor-next" data-action="next">Următoarea nesetată</button></div><div class="editor-selection">${this.selectedMarkup()}</div><div class="editor-actions"><button data-action="save">Salvează</button><button data-action="undo">Undo (Ctrl+Z)</button><button class="danger" data-action="delete">Șterge coordonata</button><button class="danger" data-action="all">Șterge tot</button><button data-action="validate">Validează</button><button data-action="copy">Copiază JSON</button><button data-action="export">Export JSON</button><label><button type="button" data-action="import">Import JSON</button><input hidden type="file" data-import accept="application/json"></label></div><div class="editor-list">${[...grouped].map(([key, items]) => `<details class="editor-group" open><summary>${key} (${items.length})</summary>${items.map(item).join('')}</details>`).join('') || '<p class="editor-empty">Nicio locație nesetată găsită.</p>'}<details class="editor-group editor-placed"${placedOpen ? ' open' : ''}><summary>Plasate pe hartă (${placed.length})</summary>${placed.map(item).join('') || '<p class="editor-empty">Nicio locație plasată.</p>'}</details></div>`;
    document.querySelector('#editor-sidebar h1').insertAdjacentHTML('afterend', this.navMarkup()); document.querySelector('[data-action="all"]')?.insertAdjacentHTML('afterend', '<button class="danger" data-action="retract-castles">Retrage toate castelele</button><button data-action="distribute-all">Distribuie automat</button>'); this.bindNav();
    const type = document.querySelector('[data-type]'); type.value = this.type;
    document.querySelector('[data-filter]').oninput = e => { this.filter = e.target.value; this.renderSidebarList(); }; type.onchange = e => { this.type = e.target.value; this.renderSidebarList(); };
    document.querySelectorAll('[data-id]').forEach(el => { el.addEventListener('pointerdown', e => this.startListDrag(e, el)); el.addEventListener('contextmenu', e => { e.preventDefault(); this.deselect(); }); });
    document.querySelectorAll('[data-action]').forEach(el => el.onclick = () => this.action(el.dataset.action)); document.querySelector('[data-import]').onchange = e => this.importFile(e.target.files[0]);
  }
  renderSidebarList() {
    const list = document.querySelector('#editor-sidebar .editor-list');
    if (!list) return;
    const matches = location => (this.type === 'all' || location.type === this.type) && location.name.toLowerCase().includes(this.filter.toLowerCase());
    const grouped = new Map();
    const placed = this.locations.filter(location => matches(location) && this.hasCoordinate(location.id));
    this.locations.filter(location => matches(location) && !this.hasCoordinate(location.id)).forEach(location => {
      const key = `${location.continent || 'unknown'} — ${location.region || 'unassigned'}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(location);
    });
    const item = (location, draggable = true) => `<button class="editor-location ${location.id === this.selectedId ? 'selected' : ''}" data-id="${location.id}" data-draggable="${draggable}"><span class="location-drag-grip" aria-hidden="true">⠿</span><span class="location-kind-icon" aria-hidden="true">${this.locationIcon(location)}</span><span class="status-dot ${this.hasCoordinate(location.id) ? 'set' : ''}">${this.hasCoordinate(location.id) ? '●' : '○'}</span>${this.escape(location.name)}</button>`;
    const placedOpen = Boolean(this.filter) || placed.some(location => location.id === this.selectedId);
    list.innerHTML = `${[...grouped].map(([key, items]) => `<details class="editor-group" open><summary>${key} (${items.length})</summary>${items.map(item).join('')}</details>`).join('') || '<p class="editor-empty">Nicio locație nesetată găsită.</p>'}<details class="editor-group editor-placed"${placedOpen ? ' open' : ''}><summary>Plasate pe hartă (${placed.length})</summary>${placed.map(item).join('') || '<p class="editor-empty">Nicio locație plasată.</p>'}</details>`;
    list.querySelectorAll('[data-id]').forEach(el => { el.addEventListener('pointerdown', event => this.startListDrag(event, el)); el.addEventListener('contextmenu', event => { event.preventDefault(); this.deselect(); }); });
    if (this.filter) list.querySelector('[data-id]')?.scrollIntoView({ block: 'nearest' });
  }
  selectedMarkup() { const loc = this.locations.find(l => l.id === this.selectedId), p = loc && this.coordinate(loc.id); return loc ? `<strong>${this.escape(loc.name)}</strong><span class="editor-coordinates">${p ? `x: ${p.x}, y: ${p.y}` : 'Coordonate nesetate'}</span>` : 'Selectează o locație.'; }
  select(id, fly = true) { if (!id) return; this.selectedId = id; const loc = this.locations.find(l => l.id === id), p = this.coordinate(id), target = p || this.regionCenter(loc.region) || { x: 750, y: 500 }; this.renderer.highlightLocation(id); if (fly) this.interaction.panTo(target.x, target.y); this.setPlacementHint(loc, Boolean(p) && this.carrying !== id); this.renderSidebar(); this.decorateMarkers(); }
  setPlacementHint(location, reposition = false) { const hint = document.querySelector('#editor-placement-hint'); if (!hint) return; hint.hidden = !location; hint.textContent = location ? `${reposition ? 'Click pe hartă pentru a repoziționa' : 'Click pe hartă pentru a plasa'}: ${location.name}` : ''; }
  deselect() { this.cancelDrag(); this.cancelCarry(); this.selectedId = null; this.setPlacementHint(null); this.renderer.clearHighlight(); this.renderSidebar(); }
  regionCenter(region) { return this.dataManager.data.worldFeatures.find(f => f.id === region)?.position || null; }
  bindMap() {
    this.renderer.svg.addEventListener('click', e => { if (Date.now() < (this.ignoreMapClickUntil || 0) || e.target.closest('.location-marker')) return; const p = screenToMapPoint(this.renderer.svg, e.clientX, e.clientY); if (!p.inside) return; if (this.carrying) return this.placeCarry(p); if (this.selectedId) this.setCoordinate(this.selectedId, p); });
    this.renderer.svg.addEventListener('pointerdown', e => { const marker = e.target.closest('.location-marker'); if (!marker || e.button !== 0) return; e.preventDefault(); e.stopPropagation(); this.startMapDrag(e, marker); });
    this.renderer.svg.addEventListener('contextmenu', e => { if (this.carrying) { e.preventDefault(); return this.cancelCarry(); } if (!this.drag && !e.target.closest('.location-marker')) return; e.preventDefault(); this.deselect(); });
    window.addEventListener('pointermove', e => { this.moveCarry(e); this.moveDrag(e); }); window.addEventListener('pointerup', e => this.finishDrag(e)); window.addEventListener('pointercancel', () => this.cancelDrag());
    window.addEventListener('contextmenu', e => { if (!this.carrying) return; e.preventDefault(); this.cancelCarry(); }, true);
    window.addEventListener('blur', () => { this.cancelDrag(); this.cancelCarry(); }); document.addEventListener('visibilitychange', () => { if (document.hidden) { this.cancelDrag(); this.cancelCarry(); } });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && this.carrying) { e.preventDefault(); return this.cancelCarry(); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); this.undo(); } }); document.querySelector('#editor-sidebar').addEventListener('click', e => { if (!this.carrying || Date.now() < (this.ignoreSidebarCarryClickUntil || 0) || !e.target.closest('.editor-list')) return; this.retractCarryToSidebar(); }); this.decorateMarkers();
  }
  startListDrag(e, button) { if (e.button !== 0) return; if (button.dataset.draggable !== 'true') return this.select(button.dataset.id); e.preventDefault(); button.setPointerCapture?.(e.pointerId); button.classList.add('dragging'); this.drag = { id: button.dataset.id, source: 'list', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, sourceElement: button }; this.selectedId = button.dataset.id; }
  startMapDrag(e, marker) { const id = marker.dataset.locationId, cached = this.renderer._markerCache.get(id); marker.setPointerCapture?.(e.pointerId); this.selectedId = id; this.drag = { id, source: 'map', pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false, sourceElement: marker, container: cached?.container }; marker.classList.add('dragging'); }
  moveDrag(e) { const d = this.drag; if (!d || e.pointerId !== d.pointerId) return; if (e.buttons === 0) return this.finishDrag(e); if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > CLICK_TOLERANCE) d.moved = true; if (d.source === 'list') { if (d.moved) this.showGhost(e, d); return; } const p = screenToMapPoint(this.renderer.svg, e.clientX, e.clientY); if (!p.inside) return; d.moved = true; this.renderer.setRenderedPosition(d.id, p); }
  finishDrag(e) { const d = this.drag; if (!d || (e?.pointerId != null && e.pointerId !== d.pointerId)) return; const target = e && this.dropTarget(e.clientX, e.clientY); this.removeGhost(); d.sourceElement?.classList.remove('dragging'); this.drag = null; this.ignoreMapClickUntil = d.source === 'map' ? Date.now() + 120 : 0;
    if (!d.moved) { this.startCarry(d.id); return; }
    if (target === 'map') { const p = screenToMapPoint(this.renderer.svg, e.clientX, e.clientY); if (p.inside) { this.remember(d.id); this.setCoordinate(d.id, p, false); this.toast(`Coordonatele pentru ${this.locationName(d.id)} au fost actualizate. Apasă „Salvează”.`); return; } }
    if (target === 'sidebar' && d.source === 'map') { this.remember(d.id); this.overrides[d.id] = null; window.atlasWorldCoordinateOverrides = this.overrides; this.renderer.refreshLocationMarkers(); requestAnimationFrame(() => this.decorateMarkers()); this.renderSidebar(); this.toast(`Coordonata pentru ${this.locationName(d.id)} a fost ștearsă.`); return; }
    if (d.source === 'list') return this.startCarry(d.id);
    this.renderer.refreshLocationMarkers(); requestAnimationFrame(() => this.decorateMarkers());
  }
  cancelDrag() { if (!this.drag) return; this.removeGhost(); this.drag.sourceElement?.classList.remove('dragging'); this.drag = null; this.renderer.refreshLocationMarkers(); requestAnimationFrame(() => this.decorateMarkers()); }
  dropTarget(x, y) { const inRect = s => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }; return inRect('#map-container') ? 'map' : inRect('#editor-sidebar') ? 'sidebar' : null; }
  showGhost(e, d) { if (!this.ghost) { this.ghost = document.createElement('div'); this.ghost.className = 'editor-drag-ghost'; this.ghost.textContent = this.locationName(d.id); document.body.appendChild(this.ghost); } this.ghost.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`; }
  removeGhost() { this.ghost?.remove(); this.ghost = null; }
  startCarry(id) {
    this.cancelCarry();
    this.ignoreSidebarCarryClickUntil = Date.now() + 150;
    this.carrying = id;
    this.carryHadOverride = Object.hasOwn(this.overrides, id);
    this.carryOverrideOrigin = this.carryHadOverride ? this.overrides[id] : undefined;
    const rendered = this.renderer.getRenderedPosition(id) || this.coordinate(id) || this.regionCenter(this.locations.find(location => location.id === id)?.region) || { x: 750, y: 500 };
    this.carryOrigin = { ...rendered };
    this.carryTemporary = !this.hasCoordinate(id);
    if (this.carryTemporary) {
      this.overrides[id] = { ...this.carryOrigin };
      window.atlasWorldCoordinateOverrides = this.overrides;
      this.renderer.refreshLocationMarkers();
    }
    this.select(id, false);
    requestAnimationFrame(() => this.decorateMarkers());
  }
  moveCarry(e) {
    if (!this.carrying || e.buttons !== 0) return;
    this.showCarryGhost(e);
    const p = screenToMapPoint(this.renderer.svg, e.clientX, e.clientY);
    if (p.inside) this.renderer.setRenderedPosition(this.carrying, p);
  }
  placeCarry(p) {
    const id = this.carrying;
    if (!id) return;
    this.clearCarryState();
    this.setCoordinate(id, p);
    this.toast(`Coordonatele pentru ${this.locationName(id)} au fost actualizate. Apasă „Salvează”.`);
  }
  cancelCarry() {
    if (!this.carrying) return;
    const id = this.carrying;
    if (this.carryHadOverride) this.overrides[id] = this.carryOverrideOrigin;
    else delete this.overrides[id];
    window.atlasWorldCoordinateOverrides = this.overrides;
    const origin = this.carryOrigin;
    const wasTemporary = this.carryTemporary;
    this.clearCarryState();
    if (wasTemporary) this.renderer.refreshLocationMarkers();
    else if (origin) this.renderer.setRenderedPosition(id, origin);
    requestAnimationFrame(() => this.decorateMarkers());
  }
  retractCarryToSidebar() {
    const id = this.carrying;
    if (!id) return;
    if (this.carryTemporary) return this.cancelCarry();
    this.clearCarryState();
    this.remember(id);
    this.overrides[id] = null;
    window.atlasWorldCoordinateOverrides = this.overrides;
    this.renderer.refreshLocationMarkers();
    requestAnimationFrame(() => this.decorateMarkers());
    this.renderSidebar();
    this.toast(`Coordonata pentru ${this.locationName(id)} a fost ștearsă.`);
  }
  clearCarryState() {
    this.renderer.container.classList.remove('editor-carrying');
    this.renderer.svg?.querySelectorAll('.location-marker.carrying').forEach(marker => marker.classList.remove('carrying'));
    this.carrying = null;
    this.carryOrigin = null;
    this.carryOverrideOrigin = undefined;
    this.carryHadOverride = false;
    this.carryTemporary = false;
    this.removeCarryGhost();
  }
  showCarryGhost(e) { if (!this.carryGhost) { this.carryGhost = document.createElement('div'); this.carryGhost.className = 'editor-carry-ghost'; document.body.appendChild(this.carryGhost); } this.carryGhost.textContent = this.locationName(this.carrying); this.carryGhost.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`; }
  removeCarryGhost() { this.carryGhost?.remove(); this.carryGhost = null; }
  decorateMarkers() {
    this.renderer.svg.querySelectorAll('.location-marker').forEach(marker => {
      marker.classList.add('map-editor-marker');
      marker.classList.toggle('carrying', marker.dataset.locationId === this.carrying);
    });
    this.renderer.container.classList.toggle('editor-carrying', Boolean(this.carrying));
  }
  setCoordinate(id, p, record = true) { const next = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }; if (record) this.remember(id); this.overrides[id] = next; window.atlasWorldCoordinateOverrides = this.overrides; this.renderer.refreshLocationMarkers(); this.renderer.setRenderedPosition(id, next); requestAnimationFrame(() => this.decorateMarkers()); this.selectedId = id; this.setPlacementHint(this.locations.find(location => location.id === id), true); this.renderSidebar(); }
  remember(id) { this.undoStack.push({ id, previous: Object.hasOwn(this.overrides, id) ? this.overrides[id] : this.dataManager.getWorldCoordinate(id) }); if (this.undoStack.length > 100) this.undoStack.shift(); }
  undo() { const item = this.undoStack.pop(); if (!item) return this.toast('Nicio modificare de anulat.'); this.overrides[item.id] = item.previous; window.atlasWorldCoordinateOverrides = this.overrides; this.renderer.refreshLocationMarkers(); requestAnimationFrame(() => this.decorateMarkers()); this.select(item.id, false); this.toast('Ultima modificare a fost anulată.'); }
  async action(a) { if (a === 'next') { const l = this.locations.find(x => !this.hasCoordinate(x.id)); if (l) this.select(l.id); else this.toast('Toate locațiile au coordonate.'); } if (a === 'save') await this.save(); if (a === 'undo') this.undo(); if (a === 'delete') this.removeSelected(); if (a === 'all') this.removeAll(); if (a === 'retract-castles') this.retractCastles(); if (a === 'distribute-all') this.distributeAll(); if (a === 'validate') this.validate(); if (a === 'copy') navigator.clipboard.writeText(JSON.stringify(this.payload(), null, 2)).then(() => this.toast('JSON copiat în clipboard.')); if (a === 'export') this.download(this.payload(), 'world_coordinates.json'); if (a === 'import') document.querySelector('[data-import]').click(); }
  distributeAll() { const missing = this.locations.filter(l => !this.hasCoordinate(l.id)); if (!missing.length) return this.toast('Toate locațiile au deja coordonate.'); if (!confirm(`Distribui automat ${missing.length} locații nesetate?`)) return; const byRegion = new Map(); missing.forEach(l => byRegion.set(l.region, [...(byRegion.get(l.region) || []), l])); byRegion.forEach((items, region) => { const polygon = pathToPolygon(this.regions.get(region)), candidates = this.gridPoints(polygon, getPolygonBounds(polygon), items.length); items.forEach((l, index) => { this.remember(l.id); this.overrides[l.id] = this.anchorFor(l) || candidates[index] || this.regionCenter(region) || { x: 750, y: 500 }; }); }); window.atlasWorldCoordinateOverrides=this.overrides; this.renderer.refreshLocationMarkers(); requestAnimationFrame(()=>this.decorateMarkers()); this.renderSidebar(); this.toast(`${missing.length} locații distribuite; verifică și apasă „Salvează”.`); }
  gridPoints(polygon, bounds, count) { if (!bounds || polygon.length < 3) return []; const aspect = bounds.width / Math.max(bounds.height, 1), cols = Math.max(1, Math.ceil(Math.sqrt(count * aspect))), rows = Math.max(1, Math.ceil(count / cols)), points=[]; for (let r=0; r<rows*3 && points.length<count; r++) for (let c=0; c<cols*3 && points.length<count; c++) { const x=bounds.minX+((c%cols)+.5)*(bounds.width/cols), y=bounds.minY+((r%rows)+.5)*(bounds.height/rows); if (isPointInPolygon({x,y},polygon)) points.push({x:Math.round(x*10)/10,y:Math.round(y*10)/10}); } return points; }
  anchorFor(location) { const text=JSON.stringify(location).toLowerCase(), landmark=this.locations.find(other => other.id !== location.id && this.hasCoordinate(other.id) && text.includes(`near ${other.name.toLowerCase()}`)); if (!landmark) return null; const point=this.coordinate(landmark.id); return {x:Math.min(1500, point.x+12), y:Math.min(1000, point.y+12)}; }
  removeSelected() { if (!this.selectedId || !confirm(`Ștergi coordonata pentru ${this.locationName(this.selectedId)}?`)) return; this.remember(this.selectedId); this.overrides[this.selectedId] = null; window.atlasWorldCoordinateOverrides = this.overrides; this.renderer.refreshLocationMarkers(); this.renderSidebar(); this.toast('Coordonata a fost ștearsă. Apasă „Salvează”.'); }
  removeAll() { if (!confirm('Ștergi toate coordonatele calibrate?') || !confirm('Confirmare finală: această acțiune va elimina toate coordonatele la salvare.')) return; this.locations.forEach(l => { this.remember(l.id); this.overrides[l.id] = null; }); window.atlasWorldCoordinateOverrides = this.overrides; this.renderer.refreshLocationMarkers(); this.renderSidebar(); this.toast('Toate coordonatele sunt pregătite pentru ștergere.'); }
  retractCastles() { const castles = this.locations.filter(location => location.type === 'castle' && this.hasCoordinate(location.id)); if (!castles.length) return this.toast('Nu există castele calibrate de retras.'); if (!confirm(`Retragi coordonatele pentru ${castles.length} castele?`) || !confirm('Confirmare finală: aceste castele vor trebui plasate din nou înainte de salvare.')) return; castles.forEach(location => { this.remember(location.id); this.overrides[location.id] = null; }); window.atlasWorldCoordinateOverrides = this.overrides; this.renderer.refreshLocationMarkers(); requestAnimationFrame(() => this.decorateMarkers()); this.renderSidebar(); this.toast(`${castles.length} castele au fost retrase și pot fi plasate din nou.`); }
  payload() { return { coordinates: this.overrides }; }
  setSaveWarning(message = '') { const warning = document.querySelector('#editor-save-warning'); if (!warning) return; warning.hidden = !message; warning.textContent = message; }
  async save() { if (!Object.keys(this.overrides).length) return this.toast('Nu există modificări de salvat.'); try { const res = await fetch(API, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(this.payload()) }); let body; try { body = await res.json(); } catch { throw new Error(`Răspuns JSON invalid (HTTP ${res.status}).`); } if (!res.ok) throw new Error(body.error || `Salvarea a eșuat (HTTP ${res.status}).`); const unknown = new Set(body.unknownIds || []); const unsaved = {}; Object.entries(this.overrides).forEach(([id, point]) => { if (unknown.has(id)) unsaved[id] = point; else if (point) this.dataManager.data.worldCoordinates[id] = point; else delete this.dataManager.data.worldCoordinates[id]; }); this.overrides = unsaved; window.atlasWorldCoordinateOverrides = this.overrides; this.renderer.refreshLocationMarkers(); this.renderSidebar(); if (body.updated) this.toast(`✓ ${body.updated} coordonate salvate permanent.`); const warning = unknown.size ? `Avertisment: ${[...unknown].join(', ')} nu au fost salvate (ID-uri necunoscute).` : ''; this.setSaveWarning(warning); if (warning) this.toast(warning, true); } catch (err) { this.toast(`Nu pot salva: ${err.message}. Pornește serverul cu „python server.py”.`, true); } }
  validate() { const warnings = []; this.locations.forEach(l => { const p = this.coordinate(l.id), path = this.regions.get(l.region); if (p && !ISLANDS.has(l.id) && path && !isPointInPolygon(p, path)) warnings.push(l.name); }); this.toast(warnings.length ? `Avertisment: în afara regiunii: ${warnings.join(', ')}` : '✓ Validare: nu sunt avertismente pentru coordonatele active.', warnings.length > 0); }
  importFile(file) { if (!file) return; const reader = new FileReader(); reader.onload = () => { try { Object.entries(JSON.parse(reader.result).coordinates || JSON.parse(reader.result)).forEach(([id, p]) => { if (this.locations.some(l => l.id === id)) this.overrides[id] = p; }); window.atlasWorldCoordinateOverrides = this.overrides; this.renderer.refreshLocationMarkers(); this.renderSidebar(); this.toast('Import reușit; apasă „Salvează” pentru persistență.'); } catch { this.toast('Fișier JSON invalid.', true); } }; reader.readAsText(file); }
  download(data, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'})); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
  locationName(id) { return this.locations.find(l => l.id === id)?.name || id; } locationIcon(location) { if (location.type === 'castle') return '♜'; if (location.type === 'fortress') return '⚔'; if (location.type === 'city') return '⬢'; if (location.type === 'town') return '⌂'; if (location.type === 'ruins') return '♙'; if (location.type === 'landmark') return '◇'; return '•'; } escape(v) { const d = document.createElement('div'); d.textContent = v; return d.innerHTML; } toast(message, error = false) { const el = document.querySelector('#editor-toast'); el.textContent = message; el.style.background = error ? '#612b25' : '#1e4729'; el.style.opacity = '1'; clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => el.style.opacity = '0', 5000); }
  navMarkup() { return `<div class="editor-nav"><button data-view="map" class="${this.view==='map'?'active':''}">Hartă</button><button data-view="locations" class="${this.view==='locations'?'active':''}">Locații</button><button data-view="houses" class="${this.view==='houses'?'active':''}">Case</button></div>`; }
  bindNav() { document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => this.switchView(b.dataset.view)); }
  switchView(view) { this.view=view; const panel=document.querySelector('#editor-admin-panel'),map=document.querySelector('#map-container');panel.hidden=view==='map';map.hidden=view!=='map';this.renderSidebar();if(view!=='map')this.renderAdmin(); }
  async api(url,method,data) { const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined}),b=await r.json();if(!r.ok)throw Error(b.error||'Acțiunea a eșuat.');return b; }
  renderAdmin() { const houses=this.view==='houses', list=(houses?this.dataManager.data.houses:this.locations).filter(x=>JSON.stringify(x).toLowerCase().includes(this.adminFilter.toLowerCase())); const p=document.querySelector('#editor-admin-panel'); p.innerHTML=`<div class="admin-toolbar"><h2>${houses?'Case':'Locații'}</h2><input data-search placeholder="Caută" value="${this.escape(this.adminFilter)}"><button data-create>Adaugă</button></div><table class="admin-table"><thead><tr><th>Nume</th><th>${houses?'Reședință':'Tip'}</th><th>${houses?'Motto':'Continent'}</th><th>${houses?'Fondată':'Regiune'}</th><th>Acțiuni</th></tr></thead><tbody>${list.sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`<tr><td>${houses?`<img class="house-crest-preview" src="../${x.crest}" alt=""> `:''}${this.escape(x.name)}</td><td>${houses?x.metadata?.seat||'':x.type}</td><td>${houses?this.escape(x.metadata?.words||''):x.continent||''}</td><td>${houses?this.escape(x.metadata?.founded||''):x.region||''}</td><td><button data-edit="${x.id}">Editează</button><button data-delete="${x.id}">Șterge</button></td></tr>`).join('')}</tbody></table>`;p.querySelector('[data-search]').oninput=e=>{this.adminFilter=e.target.value;this.renderAdminRows(houses);};p.querySelector('[data-create]').onclick=()=>this.entityForm(houses);p.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>this.entityForm(houses,b.dataset.edit));p.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>this.deleteEntity(houses,b.dataset.delete)); }
  renderAdminRows(houses) { const rows=(houses?this.dataManager.data.houses:this.locations).filter(x=>JSON.stringify(x).toLowerCase().includes(this.adminFilter.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name)); const body=document.querySelector('#editor-admin-panel tbody'); if (!body) return; body.innerHTML=rows.map(x=>`<tr><td>${houses?`<img class="house-crest-preview" src="../${x.crest}" alt=""> `:''}${this.escape(x.name)}</td><td>${houses?x.metadata?.seat||'':x.type}</td><td>${houses?this.escape(x.metadata?.words||''):x.continent||''}</td><td>${houses?this.escape(x.metadata?.founded||''):x.region||''}</td><td><button data-edit="${x.id}">Editează</button><button data-delete="${x.id}">Șterge</button></td></tr>`).join(''); body.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>this.entityForm(houses,button.dataset.edit)); body.querySelectorAll('[data-delete]').forEach(button=>button.onclick=()=>this.deleteEntity(houses,button.dataset.delete)); }
  entityForm(houses,id=null) { const row=(houses?this.dataManager.data.houses:this.locations).find(x=>x.id===id)||{},name=prompt('Nume:',row.name||'');if(name===null)return;const entityId=id||prompt('ID:',name.toLowerCase().replace(/[^a-z0-9]+/g,'_'))||name.toLowerCase().replace(/[^a-z0-9]+/g,'_');let data={id:entityId,name};if(houses){const m=row.metadata||{};data.metadata={seat:prompt('Reședință:',m.seat||'')||'',words:prompt('Motto:',m.words||'')||'',founded:prompt('Fondată:',m.founded||'')||'',sigil:prompt('Descriere heraldică:',m.sigil||'')||'',colors:{primary:prompt('Culoare primară:',m.colors?.primary||'#000000')||'#000000',secondary:prompt('Culoare secundară:',m.colors?.secondary||'#ffffff')||'#ffffff'}};}else{data.type=prompt('Tip: castle/city/landmark',row.type||'castle')||'castle';data.continent=prompt('Continent:',row.continent||'westeros')||'westeros';data.region=prompt('Regiune:',row.region||'')||'';data.canon_status=prompt('Canon status:',row.canon_status||'canon')||'canon';}this.api(`../api/${houses?'houses':'locations'}${id?'/'+id:''}`,id?'PUT':'POST',data).then(()=>location.reload()).catch(e=>this.toast(e.message,true)); }
  deleteEntity(houses,id) { const refs=houses?this.locations.filter(l=>l.house===id||l.timeline?.some(t=>t.house===id)):[];if(!confirm(`Ștergi definitiv?${refs.length?` Referințe: ${refs.map(x=>x.name).join(', ')}`:''}`))return;this.api(`../api/${houses?'houses':'locations'}/${id}`,'DELETE').then(()=>location.reload()).catch(e=>this.toast(e.message,true)); }
}
window.addEventListener('DOMContentLoaded', () => new MapEditor().init().catch(err => { console.error(err); document.body.innerHTML = `<pre>Editorul nu a putut porni: ${err.message}</pre>`; }));
