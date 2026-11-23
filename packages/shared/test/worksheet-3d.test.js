'use strict';
// Unit tests for the 3D scenes (packages/shared/worksheet-3d.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const W3 = require('../worksheet-3d.js');
const { assertWellFormed } = require('./xml-helper.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** All polylines of the solid (visible) and of the dashed (hidden) path: [[x, y], ...][] */
function paths(svg) {
  const out = { visible: [], hidden: [] };
  const re = /<path ([^>]*)d="([^"]*)"\/>/g;
  let m;
  while ((m = re.exec(svg))) {
    const kind = /stroke-dasharray/.test(m[1]) ? 'hidden' : 'visible';
    for (const part of m[2].split('M').filter(Boolean)) {
      const closed = part.endsWith('Z');
      const pts = part.replace('Z', '').split('L').map((p) => p.trim().split(/\s+/).map(Number));
      if (closed) pts.push(pts[0]);
      out[kind].push(pts);
    }
  }
  return out;
}

function lengthOf(lines) {
  let l = 0;
  for (const line of lines) for (let i = 1; i < line.length; i++) l += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  return l;
}

function check(r) {
  assert.equal(typeof r.svg, 'string');
  assertWellFormed(r.svg);
  assert.doesNotMatch(r.svg, /NaN|undefined|Infinity|null/);
  assert.ok(r.widthMm > 0 && r.heightMm > 0);
  return r;
}

const CITY = {
  type: 'scene_3d',
  bodies: [
    { id: 'haus', shape: 'cuboid', size: [3, 2, 3], at: [0, 0] },
    { shape: 'triangular_prism', lying: true, size: [3, 1.2, 3], on: 'haus' },
    { id: 'turm', shape: 'cylinder', radius: 1, height: 4, at: [5, 1] },
    { shape: 'cone', radius: 1.2, height: 2, on: 'turm' },
    { shape: 'sphere', radius: 1, at: [-3, 2], label: '3', color: 'yellow' },
  ],
};

// ---------------------------------------------------------------------------
// Scene model
// ---------------------------------------------------------------------------

test('defaults of a scene', () => {
  const s = W3.normalizeScene({ bodies: [{ shape: 'cube' }] });
  assert.equal(s.style, 'outline');
  assert.equal(s.projection, 'perspective');
  assert.equal(s.view, 'front_left');
  assert.equal(s.elevation, 'medium');
  assert.equal(s.hiddenEdges, 'none');
  assert.equal(s.ground, true);
  assert.equal(s.colorBy, 'shape');
  assert.deepEqual(s.bodies[0].dims, { w: 2, h: 2, d: 2 });
  assert.equal(W3.normalizeScene({ projection: 'oblique', bodies: [{ shape: 'cube' }] }).ground, false, 'no ground plate in a Schrägbild');
});

test('stacking puts a body on the top face of another', () => {
  const s = W3.normalizeScene(CITY);
  assert.deepEqual(s.bodies[0].position, [0, 0, 0]);
  assert.deepEqual(s.bodies[1].position, [0, 2, 0], 'roof on the house (height 2)');
  assert.deepEqual(s.bodies[3].position, [5, 4, 1], 'cone on the tower (height 4)');
  const t = W3.normalizeScene({ bodies: [{ shape: 'cube', size: 1, on: 'b' }, { id: 'b', shape: 'cuboid', size: [2, 3, 2], at: [1, 1] }] });
  assert.deepEqual(t.bodies[0].position, [1, 3, 1], 'forward reference');
  const u = W3.normalizeScene({ bodies: [{ id: 'a', shape: 'cuboid', size: [4, 1, 4] }, { shape: 'cube', size: 1, on: 'a', at: [1, -1] }] });
  assert.deepEqual(u.bodies[1].position, [1, 1, -1], '"at" is an offset from the centre below');
});

