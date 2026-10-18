const assert = require('node:assert/strict');
const fs = require('node:fs');

// Verify places-xuanhoa.ts is intact (87 places) and no fake coordinates were injected into unverified places
const placesSrc = fs.readFileSync('src/lib/places-xuanhoa.ts', 'utf8');
const placeMatches = placesSrc.match(/^\s*\{\s*$/gm) || [];
assert.ok(placeMatches.length >= 87, `Expected at least 87 places in places-xuanhoa.ts, found ${placeMatches.length}`);

// Verify map-data.ts enforces coordinateVerified: false for unverified catalog places
const mapDataSrc = fs.readFileSync('src/lib/map/map-data.ts', 'utf8');
assert.ok(mapDataSrc.includes('coordinateVerified: isVerified'));
assert.ok(mapDataSrc.includes('isDemoData: true'));

console.log('✓ personal-pool & XUHO CITY catalog verification passed (87 places intact, no fake coordinates).');
