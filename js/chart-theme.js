// Shared chart styling for both pages: dark-theme defaults, gradient fills,
// a hover crosshair, and a count-up animation for headline numbers.
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

  if (window.Chart) {
    Chart.register(crosshair);
    Chart.defaults.color = theme.muted;
    Chart.defaults.borderColor = theme.rule;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.font.size = 12;
    Chart.defaults.animation.duration = 550;
    Chart.defaults.animation.easing = "easeOutQuart";
    Object.assign(Chart.defaults.plugins.tooltip, {
      backgroundColor: "rgba(10, 16, 36, 0.95)",
      borderColor: theme.rule,
      borderWidth: 1,
      titleColor: theme.ink,
      bodyColor: theme.inkSoft,
      padding: 12,
      cornerRadius: 8,
      boxPadding: 4,
      titleFont: { weight: "600" },
    });
    Chart.defaults.elements.point.hoverBorderWidth = 2;
    Chart.defaults.elements.point.hoverBorderColor = "#fff";
  }

  // Animate a number from its previous value to a new one inside `el`.
  function countUp(el, to, fmt, ms = 650) {
    const from = el._value == null ? 0 : el._value;
    el._value = to;
    if (to == null || !isFinite(to) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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

  window.ChartTheme = { theme, alpha, areaFill, barFill, countUp, revealOnScroll };
})();
