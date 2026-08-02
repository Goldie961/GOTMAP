export function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function throttle(fn, limit) {
  let inThrottle = false;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function createElement(tag, className = '', textContent = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent) el.textContent = textContent;
  return el;
}

export function createSVGElement(tag, attributes = {}) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([key, val]) => {
    el.setAttribute(key, val);
  });
  return el;
}

export function formatYear(year) {
  if (year < 0) {
    return `${Math.abs(year)} BC`;
  }
  return `${year} AC`;
}

// Cubic easing for camera flyTo animations
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function stripEntityPrefix(id) {
  if (!id) return '';
  return String(id).replace(/^(PERSON_|HOUSE_|LOCATION_|EVENT_|OBJECT_|TITLE_)/i, '').toLowerCase();
}

