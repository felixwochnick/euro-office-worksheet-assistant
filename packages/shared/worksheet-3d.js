/*
 * worksheet-3d.js – 3D scenes of geometric bodies for worksheets (MIT License).
 *
 * Used by both the editor plugin (browser, global `Worksheet3d`) and Node.js
 * (CommonJS `require`). Dependency-free, ES2015-compatible, synchronous and deterministic.
 *
 * The AI describes a scene (block scene_3d): bodies (cube, cuboid, sphere, cylinder, cone, pyramid,
 * triangular_prism) that stand on the ground or on each other, a projection and a view. This module
 * computes the line drawing as vector graphics:
 *  - every body is convex, so it is handled analytically (no triangle meshes): polyhedra as faces
 *    with outward normals, sphere, cylinder and cone as quadrics;
 *  - candidate lines: polyhedron edges, rims of cylinders and cones, the silhouettes of the round
 *    bodies (exact for the camera: smooth, no tessellation zig-zag), the equator of a sphere (dashed
 *    style only), the edges of the ground plate and the intersection curves of overlapping bodies
 *    (marching squares of the other body's inside function on each surface patch);
 *  - visibility: a point is visible when its own body does not hide it (an adjacent face is front-
 *    facing) and a ray towards the viewer does not pass through another body; points inside another
 *    body are no edges of the union and are dropped. Lines are sampled every 0.25 mm on paper and the
 *    transitions are found by bisection, so visible lines meet and faces stay closed regions.
 *
 * render(block, opts) -> { svg, widthMm, heightMm, warnings, render }
 *   render: what the plugin needs for the coloured pass with three.js (same camera as the lines):
 *   { style, widthMm, heightMm, viewProj (world -> clip, 4x4 column-major), light (towards the light),
 *     bodies: [{ shape, dims, lying, matrix (local -> world, 4x4 column-major), color, nudge (world shift towards the
 *     viewer for the depth buffer only), faces? (local polygons of polyhedra) }], ground: { corners: [[x,y,z] x4], color } | null }
 *
 * Local frame of a body: origin at the centre of its base, y up, x to the right, z towards the viewer.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Worksheet3d = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SHAPES = ['cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'pyramid', 'triangular_prism'];
  var STYLES = ['outline', 'colored'];
  var PROJECTIONS = ['perspective', 'isometric', 'oblique'];
  var VIEWS = ['front', 'front_left', 'front_right'];
  var ELEVATIONS = ['low', 'medium', 'high'];
  var HIDDEN = ['none', 'dashed'];
  // Print-friendly fills: different lightness so they stay apart in grayscale; dark lines stay legible.
  var COLORS = {
    red: '#e8604c', blue: '#5b8fd9', yellow: '#f7d55a', green: '#63b86f', orange: '#f5a142',
    purple: '#a07ad1', brown: '#b07d52', gray: '#a3a9b3', white: '#ffffff'
  };
  var COLOR_ALIASES = {
    rot: 'red', blau: 'blue', gelb: 'yellow', 'grün': 'green', gruen: 'green', orange: 'orange', lila: 'purple',
    violett: 'purple', braun: 'brown', grau: 'gray', grey: 'gray', 'weiß': 'white', weiss: 'white', violet: 'purple'
  };
  var SHAPE_COLORS = {
    cube: 'red', cuboid: 'blue', sphere: 'yellow', cylinder: 'green', cone: 'orange', pyramid: 'purple', triangular_prism: 'brown'
  };
  var SHAPE_NAMES_DE = {
    cube: ['Würfel', 'Würfel'], cuboid: ['Quader', 'Quader'], sphere: ['Kugel', 'Kugeln'], cylinder: ['Zylinder', 'Zylinder'],
    cone: ['Kegel', 'Kegel'], pyramid: ['Pyramide', 'Pyramiden'], triangular_prism: ['Prisma', 'Prismen']
  };
  var GROUND_COLOR = '#e3ead9';
  var MAX_BODIES = 40;
  var MIN_SIZE = 0.1;
  var MAX_SIZE = 50;
  var STEP_MM = 0.25;       // sampling distance of the visibility test on paper
  var MARGIN_MM = 1.5;      // white space around the drawing
  var CIRCLE_SEGMENTS = 192;
  var DEFAULT_FONT = "'Open Sans', 'DejaVu Sans', Arial, sans-serif";
  var DEG = Math.PI / 180;

  // ---------------------------------------------------------------------------
  // Vectors ([x, y, z] arrays)
  // ---------------------------------------------------------------------------
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function len(a) { return Math.sqrt(dot(a, a)); }
  function norm(a) { var l = len(a); return l > 0 ? mul(a, 1 / l) : [0, 0, 0]; }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  /** Any unit vector perpendicular to a (unit). */
  function perp(a) {
    var t = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    return norm(cross(a, t));
  }

  function round(n, d) {
    var p = Math.pow(10, d);
    var r = Math.round(n * p) / p;
    return r === 0 ? 0 : r;
  }
  function f2(n) { return String(round(n, 2)); }
  function f3(n) { return String(round(n, 3)); }
  function px(mm) { return String(Math.round(mm / 25.4 * 96 * 100) / 100); }

  function escapeXml(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------------------
  // Scene normalisation
  // ---------------------------------------------------------------------------
  function show(v) {
    try { var s = JSON.stringify(v); return s === undefined ? String(v) : s.length > 40 ? s.slice(0, 37) + '...' : s; } catch (e) { return String(v); }
  }

  function enumOf(v, allowed, def, name) {
    if (v === undefined || v === null || v === '') return def;
    var s = String(v).trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (allowed.indexOf(s) === -1) throw new Error('"' + name + '" must be one of ' + allowed.join(', ') + ' (got ' + show(v) + ').');
    return s;
  }

  function toNum(v) {
    if (typeof v === 'string' && v.trim() !== '') return Number(v.replace(',', '.'));
    return v;
  }

  function sizeNum(v, at, name) {
    var n = toNum(v);
    if (typeof n !== 'number' || !isFinite(n)) throw new Error(at + ': "' + name + '" must be a number (got ' + show(v) + ').');
    if (n < MIN_SIZE || n > MAX_SIZE) throw new Error(at + ': "' + name + '" must be between ' + MIN_SIZE + ' and ' + MAX_SIZE + ' (got ' + n + ').');
    return n;
  }

  function coord(v, at, name) {
    var n = toNum(v);
    if (typeof n !== 'number' || !isFinite(n) || Math.abs(n) > 1000) throw new Error(at + ': "' + name + '" must be a number between -1000 and 1000 (got ' + show(v) + ').');
    return n;
  }

  /** [w, h, d] of a box-like body: size [w, h, d], or one number for all three. */
  function box3(v, def, at) {
    if (v === undefined || v === null) return def.slice();
    if (!Array.isArray(v)) { var s = sizeNum(v, at, 'size'); return [s, s, s]; }
    if (v.length !== 3) throw new Error(at + ': "size" must be [width, height, depth] (got ' + show(v) + ').');
    return [sizeNum(v[0], at, 'size[0]'), sizeNum(v[1], at, 'size[1]'), sizeNum(v[2], at, 'size[2]')];
  }

  function colorOf(v, at) {
    if (v === undefined || v === null || v === '') return null;
    var s = String(v).trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(s)) return s;
    if (COLOR_ALIASES[s]) s = COLOR_ALIASES[s];
    if (!COLORS[s]) throw new Error(at + ': "color" must be one of ' + Object.keys(COLORS).join(', ') + ' (got ' + show(v) + ').');
    return COLORS[s];
  }

  /** Dimensions per shape (local frame), with defaults so a forgotten size is no error. */
  function dimsOf(raw, shape, at) {
    var size = raw.size;
    switch (shape) {
      case 'cube': {
        var s = size === undefined || size === null ? 2 : Array.isArray(size) ? sizeNum(size[0], at, 'size') : sizeNum(size, at, 'size');
        return { w: s, h: s, d: s };
      }
      case 'cuboid': case 'pyramid': case 'triangular_prism': {
        var def = shape === 'cuboid' ? [3, 2, 2] : shape === 'pyramid' ? [2, 2, 2] : [3, 1.5, 2];
        var b = box3(size, def, at);
        return { w: b[0], h: b[1], d: b[2] };
      }
      case 'sphere': {
        var r = raw.radius !== undefined ? sizeNum(raw.radius, at, 'radius') : size !== undefined && !Array.isArray(size) ? sizeNum(size, at, 'size') / 2 : 1;
        return { r: r };
      }
      default: { // cylinder, cone
        var rr = raw.radius !== undefined ? sizeNum(raw.radius, at, 'radius') : 1;
        var hh = raw.height !== undefined ? sizeNum(raw.height, at, 'height') : 2;
        return { r: rr, h: hh };
      }
    }
  }

  /** Height of a body above its base. */
  function heightOf(b) {
    var d = b.dims;
    if (b.shape === 'sphere') return 2 * d.r;
    if (b.shape === 'cylinder' && b.lying) return 2 * d.r;
    return d.h;
  }

  function hasFlatTop(b) {
    return b.shape === 'cube' || b.shape === 'cuboid' || (b.shape === 'cylinder' && !b.lying) || (b.shape === 'triangular_prism' && !b.lying);
  }

  /**
   * Block -> normalised scene. Throws Error with a message naming the body ("bodies[2]: …").
   * Bodies get: index, shape, id, label, color, dims, lying, turnDeg, position [x, y, z] (centre of the base).
   */
  function normalizeScene(block) {
    block = block || {};
    var list = block.bodies;
    if (!Array.isArray(list) || !list.length) throw new Error('scene_3d needs "bodies": an array of 1–' + MAX_BODIES + ' bodies.');
    if (list.length > MAX_BODIES) throw new Error('scene_3d has ' + list.length + ' bodies – at most ' + MAX_BODIES + ' are allowed.');
    var projection = enumOf(block.projection, PROJECTIONS, 'perspective', 'projection');
    var scene = {
      style: enumOf(block.style, STYLES, 'outline', 'style'),
      projection: projection,
      view: enumOf(block.view, VIEWS, 'front_left', 'view'),
      elevation: enumOf(block.elevation, ELEVATIONS, 'medium', 'elevation'),
      hiddenEdges: enumOf(block.hidden_edges, HIDDEN, 'none', 'hidden_edges'),
      ground: block.ground === undefined || block.ground === null ? projection !== 'oblique' : block.ground === true || block.ground === 'true',
      colorBy: null,
      bodies: []
    };
    var ids = {};
    var anyColor = false;
    list.forEach(function (raw, i) {
      var at = 'bodies[' + i + ']';
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(at + ': a body must be an object like {"shape": "cube", "size": 2}.');
      var shape = String(raw.shape == null ? '' : raw.shape).trim().toLowerCase().replace(/[\s-]+/g, '_');
      if (shape === 'prism') shape = 'triangular_prism';
      if (SHAPES.indexOf(shape) === -1) throw new Error(at + ': "shape" must be one of ' + SHAPES.join(', ') + ' (got ' + show(raw.shape) + ').');
      var lying = raw.lying === true || raw.lying === 'true';
      if (lying && shape !== 'cylinder' && shape !== 'triangular_prism') throw new Error(at + ': only a cylinder or a triangular_prism can be "lying".');
      var b = {
        index: i, shape: shape, lying: lying, dims: dimsOf(raw, shape, at),
        id: raw.id == null || raw.id === '' ? null : String(raw.id).trim(),
        label: raw.label == null || raw.label === '' ? null : Array.from(String(raw.label).trim()).slice(0, 3).join(''),
        color: colorOf(raw.color, at),
        turnDeg: raw.turn == null || raw.turn === '' ? 0 : coord(raw.turn, at, 'turn'),
        on: raw.on == null || raw.on === '' ? null : String(raw.on).trim(),
        at: [0, 0],
        position: null
      };
      if (raw.at != null) {
        if (!Array.isArray(raw.at) || raw.at.length !== 2) throw new Error(at + ': "at" must be [x, z] (got ' + show(raw.at) + ').');
        b.at = [coord(raw.at[0], at, 'at[0]'), coord(raw.at[1], at, 'at[1]')];
      }
      if (b.color) anyColor = true;
      if (b.id) {
        if (ids[b.id] !== undefined) throw new Error(at + ': the id "' + b.id + '" is used twice.');
        ids[b.id] = i;
      }
      scene.bodies.push(b);
    });
    scene.colorBy = enumOf(block.color_by, ['shape', 'body'], anyColor ? 'body' : 'shape', 'color_by');

    // Placement: on the ground, or on the top face of the body named in "on" (resolved recursively).
    var state = {};
    function place(b, chain) {
      if (b.position) return;
      var at = 'bodies[' + b.index + ']';
      if (!b.on) {
        b.position = [b.at[0], 0, b.at[1]];
        return;
      }
      var j = ids[b.on];
      if (j === undefined) throw new Error(at + ': "on" names the id "' + b.on + '", but no body has this id.');
      if (j === b.index || state[j] === 'busy') throw new Error(at + ': "on" makes a cycle (' + chain.concat(b.index).map(function (k) { return 'bodies[' + k + ']'; }).join(' → ') + ').');
      var s = scene.bodies[j];
      if (!hasFlatTop(s)) {
        throw new Error(at + ': "on" names bodies[' + j + '] (' + (s.lying ? 'lying ' : '') + s.shape.replace('_', ' ') + '), which has no flat top – ' +
          'stack only on a cube, cuboid, upright cylinder or upright triangular_prism.');
      }
      state[b.index] = 'busy';
      place(s, chain.concat(b.index));
      state[b.index] = 'done';
      b.support = j;
      b.position = [s.position[0] + b.at[0], s.position[1] + heightOf(s), s.position[2] + b.at[1]];
    }
    scene.bodies.forEach(function (b) { place(b, []); });

    // Fill colours
    scene.bodies.forEach(function (b) {
      b.fill = scene.colorBy === 'body' ? b.color || COLORS[SHAPE_COLORS[b.shape]] : COLORS[SHAPE_COLORS[b.shape]];
    });

    // Sizes: at most 1:100 between the largest and the smallest body.
    var sizes = scene.bodies.map(function (b) { var d = b.dims; return b.shape === 'sphere' ? 2 * d.r : Math.max(d.w || 2 * d.r, d.h || 0, d.d || 2 * d.r); });
    var max = Math.max.apply(null, sizes);
    var min = Math.min.apply(null, sizes);
    if (max / min > 100) throw new Error('the largest body is more than 100 times bigger than the smallest – use sizes closer together.');
    return scene;
  }

  // ---------------------------------------------------------------------------
  // Solids in world coordinates
  // ---------------------------------------------------------------------------
  /** Polyhedron from local vertices and faces (vertex index lists, counter-clockwise seen from outside). */
  function polyhedron(vertsLocal, faces) {
    return { verts: vertsLocal, faces: faces };
  }

  /** Local polyhedron of a box-like body, or null for round bodies. */
  function localPoly(b) {
    var d = b.dims;
    var w = d.w / 2;
    var z = d.d / 2;
    var h = d.h;
    switch (b.shape) {
      case 'cube': case 'cuboid':
        return polyhedron(
          [[-w, 0, z], [w, 0, z], [w, h, z], [-w, h, z], [-w, 0, -z], [w, 0, -z], [w, h, -z], [-w, h, -z]],
          [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]);
      case 'pyramid':
        return polyhedron(
          [[-w, 0, z], [w, 0, z], [w, 0, -z], [-w, 0, -z], [0, h, 0]],
          [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [3, 2, 1, 0]]);
      case 'triangular_prism':
        if (b.lying) {
          // triangle in the side view (y-z), ridge on top along x
          return polyhedron(
            [[-w, 0, z], [-w, 0, -z], [-w, h, 0], [w, 0, z], [w, 0, -z], [w, h, 0]],
            [[0, 2, 1], [3, 4, 5], [0, 3, 5, 2], [1, 2, 5, 4], [0, 1, 4, 3]]);
        }
        // upright: triangle in the ground plane, base edge at the front, axis vertical
        return polyhedron(
          [[-w, 0, z], [w, 0, z], [0, 0, -z], [-w, h, z], [w, h, z], [0, h, -z]],
          [[0, 2, 1], [3, 4, 5], [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]]);
      default:
        return null;
    }
  }

  function rotY(p, cos, sin) { return [p[0] * cos + p[2] * sin, p[1], -p[0] * sin + p[2] * cos]; }

  /** Body -> solid: world geometry, AABB, bounding sphere, local->world matrix. */
  function makeSolid(b) {
    var cos = Math.cos(b.turnDeg * DEG);
    var sin = Math.sin(b.turnDeg * DEG);
    var pos = b.position;
    function toWorld(p) { return add(rotY(p, cos, sin), pos); }
    var d = b.dims;
    var s = { body: b, kind: null };
    // column-major local -> world (rotation about y, then translation)
    s.matrix = [cos, 0, -sin, 0, 0, 1, 0, 0, sin, 0, cos, 0, pos[0], pos[1], pos[2], 1];
    var poly = localPoly(b);
    var corners;
    if (poly) {
      s.kind = 'poly';
      s.localFaces = poly.faces.map(function (f) { return f.map(function (k) { return poly.verts[k].slice(); }); });
      s.verts = poly.verts.map(toWorld);
      s.faces = poly.faces.map(function (f) {
        var vs = f.map(function (k) { return s.verts[k]; });
        // Newell normal
        var n = [0, 0, 0];
        for (var i = 0; i < vs.length; i++) {
          var a = vs[i];
          var c = vs[(i + 1) % vs.length];
          n[0] += (a[1] - c[1]) * (a[2] + c[2]);
          n[1] += (a[2] - c[2]) * (a[0] + c[0]);
          n[2] += (a[0] - c[0]) * (a[1] + c[1]);
        }
        n = norm(n);
        return { idx: f, verts: vs, n: n, k: dot(n, vs[0]) };
      });
      var edges = {};
      s.faces.forEach(function (f, fi) {
        for (var i = 0; i < f.idx.length; i++) {
          var a = f.idx[i];
          var c = f.idx[(i + 1) % f.idx.length];
          var key = Math.min(a, c) + '-' + Math.max(a, c);
          if (!edges[key]) edges[key] = { a: s.verts[a], b: s.verts[c], faces: [] };
          edges[key].faces.push(fi);
        }
      });
      s.edges = Object.keys(edges).sort().map(function (k) { return edges[k]; });
      corners = s.verts;
    } else if (b.shape === 'sphere') {
      s.kind = 'sphere';
      s.c = [pos[0], pos[1] + d.r, pos[2]];
      s.r = d.r;
      corners = [];
      [-1, 1].forEach(function (x) { [-1, 1].forEach(function (y) { [-1, 1].forEach(function (z) { corners.push(add(s.c, [x * d.r, y * d.r, z * d.r])); }); }); });
    } else {
      s.kind = b.shape; // cylinder | cone
      s.r = d.r;
      if (b.shape === 'cylinder' && b.lying) {
        s.a = norm(rotY([1, 0, 0], cos, sin));
        s.L = d.h;
        s.b = add([pos[0], pos[1] + d.r, pos[2]], mul(s.a, -d.h / 2));
      } else {
        s.a = [0, 1, 0];
        s.L = d.h;
        s.b = pos.slice();
      }
      var e1 = perp(s.a);
      var e2 = cross(s.a, e1);
      s.e1 = e1;
      s.e2 = e2;
      corners = [];
      [0, s.L].forEach(function (t) {
        [-1, 1].forEach(function (x) { [-1, 1].forEach(function (y) { corners.push(add(add(s.b, mul(s.a, t)), add(mul(e1, x * d.r), mul(e2, y * d.r)))); }); });
      });
      if (s.kind === 'cone') s.apex = add(s.b, mul(s.a, s.L));
    }
    var lo = [Infinity, Infinity, Infinity];
    var hi = [-Infinity, -Infinity, -Infinity];
    corners.forEach(function (p) { for (var k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } });
    s.lo = lo;
    s.hi = hi;
    s.center = mul(add(lo, hi), 0.5);
    s.radius = len(sub(hi, lo)) / 2;
    return s;
  }

  /** Inside function: < 0 inside, 0 on the surface, > 0 outside (not a distance, only the sign and the zero set matter). */
  function inside(s, p) {
    switch (s.kind) {
      case 'poly': {
        var m = -Infinity;
        for (var i = 0; i < s.faces.length; i++) m = Math.max(m, dot(s.faces[i].n, p) - s.faces[i].k);
        return m;
      }
      case 'sphere': return len(sub(p, s.c)) - s.r;
      case 'cylinder': {
        var q = sub(p, s.b);
        var t = dot(q, s.a);
        var rho = len(sub(q, mul(s.a, t)));
        return Math.max(rho - s.r, -t, t - s.L);
      }
      default: { // cone
        var q2 = sub(p, s.b);
        var t2 = dot(q2, s.a);
        var rho2 = len(sub(q2, mul(s.a, t2)));
        return Math.max((rho2 - s.r * (s.L - t2) / s.L) * s.L / Math.sqrt(s.L * s.L + s.r * s.r), -t2, t2 - s.L);
      }
    }
  }

  /** Outward normal of a solid at a point on (or near) its surface. */
  function normalAt(s, p) {
    switch (s.kind) {
      case 'poly': {
        var best = null;
        var m = -Infinity;
        for (var i = 0; i < s.faces.length; i++) {
          var v = dot(s.faces[i].n, p) - s.faces[i].k;
          if (v > m) { m = v; best = s.faces[i].n; }
        }
        return best;
      }
      case 'sphere': return norm(sub(p, s.c));
      default: {
        var q = sub(p, s.b);
        var t = dot(q, s.a);
        var radial = sub(q, mul(s.a, t));
        var rho = len(radial);
        var u = rho > 1e-12 ? mul(radial, 1 / rho) : s.e1;
        var side = s.kind === 'cylinder' ? rho - s.r : (rho - s.r * (s.L - t) / s.L) * s.L / Math.sqrt(s.L * s.L + s.r * s.r);
        var bottom = -t;
        var top = t - s.L;
        if (bottom >= side && bottom >= top) return mul(s.a, -1);
        if (top >= side && top >= bottom) return s.a;
        return s.kind === 'cylinder' ? u : norm(add(mul(u, s.L), mul(s.a, s.r)));
      }
    }
  }

  /** Parameter interval [t0, t1] of the line o + t·d inside the solid, or null. d is a unit vector. */
  function quadInterval(qa, qb, qc) {
    // qa t² + 2 qb t + qc <= 0  ->  [t0, t1], or 'all', or null; only the bounded case matters for convex solids
    if (Math.abs(qa) < 1e-12) {
      if (Math.abs(qb) < 1e-12) return qc <= 0 ? [-Infinity, Infinity] : null;
      var t = -qc / (2 * qb);
      return qb > 0 ? [-Infinity, t] : [t, Infinity];
    }
    var disc = qb * qb - qa * qc;
    if (disc < 0) return qa > 0 ? null : [-Infinity, Infinity];
    var sq = Math.sqrt(disc);
    var r1 = (-qb - sq) / qa;
    var r2 = (-qb + sq) / qa;
    var lo = Math.min(r1, r2);
    var hi = Math.max(r1, r2);
    if (qa > 0) return [lo, hi];
    // outside of [lo, hi]: two half-lines; the caller intersects with a slab that keeps the right one
    return { outside: [lo, hi] };
  }

  function clampInterval(iv, lo, hi) {
    if (!iv) return null;
    if (iv.outside) {
      // (-inf, a] ∪ [b, inf) ∩ [lo, hi]: convex solids give one piece – take the hull of the pieces
      var a = iv.outside[0];
      var b = iv.outside[1];
      var p1 = lo <= a ? [lo, Math.min(a, hi)] : null;
      var p2 = hi >= b ? [Math.max(b, lo), hi] : null;
      if (p1 && p2) return [p1[0], p2[1]];
      return p1 || p2;
    }
    var t0 = Math.max(iv[0], lo);
    var t1 = Math.min(iv[1], hi);
    return t0 <= t1 ? [t0, t1] : null;
  }

  function rayInterval(s, o, d) {
    switch (s.kind) {
      case 'poly': {
        var t0 = -Infinity;
        var t1 = Infinity;
        for (var i = 0; i < s.faces.length; i++) {
          var f = s.faces[i];
          var den = dot(f.n, d);
          var dist = f.k - dot(f.n, o);
          if (Math.abs(den) < 1e-14) { if (dist < 0) return null; continue; }
          var t = dist / den;
          if (den > 0) t1 = Math.min(t1, t); else t0 = Math.max(t0, t);
          if (t0 > t1) return null;
        }
        return [t0, t1];
      }
      case 'sphere': {
        var oc = sub(o, s.c);
        var bq = dot(d, oc);
        var cq = dot(oc, oc) - s.r * s.r;
        var disc = bq * bq - cq;
        if (disc < 0) return null;
        var sq = Math.sqrt(disc);
        return [-bq - sq, -bq + sq];
      }
      default: {
        var q = sub(o, s.b);
        var s0 = dot(q, s.a);
        var da = dot(d, s.a);
        var oo = sub(q, mul(s.a, s0));
        var dd = sub(d, mul(s.a, da));
        // slab along the axis: 0 <= s0 + t·da <= L
        var lo, hi;
        if (Math.abs(da) < 1e-14) {
          if (s0 < 0 || s0 > s.L) return null;
          lo = -Infinity; hi = Infinity;
        } else {
          var ta = -s0 / da;
          var tb = (s.L - s0) / da;
          lo = Math.min(ta, tb); hi = Math.max(ta, tb);
        }
        var A = dot(dd, dd);
        var B = dot(oo, dd);
        var C = dot(oo, oo);
        if (s.kind === 'cylinder') return clampInterval(quadInterval(A, B, C - s.r * s.r), lo, hi);
        var k2 = (s.r / s.L) * (s.r / s.L);
        var hs = s.L - s0;
        return clampInterval(quadInterval(A - k2 * da * da, B + k2 * da * hs, C - k2 * hs * hs), lo, hi);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------
  /** Camera for the scene bounds { lo, hi }: project(p) -> [x, y, depth] (y up, depth grows away from the viewer). */
  function makeCamera(scene, bounds) {
    var center = mul(add(bounds.lo, bounds.hi), 0.5);
    var R = Math.max(0.5, len(sub(bounds.hi, bounds.lo)) / 2);
    var cam = { projection: scene.projection, center: center, R: R };
    var up = [0, 1, 0];
    if (scene.projection === 'oblique') {
      var k = 0.5;
      var c45 = Math.SQRT1_2;
      cam.kind = 'parallel';
      cam.rs = [1, 0, -k * c45];
      cam.us = [0, 1, -k * c45];
      cam.vvRaw = [k * c45, k * c45, 1];
      cam.vv = norm(cam.vvRaw);
      cam.project = function (p) { return [dot(p, cam.rs), dot(p, cam.us), -dot(p, cam.vv)]; };
      cam.viewRay = function (x, y) {
        var far = Math.abs(center[2]) + 10 * R;
        return { o: add([x, y, 0], mul(cam.vvRaw, far)), d: mul(cam.vv, -1) };
      };
      return cam;
    }
    var az, el;
    if (scene.projection === 'isometric') {
      az = scene.view === 'front_right' ? 45 : -45;
      el = Math.atan(1 / Math.SQRT2) / DEG; // 35.264°
    } else {
      az = { front: 0, front_left: -35, front_right: 35 }[scene.view];
      el = { low: 12, medium: 25, high: 45 }[scene.elevation];
    }
    var toEye = [Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), Math.cos(az * DEG) * Math.cos(el * DEG)];
    var f = mul(toEye, -1);
    var r = norm(cross(f, up));
    var u = cross(r, f);
    cam.r = r; cam.u = u; cam.f = f;
    if (scene.projection === 'isometric') {
      cam.kind = 'parallel';
      cam.rs = r; cam.us = u; cam.vv = toEye;
      cam.project = function (p) { return [dot(p, r), dot(p, u), -dot(p, toEye)]; };
      cam.viewRay = function (x, y) {
        var far = Math.abs(dot(center, toEye)) + 10 * R;
        return { o: add(add(mul(r, x), mul(u, y)), mul(toEye, far)), d: f };
      };
      return cam;
    }
    var fov = 22 * DEG;
    var D = R / Math.sin(fov / 2) * 1.05;
    var E = add(center, mul(toEye, D));
    cam.kind = 'perspective';
    cam.eye = E;
    cam.project = function (p) {
      var q = sub(p, E);
      var zc = dot(q, f);
      return [dot(q, r) / zc, dot(q, u) / zc, zc];
    };
    cam.viewRay = function (x, y) { return { o: E, d: norm(add(f, add(mul(r, x), mul(u, y)))) }; };
    return cam;
  }

  /** Direction from p towards the viewer (not normalised for the perspective camera). */
  function towards(cam, p) { return cam.kind === 'perspective' ? sub(cam.eye, p) : cam.vv; }

  /** World -> clip matrix (column-major) for the framing { ax, bx, ay, by } and the depth range. */
  function viewProjMatrix(cam, fr, dmin, dmax) {
    var rows;
    if (cam.kind === 'perspective') {
      var E = cam.eye;
      var rowR = [cam.r[0], cam.r[1], cam.r[2], -dot(cam.r, E)];
      var rowU = [cam.u[0], cam.u[1], cam.u[2], -dot(cam.u, E)];
      var rowF = [cam.f[0], cam.f[1], cam.f[2], -dot(cam.f, E)];
      var n = Math.max(dmin * 0.9, 1e-3);
      var fa = dmax * 1.1;
      var alpha = (fa + n) / (fa - n);
      var beta = -2 * n * fa / (fa - n);
      rows = [
        rowR.map(function (v, i) { return fr.ax * v + fr.bx * rowF[i]; }),
        rowU.map(function (v, i) { return fr.ay * v + fr.by * rowF[i]; }),
        rowF.map(function (v, i) { return alpha * v + (i === 3 ? beta : 0); }),
        rowF
      ];
    } else {
      var pad = (dmax - dmin) * 0.05 + 1e-3;
      var lo = dmin - pad;
      var dd = dmax + pad - lo;
      rows = [
        [fr.ax * cam.rs[0], fr.ax * cam.rs[1], fr.ax * cam.rs[2], fr.bx],
        [fr.ay * cam.us[0], fr.ay * cam.us[1], fr.ay * cam.us[2], fr.by],
        [-2 * cam.vv[0] / dd, -2 * cam.vv[1] / dd, -2 * cam.vv[2] / dd, -2 * lo / dd - 1],
        [0, 0, 0, 1]
      ];
    }
    var m = [];
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) m.push(rows[r][c]);
    return m;
  }

  // ---------------------------------------------------------------------------
  // Candidate curves
  // ---------------------------------------------------------------------------
  function circlePoints(c, e1, e2, rad, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n * 2 * Math.PI;
      pts.push(add(c, add(mul(e1, rad * Math.cos(t)), mul(e2, rad * Math.sin(t)))));
    }
    return pts;
  }

  function frontFacing(cam, n, p) { return dot(n, towards(cam, p)) > 0; }

  /**
   * Points of a circle are drawn as short chords; the tests use the exact circle (a chord's middle lies a hair inside
   * – inside a cone standing on the same base, for example).
   */
  function circleSnap(center, axis, rad) {
    return function (p) {
      var q = sub(p, center);
      var radial = sub(q, mul(axis, dot(q, axis)));
      var l = len(radial);
      return l > 1e-12 ? add(center, mul(radial, rad / l)) : p;
    };
  }

  /**
   * Curves of one solid: { pts, body, own(p) -> bool (own-body visibility), exclude: [solid indices], dashable,
   * faces?(p) -> [{ dir, n }] }. faces: the faces meeting at an edge (direction from the edge into the face and the
   * face normal), used to drop edges that are covered by or merged into other bodies.
   */
  function bodyCurves(s, si, cam, scene) {
    var out = [];
    function curve(pts, own, faces, snap) { out.push({ pts: pts, own: own, exclude: [si], dashable: true, body: si, faces: faces || null, snap: snap || null }); }
    var yes = function () { return true; };
    if (s.kind === 'poly') {
      s.edges.forEach(function (e) {
        var mid = lerp(e.a, e.b, 0.5);
        var vis = e.faces.some(function (fi) { return frontFacing(cam, s.faces[fi].n, mid); });
        var ed = norm(sub(e.b, e.a));
        var fdirs = e.faces.map(function (fi) {
          var f = s.faces[fi];
          var c = [0, 0, 0];
          f.verts.forEach(function (v) { c = add(c, v); });
          c = mul(c, 1 / f.verts.length);
          var d = sub(c, mid);
          return { dir: norm(sub(d, mul(ed, dot(d, ed)))), n: f.n };
        });
        curve([e.a, e.b], vis ? yes : function () { return false; }, function () { return fdirs; });
      });
      return out;
    }
    if (s.kind === 'sphere') {
      var axis, cc, rad;
      if (cam.kind === 'perspective') {
        var w = sub(cam.eye, s.c);
        var dw = len(w);
        axis = mul(w, 1 / dw);
        cc = add(s.c, mul(w, s.r * s.r / (dw * dw)));
        rad = s.r * Math.sqrt(Math.max(0, 1 - s.r * s.r / (dw * dw)));
      } else {
        axis = cam.vv; cc = s.c; rad = s.r;
      }
      var a1 = perp(axis);
      curve(circlePoints(cc, a1, cross(axis, a1), rad, CIRCLE_SEGMENTS), yes, null, circleSnap(cc, axis, rad));
      if (scene.hiddenEdges === 'dashed') {
        curve(circlePoints(s.c, [1, 0, 0], [0, 0, 1], s.r, CIRCLE_SEGMENTS), function (p) { return frontFacing(cam, norm(sub(p, s.c)), p); },
          null, circleSnap(s.c, [0, 1, 0], s.r));
      }
      return out;
    }
    // cylinder or cone
    var isCone = s.kind === 'cone';
    var sideNormal = function (p) {
      var q = sub(p, s.b);
      var u = norm(sub(q, mul(s.a, dot(q, s.a))));
      return isCone ? norm(add(mul(u, s.L), mul(s.a, s.r))) : u;
    };
    var caps = isCone ? [{ c: s.b, n: mul(s.a, -1) }] : [{ c: s.b, n: mul(s.a, -1) }, { c: add(s.b, mul(s.a, s.L)), n: s.a }];
    caps.forEach(function (cap) {
      curve(circlePoints(cap.c, s.e1, s.e2, s.r, CIRCLE_SEGMENTS), function (p) {
        return frontFacing(cam, cap.n, p) || frontFacing(cam, sideNormal(p), p);
      }, function (p) {
        var along = isCone ? norm(sub(s.apex, p)) : mul(cap.n, -1);
        return [{ dir: norm(sub(cap.c, p)), n: cap.n }, { dir: along, n: sideNormal(p) }];
      }, circleSnap(cap.c, s.a, s.r));
    });
    // silhouette generators
    var top = isCone ? s.apex : add(s.b, mul(s.a, s.L));
    var e = cam.kind === 'perspective' ? sub(cam.eye, isCone ? s.apex : s.b) : cam.vv;
    var ea = dot(e, s.a);
    var ep = sub(e, mul(s.a, ea));
    var D = len(ep);
    if (D < 1e-9) return out;
    var eh = mul(ep, 1 / D);
    var g = cross(s.a, eh);
    var cosPsi;
    if (isCone) cosPsi = -s.r * ea / (s.L * D);
    else cosPsi = cam.kind === 'perspective' ? s.r / D : 0;
    if (Math.abs(cosPsi) > 1) return out;
    var sinPsi = Math.sqrt(1 - cosPsi * cosPsi);
    [1, -1].forEach(function (sg) {
      var dir = add(mul(eh, cosPsi), mul(g, sg * sinPsi));
      var rim = add(s.b, mul(dir, s.r));
      if (isCone) curve([rim, s.apex], yes);
      else curve([rim, add(top, mul(dir, s.r))], yes);
    });
    return out;
  }

  // Marching squares of g (the other body's inside function) on surface patches of solid s.
  function patchesOf(s, other) {
    var patches = [];
    var olo = other.lo;
    var ohi = other.hi;
    function flatPatch(origin, e1, e2, poly2d, circleR) {
      // 2D bounding box of the face, cut to the projection of the other body's AABB
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      if (poly2d) poly2d.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
      else { x0 = y0 = -circleR; x1 = y1 = circleR; }
      var bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
      [0, 1].forEach(function (i) { [0, 1].forEach(function (j) { [0, 1].forEach(function (k) {
        var c = sub([i ? ohi[0] : olo[0], j ? ohi[1] : olo[1], k ? ohi[2] : olo[2]], origin);
        var u = dot(c, e1);
        var v = dot(c, e2);
        bx0 = Math.min(bx0, u); bx1 = Math.max(bx1, u); by0 = Math.min(by0, v); by1 = Math.max(by1, v);
      }); }); });
      // exactly the face (no margin: a grid row beyond the face could cross a coplanar face of the other body), cut to
      // the other body's box with a margin (a crossing on the box boundary must lie inside the grid)
      var m = 0.02 * other.radius + 1e-9;
      x0 = Math.max(x0, bx0 - m); x1 = Math.min(x1, bx1 + m); y0 = Math.max(y0, by0 - m); y1 = Math.min(y1, by1 + m);
      if (x0 >= x1 || y0 >= y1) return;
      var n = norm(cross(e1, e2));
      patches.push({
        nu: 64, nv: 64,
        point: function (u, v) { return add(origin, add(mul(e1, x0 + (x1 - x0) * u), mul(e2, y0 + (y1 - y0) * v))); },
        normal: function () { return n; },
        clip: function (a, b) { return poly2d ? clipPoly(a, b, origin, e1, e2, poly2d) : clipCircle(a, b, origin, e1, e2, circleR); }
      });
    }
    if (s.kind === 'poly') {
      s.faces.forEach(function (f) {
        var o = f.verts[0];
        var e1 = norm(sub(f.verts[1], o));
        var e2 = cross(f.n, e1);
        flatPatch(o, e1, e2, f.verts.map(function (p) { var q = sub(p, o); return [dot(q, e1), dot(q, e2)]; }), 0);
      });
    } else if (s.kind === 'sphere') {
      patches.push({
        nu: 160, nv: 80,
        point: function (u, v) {
          var th = u * 2 * Math.PI;
          var ph = v * Math.PI;
          return add(s.c, mul([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)], s.r));
        },
        normal: function (p) { return norm(sub(p, s.c)); }
      });
    } else {
      var isCone = s.kind === 'cone';
      patches.push({
        nu: 160, nv: 64,
        point: function (u, v) {
          var th = u * 2 * Math.PI;
          var dir = add(mul(s.e1, Math.cos(th)), mul(s.e2, Math.sin(th)));
          var rim = add(s.b, mul(dir, s.r));
          return isCone ? lerp(rim, s.apex, v) : add(rim, mul(s.a, v * s.L));
        },
        normal: function (p) { return normalAt(s, p); }
      });
      flatPatch(s.b, s.e2, s.e1, null, s.r); // bottom (e2 x e1 = -a: outward)
      if (!isCone) flatPatch(add(s.b, mul(s.a, s.L)), s.e1, s.e2, null, s.r);
    }
    return patches;
  }

  /** Clip segment a-b (3D points in a face plane) to a convex 2D polygon (counter-clockwise or clockwise). */
  function clipPoly(a, b, origin, e1, e2, poly) {
    var pa = [dot(sub(a, origin), e1), dot(sub(a, origin), e2)];
    var pb = [dot(sub(b, origin), e1), dot(sub(b, origin), e2)];
    // orientation of the polygon
    var area = 0;
    for (var i = 0; i < poly.length; i++) { var q = poly[i]; var r = poly[(i + 1) % poly.length]; area += q[0] * r[1] - r[0] * q[1]; }
    var sgn = area >= 0 ? 1 : -1;
    var t0 = 0, t1 = 1;
    for (var j = 0; j < poly.length; j++) {
      var p1 = poly[j];
      var p2 = poly[(j + 1) % poly.length];
      // inside: sgn * cross(p2 - p1, x - p1) >= 0
      var ex = p2[0] - p1[0], ey = p2[1] - p1[1];
      var fa = sgn * (ex * (pa[1] - p1[1]) - ey * (pa[0] - p1[0]));
      var fb = sgn * (ex * (pb[1] - p1[1]) - ey * (pb[0] - p1[0]));
      if (fa < 0 && fb < 0) return null;
      if (fa < 0) t0 = Math.max(t0, fa / (fa - fb));
      else if (fb < 0) t1 = Math.min(t1, fa / (fa - fb));
    }
    if (t0 >= t1) return null;
    return [t0 > 0 ? lerp(a, b, t0) : a, t1 < 1 ? lerp(a, b, t1) : b];
  }

  function clipCircle(a, b, origin, e1, e2, rad) {
    var pa = [dot(sub(a, origin), e1), dot(sub(a, origin), e2)];
    var pb = [dot(sub(b, origin), e1), dot(sub(b, origin), e2)];
    var dx = pb[0] - pa[0], dy = pb[1] - pa[1];
    var A = dx * dx + dy * dy;
    var B = pa[0] * dx + pa[1] * dy;
    var C = pa[0] * pa[0] + pa[1] * pa[1] - rad * rad;
    if (A < 1e-20) return C <= 0 ? [a, b] : null;
    var disc = B * B - A * C;
    if (disc < 0) return null;
    var sq = Math.sqrt(disc);
    var t0 = Math.max(0, (-B - sq) / A);
    var t1 = Math.min(1, (-B + sq) / A);
    if (t0 >= t1) return null;
    return [t0 > 0 ? lerp(a, b, t0) : a, t1 < 1 ? lerp(a, b, t1) : b];
  }

  /** Intersection segments of the surface of s with the surface of o: [[p, q], ...] (3D). */
  function intersectionSegments(s, o, tau) {
    var segs = [];
    var lo = o.lo, hi = o.hi;
    // outside the other body's bounding box: certainly outside (cheap test first)
    var g = function (p) {
      if (p[0] < lo[0] - tau || p[0] > hi[0] + tau || p[1] < lo[1] - tau || p[1] > hi[1] + tau || p[2] < lo[2] - tau || p[2] > hi[2] + tau) return 1;
      return inside(o, p);
    };
    patchesOf(s, o).forEach(function (patch) {
      var nu = patch.nu, nv = patch.nv;
      // g at a patch point; a point exactly on the other surface (round sizes often put a grid row there) is decided
      // by a small step into the patch: a surface passing through gets its side, one lying in the other's face stays
      // "on" (|g| <= tau, counted as outside).
      function gAt(u, v) {
        var gv = g(patch.point(u, v));
        if (Math.abs(gv) > tau) return gv;
        var gp = g(patch.point(u + (u < 1 ? 0.0137 : -0.0137) / nu, v + (v < 1 ? 0.0113 : -0.0113) / nv));
        return Math.abs(gp) > tau ? gp : gv;
      }
      var vals = [];
      var gs = [];
      for (var j = 0; j <= nv; j++) {
        for (var i = 0; i <= nu; i++) {
          var gv = gAt(i / nu, j / nv);
          gs.push(gv);
          vals.push(gv < -tau);
        }
      }
      var cache = {};
      function crossing(i0, j0, i1, j1) {
        var key = i0 + ',' + j0 + ',' + i1 + ',' + j1;
        if (cache[key]) return cache[key];
        var ua = i0 / nu, va = j0 / nv, ub = i1 / nu, vb = j1 / nv;
        var ina = vals[j0 * (nu + 1) + i0];
        var lo = 0, hi = 1;
        for (var k = 0; k < 24; k++) {
          var m = (lo + hi) / 2;
          if ((gAt(ua + (ub - ua) * m, va + (vb - va) * m) < -tau) === ina) lo = m; else hi = m;
        }
        var t = (lo + hi) / 2;
        cache[key] = patch.point(ua + (ub - ua) * t, va + (vb - va) * t);
        return cache[key];
      }
      for (var cj = 0; cj < nv; cj++) {
        for (var ci = 0; ci < nu; ci++) {
          var c00 = vals[cj * (nu + 1) + ci];
          var c10 = vals[cj * (nu + 1) + ci + 1];
          var c01 = vals[(cj + 1) * (nu + 1) + ci];
          var c11 = vals[(cj + 1) * (nu + 1) + ci + 1];
          if (c00 === c10 && c00 === c01 && c00 === c11) continue;
          // The surface must really pass through the other body: a cell whose "outside" corners only touch its
          // surface (a body standing in or on another one) gives no line.
          var gmax = Math.max(gs[cj * (nu + 1) + ci], gs[cj * (nu + 1) + ci + 1], gs[(cj + 1) * (nu + 1) + ci], gs[(cj + 1) * (nu + 1) + ci + 1]);
          if (gmax <= tau) continue;
          var e = [];
          e[0] = c00 !== c10 ? crossing(ci, cj, ci + 1, cj) : null;
          e[1] = c10 !== c11 ? crossing(ci + 1, cj, ci + 1, cj + 1) : null;
          e[2] = c01 !== c11 ? crossing(ci, cj + 1, ci + 1, cj + 1) : null;
          e[3] = c00 !== c01 ? crossing(ci, cj, ci, cj + 1) : null;
          var found = e.filter(function (x) { return x; });
          var pairs = [];
          if (found.length === 2) pairs.push(found);
          else if (found.length === 4) {
            var centerIn = gAt((ci + 0.5) / nu, (cj + 0.5) / nv) < -tau;
            if (c00 === centerIn) { pairs.push([e[0], e[1]]); pairs.push([e[2], e[3]]); }
            else { pairs.push([e[0], e[3]]); pairs.push([e[1], e[2]]); }
          }
          pairs.forEach(function (pr) {
            var seg = patch.clip ? patch.clip(pr[0], pr[1]) : pr;
            if (!seg || len(sub(seg[1], seg[0])) <= 1e-12) return;
            // where the two surfaces are parallel they touch or lie in one plane: no crease (only exactly parallel –
            // two faces 2° apart still meet in a crease)
            var mid = lerp(seg[0], seg[1], 0.5);
            if (Math.abs(dot(patch.normal(mid), normalAt(o, mid))) > 1 - 1e-7) return;
            segs.push(seg);
          });
        }
      }
    });
    return segs;
  }

  /**
   * Chain 3D segments sharing end points into polylines. Neighbouring marching-squares cells share their crossing
   * points (the same array object), so end points are matched by identity.
   */
  function chain3(segs) {
    var ids = typeof Map === 'function' ? new Map() : null;
    var next = 0;
    var key = function (p) {
      if (!ids) return p.join(',');
      var k = ids.get(p);
      if (k === undefined) { k = next++; ids.set(p, k); }
      return k;
    };
    var byKey = {};
    segs.forEach(function (s, i) {
      [0, 1].forEach(function (k) { var kk = key(s[k]); (byKey[kk] = byKey[kk] || []).push(i); });
    });
    var used = [];
    var lines = [];
    segs.forEach(function (s, i) {
      if (used[i]) return;
      used[i] = true;
      var line = [s[0], s[1]];
      [true, false].forEach(function (forward) {
        for (;;) {
          var end = forward ? line[line.length - 1] : line[0];
          var next = (byKey[key(end)] || []).filter(function (j) { return !used[j]; })[0];
          if (next === undefined) break;
          used[next] = true;
          var sn = segs[next];
          var other = key(sn[0]) === key(end) ? sn[1] : sn[0];
          if (forward) line.push(other); else line.unshift(other);
        }
      });
      lines.push(line);
    });
    return lines;
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  function describe(scene) {
    var counts = {};
    scene.bodies.forEach(function (b) { counts[b.shape] = (counts[b.shape] || 0) + 1; });
    return SHAPES.filter(function (s) { return counts[s]; }).map(function (s) {
      return counts[s] + ' ' + SHAPE_NAMES_DE[s][counts[s] === 1 ? 0 : 1];
    }).join(', ');
  }

  /**
   * Block -> { svg, widthMm, heightMm, warnings, render, scene }.
   * opts: { widthMm (default 160), maxHeightMm (default 180), font, color (lines, default #1f2937) }
   */
  function render(block, opts) {
    opts = opts || {};
    var scene = normalizeScene(block);
    var warnings = [];
    var solids = scene.bodies.map(makeSolid);

    // stacked bodies whose centre is outside the supporting top face
    scene.bodies.forEach(function (b) {
      if (b.support === undefined) return;
      var s = solids[b.support];
      var probe = [b.position[0], b.position[1] - 1e-6 * (s.radius + 1), b.position[2]];
      if (inside(s, probe) > 1e-9 * (s.radius + 1)) {
        warnings.push('bodies[' + b.index + '] stands on bodies[' + b.support + '], but its centre is outside the top face – with "on", "at" is the offset from the centre of the body below (usually leave it out).');
      }
    });

    // scene bounds and the ground plate
    var lo = [Infinity, Infinity, Infinity];
    var hi = [-Infinity, -Infinity, -Infinity];
    solids.forEach(function (s) { for (var k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], s.lo[k]); hi[k] = Math.max(hi[k], s.hi[k]); } });
    var ground = null;
    if (scene.ground) {
      var m = Math.max(0.6, 0.12 * Math.max(hi[0] - lo[0], hi[2] - lo[2]));
      ground = { x0: lo[0] - m, x1: hi[0] + m, z0: lo[2] - m, z1: hi[2] + m };
      ground.corners = [[ground.x0, 0, ground.z1], [ground.x1, 0, ground.z1], [ground.x1, 0, ground.z0], [ground.x0, 0, ground.z0]];
      lo = [Math.min(lo[0], ground.x0), Math.min(lo[1], 0), Math.min(lo[2], ground.z0)];
      hi = [Math.max(hi[0], ground.x1), Math.max(hi[1], 0), Math.max(hi[2], ground.z1)];
    }
    var cam = makeCamera(scene, { lo: lo, hi: hi });
    var S = cam.R;
    var tau = 1e-7 * S;
    var eps = 1e-6 * S;

    // candidate curves
    var curves = [];
    solids.forEach(function (s, si) { curves = curves.concat(bodyCurves(s, si, cam, scene)); });
    if (ground) {
      for (var gi = 0; gi < 4; gi++) {
        curves.push({ pts: [ground.corners[gi], ground.corners[(gi + 1) % 4]], own: function () { return true; }, exclude: [], dashable: false, body: -1 });
      }
    }
    for (var i = 0; i < solids.length; i++) {
      for (var j = i + 1; j < solids.length; j++) {
        var A = solids[i];
        var B = solids[j];
        var overlap = true;
        for (var k = 0; k < 3; k++) if (A.lo[k] > B.hi[k] - tau || B.lo[k] > A.hi[k] - tau) overlap = false;
        if (!overlap) continue;
        // march on the smaller body: finer curves
        var march = A.radius <= B.radius ? A : B;
        var oth = march === A ? B : A;
        var mi = march === A ? i : j;
        var oi = march === A ? j : i;
        chain3(intersectionSegments(march, oth, tau)).forEach(function (line) {
          curves.push({
            pts: line, body: mi, other: oi, exclude: [i, j], dashable: true,
            own: (function (s1, s2) {
              return function (p) {
                var w = towards(cam, p);
                return dot(normalAt(s1, p), w) >= -1e-9 && dot(normalAt(s2, p), w) >= -1e-9;
              };
            })(march, oth)
          });
        });
      }
    }

    // framing
    var bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    var dmin = Infinity, dmax = -Infinity;
    curves.forEach(function (c) {
      c.proj = c.pts.map(function (p) {
        var q = cam.project(p);
        bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]);
        return q;
      });
    });
    [0, 1].forEach(function (a) { [0, 1].forEach(function (b) { [0, 1].forEach(function (c) {
      var d = cam.project([a ? hi[0] : lo[0], b ? hi[1] : lo[1], c ? hi[2] : lo[2]])[2];
      dmin = Math.min(dmin, d); dmax = Math.max(dmax, d);
    }); }); });
    var maxW = Math.max(30, Number(opts.widthMm) || 160);
    var maxH = Math.max(30, Number(opts.maxHeightMm) || 180);
    var spanX = Math.max(bx1 - bx0, 1e-9);
    var spanY = Math.max(by1 - by0, 1e-9);
    var scale = (maxW - 2 * MARGIN_MM) / spanX;
    if (spanY * scale + 2 * MARGIN_MM > maxH) scale = (maxH - 2 * MARGIN_MM) / spanY;
    var W = round(spanX * scale + 2 * MARGIN_MM, 3);
    var H = round(spanY * scale + 2 * MARGIN_MM, 3);
    function toMm(q) { return [MARGIN_MM + (q[0] - bx0) * scale, MARGIN_MM + (by1 - q[1]) * scale]; }

    // visibility
    function occluded(p, exclude) {
      var w = towards(cam, p);
      var tmax = cam.kind === 'perspective' ? len(w) : Infinity;
      w = norm(w);
      for (var s = 0; s < solids.length; s++) {
        if (exclude.indexOf(s) !== -1) continue;
        var so = solids[s];
        // bounding sphere test
        var oc = sub(so.center, p);
        var tc = dot(oc, w);
        if (tc < -so.radius) continue;
        if (dot(oc, oc) - tc * tc > so.radius * so.radius) continue;
        var iv = rayInterval(so, p, w);
        if (!iv) continue;
        var a = Math.max(iv[0], eps);
        var b = Math.min(iv[1], tmax);
        if (b - a > eps) return true;
      }
      return false;
    }
    function insideOther(p, exclude) {
      for (var s = 0; s < solids.length; s++) {
        if (exclude.indexOf(s) !== -1) continue;
        var so = solids[s];
        if (p[0] < so.lo[0] || p[0] > so.hi[0] || p[1] < so.lo[1] || p[1] > so.hi[1] || p[2] < so.lo[2] || p[2] > so.hi[2]) continue;
        if (inside(so, p) < -tau) return true;
      }
      return false;
    }
    // Classify a point just inside one face of an edge against the other bodies:
    // 'covered' (inside another body, or glued to its surface with opposite normals), 'merged' (lies in another
    // body's face with the same normal) or 'free'.
    var delta = 1e-4 * S;
    function classify(q, n, exclude) {
      var res = 'free';
      for (var s = 0; s < solids.length; s++) {
        if (exclude.indexOf(s) !== -1) continue;
        var so = solids[s];
        if (q[0] < so.lo[0] - tau || q[0] > so.hi[0] + tau || q[1] < so.lo[1] - tau || q[1] > so.hi[1] + tau || q[2] < so.lo[2] - tau || q[2] > so.hi[2] + tau) continue;
        var g = inside(so, q);
        if (g < -tau) return 'covered';
        if (g <= tau) {
          var d = dot(normalAt(so, q), n);
          if (d < -(1 - 1e-7)) return 'covered';
          if (d > 1 - 1e-7) res = 'merged';
        }
      }
      return res;
    }
    // An edge is a line of the picture when one of its faces is free or when both merge into faces of other bodies
    // (two bodies sharing the edge). It is gone when no face is free and at least one is covered – e.g. the rim of a
    // cylinder standing inside a cuboid: its base lies in the cuboid's base, its side inside the cuboid.
    function edgeGone(c, p) {
      var fs = c.faces(p);
      var free = 0;
      var merged = 0;
      for (var k = 0; k < fs.length; k++) {
        var cl = classify(add(p, mul(fs[k].dir, delta)), fs[k].n, c.exclude);
        if (cl === 'free') free++;
        else if (cl === 'merged') merged++;
      }
      return free === 0 && merged < fs.length;
    }
    // 0 = no line (inside another body or covered), 1 = visible, 2 = hidden
    function state(c, p) {
      if (c.snap) p = c.snap(p);
      if (c.faces ? edgeGone(c, p) : insideOther(p, c.exclude)) return 0;
      if (!c.own(p)) return 2;
      return occluded(p, c.exclude) ? 2 : 1;
    }

    var dashed = scene.hiddenEdges === 'dashed';
    var visPieces = [];
    var hidPieces = [];
    var visibleLen = solids.map(function () { return 0; });
    curves.forEach(function (c) {
      for (var si = 0; si + 1 < c.pts.length; si++) {
        var pa = c.pts[si];
        var pb = c.pts[si + 1];
        var ma = toMm(c.proj[si]);
        var mb = toMm(c.proj[si + 1]);
        var lmm = Math.sqrt((mb[0] - ma[0]) * (mb[0] - ma[0]) + (mb[1] - ma[1]) * (mb[1] - ma[1]));
        if (lmm < 1e-6) continue;
        var n = Math.max(1, Math.ceil(lmm / STEP_MM));
        var ts = [0];
        var st = [state(c, pa)];
        for (var k2 = 1; k2 <= n; k2++) {
          var t = k2 / n;
          var sNow = state(c, lerp(pa, pb, t));
          var sPrev = st[st.length - 1];
          if (sNow !== sPrev) {
            var l = (k2 - 1) / n;
            var h = t;
            for (var it = 0; it < 18; it++) {
              var mid = (l + h) / 2;
              if (state(c, lerp(pa, pb, mid)) === sPrev) l = mid; else h = mid;
            }
            ts.push((l + h) / 2);
            st.push(sNow);
          }
        }
        ts.push(1);
        for (var r = 0; r < st.length; r++) {
          if (st[r] === 0) continue;
          var t0 = ts[r];
          var t1 = ts[r + 1];
          if (t1 - t0 < 1e-9) continue;
          var q0 = toMm(cam.project(lerp(pa, pb, t0)));
          var q1 = toMm(cam.project(lerp(pa, pb, t1)));
          if (st[r] === 1) {
            visPieces.push([q0, q1]);
            if (c.body >= 0) visibleLen[c.body] += Math.sqrt((q1[0] - q0[0]) * (q1[0] - q0[0]) + (q1[1] - q0[1]) * (q1[1] - q0[1]));
          } else if (dashed && c.dashable) {
            hidPieces.push([q0, q1]);
          }
        }
      }
    });

    // labels
    var labels = [];
    var labelR = 2.4;
    solids.forEach(function (s, si) {
      var b = s.body;
      if (!b.label) return;
      var p0x = Infinity, p1x = -Infinity, p0y = Infinity, p1y = -Infinity;
      [0, 1].forEach(function (a) { [0, 1].forEach(function (bb) { [0, 1].forEach(function (c) {
        var q = cam.project([a ? s.hi[0] : s.lo[0], bb ? s.hi[1] : s.lo[1], c ? s.hi[2] : s.lo[2]]);
        p0x = Math.min(p0x, q[0]); p1x = Math.max(p1x, q[0]); p0y = Math.min(p0y, q[1]); p1y = Math.max(p1y, q[1]);
      }); }); });
      var cand = [];
      var N = 15;
      for (var iy = 0; iy <= N; iy++) {
        for (var ix = 0; ix <= N; ix++) {
          var x = p0x + (p1x - p0x) * ix / N;
          var y = p0y + (p1y - p0y) * iy / N;
          var ray = cam.viewRay(x, y);
          var best = Infinity;
          var who = -1;
          for (var o2 = 0; o2 < solids.length; o2++) {
            var iv = rayInterval(solids[o2], ray.o, ray.d);
            if (!iv || iv[1] < 0 || iv[1] - Math.max(iv[0], 0) < eps) continue;
            var th = Math.max(iv[0], 0);
            if (th < best) { best = th; who = o2; }
          }
          if (who === si) cand.push([x, y]);
        }
      }
      if (!cand.length) {
        warnings.push('bodies[' + si + '] has the label "' + b.label + '", but the body cannot be seen – the label is left out.');
        return;
      }
      var cx = 0, cy = 0;
      cand.forEach(function (q) { cx += q[0]; cy += q[1]; });
      cx /= cand.length; cy /= cand.length;
      var pick = cand[0];
      var bd = Infinity;
      cand.forEach(function (q) { var d = (q[0] - cx) * (q[0] - cx) + (q[1] - cy) * (q[1] - cy); if (d < bd) { bd = d; pick = q; } });
      labels.push({ at: toMm([pick[0], pick[1]]), text: b.label });
    });

    // warnings: invisible bodies
    solids.forEach(function (s, si) {
      if (visibleLen[si] > 0.05) return;
      var host = -1;
      var probe = s.center;
      for (var o3 = 0; o3 < solids.length; o3++) if (o3 !== si && inside(solids[o3], probe) < -tau) host = o3;
      if (host >= 0) warnings.push('bodies[' + si + '] (' + s.body.shape + ') is completely inside bodies[' + host + '] and cannot be seen – move or enlarge it.');
      else warnings.push('bodies[' + si + '] (' + s.body.shape + ') is completely hidden behind other bodies – move it or choose another view.');
    });

    // SVG
    var lw = Math.max(0.35, Math.min(0.6, 0.25 + W * 0.0025));
    if (scene.style === 'colored') lw = Math.max(0.3, lw * 0.75);
    var hw = Math.max(0.25, lw * 0.5);
    var color = opts.color || '#1f2937';
    var font = opts.font || DEFAULT_FONT;
    var body = '';
    var visD = pathData(dropSpecks(chain2(mergeCollinear(visPieces))));
    var hidD = pathData(dropSpecks(chain2(mergeCollinear(hidPieces))));
    if (hidD) body += '<path fill="none" stroke="' + color + '" stroke-width="' + f3(hw) + '" stroke-dasharray="' + f3(hw * 4) + ' ' + f3(hw * 3) + '" stroke-linecap="butt" stroke-linejoin="round" d="' + hidD + '"/>';
    if (visD) body += '<path fill="none" stroke="' + color + '" stroke-width="' + f3(lw) + '" stroke-linecap="round" stroke-linejoin="round" d="' + visD + '"/>';
    labels.forEach(function (l) {
      var fs = 3.4;
      body += '<circle cx="' + f2(l.at[0]) + '" cy="' + f2(l.at[1]) + '" r="' + labelR + '" fill="#ffffff" stroke="' + color + '" stroke-width="0.35"/>' +
        '<text x="' + f2(l.at[0]) + '" y="' + f2(l.at[1] + fs * 0.36) + '" font-size="' + fs + '" font-weight="bold" text-anchor="middle" fill="' + color + '">' + escapeXml(l.text) + '</text>';
    });
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + px(W) + '" height="' + px(H) + '" viewBox="0 0 ' + f3(W) + ' ' + f3(H) + '">' +
      '<g font-family="' + escapeXml(font) + '">' + body + '</g></svg>';

    // description for the coloured pass (plugin, three.js)
    var fr = {
      ax: 2 * scale / W, bx: 2 * (MARGIN_MM - bx0 * scale) / W - 1,
      ay: 2 * scale / H, by: 1 - 2 * (MARGIN_MM + by1 * scale) / H
    };
    // y: ndc_y = 1 - 2·Y/H with Y = MARGIN + (by1 - y)·scale  ->  ndc_y = (2·scale/H)·y + 1 - 2(MARGIN + by1·scale)/H
    var toViewer = cam.kind === 'perspective' ? mul(cam.f, -1) : cam.vv;
    var right = cam.kind === 'perspective' || cam.projection === 'isometric' ? cam.r : [1, 0, 0];
    var light = norm(add(add(mul(right, -0.45), [0, 0.9, 0]), mul(toViewer, 0.55)));
    var renderDesc = {
      style: scene.style, widthMm: W, heightMm: H,
      viewProj: viewProjMatrix(cam, fr, dmin, dmax).map(function (v) { return round(v, 9); }),
      light: light.map(function (v) { return round(v, 6); }),
      bodies: solids.map(function (s, si) {
        var b = s.body;
        // nudge: a tiny shift towards the viewer, growing with the body index, so that faces of two bodies in one plane
        // (two cylinders of the same height) get a clear winner in the depth buffer instead of flickering stripes
        var nudge = mul(norm(towards(cam, s.center)), (si + 1) * 2e-4 * S);
        var o = { shape: b.shape, dims: b.dims, lying: b.lying, matrix: s.matrix.map(function (v) { return round(v, 9); }), color: b.fill,
          nudge: nudge.map(function (v) { return round(v, 9); }) };
        if (s.localFaces) o.faces = s.localFaces;
        return o;
      }),
      ground: ground ? { corners: ground.corners, color: GROUND_COLOR } : null
    };
    return { svg: svg, widthMm: W, heightMm: H, warnings: warnings, render: renderDesc, scene: scene, summary: describe(scene) };
  }

  /**
   * Merge straight 2D pieces that lie on one line and overlap – an edge shared by two bodies comes twice, and two
   * dashed copies with different dash phases would look like a solid line.
   */
  function mergeCollinear(pieces) {
    var groups = {};
    var order = [];
    pieces.forEach(function (pc) {
      var dx = pc[1][0] - pc[0][0], dy = pc[1][1] - pc[0][1];
      var l = Math.sqrt(dx * dx + dy * dy);
      if (l < 1e-6) return;
      var ux = dx / l, uy = dy / l;
      if (ux < -1e-9 || (Math.abs(ux) <= 1e-9 && uy < 0)) { ux = -ux; uy = -uy; }
      var key = Math.round(Math.atan2(uy, ux) * 2000) + ':' + Math.round((uy * pc[0][0] - ux * pc[0][1]) * 200);
      var g = groups[key];
      if (!g) { g = groups[key] = { ux: ux, uy: uy, list: [] }; order.push(key); }
      var t0 = pc[0][0] * g.ux + pc[0][1] * g.uy;
      var t1 = pc[1][0] * g.ux + pc[1][1] * g.uy;
      g.list.push(t0 <= t1 ? { t0: t0, t1: t1, a: pc[0], b: pc[1] } : { t0: t1, t1: t0, a: pc[1], b: pc[0] });
    });
    var out = [];
    order.forEach(function (key) {
      var list = groups[key].list.sort(function (x, y) { return x.t0 - y.t0; });
      var cur = null;
      list.forEach(function (it) {
        if (cur && it.t0 <= cur.t1 + 1e-3) {
          if (it.t1 > cur.t1) { cur.t1 = it.t1; cur.b = it.b; }
        } else {
          if (cur) out.push([cur.a, cur.b]);
          cur = { t0: it.t0, t1: it.t1, a: it.a, b: it.b };
        }
      });
      if (cur) out.push([cur.a, cur.b]);
    });
    return out;
  }

  /** Chain 2D pieces [[a, b], ...] into polylines (end points within 0.001 mm). */
  function chain2(pieces) {
    var key = function (p) { return Math.round(p[0] * 1000) + ',' + Math.round(p[1] * 1000); };
    var starts = {};
    var ends = {};
    pieces.forEach(function (pc, i) {
      (starts[key(pc[0])] = starts[key(pc[0])] || []).push(i);
      (ends[key(pc[1])] = ends[key(pc[1])] || []).push(i);
    });
    var used = [];
    var lines = [];
    pieces.forEach(function (pc, i) {
      if (used[i]) return;
      used[i] = true;
      var line = [pc[0], pc[1]];
      for (;;) {
        var k = key(line[line.length - 1]);
        var next = (starts[k] || []).filter(function (j) { return !used[j]; })[0];
        var flip = false;
        if (next === undefined) { next = (ends[k] || []).filter(function (j) { return !used[j]; })[0]; flip = true; }
        if (next === undefined) break;
        used[next] = true;
        line.push(flip ? pieces[next][0] : pieces[next][1]);
      }
      for (;;) {
        var k0 = key(line[0]);
        var prev = (ends[k0] || []).filter(function (j) { return !used[j]; })[0];
        var flip0 = false;
        if (prev === undefined) { prev = (starts[k0] || []).filter(function (j) { return !used[j]; })[0]; flip0 = true; }
        if (prev === undefined) break;
        used[prev] = true;
        line.unshift(flip0 ? pieces[prev][1] : pieces[prev][0]);
      }
      lines.push(simplify(line));
    });
    return lines;
  }

  /** Leave out lines shorter than 0.25 mm: specks where a corner barely touches a face (a round cap would show a dot). */
  function dropSpecks(lines) {
    return lines.filter(function (line) {
      var l = 0;
      for (var i = 1; i < line.length; i++) l += Math.sqrt((line[i][0] - line[i - 1][0]) * (line[i][0] - line[i - 1][0]) + (line[i][1] - line[i - 1][1]) * (line[i][1] - line[i - 1][1]));
      return l >= 0.25;
    });
  }

  /** Drop points that lie on the straight line between their neighbours (collinear within 0.002 mm). */
  function simplify(line) {
    if (line.length < 3) return line;
    var out = [line[0]];
    for (var i = 1; i < line.length - 1; i++) {
      var a = out[out.length - 1];
      var b = line[i];
      var c = line[i + 1];
      var dx = c[0] - a[0], dy = c[1] - a[1];
      var l = Math.sqrt(dx * dx + dy * dy);
      // b may go: on the segment a–c (strictly between a and c, within 0.002 mm); a point where the line turns back
      // (outside a–c) stays
      var t = l < 1e-9 ? -1 : ((b[0] - a[0]) * dx + (b[1] - a[1]) * dy) / (l * l);
      var dist = l < 1e-9 ? Infinity : Math.abs(dx * (b[1] - a[1]) - dy * (b[0] - a[0])) / l;
      if (!(t > 0 && t < 1 && dist <= 0.002)) out.push(b);
    }
    out.push(line[line.length - 1]);
    return out;
  }

  function pathData(lines) {
    return lines.map(function (line) {
      var closed = line.length > 2 && Math.abs(line[0][0] - line[line.length - 1][0]) < 1e-3 && Math.abs(line[0][1] - line[line.length - 1][1]) < 1e-3;
      var pts = closed ? line.slice(0, -1) : line;
      return 'M' + pts.map(function (p) { return f2(p[0]) + ' ' + f2(p[1]); }).join('L') + (closed ? 'Z' : '');
    }).join('');
  }

  return {
    SHAPES: SHAPES,
    STYLES: STYLES,
    PROJECTIONS: PROJECTIONS,
    VIEWS: VIEWS,
    ELEVATIONS: ELEVATIONS,
    COLORS: COLORS,
    SHAPE_COLORS: SHAPE_COLORS,
    MAX_BODIES: MAX_BODIES,
    normalizeScene: normalizeScene,
    render: render,
    describe: describe,
    // exposed for the unit tests
    _internal: { makeSolid: makeSolid, rayInterval: rayInterval, inside: inside, makeCamera: makeCamera }
  };
});
