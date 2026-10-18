import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('case-mechanics spin curve & XUHO CITY geo dataset integrity', () => {
  // 1. Verify spinProgress monotonic curve
  const spinProgress = (progress, friction) => {
    const p = Math.max(0, Math.min(1, progress));
    return 1 - Math.pow(1 - p, friction);
  };
  assert.equal(spinProgress(0, 3), 0);
  assert.equal(spinProgress(1, 3), 1);
  assert.ok(spinProgress(0.5, 3) > 0.5);

  // 2. Verify XUHO CITY GeoJSON files exist and contain genuine OpenStreetMap features
  const boundary = JSON.parse(fs.readFileSync('public/geo/xuanhoa-boundary.geojson', 'utf8'));
  assert.equal(boundary.type, 'FeatureCollection');
  assert.ok(boundary.features.length >= 1);
  assert.equal(boundary.features[0].geometry.type, 'Polygon');

  const roads = JSON.parse(fs.readFileSync('public/geo/xuanhoa-roads.geojson', 'utf8'));
  assert.equal(roads.type, 'FeatureCollection');
  assert.ok(roads.features.length > 5000, 'Should contain >5,000 real OSM road ways');

  const buildings = JSON.parse(fs.readFileSync('public/geo/xuanhoa-buildings.geojson', 'utf8'));
  assert.equal(buildings.type, 'FeatureCollection');
  assert.ok(buildings.features.length > 4000, 'Should contain >4,000 real OSM buildings');

  const water = JSON.parse(fs.readFileSync('public/geo/xuanhoa-water.geojson', 'utf8'));
  assert.equal(water.type, 'FeatureCollection');
  assert.ok(water.features.length > 100, 'Should contain >100 real OSM water polygons');

  const verifiedPois = JSON.parse(fs.readFileSync('public/geo/xuanhoa-osm-verified-pois.json', 'utf8'));
  assert.equal(verifiedPois.relationId, 19542980);
  assert.ok(Array.isArray(verifiedPois.namedRoads) && verifiedPois.namedRoads.length >= 26);
  assert.ok(Array.isArray(verifiedPois.pois) && verifiedPois.pois.length >= 20);
  for (const poi of verifiedPois.pois) {
    assert.ok(poi.osmId && (poi.osmId.startsWith('node/') || poi.osmId.startsWith('way/')));
    assert.ok(Number.isFinite(poi.lat) && poi.lat > 21.2 && poi.lat < 21.45);
    assert.ok(Number.isFinite(poi.lng) && poi.lng > 105.6 && poi.lng < 105.85);
  }
});
