/*
 * ABC -> SVG (abcjs) -> PNG (canvas, print resolution).
 *
 * Sizing: abcjs renders in CSS pixels (96 px = 1 inch). We render with
 * staffwidth = requested width and "%%stretchlast" so every staff spans the
 * full width, then rasterise at `dpi` (default 300). The physical image size
 * is derived from the SVG size, so the music keeps its natural proportions
 * (staff height ≈ 8 mm, a common size for printed worksheets).
 */
(function (window) {
  'use strict';

  var CSS_DPI = 96;
  var PADDING = 8; // px around the music inside the SVG

  function cmToPx(cm) { return cm / 2.54 * CSS_DPI; }
  function pxToMm(px) { return px / CSS_DPI * 25.4; }

  function prepareAbc(abc) {
    // Insert layout directives after the X: line unless the tune sets them itself.
    var lines = abc.split('\n');
    var extra = [];
    if (!/^%%stretchlast/m.test(abc)) extra.push('%%stretchlast true');
    if (extra.length) lines.splice(1, 0, extra.join('\n'));
    return lines.join('\n');
  }

  function getSandbox() {
    var el = document.getElementById('abc-render-sandbox');
    if (!el) {
      el = document.createElement('div');
      el.id = 'abc-render-sandbox';
      // Must be laid out (not display:none) – abcjs measures text with getBBox().
      el.style.cssText = 'position:absolute;left:-10000px;top:0;visibility:hidden;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.innerHTML = '';
    return el;
  }

  /**
   * Render ABC to an SVG string.
   * @returns {{svg:string, width:number, height:number, warnings:string[]}}
   */
  function renderSvg(abc, opts) {
    if (!window.ABCJS) throw new Error('abcjs is not loaded');
    opts = opts || {};
    var widthCm = Math.min(19, Math.max(3, Number(opts.widthCm) || 16));
    var totalPx = cmToPx(widthCm);
    var host = getSandbox();
    var tunes = window.ABCJS.renderAbc(host, prepareAbc(abc), {
      staffwidth: Math.round(totalPx - 2 * PADDING),
      paddingtop: PADDING,
      paddingbottom: PADDING,
      paddingleft: PADDING,
      paddingright: PADDING,
      scale: 1,
      add_classes: false,
      foregroundColor: '#000000'
    });
    var warnings = (tunes && tunes[0] && tunes[0].warnings) || [];
    var svgEl = host.querySelector('svg');
    if (!svgEl) throw new Error('abcjs produced no SVG');

    var w = parseFloat(svgEl.getAttribute('width')) || svgEl.getBoundingClientRect().width;
    var h = parseFloat(svgEl.getAttribute('height')) || svgEl.getBoundingClientRect().height;
    if (!w || !h) throw new Error('empty SVG');

    svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgEl.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    svgEl.setAttribute('width', String(w));
    svgEl.setAttribute('height', String(h));
    if (!svgEl.getAttribute('viewBox')) svgEl.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svgEl.removeAttribute('style');
    var svg = new XMLSerializer().serializeToString(svgEl);
    host.innerHTML = '';
    return {
      svg: svg,
      width: w,
      height: h,
      warnings: warnings.map(function (x) { return String(x).replace(/<[^>]+>/g, ''); })
    };
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('SVG could not be rasterised')); };
      img.src = src;
    });
  }

  /**
   * Render ABC to a PNG data URL.
   * @param {string} abc
   * @param {{widthCm?:number, dpi?:number, background?:string}} opts
   * @returns {Promise<{dataUrl:string, svg:string, widthMm:number, heightMm:number, pixelWidth:number, pixelHeight:number, warnings:string[]}>}
   */
  function renderPng(abc, opts) {
    opts = opts || {};
    var r;
    try {
      r = renderSvg(abc, opts);
    } catch (e) {
      return Promise.reject(e);
    }
    var dpi = Math.min(600, Math.max(96, Number(opts.dpi) || 300));
    var factor = dpi / CSS_DPI;
    var pw = Math.round(r.width * factor);
    var ph = Math.round(r.height * factor);
    var src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg);
    return loadImage(src).then(function (img) {
      var canvas = document.createElement('canvas');
      canvas.width = pw;
      canvas.height = ph;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = opts.background || '#ffffff';
      ctx.fillRect(0, 0, pw, ph);
      ctx.drawImage(img, 0, 0, pw, ph);
      return {
        dataUrl: canvas.toDataURL('image/png'),
        svg: r.svg,
        widthMm: pxToMm(r.width),
        heightMm: pxToMm(r.height),
        pixelWidth: pw,
        pixelHeight: ph,
        warnings: r.warnings
      };
    });
  }

  window.MusicRenderer = {
    renderSvg: renderSvg,
    renderPng: renderPng,
    cmToPx: cmToPx,
    pxToMm: pxToMm
  };
})(window);
