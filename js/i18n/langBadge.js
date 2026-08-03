// The single visual mechanism for "this string is not in your interface
// language", used identically by L2 (entity names) and L3 (narrative fragments).
//
// DOM-touching, so it lives apart from index.js and is imported only by UI
// modules — never by SearchEngine, which runs under Node.

import { createElement } from '../utils/helpers.js';
import { t, getLanguage, nameDescriptor, detectLanguage } from './index.js';

/**
 * A two-letter chip. Shown *only* when the fragment's language differs from the
 * interface language, so a Romanian reader on the Romanian interface sees none
 * of them and the count of visible badges measures translation progress (§4.3).
 */
export function createLanguageBadge(fragmentLang, provenance = {}) {
  if (!fragmentLang) return null;
  const code = fragmentLang === 'ro' || fragmentLang === 'en' ? fragmentLang : 'unknown';
  const badge = createElement('span', `lang-badge lang-badge-${code}`, t(`lang.badge.${code}`));
  badge.title = provenance.book || provenance.page
    ? t('lang.untranslatedSourced', {
      book: provenance.book || t('lang.sourceUnknown'),
      page: provenance.page ?? '—'
    })
    : t('lang.untranslated');
  // Announced, not merely coloured.
  badge.setAttribute('aria-label', badge.title);
  return badge;
}

/**
 * Tag a container with the language of the text it holds and, when that differs
 * from the interface, append the badge.
 *
 * The fragment is never hidden or dropped for being in the "wrong" language:
 * 488 locations carry `descriere_fizica` and every one of them is Romanian
 * (§5.1). The `lang` attribute is set regardless of the badge, because
 * hyphenation and screen readers need it even when the languages match (§6.6).
 *
 * @param {HTMLElement} element  the element holding the fragment
 * @param {string} text          the fragment, used to detect the language
 * @param {HTMLElement} [badgeHost]  where the badge goes; defaults to `element`
 * @returns {string} the detected language
 */
export function markFragmentLanguage(element, text, badgeHost = element) {
  if (!element) return 'neutral';
  const uiLang = getLanguage();
  const fragmentLang = detectLanguage(text);
  const resolved = fragmentLang === 'mixed' || fragmentLang === 'neutral' ? null : fragmentLang;

  element.setAttribute('lang', resolved || uiLang);
  if (!resolved || resolved === uiLang) return fragmentLang;

  element.classList.add('untranslated-fragment');
  const badge = createLanguageBadge(resolved);
  if (badge && badgeHost) badgeHost.appendChild(badge);
  return fragmentLang;
}

/**
 * The same marker, for the panels that build their markup as an HTML string.
 * Returns pieces rather than a node so a template literal can place the badge
 * next to a section heading instead of inside the quoted body.
 *
 * @returns {{ lang: string, attrs: string, badge: string, className: string }}
 */
export function fragmentMarkup(text) {
  const uiLang = getLanguage();
  const detected = detectLanguage(text);
  const resolved = detected === 'mixed' || detected === 'neutral' ? null : detected;
  if (!resolved || resolved === uiLang) {
    return { lang: resolved || uiLang, attrs: ` lang="${resolved || uiLang}"`, badge: '', className: '' };
  }
  const title = t('lang.untranslated').replace(/"/g, '&quot;');
  return {
    lang: resolved,
    attrs: ` lang="${resolved}"`,
    badge: `<span class="lang-badge lang-badge-${resolved}" title="${title}">${t(`lang.badge.${resolved}`)}</span>`,
    className: ' untranslated-fragment'
  };
}

/**
 * The entity's name for the active language, plus a badge when the ladder had to
 * fall back to the other one. Returns a fragment so call sites that build a
 * heading can append it whole.
 */
export function appendEntityName(host, entity, { lang = getLanguage() } = {}) {
  const descriptor = nameDescriptor(entity, lang);
  host.appendChild(document.createTextNode(descriptor.text));
  if (descriptor.badgeLang) {
    host.setAttribute('lang', descriptor.badgeLang === 'unknown' ? lang : descriptor.badgeLang);
    const badge = createLanguageBadge(descriptor.badgeLang);
    if (badge) host.appendChild(badge);
  }
  return host;
}
