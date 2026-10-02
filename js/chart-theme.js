// Shared chart styling for both pages: dark-theme defaults, gradient fills,
// a hover crosshair, a baseball hover marker, a scoreboard-style tooltip,
// "milestone" pennants for key moments in baseball history, a draw-in
// animation, and a count-up animation for headline numbers.
// Loaded after Chart.js and before dashboard.js / report.js.

(function () {
  "use strict";

  const css = getComputedStyle(document.documentElement);
  const v = (n) => css.getPropertyValue(n).trim();

  const theme = {
    ink: v("--ink"),
    inkSoft: v("--ink-soft"),
    muted: v("--ink-muted"),
    rule: v("--rule"),
    series: [1, 2, 3, 4, 5].map((i) => v("--series-" + i)),
  };

  // Hex color -> rgba string with the given alpha.
  function alpha(hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  // Scriptable fills: a soft glow under a line, and bars that fade toward the base.
  function areaFill(color) {
    return (ctx) => {
      const { chart } = ctx;
      const area = chart.chartArea;
      if (!area) return alpha(color, 0.15);
      const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, alpha(color, 0.38));
      g.addColorStop(1, alpha(color, 0));
      return g;
    };
  }
  function barFill(color, horizontal) {
    return (ctx) => {
      const { chart } = ctx;
      const area = chart.chartArea;
      if (!area) return color;
      const g = horizontal
        ? chart.ctx.createLinearGradient(area.left, 0, area.right, 0)
        : chart.ctx.createLinearGradient(0, area.bottom, 0, area.top);
      g.addColorStop(0, alpha(color, 0.55));
      g.addColorStop(1, color);
      return g;
    };
  }

  // Vertical dashed line that follows the mouse on line charts.
  const crosshair = {
    id: "crosshair",
    afterDatasetsDraw(chart) {
      if (chart.config.type !== "line" || chart.options.indexAxis === "y") return;
      const active = chart.tooltip && chart.tooltip.getActiveElements();
      if (!active || !active.length) return;
      const x = active[0].element.x;
      const { top, bottom } = chart.chartArea;
      const c = chart.ctx;
      c.save();
      c.beginPath();
      c.setLineDash([4, 4]);
      c.moveTo(x, top);
      c.lineTo(x, bottom);
      c.lineWidth = 1;
      c.strokeStyle = alpha("#ffffff", 0.35);
      c.stroke();
      c.restore();
    },
  };


  // ---------------------------------------------------------------------------
  // A little baseball, used as the hover marker on single-series line charts.
  // ---------------------------------------------------------------------------
  const baseball = (() => {
    const size = 18, dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = document.createElement("canvas");
    c.width = c.height = size * dpr;
    c.style.width = c.style.height = size + "px";
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    g.beginPath(); g.arc(9, 9, 7.5, 0, Math.PI * 2);
    g.fillStyle = "#fffdf7"; g.fill();
    g.lineWidth = 1; g.strokeStyle = "#cfc6b0"; g.stroke();
    g.strokeStyle = "#d2383d"; g.lineWidth = 1.2; g.setLineDash([1.6, 1.3]);
    g.beginPath(); g.arc(1.5, 9, 6, -0.9, 0.9); g.stroke();
    g.beginPath(); g.arc(16.5, 9, 6, Math.PI - 0.9, Math.PI + 0.9); g.stroke();
    return c;
  })();

  // ---------------------------------------------------------------------------
  // Scoreboard tooltip: an HTML tooltip styled like a ballpark scoreboard.
  // Uses Chart.js's own formatted title/label/footer text.
  // ---------------------------------------------------------------------------
  function scoreboardTooltip({ chart, tooltip }) {
    const host = chart.canvas.parentNode;
    let el = host.querySelector(".sb-tip");
    if (!el) {
      el = document.createElement("div");
      el.className = "sb-tip";
      el.setAttribute("role", "status");
      host.appendChild(el);
    }
    if (tooltip.opacity === 0) { el.classList.remove("on"); return; }
    const rows = tooltip.body.map((b, i) => {
      const text = b.lines.join(" ").trim();
      const cut = text.lastIndexOf(": ");
      const name = cut > -1 ? text.slice(0, cut) : "";
      const val = cut > -1 ? text.slice(cut + 2) : text;
      const col = tooltip.labelColors[i];
      const chip = col ? (typeof col.borderColor === "string" ? col.borderColor : (typeof col.backgroundColor === "string" ? col.backgroundColor : "#e3b45f")) : "#e3b45f";
      return `<div class="sb-tip-row"><i style="background:${chip}"></i><span>${name}</span><b>${val}</b></div>`;
    }).join("");
    const foot = (tooltip.footer || []).filter(Boolean).map((f) => `<div class="sb-tip-foot">${f}</div>`).join("");
    el.innerHTML = `<div class="sb-tip-title">${(tooltip.title || []).join(" ")}</div>${rows}${foot}`;
    el.classList.add("on");
    // keep it inside the chart box
    const w = el.offsetWidth, h = el.offsetHeight, bw = host.clientWidth;
    let x = tooltip.caretX + 14, y = tooltip.caretY - h - 12;
    if (x + w > bw) x = tooltip.caretX - w - 14;
    if (y < 0) y = tooltip.caretY + 14;
    el.style.transform = `translate(${Math.max(0, x)}px, ${Math.max(0, y)}px)`;
  }

  // Footer callback: change from the previous point ("▲ 1.2 vs 1990s").
  // fmtDelta(diff) formats the difference; only used on single-series charts.
  function deltaFooter(fmtDelta) {
    return (items) => {
      if (!items.length || items.length > 1) return "";
      const it = items[0], i = it.dataIndex;
      if (i === 0) return "";
      const data = it.dataset.data, prev = data[i - 1], cur = data[i];
      if (prev == null || cur == null || !isFinite(prev) || !isFinite(cur)) return "";
      const d = cur - prev, arrow = d > 0 ? "▲" : d < 0 ? "▼" : "•";
      return `${arrow} ${fmtDelta(Math.abs(d))} vs ${it.chart.data.labels[i - 1]}`;
    };
  }

  // ---------------------------------------------------------------------------
  // Milestones: thin gold dashed lines with a pennant label, marking key
  // moments (e.g. 1968 "Year of the Pitcher"). Set per chart with
  // options.plugins.milestones = [{ x: <label>, text: "..." }].
  // ---------------------------------------------------------------------------
  const milestones = {
    id: "milestones",
    afterDatasetsDraw(chart, _args, opts) {
      const list = (opts && opts.items) || [];
      if (!list.length) return;
      const xs = chart.scales.x, { top, bottom } = chart.chartArea, c = chart.ctx;
      c.save();
      c.font = `600 10px ${Chart.defaults.font.family}`;
      list.forEach((m, k) => {
        const idx = chart.data.labels.indexOf(m.x);
        if (idx < 0) return;
        const x = xs.getPixelForValue(idx);
        const yTop = top - (list.length > 1 ? 34 : 16) + (k % 2) * 18;   // in the padding above the plot; staggered
        c.setLineDash([3, 4]); c.lineWidth = 1; c.strokeStyle = alpha("#e3b45f", 0.6);
        c.beginPath(); c.moveTo(x, yTop + 14); c.lineTo(x, bottom); c.stroke();
        c.setLineDash([]);
        const tw = c.measureText(m.text).width + 12;
        const flip = x + tw + 6 > chart.chartArea.right;  // pennant points left near the right edge
        const x0 = flip ? x - tw : x;
        c.fillStyle = "rgba(10,16,36,0.85)"; c.strokeStyle = "#e3b45f";
        c.beginPath();
        if (flip) { c.moveTo(x, yTop); c.lineTo(x0 + 4, yTop); c.lineTo(x0, yTop + 7); c.lineTo(x0 + 4, yTop + 14); c.lineTo(x, yTop + 14); }
        else { c.moveTo(x, yTop); c.lineTo(x + tw - 4, yTop); c.lineTo(x + tw, yTop + 7); c.lineTo(x + tw - 4, yTop + 14); c.lineTo(x, yTop + 14); }
        c.closePath(); c.fill(); c.stroke();
        c.fillStyle = "#e3b45f"; c.textBaseline = "middle";
        c.fillText(m.text, x0 + (flip ? 6 : 5), yTop + 7.5);
      });
      c.restore();
    },
  };

  // ---------------------------------------------------------------------------
  // Draw-in animation: lines trace left to right, bars rise one after another.
  // ---------------------------------------------------------------------------
  function drawIn(type, n, total = 1400) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    const step = total / Math.max(n, 1);
    if (type === "bar") {
      return { delay: (ctx) => (ctx.type === "data" && ctx.mode === "default" ? ctx.dataIndex * Math.min(70, step) : 0), duration: 600 };
    }
    const prevY = (ctx) => ctx.index === 0
      ? ctx.chart.scales.y.getPixelForValue(ctx.chart.scales.y.min)
      : ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.index - 1].getProps(["y"], true).y;
    const delay = (key) => (ctx) => {
      if (ctx.type !== "data" || ctx[key]) return 0;
      ctx[key] = true;
      return ctx.index * step;
    };
    return {
      x: { type: "number", easing: "linear", duration: step, from: NaN, delay: delay("xStarted") },
      y: { type: "number", easing: "linear", duration: step, from: prevY, delay: delay("yStarted") },
    };
  }

  if (window.Chart) {
    Chart.register(crosshair, milestones);
    Chart.defaults.color = theme.muted;
    Chart.defaults.borderColor = theme.rule;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.font.size = 12;
    Chart.defaults.animation.duration = 550;
    Chart.defaults.animation.easing = "easeOutQuart";
    // Every chart uses the scoreboard tooltip instead of the default canvas one.
    Object.assign(Chart.defaults.plugins.tooltip, { enabled: false, external: scoreboardTooltip });
    Chart.defaults.elements.point.hoverBorderWidth = 2;
    Chart.defaults.elements.point.hoverBorderColor = "#fff";
  }

  // Animate a number from its previous value to a new one inside `el`.
  function countUp(el, to, fmt, ms = 650) {
    const from = el._value == null ? 0 : el._value;
    el._value = to;
    // No animation if motion is reduced or the tab isn't visible (browsers pause
    // animations in background tabs, which would leave the number blank).
    if (to == null || !isFinite(to) || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = fmt(to);
      return;
    }
    const t0 = performance.now();
    cancelAnimationFrame(el._raf);
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (p < 1) el._raf = requestAnimationFrame(step);
      else el.textContent = fmt(to);
    };
    el._raf = requestAnimationFrame(step);
  }

  // Fade sections up as they scroll into view.
  function revealOnScroll(selector) {
    const els = document.querySelectorAll(selector);
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("shown"); io.unobserve(e.target); } });
    }, { threshold: 0.08 });
    els.forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  }

  // Run fn once, the first time `el` scrolls into view (used to draw charts in).
  function whenVisible(el, fn) {
    if (!("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
    }, { threshold: 0.25 });
    io.observe(el);
  }

  window.ChartTheme = { theme, alpha, areaFill, barFill, countUp, revealOnScroll, baseball, deltaFooter, drawIn, whenVisible };
})();
