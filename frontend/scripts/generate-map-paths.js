/**
 * Convert world-atlas TopoJSON to SVG path strings for the matchmaking map.
 * Run: node scripts/generate-map-paths.js
 * Output: assets/map-paths.json
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// Decode TopoJSON arcs
function decodeArcs(topology) {
  const { scale, translate } = topology.transform;
  return topology.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
}

// Convert longitude/latitude to SVG viewBox coords (1000x500, Mercator)
// Clamp latitude to ±80° to avoid extreme Mercator distortion at the poles
const MAX_LAT = 80;
function lonLatToSvg(lon, lat) {
  lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const x = ((lon + 180) / 360) * 1000;
  // Mercator Y
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = 250 - (mercN / Math.PI) * 250;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

// Build SVG path from arc references
function arcToPath(arcRefs, decodedArcs) {
  const points = [];
  for (const ref of arcRefs) {
    const idx = ref >= 0 ? ref : ~ref;
    let coords = decodedArcs[idx].slice();
    if (ref < 0) coords = coords.slice().reverse();
    for (const [lon, lat] of coords) {
      points.push(lonLatToSvg(lon, lat));
    }
  }
  if (points.length === 0) return '';
  // Simplify: skip points too close together
  const simplified = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [px, py] = simplified[simplified.length - 1];
    const [cx, cy] = points[i];
    if (Math.abs(cx - px) > 1.5 || Math.abs(cy - py) > 1.5) {
      simplified.push(points[i]);
    }
  }
  if (simplified.length < 3) return '';
  return 'M' + simplified.map(([x, y]) => `${x},${y}`).join('L') + 'Z';
}

async function main() {
  console.log('Fetching world-atlas TopoJSON...');
  const raw = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json');
  const topo = JSON.parse(raw);

  console.log('Decoding arcs...');
  const decodedArcs = decodeArcs(topo);

  const land = topo.objects.land;
  const paths = [];

  for (const geom of land.geometries) {
    if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.arcs) {
        for (const ring of polygon) {
          const p = arcToPath(ring, decodedArcs);
          if (p && p.length > 20) paths.push(p);
        }
      }
    } else if (geom.type === 'Polygon') {
      for (const ring of geom.arcs) {
        const p = arcToPath(ring, decodedArcs);
        if (p && p.length > 20) paths.push(p);
      }
    }
  }

  console.log(`Generated ${paths.length} SVG paths`);

  const outPath = path.join(__dirname, '..', 'assets', 'map-paths.json');
  fs.writeFileSync(outPath, JSON.stringify(paths, null, 0));
  console.log(`Written to ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
}

main().catch(console.error);