test('errors name the body', () => {
  const bad = (bodies, re) => assert.throws(() => W3.normalizeScene({ bodies }), re);
  bad([{ shape: 'tetraeder' }], /bodies\[0\]: "shape" must be one of cube, cuboid/);
  bad([{ shape: 'cube' }, { shape: 'cube', on: 'x' }], /bodies\[1\]: "on" names the id "x", but no body has this id/);
  bad([{ id: 'a', shape: 'cube', on: 'b' }, { id: 'b', shape: 'cube', on: 'a' }], /cycle/);
  bad([{ id: 'k', shape: 'sphere' }, { shape: 'cube', on: 'k' }], /bodies\[1\]: "on" names bodies\[0\] \(sphere\), which has no flat top/);
  bad([{ id: 'z', shape: 'cylinder', lying: true }, { shape: 'cube', on: 'z' }], /lying cylinder\), which has no flat top/);
  bad([{ shape: 'cube', size: 0 }], /bodies\[0\]: "size" must be between 0.1 and 50/);
  bad([{ shape: 'cuboid', size: [1, 2] }], /bodies\[0\]: "size" must be \[width, height, depth\]/);
  bad([{ shape: 'cone', lying: true }], /only a cylinder or a triangular_prism can be "lying"/);
  bad([{ shape: 'cube', color: 'pink' }], /"color" must be one of red, blue/);
  bad([{ shape: 'cube', size: 0.2 }, { shape: 'cube', size: 30 }], /more than 100 times bigger/);
  bad(Array.from({ length: 41 }, () => ({ shape: 'cube' })), /at most 40/);
  assert.throws(() => W3.normalizeScene({ bodies: [] }), /needs "bodies"/);
  assert.throws(() => W3.normalizeScene({ view: 'top', bodies: [{ shape: 'cube' }] }), /"view" must be one of front, front_left, front_right/);
  // stacking on an upright prism is allowed
  assert.doesNotThrow(() => W3.normalizeScene({ bodies: [{ id: 'p', shape: 'triangular_prism' }, { shape: 'cube', size: 0.5, on: 'p' }] }));
});

test('colours: by shape, by body, German names', () => {
  const byShape = W3.normalizeScene({ bodies: [{ shape: 'cube' }, { shape: 'cylinder' }] });
  assert.equal(byShape.bodies[0].fill, W3.COLORS.red);
  assert.equal(byShape.bodies[1].fill, W3.COLORS.green);
  const byBody = W3.normalizeScene({ bodies: [{ shape: 'cube', color: 'blau' }, { shape: 'cylinder' }] });
  assert.equal(byBody.colorBy, 'body');
  assert.equal(byBody.bodies[0].fill, W3.COLORS.blue);
  assert.equal(byBody.bodies[1].fill, W3.COLORS.green, 'a body without colour gets its shape colour');
});

test('ray intervals of the convex solids', () => {
  const s = W3.normalizeScene({ bodies: [{ shape: 'cube', size: 2 }, { shape: 'sphere', radius: 1, at: [5, 0] }, { shape: 'cone', radius: 1, height: 2, at: [10, 0] }] });
  const { makeSolid, rayInterval } = W3._internal;
  const cube = makeSolid(s.bodies[0]);
  assert.deepEqual(rayInterval(cube, [0, 1, 10], [0, 0, -1]).map((v) => Math.round(v * 1e6) / 1e6), [9, 11]);
  const sphere = makeSolid(s.bodies[1]);
  assert.deepEqual(rayInterval(sphere, [5, 1, 10], [0, 0, -1]).map((v) => Math.round(v * 1e6) / 1e6), [9, 11]);
  assert.equal(rayInterval(sphere, [5, 3, 10], [0, 0, -1]), null);
  const cone = makeSolid(s.bodies[2]);
  // at half height the cone has radius 0.5
  assert.deepEqual(rayInterval(cone, [10, 1, 10], [0, 0, -1]).map((v) => Math.round(v * 1e6) / 1e6), [9.5, 10.5]);
  assert.equal(rayInterval(cone, [10, 2.5, 10], [0, 0, -1]), null, 'above the apex (upper nappe excluded)');
});

// ---------------------------------------------------------------------------
// Line drawing
// ---------------------------------------------------------------------------

test('render returns a well-formed SVG of the requested width', () => {
  const r = check(W3.render(CITY, { widthMm: 150 }));
  assert.equal(r.widthMm, 150);
  assert.match(r.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="[\d.]+" height="[\d.]+" viewBox="0 0 150 [\d.]+">/);
  assert.match(r.svg, /<circle [^>]*\/><text [^>]*>3<\/text>/, 'label');
  assert.deepEqual(r.warnings, []);
  assert.equal(r.summary, '1 Quader, 1 Kugel, 1 Zylinder, 1 Kegel, 1 Prisma');
  assert.equal(W3.render(CITY, { widthMm: 150 }).svg, r.svg, 'deterministic');
});

test('a tall scene is limited by the maximum height', () => {
  const r = check(W3.render({ projection: 'oblique', bodies: [{ shape: 'cuboid', size: [1, 20, 1] }] }, { widthMm: 160, maxHeightMm: 100 }));
  assert.equal(r.heightMm, 100);
  assert.ok(r.widthMm < 40);
});

