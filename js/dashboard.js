// Dashboard: loads data/batting.csv in the browser, applies the filters,
// and recomputes every summary number, chart, and table from the rows.
//
// Rates are always computed from summed totals (e.g. AVG = sum(H) / sum(AB)),
// never by averaging per-row rates.

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Formatting helpers
  // ---------------------------------------------------------------------------
  const fmtInt = (v) => (v == null ? "–" : Math.round(v).toLocaleString("en-US"));
  const fmtRate3 = (v) => {
    if (v == null || !isFinite(v)) return "–";
    const s = v.toFixed(3);
    return s.startsWith("0.") ? s.slice(1) : s; // baseball style: .300
  };
  const fmtPct = (v) => (v == null || !isFinite(v) ? "–" : (v * 100).toFixed(1) + "%");
  const fmt1 = (v) => (v == null || !isFinite(v) ? "–" : v.toFixed(1));
  const safeDiv = (a, b) => (b > 0 ? a / b : null);

  // ---------------------------------------------------------------------------
  // Measures (the "Measure" switch). type: count | total | rate
  // ---------------------------------------------------------------------------
  const obp = (a) => safeDiv(a.H + a.BB + a.HBP, a.AB + a.BB + a.HBP + a.SF);
  const slg = (a) => safeDiv(a.TB, a.AB);

  const MEASURES = [
    { key: "HR", label: "Home runs (total)", short: "HR", type: "total", f: (a) => a.HR, fmt: fmtInt },
    { key: "H", label: "Hits (total)", short: "H", type: "total", f: (a) => a.H, fmt: fmtInt },
    { key: "RBI", label: "Runs batted in (total)", short: "RBI", type: "total", f: (a) => a.RBI, fmt: fmtInt },
    { key: "SB", label: "Stolen bases (total)", short: "SB", type: "total", f: (a) => a.SB, fmt: fmtInt },
    { key: "PA", label: "Plate appearances (total)", short: "PA", type: "total", f: (a) => a.PA, fmt: fmtInt },
    { key: "players", label: "Players (count)", short: "Players", type: "count", f: (a) => a.players.size, fmt: fmtInt },
    { key: "AVG", label: "Batting average (rate)", short: "AVG", type: "rate", f: (a) => safeDiv(a.H, a.AB), fmt: fmtRate3 },
    { key: "OBP", label: "On-base percentage (rate)", short: "OBP", type: "rate", f: obp, fmt: fmtRate3 },
    { key: "SLG", label: "Slugging percentage (rate)", short: "SLG", type: "rate", f: slg, fmt: fmtRate3 },
    { key: "OPS", label: "OPS (rate)", short: "OPS", type: "rate",
      f: (a) => { const o = obp(a), s = slg(a); return o == null || s == null ? null : o + s; }, fmt: fmtRate3 },
    { key: "HR600", label: "Home runs per 600 PA (rate)", short: "HR/600", type: "rate", f: (a) => { const r = safeDiv(a.HR, a.PA); return r == null ? null : r * 600; }, fmt: fmt1 },
    { key: "KPCT", label: "Strikeout rate (rate)", short: "K%", type: "rate", f: (a) => safeDiv(a.SO, a.PAso), fmt: fmtPct },
  ];
  const measureByKey = Object.fromEntries(MEASURES.map((m) => [m.key, m]));

  // ---------------------------------------------------------------------------
  // Breakdowns (the "Break down by" switch)
  // ---------------------------------------------------------------------------
  const BREAKDOWNS = [
    { key: "grp", label: "League group" },
    { key: "lgName", label: "League" },
    { key: "teamLabel", label: "Team (franchise)" },
    { key: "bats", label: "Bats" },
    { key: "throws", label: "Throws" },
    { key: "country", label: "Birth country" },
  ];

  // Table columns (the selected measure's column is highlighted)
  const TABLE_COLS = ["players", "PA", "H", "HR", "RBI", "SB", "AVG", "OBP", "SLG", "OPS", "HR600", "KPCT"];

  // ---------------------------------------------------------------------------
  // Aggregation
  // ---------------------------------------------------------------------------
  function newAcc() {
    return { players: new Set(), seasons: new Set(), PA: 0, AB: 0, H: 0, HR: 0, TB: 0, B1: 0, B2: 0, B3: 0, RBI: 0, SB: 0, BB: 0, HBP: 0, SF: 0, SO: 0, PAso: 0 };
  }
  function add(acc, r) {
    acc.players.add(r.pid);
    acc.seasons.add(r.year);
    acc.PA += r.PA; acc.AB += r.AB; acc.H += r.H; acc.HR += r.HR; acc.TB += r.TB;
    acc.B1 += r.B1; acc.B2 += r.B2; acc.B3 += r.B3;
    acc.BB += r.BB; acc.RBI += r.RBI || 0; acc.SB += r.SB || 0;
    acc.HBP += r.HBP || 0; acc.SF += r.SF || 0;
    if (r.SO != null) { acc.SO += r.SO; acc.PAso += r.PA; }
  }
  function groupBy(rows, keyFn) {
    const m = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      let a = m.get(k);
      if (!a) { a = newAcc(); m.set(k, a); }
      add(a, r);
    }
    return m;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let ROWS = [];
  let YEARS = [];
  const charts = {};
  const trendSlots = new Map(); // category -> color slot, so colors follow the entity
  const $ = (id) => document.getElementById(id);

  const css = getComputedStyle(document.documentElement);
  const cssVar = (n) => css.getPropertyValue(n).trim();
  const SERIES = [1, 2, 3, 4, 5].map((i) => cssVar("--series-" + i));
  const INK = cssVar("--ink"), INK_MUTED = cssVar("--ink-muted"), RULE = cssVar("--rule");

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------
  const num = (v) => (v === "" || v == null ? null : +v);

  Papa.parse("data/batting.csv", {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
      // Latest team name for each franchise, so the team filter has one entry per franchise.
      const latest = new Map();
      for (const d of res.data) {
        const y = +d.year, cur = latest.get(d.franchise_id);
        if (!cur || y > cur.year) latest.set(d.franchise_id, { year: y, name: d.team_name });
      }
      ROWS = res.data.map((d) => ({
        year: +d.year,
        decade: d.decade,
        pid: d.player_id,
        name: d.player_name,
        nameLower: d.player_name.toLowerCase(),
        fr: d.franchise_id,
        teamLabel: latest.get(d.franchise_id).name,
        lg: d.league,
        lgName: d.league_name,
        grp: d.league_group,
        bats: d.bats,
        throws: d.throws,
        country: d.birth_country,
        PA: num(d.PA) || 0, AB: num(d.AB) || 0, H: num(d.H) || 0, HR: num(d.HR) || 0, TB: num(d.TB) || 0,
        B1: num(d["1B"]) || 0, B2: num(d["2B"]) || 0, B3: num(d["3B"]) || 0,
        BB: num(d.BB) || 0, RBI: num(d.RBI), SB: num(d.SB), SO: num(d.SO), HBP: num(d.HBP), SF: num(d.SF),
      }));
      init();
    },
    error: (err) => {
      $("status").textContent = "Could not load data/batting.csv (" + err + "). If you opened this file directly, run a local server instead.";
    },
  });

  // ---------------------------------------------------------------------------
  // Controls
  // ---------------------------------------------------------------------------
  function fillSelect(sel, values, allLabel) {
    sel.innerHTML = "";
    if (allLabel) sel.add(new Option(allLabel, ""));
    for (const v of values) {
      if (Array.isArray(v)) sel.add(new Option(v[1], v[0]));
      else sel.add(new Option(v, v));
    }
  }
  const byCount = (key) => {
    const c = new Map();
    for (const r of ROWS) c.set(r[key], (c.get(r[key]) || 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
  };

  function init() {
    YEARS = [...new Set(ROWS.map((r) => r.year))].sort((a, b) => a - b);
    fillSelect($("f-year-from"), YEARS.map(String));
    fillSelect($("f-year-to"), YEARS.map(String));
    fillSelect($("f-group"), byCount("grp"), "All league groups");
    fillSelect($("f-league"), byCount("lgName"), "All leagues");
    const teams = [...new Map(ROWS.map((r) => [r.fr, r.teamLabel])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => [id, name + " (" + id + ")"]);
    fillSelect($("f-team"), teams, "All teams");
    fillSelect($("f-bats"), byCount("bats"), "All");
    fillSelect($("f-country"), byCount("country"), "All countries");
    fillSelect($("s-measure"), MEASURES.map((m) => [m.key, m.label]));
    fillSelect($("s-breakdown"), BREAKDOWNS.map((b) => [b.key, b.label]));

    resetFilters(false);

    for (const id of ["f-year-from", "f-year-to", "f-group", "f-league", "f-team", "f-bats", "f-country",
                      "s-measure", "s-breakdown", "s-grain", "s-minpa"]) {
      $(id).addEventListener("change", update);
    }
    let t;
    $("f-player").addEventListener("input", () => { clearTimeout(t); t = setTimeout(update, 250); });
    $("reset").addEventListener("click", () => resetFilters(true));

    makeCharts();
    window.HitField.init($("hit-field"), $("hf-callout"), $("hf-swing"));
    buildLegends();
    update();
  }

  function resetFilters(run) {
    $("f-year-from").value = String(YEARS[0]);
    $("f-year-to").value = String(YEARS[YEARS.length - 1]);
    for (const id of ["f-group", "f-league", "f-team", "f-bats", "f-country"]) $(id).value = "";
    $("f-player").value = "";
    $("s-measure").value = "HR";
    $("s-breakdown").value = "grp";
    $("s-grain").value = "year";
    $("s-minpa").value = "500";
    if (run) update();
  }

  function currentFilters() {
    let y0 = +$("f-year-from").value, y1 = +$("f-year-to").value;
    if (y0 > y1) [y0, y1] = [y1, y0];
    return {
      y0, y1,
      grp: $("f-group").value,
      lgName: $("f-league").value,
      fr: $("f-team").value,
      bats: $("f-bats").value,
      country: $("f-country").value,
      player: $("f-player").value.trim().toLowerCase(),
    };
  }

  function applyFilters(f) {
    return ROWS.filter((r) =>
      r.year >= f.y0 && r.year <= f.y1 &&
      (!f.grp || r.grp === f.grp) &&
      (!f.lgName || r.lgName === f.lgName) &&
      (!f.fr || r.fr === f.fr) &&
      (!f.bats || r.bats === f.bats) &&
      (!f.country || r.country === f.country) &&
      (!f.player || r.nameLower.includes(f.player))
    );
  }

  // ---------------------------------------------------------------------------
  // Charts
  // ---------------------------------------------------------------------------
  function baseOptions(horizontal) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? "y" : "x",
      interaction: horizontal ? { mode: "nearest", axis: "y", intersect: false } : { mode: "index", intersect: false },
      plugins: {
        legend: { display: false, labels: { color: INK, boxWidth: 12, boxHeight: 12, usePointStyle: true } },
        tooltip: {},
      },
      scales: {
        x: { grid: { color: horizontal ? RULE : "transparent" }, ticks: { color: INK_MUTED, maxRotation: 0, autoSkipPadding: 12 }, border: { color: RULE } },
        y: { grid: { color: horizontal ? "transparent" : RULE }, ticks: { color: horizontal ? INK : INK_MUTED }, border: { display: false } },
      },
    };
  }

  function makeCharts() {
    const { areaFill, barFill } = window.ChartTheme;
    charts.time = new Chart($("c-time"), {
      type: "line",
      data: { labels: [], datasets: [{ data: [], borderColor: SERIES[0], backgroundColor: areaFill(SERIES[0]), pointBackgroundColor: SERIES[0], fill: true, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 6, tension: 0.25, spanGaps: true }] },
      options: baseOptions(false),
    });
    charts.brk = new Chart($("c-break"), {
      type: "bar",
      data: { labels: [], datasets: [{ data: [], backgroundColor: barFill(SERIES[0], true), borderRadius: 6, borderSkipped: "start", maxBarThickness: 22 }] },
      options: baseOptions(true),
    });
    charts.leaders = new Chart($("c-leaders"), {
      type: "bar",
      data: { labels: [], datasets: [{ data: [], backgroundColor: barFill(SERIES[1], true), borderRadius: 6, borderSkipped: "start", maxBarThickness: 22 }] },
      options: baseOptions(true),
    });
    const trendOpts = baseOptions(false);
    trendOpts.plugins.legend.display = true;
    trendOpts.plugins.legend.position = "bottom";
    charts.trend = new Chart($("c-trend"), { type: "line", data: { labels: [], datasets: [] }, options: trendOpts });
  }

  // Totals and counts are drawn as bars starting at zero. Rates are drawn as
  // dots on a zoomed-in axis, because bars must start at zero and would hide
  // the differences between, say, a .260 and a .270 average.
  function setRankStyle(chart, m, color) {
    const ds = chart.data.datasets[0];
    const isRate = m.type === "rate";
    ds.type = isRate ? "line" : "bar";
    ds.showLine = false;
    ds.pointRadius = 6;
    ds.pointHoverRadius = 8;
    ds.pointBackgroundColor = color;
    ds.pointBorderColor = "#0b1120";
    ds.pointBorderWidth = 2;
    chart.options.scales.x.beginAtZero = !isRate;
    chart.options.scales.x.grace = isRate ? "5%" : 0;
  }

  function setTickFormat(chart, axis, m) {
    chart.options.scales[axis].ticks.callback = (v) =>
      m.type === "rate" ? m.fmt(v) : Number(v).toLocaleString("en-US");
    chart.options.plugins.tooltip.callbacks = {
      label: (ctx) => {
        const val = ctx.parsed[axis];
        const name = ctx.dataset.label ? ctx.dataset.label + ": " : "";
        return " " + name + m.fmt(val);
      },
    };
  }

  // Keep a category's color the same while it stays in the top 5.
  function assignSlots(cats) {
    for (const k of [...trendSlots.keys()]) if (!cats.includes(k)) trendSlots.delete(k);
    const used = new Set(trendSlots.values());
    for (const c of cats) {
      if (!trendSlots.has(c)) {
        let s = 0; while (used.has(s)) s++;
        trendSlots.set(c, s); used.add(s);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Update everything
  // ---------------------------------------------------------------------------
  function update() {
    markSelectedLegend();
    const f = currentFilters();
    const rows = applyFilters(f);
    const m = measureByKey[$("s-measure").value];
    const bKey = $("s-breakdown").value;
    const bLabel = BREAKDOWNS.find((b) => b.key === bKey).label;
    const grain = $("s-grain").value;
    const minPA = Math.max(0, +$("s-minpa").value || 0);
    const passesMin = (a) => m.type !== "rate" || a.PA >= minPA;

    $("status").textContent = rows.length
      ? `Showing ${rows.length.toLocaleString("en-US")} of ${ROWS.length.toLocaleString("en-US")} rows (${f.y0}–${f.y1}).`
      : "No rows match these filters.";

    // ---- Summary numbers
    const all = newAcc();
    for (const r of rows) add(all, r);
    const kpis = [
      ["Players", all.players.size, fmtInt],
      ["Seasons", all.seasons.size, fmtInt],
      ["Plate appearances", all.PA, fmtInt],
      ["Home runs", all.HR, fmtInt],
      ["Batting average", measureByKey.AVG.f(all), fmtRate3],
      ["OPS", measureByKey.OPS.f(all), fmtRate3],
    ];
    // Build the tiles once, then animate each number to its new value.
    if (!$("kpis").children.length) {
      $("kpis").innerHTML = kpis.map(([l]) => `<div class="kpi"><div class="label">${l}</div><div class="value">–</div></div>`).join("");
    }
    [...$("kpis").querySelectorAll(".value")].forEach((el, i) => window.ChartTheme.countUp(el, kpis[i][1], kpis[i][2]));

    // ---- Ballpark: share of hits by type in the current view
    window.HitField.update({ H: all.H, B1: all.B1, B2: all.B2, B3: all.B3, HR: all.HR });

    // ---- Chart 1: measure over time
    const timeKey = grain === "year" ? (r) => r.year : (r) => r.decade;
    const byTime = groupBy(rows, timeKey);
    let timeLabels;
    if (grain === "year") {
      timeLabels = YEARS.filter((y) => y >= f.y0 && y <= f.y1);
    } else {
      timeLabels = [...new Set(YEARS.filter((y) => y >= f.y0 && y <= f.y1).map((y) => Math.floor(y / 10) * 10 + "s"))];
    }
    charts.time.data.labels = timeLabels;
    charts.time.data.datasets[0].data = timeLabels.map((t) => (byTime.has(t) ? m.f(byTime.get(t)) : null));
    charts.time.data.datasets[0].pointRadius = grain === "decade" ? 4 : 0;
    setTickFormat(charts.time, "y", m);
    charts.time.update();
    $("t-time").textContent = `${m.short} by ${grain === "year" ? "season" : "decade"}`;

    // ---- Chart 2: measure by breakdown (top 12)
    const byCat = groupBy(rows, (r) => r[bKey]);
    const catList = [...byCat.entries()]
      .filter(([, a]) => passesMin(a))
      .map(([k, a]) => [k, m.f(a)])
      .filter(([, v]) => v != null)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);
    charts.brk.data.labels = catList.map((c) => c[0]);
    charts.brk.data.datasets[0].data = catList.map((c) => c[1]);
    setRankStyle(charts.brk, m, SERIES[0]);
    setTickFormat(charts.brk, "x", m);
    charts.brk.update();
    $("t-break").textContent = `${m.short} by ${bLabel.toLowerCase()}` + (byCat.size > 12 ? " (top 12)" : "");

    // ---- Chart 3: top 10 players
    const byPlayer = groupBy(rows, (r) => r.pid);
    const names = new Map(rows.map((r) => [r.pid, r.name]));
    const lm = m.key === "players"
      ? { short: "Seasons played", type: "total", f: (a) => a.seasons.size, fmt: fmtInt }
      : m;
    const leaders = [...byPlayer.entries()]
      .filter(([, a]) => lm.type !== "rate" || a.PA >= minPA)
      .map(([pid, a]) => [names.get(pid), lm.f(a)])
      .filter(([, v]) => v != null)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    charts.leaders.data.labels = leaders.map((l) => l[0]);
    charts.leaders.data.datasets[0].data = leaders.map((l) => l[1]);
    setRankStyle(charts.leaders, lm, SERIES[1]);
    setTickFormat(charts.leaders, "x", lm);
    charts.leaders.update();
    $("t-leaders").textContent = `Top 10 players: ${lm.short}` + (lm.type === "rate" ? ` (min. ${minPA.toLocaleString("en-US")} PA)` : "");

    // ---- Chart 4: top 5 categories (by plate appearances) over time
    const top5 = [...byCat.entries()].sort((a, b) => b[1].PA - a[1].PA).slice(0, 5).map((e) => e[0]);
    assignSlots(top5);
    const byCatTime = groupBy(rows.filter((r) => top5.includes(r[bKey])), (r) => r[bKey] + "|" + timeKey(r));
    charts.trend.data.labels = timeLabels;
    charts.trend.data.datasets = top5.map((c) => {
      const col = SERIES[trendSlots.get(c)];
      return {
        label: c,
        data: timeLabels.map((t) => { const a = byCatTime.get(c + "|" + t); return a ? m.f(a) : null; }),
        borderColor: col, backgroundColor: col, borderWidth: 2.5,
        pointRadius: grain === "decade" ? 4 : 0, pointHoverRadius: 6, tension: 0.25, spanGaps: false,
      };
    });
    setTickFormat(charts.trend, "y", m);
    charts.trend.update();
    $("t-trend").textContent = `${m.short} over time: 5 largest groups by plate appearances`;

    // ---- Table
    const tableRows = [...byCat.entries()].sort((a, b) => {
      const va = m.f(a[1]), vb = m.f(b[1]);
      return (vb == null ? -Infinity : vb) - (va == null ? -Infinity : va);
    });
    const head = `<thead><tr><th>${bLabel}</th>` +
      TABLE_COLS.map((k) => `<th class="${k === m.key ? "hl" : ""}">${measureByKey[k].short}</th>`).join("") + "</tr></thead>";
    const line = (label, a, bold) =>
      `<tr${bold ? ' style="font-weight:600"' : ""}><td>${label}</td>` +
      TABLE_COLS.map((k) => `<td class="${k === m.key ? "hl" : ""}">${measureByKey[k].fmt(measureByKey[k].f(a))}</td>`).join("") + "</tr>";
    const body = "<tbody>" + tableRows.map(([k, a]) => line(escapeHtml(k), a)).join("") + line("All (current filters)", all, true) + "</tbody>";
    $("data-table").innerHTML = head + body;
    $("t-table").textContent = `Numbers behind the view, by ${bLabel.toLowerCase()}`;
    $("table-note").textContent = `${tableRows.length} groups, sorted by ${m.short}. The last row matches the summary numbers above.`;
  }


  // ---------------------------------------------------------------------------
  // Legends sidebar: player cards with career stats computed from the data
  // ---------------------------------------------------------------------------
  // Each stat is either a career total/rate or the player's best single season.
  // "best" seasons combine all of a player's stints that year; best-season rates
  // need at least 400 PA.
  // Photos are hot-linked from Wikimedia Commons (public domain or openly
  // licensed). Each card credits the photographer and license on its back.
  // If a photo can't load (e.g. offline), the card falls back to the batter
  // silhouette drawn in dashboard.html.
  const COMMONS = (file) => "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file) + "?width=360";
  const LEGENDS = [
    { pid: "ruthba01", color: "#1f4fa3", stats: [["career", "HR"], ["best", "HR"]],
      photo: { file: "Babe_Ruth2.jpg", credit: "Irwin, La Broad & Pudlin, 1920", license: "Public domain", zoom: 1.6, pos: "50% 12%" } },
    { pid: "gibsojo99", color: "#b3272d", stats: [["career", "AVG"], ["career", "HR"]],
      photo: { file: "Josh_Gibson_1931.jpg", credit: "Harrison Studio, 1931", license: "Public domain" } },
    { pid: "willite01", color: "#b3272d", stats: [["career", "OBP"], ["best", "AVG"]],
      photo: { file: "Ted_Williams_(cropped).jpg", credit: "Unknown photographer, 1958", license: "Public domain" } },
    { pid: "robinja02", color: "#1f4fa3", stats: [["career", "AVG"], ["career", "SB"]],
      photo: { file: "Jackie_Robinson,_NPG_97_135.jpg", credit: "Harry Warnecke et al., 1949, National Portrait Gallery", license: "CC0" } },
    { pid: "aaronha01", color: "#1f6b4a", stats: [["career", "HR"], ["career", "RBI"]],
      photo: { file: "Hank_Aaron_1974.jpg", credit: "Unknown photographer, 1974", license: "Public domain" } },
    { pid: "henderi01", color: "#1f6b4a", stats: [["career", "SB"], ["best", "SB"]],
      photo: { file: "Rickeyhenderson2002.jpg", credit: "Dlz28 (Wikipedia user), 2002", license: "Public domain" } },
    { pid: "suzukic01", color: "#1f5d73", stats: [["career", "H"], ["best", "H"]],
      photo: { file: "Ichiro_Suzuki_(51007034081)_(cropped).jpg", credit: "Jeffrey Hayes, 2011", license: "CC BY 2.0",
               licenseUrl: "https://creativecommons.org/licenses/by/2.0/" } },
    { pid: "bondsba01", color: "#c0561f", stats: [["career", "HR"], ["best", "HR"]],
      photo: { file: "BarryLamar_Bonds.jpg", credit: "druchoy (Flickr), 2005", license: "CC BY-SA 2.0",
               licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/" } },
  ];
  const STAT_WORDS = { HR: "home runs", H: "hits", SB: "stolen bases", RBI: "runs batted in",
                       AVG: "batting average", OBP: "on-base percentage" };

  // Work out each legend's numbers once, then draw the cards twice: once for the
  // page margins (wide screens) and once for the swipeable row (narrow screens).
  function legendData() {
    const out = [];
    for (const L of LEGENDS) {
      const rows = ROWS.filter((r) => r.pid === L.pid);
      if (!rows.length) continue;
      const career = newAcc();
      rows.forEach((r) => add(career, r));
      const bySeason = groupBy(rows, (r) => r.year);
      // The team he batted the most for (by plate appearances) goes on the ribbon.
      const byTeam = groupBy(rows, (r) => r.teamLabel);
      const team = [...byTeam.entries()].sort((a, b) => b[1].PA - a[1].PA)[0][0];
      const statLines = L.stats.map(([kind, key]) => {
        const m = measureByKey[key];
        if (kind === "career") return { value: m.fmt(m.f(career)), text: "career " + STAT_WORDS[key] };
        let best = null, bestYear = null;
        for (const [yr, a] of bySeason) {
          if (m.type === "rate" && a.PA < 400) continue;
          const v = m.f(a);
          if (v != null && (best == null || v > best)) { best = v; bestYear = yr; }
        }
        return { value: m.fmt(best), text: STAT_WORDS[key] + " in " + bestYear + " (career best)" };
      });
      out.push({
        name: rows[0].name,
        bats: rows[0].bats,
        team,
        color: L.color,
        photo: L.photo,
        y0: Math.min(...rows.map((r) => r.year)),
        y1: Math.max(...rows.map((r) => r.year)),
        teamSeasons: rows.length,
        statLines,
      });
    }
    return out;
  }

  function makeLegendCard(d) {
    // A div acting as a button (a real <button> can't contain the credit links).
    const btn = document.createElement("div");
    btn.setAttribute("role", "button");
    btn.tabIndex = 0;
    btn.className = "legend";
    btn.dataset.name = d.name;
    btn.style.setProperty("--frame", d.color);
    btn.setAttribute("aria-label", `${d.name}, ${d.y0}–${d.y1}, ${d.team}. ` +
      d.statLines.map((l) => `${l.value} ${l.text}`).join(". ") + ". Click to filter the dashboard.");
    const p = d.photo;
    const lic = p.licenseUrl ? `<a href="${p.licenseUrl}" target="_blank" rel="noopener" tabindex="-1">${p.license}</a>` : p.license;
    btn.innerHTML = `
      <span class="flip" aria-hidden="true">
        <span class="face front">
          <span class="photo">
            <img src="${COMMONS(p.file)}" alt="" loading="lazy" referrerpolicy="no-referrer"
                 style="${p.pos ? `object-position:${p.pos};` : ""}${p.zoom ? `transform:scale(${p.zoom});transform-origin:${p.pos || "50% 18%"};` : ""}">
            <span class="badge"></span>
            <span class="ribbon">${escapeHtml(d.team)}</span>
          </span>
          <span class="plate"><span class="nm">${escapeHtml(d.name)}</span><span class="yr">${d.y0}–${d.y1}</span></span>
        </span>
        <span class="face back">
          <span class="bk-name">${escapeHtml(d.name)}</span>
          <span class="bk-meta">${d.y0}–${d.y1} · bats ${d.bats.toLowerCase()}<br>${d.teamSeasons} team-seasons</span>
          ${d.statLines.map((l) => `<span class="bk-stat"><b>${l.value}</b><span>${l.text}</span></span>`).join("")}
          <span class="bk-cta">Click to filter the dashboard</span>
          <span class="bk-credit">Photo: ${escapeHtml(p.credit)} · ${lic} · <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(p.file)}" target="_blank" rel="noopener" tabindex="-1">Wikimedia Commons</a></span>
        </span>
      </span>`;
    // Fall back to the silhouette if the photo can't load.
    const img = btn.querySelector("img");
    img.addEventListener("error", () => {
      img.replaceWith(Object.assign(document.createElementNS("http://www.w3.org/2000/svg", "svg"), {}));
      const svg = btn.querySelector(".photo svg");
      svg.setAttribute("viewBox", "0 0 100 120");
      if (d.bats === "Left") svg.classList.add("lefty");
      svg.innerHTML = '<use href="#batter"/>';
    }, { once: true });
    // Links on the back of the card open the credit, not the filter.
    btn.querySelectorAll(".bk-credit a").forEach((a) => a.addEventListener("click", (e) => e.stopPropagation()));
    btn.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click(); }
    });
    btn.addEventListener("click", () => {
      const on = $("f-player").value === d.name;
      $("f-player").value = on ? "" : d.name;
      update();
      if (!on) $("kpis").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return btn;
  }

  let railCards = [];
  function buildLegends() {
    const data = legendData();
    $("photo-credits").innerHTML = "<strong>Player photos</strong> (via Wikimedia Commons): " + data.map((d) =>
      `${escapeHtml(d.name)}: ${escapeHtml(d.photo.credit)}, ${d.photo.licenseUrl ? `<a href="${d.photo.licenseUrl}">${d.photo.license}</a>` : d.photo.license}`).join("; ") + ".";
    const row = $("legend-row");
    row.innerHTML = "";
    data.forEach((d) => row.appendChild(makeLegendCard(d)));

    // Margin cards alternate sides: 1st right, 2nd left, 3rd right, ...
    railCards = data.map((d, i) => {
      const card = makeLegendCard(d);
      (i % 2 === 0 ? $("rail-right") : $("rail-left")).appendChild(card);
      return card;
    });

    // Fade each card in when it scrolls into view and out when it leaves.
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.target.classList.toggle("in-view", e.isIntersecting);
    }, { threshold: 0.35 });
    railCards.forEach((c) => io.observe(c));

    // Re-space the cards whenever the charts/table column changes height.
    new ResizeObserver(placeRailCards).observe($("layout-main"));
    placeRailCards();
  }

  // Spread the cards evenly down the length of the charts + table column.
  function placeRailCards() {
    const H = $("layout-main").offsetHeight;
    const cardH = railCards.length ? railCards[0].offsetHeight || 280 : 280;
    const step = H / Math.max(railCards.length, 1);
    railCards.forEach((c, i) => {
      const top = i * step;
      const fits = top + cardH <= H;           // hide cards that would hang off the end
      c.style.top = top + "px";
      c.style.display = fits ? "" : "none";
    });
  }

  function markSelectedLegend() {
    const v = $("f-player").value;
    document.querySelectorAll(".legend").forEach((b) => b.classList.toggle("selected", b.dataset.name === v));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
})();
