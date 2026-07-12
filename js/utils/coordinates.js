export function distanceBetween(point1, point2) {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function travelTime(miles, mode) {
  const speeds = {
    horse: 30,    // miles per day (steady pace)
    walking: 15,  // miles per day
    ship: 100,    // miles per day (typical winds)
    dragon: 250   // miles per day (swift flying, non-stop)
  };
  return Math.ceil(miles / speeds[mode]);
}

// Convert screen (client) coordinates to SVG space coordinates
export function screenToSVG(svgElement, screenX, screenY) {
  const point = svgElement.createSVGPoint();
  point.x = screenX;
  point.y = screenY;
  
  // Use CTM (Current Transformation Matrix) of SVG for inversion
  const ctm = svgElement.getScreenCTM();
  if (ctm) {
    return point.matrixTransform(ctm.inverse());
  }
  return { x: screenX, y: screenY };
}
