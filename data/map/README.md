# World map data contract

`world-terrain-1500x1000` is the single canonical coordinate system for the active world map. It is a 1500 × 1000 landscape canvas rendered over `assets/Mapa/HARTA LUMII.png` (7685 × 5115 pixels).

## Coordinate spaces

1. **Legacy schematic space.** `regions.json` and the `coordinates` on records in `locations.json` use an older hand-drawn SVG space. It has no verified transform to the terrain map. Do not render or transform this geometry on the terrain map.
2. **Canonical world terrain space.** `catalog.json`, `world_coordinates.json`, and `region_polygons_calibrated.json` use `world-terrain-1500x1000`. This is the only space accepted for new map positions.
3. **Historical reference-image space.** The 17 entries in `catalog.json → maps.world.coordinates` were copied from the 512 × 1024 portrait reference image `Poze harta completa/WESTEROS/westeros.png`. They are retained for provenance, marked `status: "needsRecalibration"`, and must never be rendered.

`world_coordinates.json` is the active terrain-space location registry and `region_polygons_calibrated.json` is the matching region-boundary registry. The current Westeros entries are the initial terrain seed used to make the map immediately usable; neither file changes legacy `locations.json` or `regions.json`.

The uncalibrated coastline, road, mountain, and forest source files are archived in `_legacy_unused/`; they are retained only as source material for future calibration and must not be fetched by the application.

The coordinate picker is intentionally hidden from normal use and is available only at `?internalCalibrate=1`. In point mode, choose a location and click its position. In region mode, choose a region, click vertices around its outline, then double-click the final vertex or press **Finish polygon**. Download each JSON file and review it before replacing the matching file in `data/map/`.

Only numeric in-bounds coordinates (`0 ≤ x ≤ 1500`, `0 ≤ y ≤ 1000`) with no recalibration status are rendered. Missing or invalid locations are deliberately omitted and listed in `window.atlasDataManager.data.missingCoordinates` for calibration work.
