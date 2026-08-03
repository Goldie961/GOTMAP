import { createElement } from '../utils/helpers.js';
import { t, getLanguage, setLanguage, LANGUAGES } from '../i18n/index.js';

export class Toolbar {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    // Toggles whose state lives in the button rather than in a model. It has to
    // survive the rebuild that a language switch performs.
    this.isNight = false;
    this.isSummer = true;
    this.isMuted = true;
  }

  init() {
    // init() doubles as the re-render entry point for a language switch, so it
    // must start from an empty container rather than append a second toolbar.
    this.container.innerHTML = '';
    this.container.className = 'timeline-top-row';
    this.container.style.position = 'fixed';
    this.container.style.top = '15px';
    this.container.style.left = '50%';
    this.container.style.transform = 'translateX(-50%)';
    this.container.style.width = '90%';
    this.container.style.maxWidth = '1100px';
    this.container.style.background = 'radial-gradient(circle, var(--parchment-light) 0%, var(--parchment) 100%)';
    this.container.style.border = '1px solid var(--gold)';
    this.container.style.borderRadius = '4px';
    this.container.style.padding = '0.5rem 1.5rem';
    this.container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    this.container.style.zIndex = '150';
    this.container.style.display = 'flex';
    this.container.style.justifyContent = 'space-between';
    this.container.style.alignItems = 'center';

    // 1. App Title
    const title = createElement('h1', 'heading-primary', t('toolbar.title'));
    title.style.fontSize = '1.3rem';
    title.style.margin = '0';
    this.container.appendChild(title);

    // 2. Search Container (empty, SearchBar will populate it)
    const searchContainer = createElement('div', 'search-container');
    searchContainer.id = 'search-bar-target';
    searchContainer.style.flex = '1';
    searchContainer.style.maxWidth = '360px';
    searchContainer.style.margin = '0 2rem';
    searchContainer.style.position = 'relative';
    this.container.appendChild(searchContainer);

    // 3. Action Buttons
    const buttons = createElement('div', 'toolbar-buttons');
    buttons.style.display = 'flex';
    buttons.style.gap = '0.6rem';

    // Day/Night Toggle
    const nightBtn = createElement('button', 'timeline-play-btn');
    nightBtn.innerHTML = this.isNight ? '🌙' : '☀';
    if (this.isNight) nightBtn.classList.add('active');
    nightBtn.title = t('toolbar.toggleDayNight');
    nightBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('toggleDayNight'));
      this.isNight = nightBtn.classList.toggle('active');
      nightBtn.innerHTML = this.isNight ? '🌙' : '☀';
    });
    buttons.appendChild(nightBtn);

    // Season Toggle
    const seasonBtn = createElement('button', 'timeline-play-btn');
    seasonBtn.innerHTML = this.isSummer ? '🍃' : '❄';
    seasonBtn.title = t('toolbar.toggleSeason');
    seasonBtn.addEventListener('click', () => {
      this.isSummer = !this.isSummer;
      document.dispatchEvent(new CustomEvent('seasonChanged', { detail: { season: this.isSummer ? 'summer' : 'winter' } }));
      seasonBtn.innerHTML = this.isSummer ? '🍃' : '❄';
    });
    buttons.appendChild(seasonBtn);

    // Filter Toggle
    const filterBtn = createElement('button', 'timeline-play-btn');
    filterBtn.innerHTML = '⚙';
    filterBtn.title = t('toolbar.toggleFilters');
    filterBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('toggleFilters'));
    });
    buttons.appendChild(filterBtn);

    // Distance Tool Toggle
    const distanceBtn = createElement('button', 'timeline-play-btn');
    distanceBtn.innerHTML = '📏';
    distanceBtn.title = t('toolbar.distanceCalculator');
    distanceBtn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('toggleDistanceTool'));
    });
    buttons.appendChild(distanceBtn);

    // Reset View Button
    const resetBtn = createElement('button', 'timeline-play-btn');
    resetBtn.innerHTML = '⟲';
    resetBtn.title = t('toolbar.resetView');
    resetBtn.setAttribute('aria-label', t('toolbar.resetView'));
    resetBtn.addEventListener('click', () => {
      if (window.atlasApp && window.atlasApp.mapInteraction) {
        window.atlasApp.mapInteraction.resetView();
      }
    });
    buttons.appendChild(resetBtn);

    // Mute/Unmute Toggle
    const muteBtn = createElement('button', 'timeline-play-btn');
    this.isMuted = window.atlasApp?.audioManager?.isMuted ?? this.isMuted;
    muteBtn.innerHTML = this.isMuted ? '🔇' : '🔊';
    muteBtn.title = this.isMuted ? t('toolbar.unmuteSounds') : t('toolbar.muteSounds');
    muteBtn.addEventListener('click', () => {
      if (window.atlasApp && window.atlasApp.audioManager) {
        const currentlyMuted = window.atlasApp.audioManager.isMuted;
        window.atlasApp.audioManager.setMuted(!currentlyMuted);
        this.isMuted = !currentlyMuted;
        muteBtn.innerHTML = currentlyMuted ? '🔊' : '🔇';
        muteBtn.title = currentlyMuted ? t('toolbar.muteSounds') : t('toolbar.unmuteSounds');
      }
    });
    buttons.appendChild(muteBtn);

    // The only way into /wiki from the interface. Without it the route would be
    // reachable only by typing the address, which is not a route the reader has.
    const wikiBtn = createElement('a', 'timeline-play-btn');
    wikiBtn.innerHTML = '📖';
    wikiBtn.title = t('toolbar.encyclopedia');
    wikiBtn.setAttribute('aria-label', t('toolbar.encyclopedia'));
    wikiBtn.href = window.atlasApp?.router?.href({ name: 'wikiIndex', params: {} }) || '/wiki';
    wikiBtn.addEventListener('click', event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button > 0) return;
      event.preventDefault();
      window.atlasApp?.router?.navigate({ name: 'wikiIndex', params: {} });
    });
    buttons.appendChild(wikiBtn);

    buttons.appendChild(this.createLanguageSwitch());

    this.container.appendChild(buttons);
  }

  /**
   * RO | EN. `setLanguage` persists the choice and updates `<html lang>`; the
   * re-render is driven from AtlasApp's subscription, not from here, so the
   * switch stays a plain control with no knowledge of the rest of the UI.
   */
  createLanguageSwitch() {
    const active = getLanguage();
    const group = createElement('div', 'lang-switch');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', t('toolbar.language'));

    LANGUAGES.forEach(lang => {
      const option = createElement('button', 'lang-switch-option', t(`lang.badge.${lang}`));
      option.type = 'button';
      option.setAttribute('aria-pressed', String(lang === active));
      option.title = t(lang === 'ro' ? 'toolbar.switchToRo' : 'toolbar.switchToEn');
      option.setAttribute('lang', lang);
      option.addEventListener('click', () => setLanguage(lang));
      group.appendChild(option);
    });

    return group;
  }
}