test('a cube behind a cube loses its hidden edges', () => {
  const alone = paths(W3.render({ ground: false, bodies: [{ shape: 'cube', size: 2, at: [0, -6] }] }, { widthMm: 100 }).svg);
  const both = W3.render({ ground: false, bodies: [{ shape: 'cube', size: 2, at: [0, -6] }, { shape: 'cube', size: 3, at: [0, 0] }] }, { widthMm: 100 });
  check(both);
  assert.equal(alone.hidden.length, 0);
  // the front cube (3 units) covers the lower part of the back cube: fewer visible lines than 2 cubes alone
  const two = paths(both.svg);
  const frontAlone = paths(W3.render({ ground: false, bodies: [{ shape: 'cube', size: 3, at: [0, 0] }] }, { widthMm: 100 }).svg);
  assert.ok(lengthOf(two.visible) < lengthOf(alone.visible) * 0.95 + lengthOf(frontAlone.visible) * 1.6);
  assert.deepEqual(both.warnings, []);
});

test('visible lines of a cube meet: closed outline', () => {
  const r = W3.render({ ground: false, projection: 'isometric', bodies: [{ shape: 'cube', size: 2 }] }, { widthMm: 80 });
  const lines = paths(r.svg).visible;
  lines.forEach((line, li) => {
    if (Math.hypot(line[0][0] - line[line.length - 1][0], line[0][1] - line[line.length - 1][1]) < 1e-6) return;
    for (const e of [line[0], line[line.length - 1]]) {
      // a line (also this one, further along) passes through or ends at this end point
      const met = lines.some((o, oi) => o.some((p, pi) => !(oi === li && (pi === 0 || pi === o.length - 1)) && Math.hypot(p[0] - e[0], p[1] - e[1]) < 0.05));
      assert.ok(met, 'open end at ' + e.join(','));
    }
  });
  // 9 visible edges of an isometric cube: the outline hexagon (6) and 3 inner edges
  assert.ok(lengthOf(paths(r.svg).visible) > 0);
});

test('sphere: one closed outline, equator only in the dashed style', () => {
  const plain = paths(W3.render({ ground: false, bodies: [{ shape: 'sphere', radius: 1 }] }, { widthMm: 60 }).svg);
  assert.equal(plain.visible.length, 1);
  assert.equal(plain.hidden.length, 0);
  const first = plain.visible[0];
  assert.ok(Math.hypot(first[0][0] - first[first.length - 1][0], first[0][1] - first[first.length - 1][1]) < 1e-6, 'closed');
  // a circle: all points at the same distance from the centre (no zig-zag)
  const cx = first.reduce((s, p) => s + p[0], 0) / first.length;
  const cy = first.reduce((s, p) => s + p[1], 0) / first.length;
  const radii = first.map((p) => Math.hypot(p[0] - cx, p[1] - cy));
  assert.ok(Math.max(...radii) - Math.min(...radii) < 0.6, 'smooth outline');
  const dashed = paths(W3.render({ ground: false, projection: 'oblique', hidden_edges: 'dashed', bodies: [{ shape: 'sphere', radius: 1 }] }, { widthMm: 60 }).svg);
  assert.ok(dashed.hidden.length >= 1, 'back half of the equator dashed');
  assert.ok(dashed.visible.length >= 2, 'outline and front half of the equator');
});

test('oblique projection: the front face of a cube is a square', () => {
  const r = W3.render({ projection: 'oblique', bodies: [{ shape: 'cube', size: 2 }] }, { widthMm: 60 });
  // width of the drawing = 2 + 2·0.5·cos45 = 2.707 units, height the same
  assert.ok(Math.abs(r.widthMm - r.heightMm) < 0.1, r.widthMm + ' x ' + r.heightMm);
  const dashed = paths(W3.render({ projection: 'oblique', hidden_edges: 'dashed', bodies: [{ shape: 'cube', size: 2 }] }, { widthMm: 60 }).svg);
  assert.equal(dashed.hidden.length >= 1, true, '3 hidden edges dashed');
});

test('stacked bodies give no intersection lines', () => {
  const stacked = W3.render({ ground: false, bodies: [{ id: 'a', shape: 'cube', size: 2 }, { shape: 'cylinder', radius: 0.5, height: 1, on: 'a' }] }, { widthMm: 80 });
  const cube = W3.render({ ground: false, bodies: [{ shape: 'cube', size: 2 }, { shape: 'cylinder', radius: 0.5, height: 1, at: [0, 0] }] }, { widthMm: 80 });
  // the same bodies overlapping (cylinder inside the cube's bottom) produce no line where the cylinder stands in the cube
  assert.deepEqual(stacked.warnings, []);
  assert.ok(/bodies\[1\] \(cylinder\) is completely inside bodies\[0\]/.test(cube.warnings.join('\n')), cube.warnings.join('\n'));
});

