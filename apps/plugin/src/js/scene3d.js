/*
 * scene3d.js – coloured pass of the 3D scenes (block scene_3d, style "colored") with three.js (MIT License).
 *
 * packages/shared/worksheet-3d.js computes the line drawing and a render description: the camera as one world -> clip
 * matrix (the picture rectangle is the clip square), the light direction, the bodies (shape, dimensions, local -> world
 * matrix, colour, faces of the polyhedra in local coordinates) and the ground plate. This file fills the bodies with
 * WebGL at print resolution; blocks.js puts the vector lines on top (one SVG, rasterised like every graphic).
 *
 * window.Scene3dRenderer.available() -> boolean
 * window.Scene3dRenderer.renderColored(desc, dpi) -> PNG data URL (throws when WebGL fails)
 *
 * Local frames are those of worksheet-3d.js: origin at the centre of the base, y up. Lying cylinders lie along x.
 */
(function (window) {
  'use strict';

  var MAX_PX = 4096;

  function available() {
    if (!window.THREE) return false;
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) {
      return false;
    }
  }

  /** Flat-shaded geometry from polygons (counter-clockwise seen from outside). */
  function polyGeometry(T, faces) {
    var pos = [];
    var nrm = [];
    faces.forEach(function (f) {
      var n = [0, 0, 0];
      for (var i = 0; i < f.length; i++) {
        var a = f[i];
        var c = f[(i + 1) % f.length];
        n[0] += (a[1] - c[1]) * (a[2] + c[2]);
        n[1] += (a[2] - c[2]) * (a[0] + c[0]);
        n[2] += (a[0] - c[0]) * (a[1] + c[1]);
      }
      var l = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) || 1;
      n = [n[0] / l, n[1] / l, n[2] / l];
      for (var k = 1; k + 1 < f.length; k++) {
        [f[0], f[k], f[k + 1]].forEach(function (p) {
          pos.push(p[0], p[1], p[2]);
          nrm.push(n[0], n[1], n[2]);
        });
      }
    });
    var g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(nrm, 3));
    return g;
  }

  function bodyGeometry(T, b) {
    var d = b.dims;
    var g;
    if (b.faces) return polyGeometry(T, b.faces);
    if (b.shape === 'sphere') {
      g = new T.SphereGeometry(d.r, 128, 64);
      g.translate(0, d.r, 0);
      return g;
    }
    if (b.shape === 'cylinder') {
      g = new T.CylinderGeometry(d.r, d.r, d.h, 160);
      if (b.lying) {
        g.rotateZ(Math.PI / 2);
        g.translate(0, d.r, 0);
      } else {
        g.translate(0, d.h / 2, 0);
      }
      return g;
    }
    if (b.shape === 'cone') {
      g = new T.ConeGeometry(d.r, d.h, 160);
      g.translate(0, d.h / 2, 0);
      return g;
    }
    throw new Error('unknown body ' + b.shape);
  }

  function renderColored(desc, dpi) {
    var T = window.THREE;
    if (!T) throw new Error('three.js is not loaded');
    dpi = Math.min(600, Math.max(96, Number(dpi) || 300));
    var pw = Math.round(desc.widthMm / 25.4 * dpi);
    var ph = Math.round(desc.heightMm / 25.4 * dpi);
    var shrink = Math.min(1, MAX_PX / Math.max(pw, ph));
    pw = Math.max(1, Math.round(pw * shrink));
    ph = Math.max(1, Math.round(ph * shrink));

    var canvas = document.createElement('canvas');
    var renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
    var disposables = [];
    try {
      renderer.setPixelRatio(1);
      renderer.setSize(pw, ph, false);
      renderer.setClearColor(0xffffff, 1);

      var scene = new T.Scene();
      // Lambert divides by π: ambient + direct ≈ π keeps lit faces close to the palette colour.
      scene.add(new T.AmbientLight(0xffffff, 0.62 * Math.PI));
      var sun = new T.DirectionalLight(0xffffff, 0.5 * Math.PI);
      sun.position.set(desc.light[0], desc.light[1], desc.light[2]);
      scene.add(sun);
      scene.add(sun.target);

      (desc.bodies || []).forEach(function (b) {
        var geo = bodyGeometry(T, b);
        var mat = new T.MeshLambertMaterial({ color: b.color, side: T.DoubleSide });
        disposables.push(geo, mat);
        var mesh = new T.Mesh(geo, mat);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.fromArray(b.matrix);
        mesh.frustumCulled = false;
        scene.add(mesh);
      });
      if (desc.ground) {
        var c = desc.ground.corners;
        var gg = polyGeometry(T, [[c[0], c[1], c[2], c[3]]]);
        var gm = new T.MeshLambertMaterial({ color: desc.ground.color, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
        disposables.push(gg, gm);
        var ground = new T.Mesh(gg, gm);
        ground.frustumCulled = false;
        scene.add(ground);
      }

      // The whole camera is one world -> clip matrix (view = identity).
      var camera = new T.Camera();
      camera.matrixAutoUpdate = false;
      camera.matrixWorldAutoUpdate = false;
      camera.projectionMatrix.fromArray(desc.viewProj);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

      renderer.render(scene, camera);
      var gl = renderer.getContext();
      if (gl.isContextLost && gl.isContextLost()) throw new Error('the WebGL context was lost');
      return canvas.toDataURL('image/png');
    } finally {
      disposables.forEach(function (d) { try { d.dispose(); } catch (e) {} });
      try { renderer.dispose(); renderer.forceContextLoss(); } catch (e) {}
    }
  }

  window.Scene3dRenderer = { available: available, renderColored: renderColored };
})(window);
