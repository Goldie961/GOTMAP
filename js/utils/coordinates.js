export function svgToMiles(svgDistance) {
  // Westeros is ~900 miles wide at its widest point.
  // Our viewBox width is 1000. So 1 SVG unit ≈ 0.9 miles.
  return svgDistance * 0.9;
}

export function milesToSvg(miles) {
  return miles / 0.9;
}

export function distanceBetween(point1, point2) {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceInMiles(point1, point2) {
  return svgToMiles(distanceBetween(point1, point2));
}

export function distanceInLeagues(point1, point2) {
  // 1 league ≈ 3 miles
  return distanceInMiles(point1, point2) / 3;
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