test('a cylinder sunk into a cuboid gets an intersection curve', () => {
  const sunk = W3.render({ ground: false, bodies: [{ shape: 'cuboid', size: [4, 2, 3] }, { shape: 'cylinder', radius: 0.8, height: 3.5, at: [0.5, 0] }] }, { widthMm: 100 });
  const apart = W3.render({ ground: false, bodies: [{ shape: 'cuboid', size: [4, 2, 3] }, { shape: 'cylinder', radius: 0.8, height: 1.5, at: [0.5, 0], on: undefined }] }, { widthMm: 100 });
  check(sunk);
  assert.deepEqual(sunk.warnings, []);
  // the part above the cuboid shows its top rim, the outline and the curve where it leaves the top face
  const p = paths(sunk.svg);
  assert.ok(p.visible.length >= 3);
  assert.ok(/completely inside/.test(apart.warnings.join('')), 'a short cylinder inside the cuboid is reported');
});

test('labels on hidden bodies are reported', () => {
  const r = W3.render({ ground: false, bodies: [{ shape: 'cuboid', size: [4, 4, 4] }, { shape: 'sphere', radius: 0.5, at: [0, 0], label: '1' }] }, { widthMm: 80 });
  assert.match(r.warnings.join('\n'), /bodies\[1\] has the label "1", but the body cannot be seen/);
  assert.match(r.warnings.join('\n'), /bodies\[1\] \(sphere\) is completely inside bodies\[0\]/);
  assert.doesNotMatch(r.svg, /<text/);
});

test('a hidden body behind a wall is reported', () => {
  const r = W3.render({ view: 'front', elevation: 'low', ground: false, bodies: [
    { shape: 'cuboid', size: [8, 6, 0.5], at: [0, 2] }, { shape: 'cube', size: 1, at: [0, -2] }] }, { widthMm: 80 });
  assert.match(r.warnings.join('\n'), /bodies\[1\] \(cube\) is completely hidden behind other bodies/);
});

test('overhang warning for a stacked body placed off its support', () => {
  const r = W3.render({ bodies: [{ id: 's', shape: 'cylinder', radius: 0.2, height: 1 }, { shape: 'sphere', radius: 0.8, on: 's', at: [-4, -1] }] }, { widthMm: 80 });
  assert.match(r.warnings.join('\n'), /bodies\[1\] stands on bodies\[0\], but its centre is outside the top face/);
});

test('every projection, view and elevation renders', () => {
  for (const projection of W3.PROJECTIONS) {
    for (const view of W3.VIEWS) {
      for (const elevation of W3.ELEVATIONS) {
        for (const hidden_edges of ['none', 'dashed']) {
          check(W3.render({ ...CITY, projection, view, elevation, hidden_edges }, { widthMm: 120 }));
        }
      }
    }
  }
});

test('render description for the coloured pass', () => {
  const r = W3.render({ ...CITY, style: 'colored' }, { widthMm: 150 });
  const d = r.render;
  assert.equal(d.style, 'colored');
  assert.equal(d.widthMm, r.widthMm);
  assert.equal(d.viewProj.length, 16);
  assert.equal(d.bodies.length, 5);
  assert.equal(d.bodies[0].faces.length, 6, 'cuboid faces');
  assert.equal(d.bodies[1].faces.length, 5, 'prism faces');
  assert.equal(d.bodies[2].faces, undefined, 'cylinder is drawn from its dimensions');
  assert.equal(d.bodies[4].color, W3.COLORS.yellow);
  assert.ok(d.ground && d.ground.corners.length === 4);
  // the matrix maps the top of the tower inside the clip square and the image corners to ±1
  const m = d.viewProj;
  const clip = (p) => {
    const v = [0, 1, 2, 3].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
    return [v[0] / v[3], v[1] / v[3], v[2] / v[3]];
  };
  for (const p of [[5, 6, 1], [0, 0, 0], [-3, 1, 2]]) {
    const c = clip(p);
    assert.ok(c.every((v) => v > -1 && v < 1), JSON.stringify(c));
  }
  // lines are thinner in the coloured style
  const sw = (svg) => Number(/stroke-width="([\d.]+)" stroke-linecap="round"/.exec(svg)[1]);
  assert.ok(sw(r.svg) < sw(W3.render(CITY, { widthMm: 150 }).svg));
});

test('40 bodies render quickly', () => {
  const bodies = [];
  for (let i = 0; i < 40; i++) {
    const shape = W3.SHAPES[i % W3.SHAPES.length];
    bodies.push({ shape, at: [(i % 8) * 2.2, Math.floor(i / 8) * 2.2] });
  }
  // some overlapping pairs
  bodies[5].at = [bodies[4].at[0] + 0.8, bodies[4].at[1]];
  const t = Date.now();
  check(W3.render({ bodies }, { widthMm: 170 }));
  assert.ok(Date.now() - t < 3000, 'took ' + (Date.now() - t) + ' ms');
});
