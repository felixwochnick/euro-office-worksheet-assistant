#!/usr/bin/env node
'use strict';
/*
 * Manual check of the 3D line drawings (packages/shared/worksheet-3d.js) on ~330 scenes: every pair of shapes
 * overlapping, stacks, touching and coplanar bodies, extreme sizes and distances – each in five projections/views,
 * compared with an independent ray-cast id buffer (scene-oracle.js). Prints the scenes with issues and the timings.
 * Slow (minutes); the unit tests (worksheet-3d.test.js) run a selection.
 *
 *   node packages/shared/test/scene-battery.js [<part of a scene name>]
 *
 * Known findings that are no defects: in projection oblique with hidden_edges dashed a sphere gets its equator (a
 * line inside the sphere, reported as LINE-THROUGH-FACE).
 */
const { analyse } = require('./scene-oracle.js');
const only = process.argv[2];
const shapes = { cube: { shape: 'cube', size: 2 }, cuboid: { shape: 'cuboid', size: [3, 1.5, 2] }, sphere: { shape: 'sphere', radius: 1 },
  cylinder: { shape: 'cylinder', radius: 0.8, height: 2.5 }, cone: { shape: 'cone', radius: 1, height: 2.5 }, pyramid: { shape: 'pyramid', size: [2, 2.5, 2] },
  prism: { shape: 'triangular_prism', size: [3, 1.5, 2] }, lcyl: { shape: 'cylinder', lying: true, radius: 0.8, height: 3 }, lprism: { shape: 'triangular_prism', lying: true, size: [3, 1.5, 2] } };
