/**
 * MiniChart — self-contained SVG line chart for the SET Chrome extension.
 * Mimics enough of the Chart.js constructor API so popup.js works unchanged.
 * No external dependencies. Pure SVG + vanilla JS.
 */
(function (global) {
  'use strict';

  function MiniChart(canvas, config) {
    this.canvas  = canvas;
    this.config  = config;
    this._svg    = null;
    this._tip    = null;
    this._build();
  }

  MiniChart.prototype.destroy = function () {
    if (this._svg  && this._svg.parentNode)  this._svg.parentNode.removeChild(this._svg);
    if (this._tip  && this._tip.parentNode)  this._tip.parentNode.removeChild(this._tip);
    this._svg = this._tip = null;
  };

  MiniChart.prototype._build = function () {
    var canvas = this.canvas;
    var parent = canvas.parentNode;
    if (!parent) return;
    canvas.style.display = 'none';

    var W  = parent.offsetWidth  || 420;
    var H  = parent.offsetHeight || 180;
    var P  = { top: 12, right: 54, bottom: 26, left: 8 };

    var ds     = this.config.data.datasets[0];
    var labels = this.config.data.labels || [];
    var vals   = (ds.data || []).map(Number).filter(function(v){ return !isNaN(v); });
    if (!vals.length) return;

    var minV = Math.min.apply(null, vals);
    var maxV = Math.max.apply(null, vals);
    var span = maxV - minV || 1;
    var pad  = span * 0.06;
    minV -= pad; maxV += pad; span = maxV - minV;

    var cW = W - P.left - P.right;
    var cH = H - P.top  - P.bottom;

    function xOf(i) { return P.left + (vals.length > 1 ? i / (vals.length - 1) : 0.5) * cW; }
    function yOf(v) { return P.top  + (1 - (v - minV) / span) * cH; }

    var svg = mkSVG('svg');
    svg.setAttribute('width',  W);
    svg.setAttribute('height', H);
    svg.style.cssText = 'position:absolute;top:0;left:0;overflow:visible;';
    parent.style.position = 'relative';

    // grid + y-axis labels
    var YTICK = 4;
    var tickColor = '#7986a3';
    for (var ti = 0; ti <= YTICK; ti++) {
      var gy = P.top + (ti / YTICK) * cH;
      var gl = mkSVG('line');
      setA(gl, { x1: P.left, x2: P.left + cW, y1: gy, y2: gy,
                 stroke: 'rgba(255,255,255,0.05)', 'stroke-width': 1 });
      svg.appendChild(gl);

      var gv = maxV - (ti / YTICK) * span;
      var yt = mkSVG('text');
      setA(yt, { x: P.left + cW + 4, y: gy + 4,
                 'font-size': 9, fill: tickColor,
                 'font-family': 'JetBrains Mono,monospace' });
      yt.textContent = gv.toFixed(2);
      svg.appendChild(yt);
    }

    // x-axis labels (max 5)
    var step = Math.max(1, Math.floor(labels.length / 5));
    for (var xi = 0; xi < labels.length; xi += step) {
      if (!labels[xi]) continue;
      var xl = mkSVG('text');
      setA(xl, { x: xOf(xi), y: H - 5, 'text-anchor': 'middle',
                 'font-size': 9, fill: tickColor,
                 'font-family': 'Space Grotesk,sans-serif' });
      xl.textContent = labels[xi];
      svg.appendChild(xl);
    }

    // fill polygon
    var bg = ds.backgroundColor;
    if (ds.fill !== false && bg && typeof bg === 'string') {
      var fpts = [P.left + ',' + (P.top + cH)];
      for (var fi = 0; fi < vals.length; fi++) fpts.push(xOf(fi) + ',' + yOf(vals[fi]));
      fpts.push(xOf(vals.length - 1) + ',' + (P.top + cH));
      var fp = mkSVG('polygon');
      setA(fp, { points: fpts.join(' '), fill: bg });
      svg.appendChild(fp);
    }

    // spline path
    var pathEl = mkSVG('path');
    setA(pathEl, { d: catmull(vals, xOf, yOf), fill: 'none',
                   stroke: ds.borderColor || '#3b82f6',
                   'stroke-width': ds.borderWidth || 1.5,
                   'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    svg.appendChild(pathEl);

    // last-point dot
    var dot = mkSVG('circle');
    setA(dot, { cx: xOf(vals.length - 1), cy: yOf(vals[vals.length - 1]),
                r: 3, fill: ds.borderColor || '#3b82f6' });
    svg.appendChild(dot);

    // tooltip hit zones
    var ttCfg = ((this.config.options || {}).plugins || {}).tooltip || {};
    var self   = this;
    var barW   = Math.max(4, cW / (vals.length || 1));
    for (var hi = 0; hi < vals.length; hi++) {
      (function(idx) {
        var hit = mkSVG('rect');
        setA(hit, { x: xOf(idx) - barW / 2, y: P.top,
                    width: barW, height: cH, fill: 'transparent' });
        hit.style.cursor = 'crosshair';
        hit.addEventListener('mouseenter', function(e) { self._show(e, idx, vals[idx], labels[idx], ttCfg); });
        hit.addEventListener('mouseleave', function()   { self._hide(); });
        svg.appendChild(hit);
      })(hi);
    }

    parent.appendChild(svg);
    this._svg = svg;
  };

  MiniChart.prototype._show = function(e, idx, val, label, ttCfg) {
    this._hide();
    var valTxt = typeof (ttCfg.callbacks || {}).label === 'function'
      ? ttCfg.callbacks.label({ raw: val, dataIndex: idx })
      : val.toFixed(2);

    var tip = document.createElement('div');
    tip.style.cssText = [
      'position:absolute', 'z-index:9999', 'pointer-events:none',
      'background:' + (ttCfg.backgroundColor || '#0f172a'),
      'border:1px solid rgba(255,255,255,0.12)',
      'border-radius:6px', 'padding:5px 9px',
      'font-family:JetBrains Mono,monospace', 'font-size:11px',
      'white-space:nowrap', 'line-height:1.5',
    ].join(';');
    tip.innerHTML =
      (label ? '<div style="color:' + (ttCfg.titleColor || '#7986a3') + ';font-size:9px">' + label + '</div>' : '') +
      '<div style="color:' + (ttCfg.bodyColor || '#eef2ff') + '">' + valTxt + '</div>';

    var pr  = this.canvas.parentNode.getBoundingClientRect();
    var tx  = e.clientX - pr.left + 12;
    var ty  = e.clientY - pr.top  - 12;
    if (tx + 120 > pr.width) tx = tx - 132;
    if (ty < 0) ty = 4;
    tip.style.left = tx + 'px';
    tip.style.top  = ty + 'px';

    this.canvas.parentNode.appendChild(tip);
    this._tip = tip;
  };

  MiniChart.prototype._hide = function() {
    if (this._tip && this._tip.parentNode) this._tip.parentNode.removeChild(this._tip);
    this._tip = null;
  };

  // ── helpers ──
  function mkSVG(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
  }
  function setA(el, attrs) {
    for (var k in attrs) el.setAttribute(k, attrs[k]);
  }

  // Catmull-Rom → cubic Bézier approximation
  function catmull(vals, xOf, yOf) {
    if (vals.length === 1) return 'M ' + xOf(0) + ' ' + yOf(vals[0]);
    var pts = vals.map(function(v, i){ return [xOf(i), yOf(v)]; });
    var d = 'M ' + pts[0][0] + ' ' + pts[0][1];
    var t = 0.3;
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;
      var cp1x = p1[0] + (p2[0] - p0[0]) * t;
      var cp1y = p1[1] + (p2[1] - p0[1]) * t;
      var cp2x = p2[0] - (p3[0] - p1[0]) * t;
      var cp2y = p2[1] - (p3[1] - p1[1]) * t;
      d += ' C ' + cp1x.toFixed(2) + ' ' + cp1y.toFixed(2) + ' '
                 + cp2x.toFixed(2) + ' ' + cp2y.toFixed(2) + ' '
                 + p2[0].toFixed(2) + ' ' + p2[1].toFixed(2);
    }
    return d;
  }

  global.Chart = MiniChart;

}(typeof window !== 'undefined' ? window : this));
