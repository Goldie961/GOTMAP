// Pure helpers for calibrated world-space region polygons. Region membership
// remains the hand-authored `location.region` field; geometry is diagnostic only.
export function pathToPolygon(path) {
  if (typeof path !== 'string') return [];
  const tokens = path.match(/[MLZ]|-?(?:\d+\.?\d*|\.\d+)/gi) || [];
  const points = [];
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++].toUpperCase();
    if (command === 'Z') break;
    if ((command === 'M' || command === 'L') && Number.isFinite(Number(tokens[index])) && Number.isFinite(Number(tokens[index + 1]))) {
      points.push({ x: Number(tokens[index++]), y: Number(tokens[index++]) });
    } else {
      return [];
    }
  }
  return points;
}

export function getPolygonBounds(path) {
  const points = Array.isArray(path) ? path : pathToPolygon(path);
  if (points.length < 3) return null;
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return {
    minX: Math.min(...xs), minY: Math.min(...ys),
    maxX: Math.max(...xs), maxY: Math.max(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys)
  };
}

export function isPointInPolygon(point, polygonPath) {
  const polygon = Array.isArray(polygonPath) ? polygonPath : pathToPolygon(polygonPath);
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y))
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}