const scenes = [];
const names = Object.keys(shapes);
// all pairs overlapping, with turn
for (let i = 0; i < names.length; i++) for (let j = i; j < names.length; j++) {
  scenes.push([`pair ${names[i]}+${names[j]}`, { bodies: [{ ...shapes[names[i]], at: [0, 0], turn: 20 }, { ...shapes[names[j]], at: [0.9, 0.6], turn: -35 }] }]);
}
const projs = [{}, { projection: 'isometric' }, { projection: 'oblique', hidden_edges: 'dashed' }, { elevation: 'low', view: 'front_right' }, { elevation: 'high', view: 'front' }];
const extra = [
  ['stack chain', { bodies: [{ id: 'a', shape: 'cuboid', size: [4, 1, 4] }, { id: 'b', shape: 'cylinder', radius: 1.5, height: 1, on: 'a' }, { id: 'c', shape: 'triangular_prism', size: [2, 1, 2], on: 'b', turn: 30 }, { id: 'd', shape: 'cube', size: 0.8, on: 'c', turn: 10 }, { shape: 'cone', radius: 0.4, height: 1, on: 'd' }] }],
  ['side by side touching', { bodies: [{ shape: 'cube', size: 2, at: [0, 0] }, { shape: 'cube', size: 2, at: [2, 0] }, { shape: 'cuboid', size: [2, 3, 2], at: [4, 0] }, { shape: 'cube', size: 2, at: [0, -2] }] }],
  ['same place twins', { bodies: [{ shape: 'cube', size: 2 }, { shape: 'cube', size: 2 }] }],
  ['flush front', { bodies: [{ shape: 'cuboid', size: [4, 1, 2], at: [-1, 0] }, { shape: 'cube', size: 2, at: [1, 0] }] }],
  ['sphere tangent cube', { bodies: [{ shape: 'cube', size: 2 }, { shape: 'sphere', radius: 1, at: [2, 0] }] }],
  ['tiny huge', { bodies: [{ shape: 'cube', size: 40 }, { shape: 'sphere', radius: 0.25, at: [25, 25] }] }],
  ['far apart', { bodies: [{ shape: 'cube', size: 2, at: [-900, 0] }, { shape: 'cube', size: 2, at: [900, 0] }] }],
  ['far deep', { bodies: [{ shape: 'cube', size: 2, at: [0, -900] }, { shape: 'cube', size: 2, at: [0, 900] }] }],
  ['tall low', { elevation: 'low', bodies: [{ shape: 'cuboid', size: [1, 30, 1] }, { id: 't', shape: 'cuboid', size: [2, 20, 2], at: [3, -2] }, { shape: 'pyramid', size: [2, 3, 2], on: 't' }, { shape: 'cube', size: 1, at: [0, 3] }] }],
  ['crossing cylinders', { bodies: [{ shape: 'cylinder', radius: 1, height: 4 }, { shape: 'cylinder', lying: true, radius: 0.6, height: 5, at: [0, 0], turn: 30 }] }],
  ['spheres overlap', { bodies: [{ shape: 'sphere', radius: 1.5 }, { shape: 'sphere', radius: 1, at: [1.5, 0.5] }, { shape: 'sphere', radius: 0.7, at: [-1.2, 1] }] }],
  ['tree', { bodies: [{ id: 's', shape: 'cylinder', radius: 0.3, height: 2 }, { shape: 'sphere', radius: 1.2, on: 's', at: [0, 0] }] }],
  ['tree sunk', { bodies: [{ shape: 'cylinder', radius: 0.3, height: 2.5 }, { shape: 'sphere', radius: 1.2, at: [0, 0] }] }],
  ['vehicle', { bodies: [{ shape: 'cuboid', size: [4, 1.5, 2], at: [0, 0] }, ...[[-1.3, 1], [1.3, 1], [-1.3, -1], [1.3, -1]].map(a => ({ shape: 'cylinder', lying: true, radius: 0.5, height: 0.4, turn: 90, at: a }))] }],
  ['plate', { bodies: [{ shape: 'cuboid', size: [10, 0.1, 10] }, { shape: 'cube', size: 1, at: [0, 0] }] }],
  ['turn45 iso', { projection: 'isometric', bodies: [{ shape: 'cube', size: 2, turn: 45 }, { shape: 'cuboid', size: [3, 1, 2], turn: 45, at: [3, 0] }] }],
  ['pyramid apex in cube', { bodies: [{ shape: 'cube', size: 2, at: [0, 0] }, { shape: 'pyramid', size: [2, 3, 2], at: [0, 0] }] }],
  ['cone in cylinder', { bodies: [{ shape: 'cylinder', radius: 1, height: 2 }, { shape: 'cone', radius: 1, height: 4 }] }],
  ['coaxial cylinders', { bodies: [{ shape: 'cylinder', radius: 1, height: 2 }, { shape: 'cylinder', radius: 0.5, height: 3 }] }],
  ['house row', { bodies: [0, 1, 2].flatMap(k => [{ id: 'h' + k, shape: 'cuboid', size: [3, 2, 3], at: [k * 3, 0] }, { shape: 'triangular_prism', lying: true, size: [3, 1.2, 3], on: 'h' + k }]) }],
  ['overhang stack', { bodies: [{ id: 'p', shape: 'cylinder', radius: 0.3, height: 3 }, { shape: 'cuboid', size: [4, 0.3, 4], on: 'p' }] }],
];
for (const [n, s] of extra) scenes.push([n, s]);
const results = [];
for (const [name, sc] of scenes) {
  if (only && !name.includes(only)) continue;
  for (const p of projs) {
    const block = { ...sc, ...p };
    let a;
    try { a = analyse(block, { res: 0.12 }); } catch (e) { console.log('CRASH', name, JSON.stringify(p), e.stack.split('\n').slice(0,3).join(' | ')); continue; }
    const tag = `${name} ${JSON.stringify(p)}`;
    if (a.issues.length || a.ms > 300) console.log(tag, a.ms + 'ms', a.W + 'x' + a.H, a.r.warnings, '\n  ' + a.issues.join('\n  '));
    results.push({ tag, ms: a.ms, issues: a.issues.length });
  }
}
console.log('scenes', results.length, 'with issues', results.filter(r => r.issues).length, 'max ms', Math.max(...results.map(r => r.ms)));
