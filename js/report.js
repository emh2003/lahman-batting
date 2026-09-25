// Report charts: loads data/report.json (written by scripts/report_numbers.py)
// and draws one chart per finding.

(function () {
  "use strict";

  const css = getComputedStyle(document.documentElement);
  const v = (n) => css.getPropertyValue(n).trim();
  const BLUE = v("--series-1"), ORANGE = v("--series-2");
  const INK = v("--ink"), MUTED = v("--ink-muted"), RULE = v("--rule");
  const MUTED_BAR = "#b9cde6"; // lighter blue for bars that aren't highlighted

  const pct = (x, d = 1) => (x == null ? "–" : (x * 100).toFixed(d) + "%");
  const avg = (x) => (x == null ? "–" : x.toFixed(3).replace(/^0/, ""));
  const int = (x) => (x == null ? "–" : Math.round(x).toLocaleString("en-US"));
  const one = (x) => (x == null ? "–" : x.toFixed(1));

  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 12;
  Chart.defaults.color = MUTED;

  function options(fmt, { legend = false, yMin } = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: legend, position: "bottom", labels: { color: INK, usePointStyle: true, boxWidth: 10, boxHeight: 10 } },
        tooltip: {
          backgroundColor: "#14213d", padding: 10, cornerRadius: 6,
          callbacks: { label: (c) => " " + (c.dataset.label ? c.dataset.label + ": " : "") + fmt(c.parsed.y) },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 14 }, border: { color: RULE } },
        y: { grid: { color: RULE }, border: { display: false }, ticks: { callback: (t) => fmt(t) },
             ...(yMin != null ? { min: yMin } : { beginAtZero: true }) },
      },
    };
  }

  const bar = (id, labels, data, fmt, colors) =>
    new Chart(document.getElementById(id), {
      type: "bar",
      data: { labels, datasets: [{ data, backgroundColor: colors || BLUE, borderRadius: 4, borderSkipped: "start", maxBarThickness: 44 }] },
      options: options(fmt),
    });

  const line = (id, labels, series, fmt, opts = {}) =>
    new Chart(document.getElementById(id), {
      type: "line",
      data: {
        labels,
        datasets: series.map((s) => ({
          label: s.label, data: s.data, borderColor: s.color, backgroundColor: s.color,
          borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, tension: 0.15, spanGaps: false,
        })),
      },
      options: options(fmt, { legend: series.length > 1, ...opts }),
    });

  fetch("data/report.json")
    .then((r) => r.json())
    .then(({ charts: c }) => {
      // 1. HR per 600 PA by decade
      bar("c1", c.hr_by_decade.labels, c.hr_by_decade.values, one);

      // 2. Strikeout and walk rates by season
      line("c2", c.k_by_year.labels, [
        { label: "Strikeout rate", data: c.k_by_year.k, color: ORANGE },
        { label: "Walk rate", data: c.k_by_year.bb, color: BLUE },
      ], (x) => pct(x, 0));

      // 3. League batting average by season (zoomed axis: it's a line, not bars)
      line("c3", c.avg_by_year.labels, [{ label: "", data: c.avg_by_year.values, color: BLUE }], avg, { yMin: 0.22 });

      // 4. Three true outcomes by decade
      bar("c4", c.tto_by_decade.labels, c.tto_by_decade.values, (x) => pct(x, 0));

      // 5. Singles share of hits by decade
      bar("c5", c.singles_by_decade.labels, c.singles_by_decade.values, (x) => pct(x, 0));

      // 6. Stolen bases by season, 2023 highlighted
      bar("c6", c.sb_by_year.labels, c.sb_by_year.values, int,
          c.sb_by_year.labels.map((y) => (y === 2023 ? ORANGE : MUTED_BAR)));

      // 7. Born-abroad share of PA by decade
      bar("c7", c.foreign_by_decade.labels, c.foreign_by_decade.values, (x) => pct(x, 0));

      // 8. Players per season
      line("c8", c.players_by_year.labels, [{ label: "", data: c.players_by_year.players, color: BLUE }], int);

      // 9. Negro Leagues vs AL/NL batting average, 1920-1948
      line("c9", c.negro_vs_mlb.labels, [
        { label: "AL/NL", data: c.negro_vs_mlb.mlb, color: BLUE },
        { label: "Negro Leagues", data: c.negro_vs_mlb.negro, color: ORANGE },
      ], avg, { yMin: 0.22 });
    })
    .catch((err) => {
      document.querySelectorAll(".chart-box").forEach((b) => {
        b.innerHTML = '<p class="muted">Chart data could not be loaded (' + err + '). If you opened this file directly, run a local server.</p>';
      });
    });
})();
