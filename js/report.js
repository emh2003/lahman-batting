// Report charts: loads data/report.json (written by scripts/report_numbers.py)
// and draws one chart per finding.

(function () {
  "use strict";

  const { theme, alpha, areaFill, barFill, revealOnScroll } = window.ChartTheme;
  const [BLUE, ORANGE] = theme.series;
  const INK = theme.ink, RULE = theme.rule;
  const MUTED_BAR = alpha(BLUE, 0.35); // dimmed blue for bars that aren't highlighted

  const pct = (x, d = 1) => (x == null ? "–" : (x * 100).toFixed(d) + "%");
  const avg = (x) => (x == null ? "–" : x.toFixed(3).replace(/^0/, ""));
  const int = (x) => (x == null ? "–" : Math.round(x).toLocaleString("en-US"));
  const one = (x) => (x == null ? "–" : x.toFixed(1));

  revealOnScroll(".finding, .scoreboard");
  setupScoreboard();
  setupStretch();

  function options(fmt, { legend = false, yMin } = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: legend, position: "bottom", labels: { color: INK, usePointStyle: true, boxWidth: 10, boxHeight: 10 } },
        tooltip: {
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
      data: { labels, datasets: [{ data, backgroundColor: colors || barFill(BLUE), hoverBackgroundColor: BLUE, borderRadius: 6, borderSkipped: "start", maxBarThickness: 44 }] },
      options: options(fmt),
    });

  const line = (id, labels, series, fmt, opts = {}) =>
    new Chart(document.getElementById(id), {
      type: "line",
      data: {
        labels,
        datasets: series.map((s) => ({
          label: s.label, data: s.data, borderColor: s.color,
          backgroundColor: series.length === 1 ? areaFill(s.color) : s.color,
          fill: series.length === 1 ? "start" : false,
          pointBackgroundColor: s.color,
          borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 6, tension: 0.25, spanGaps: false,
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

  // ---------------------------------------------------------------------------
  // Scoreboard: hover previews an inning, click jumps to it, and the inning
  // you're currently reading is outlined as you scroll.
  // ---------------------------------------------------------------------------
  function setupScoreboard() {
    const now = document.getElementById("sb-now");
    const links = [...document.querySelectorAll(".sb-table a.inn")];
    const cellsFor = (id) => links.filter((a) => a.dataset.target === id).map((a) => a.parentElement);
    const defaultText = now.textContent;

    links.forEach((a) => {
      const id = a.dataset.target;
      const label = links.find((l) => l.dataset.target === id && l.title).title;
      const n = id === "data" ? "Post-game" : "Inning " + id.slice(1);
      const on = () => { cellsFor(id).forEach((td) => td.classList.add("hot")); now.textContent = n + ": " + label; };
      const off = () => { cellsFor(id).forEach((td) => td.classList.remove("hot")); now.textContent = defaultText; };
      a.addEventListener("mouseenter", on);
      a.addEventListener("focus", on);
      a.addEventListener("mouseleave", off);
      a.addEventListener("blur", off);
    });

    const sections = [...document.querySelectorAll(".finding[id]")];
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.parentElement.classList.toggle("current", a.dataset.target === e.target.id));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((sec) => io.observe(sec));
  }

  // ---------------------------------------------------------------------------
  // 7th-inning stretch
  //  * Progress (0 -> 1) comes from how far you've scrolled DOWN through the
  //    tall section. It only ever increases, so scrolling back up doesn't
  //    un-stretch the fan. It resets once the section is fully below the
  //    screen again (you've scrolled back above it), so it can replay.
  //  * At the end: two neighbors slide in, everyone raises a cup, "Cheers!"
  //    pops, and confetti falls.
  // ---------------------------------------------------------------------------

  // One fan, drawn in a 520 x 360 box around x = 260. Parts that move get classes:
  // .torso stretches, .upper (head + arms) rides up, .arm-l / .arm-r rotate.
  function fanSVG(opts) {
    const o = Object.assign({ jersey: "j-red", num: "7", cup: false, mouth: "m-smile" }, opts);
    const cupG = (cls) => `<g class="${cls}">
        <path d="M280 212 L296 212 L293.5 238 L282.5 238 Z" class="cup"/>
        <path d="M282 219 L294 219" class="cup-band"/>
        <ellipse cx="288" cy="212" rx="9" ry="3.4" class="foam"/>
        <circle cx="284" cy="209.5" r="2.6" class="foam"/><circle cx="291" cy="209" r="3" class="foam"/>
      </g>`;
    return `
      <g class="legs">
        <rect x="241" y="250" width="17" height="76" rx="8" class="pants"/>
        <rect x="262" y="250" width="17" height="76" rx="8" class="pants"/>
        <path d="M230 334 q0 -12 14 -12 h14 v12 z" class="shoe"/>
        <path d="M290 334 q0 -12 -14 -12 h-14 v12 z" class="shoe"/>
        <path d="M232 332 h26 M288 332 h-26" class="sole"/>
      </g>
      <g class="torso">
        <path d="M228 190 q0 -22 22 -22 h20 q22 0 22 22 v54 q0 10 -10 10 h-44 q-10 0 -10 -10 z" class="jersey ${o.jersey}"/>
        <path d="M228 190 q0 -22 22 -22 h20 q22 0 22 22" class="shade"/>
        <path d="M251 168 L260 184 L269 168" class="collar"/>
        <path d="M260 184 V244" class="placket"/>
        <circle cx="260" cy="196" r="1.7" class="btn"/><circle cx="260" cy="210" r="1.7" class="btn"/>
        <circle cx="260" cy="224" r="1.7" class="btn"/><circle cx="260" cy="238" r="1.7" class="btn"/>
        <text x="275" y="222" class="num">${o.num}</text>
        <rect x="228" y="244" width="64" height="8" class="belt"/>
        <rect x="256" y="244" width="8" height="8" class="buckle"/>
      </g>
      <g class="upper">
        <rect x="253" y="152" width="14" height="20" rx="5" class="skin neck"/>
        <circle cx="237" cy="142" r="5" class="skin"/><circle cx="283" cy="142" r="5" class="skin"/>
        <circle cx="260" cy="140" r="22" class="skin head"/>
        <path d="M239 150 Q260 166 281 150 Q276 160 260 162 Q244 160 239 150 Z" class="jaw-shade"/>
        <path d="M237 134 Q237 108 260 108 Q283 108 283 134 Z" class="cap"/>
        <path d="M249 111 Q260 104 271 111" class="cap-seam"/>
        <path d="M278 131 Q300 129 308 137 Q294 141 278 137 Z" class="brim"/>
        <circle cx="260" cy="108" r="3" class="cap-btn"/>
        <circle cx="260" cy="123" r="6" class="logo"/>
        <path d="M245 139 q5 -4 10 0 M265 139 q5 -4 10 0" class="brow"/>
        <ellipse cx="250" cy="145" rx="2.4" ry="3" class="eye"/><ellipse cx="270" cy="145" rx="2.4" ry="3" class="eye"/>
        <circle cx="245" cy="152" r="4" class="cheek"/><circle cx="275" cy="152" r="4" class="cheek"/>
        <path d="M251 153 Q260 161 269 153" class="mouth ${o.mouth}"/>
        <path d="M252 152 Q260 164 268 152 Z" class="mouth-open"/>
        <g class="arm arm-l">
          <rect x="226" y="198" width="11" height="40" rx="5.5" class="skin"/>
          <circle cx="231.5" cy="240" r="7" class="skin"/>
          <path d="M222 190 q0 -14 10 -16 q10 2 10 16 v10 h-20 z" class="sleeve ${o.jersey}"/>
        </g>
        <g class="arm arm-r">
          <rect x="283" y="198" width="11" height="40" rx="5.5" class="skin"/>
          <circle cx="288.5" cy="240" r="7" class="skin"/>
          <path d="M278 190 q0 -14 10 -16 q10 2 10 16 v10 h-20 z" class="sleeve ${o.jersey}"/>
          ${o.cup ? cupG("cup-g") : ""}
        </g>
      </g>`;
  }

  function setupStretch() {
    const sec = document.getElementById("stretch");
    if (!sec) return;
    const fan = document.getElementById("fan");
    sec.querySelector(".stretch-stage").insertAdjacentHTML("afterbegin", stadiumSVG());
    fan.innerHTML = `
      <defs>
        <linearGradient id="g-red" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#e5484d"/><stop offset="1" stop-color="#a8262b"/></linearGradient>
        <linearGradient id="g-blue" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3f7fe0"/><stop offset="1" stop-color="#1f4fa3"/></linearGradient>
        <linearGradient id="g-green" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2fa36f"/><stop offset="1" stop-color="#1b6b47"/></linearGradient>
        <linearGradient id="g-skin" x1="0" x2="1"><stop offset="0" stop-color="#f1cfa8"/><stop offset="1" stop-color="#d9a97c"/></linearGradient>
        <linearGradient id="g-cup" x1="0" x2="1"><stop offset="0" stop-color="#f4c44e"/><stop offset="1" stop-color="#d99b1c"/></linearGradient>
        <radialGradient id="g-spot" cx="50%" cy="0%" r="80%"><stop offset="0" stop-color="rgba(255,236,190,0.35)"/><stop offset="1" stop-color="rgba(255,236,190,0)"/></radialGradient>
      </defs>
      <ellipse cx="260" cy="190" rx="250" ry="190" fill="url(#g-spot)" class="spot"/>
      <g class="seats">
        ${[258, 284, 310].map((y) => `<rect x="10" y="${y}" width="500" height="16" rx="4"/>`).join("")}
      </g>
      <ellipse cx="260" cy="334" rx="46" ry="6" class="shadow"/>
      <g transform="translate(-140 14) scale(0.9)" class="side-pos"><g class="side side-l">${fanSVG({ jersey: "j-blue", num: "", cup: true, mouth: "m-smile" })}</g></g>
      <g transform="translate(660 14) scale(-0.9 0.9)" class="side-pos"><g class="side side-r">${fanSVG({ jersey: "j-green", num: "", cup: true, mouth: "m-smile" })}</g></g>
      <g class="main">${fanSVG({ jersey: "j-red", num: "7", cup: true })}</g>
      <g transform="translate(300 34)"><g class="clink">
        ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<path d="M0 -12 V-24" transform="rotate(${a})"/>`).join("")}
      </g></g>`;

    const txt = sec.querySelector(".stretch-text");
    const canvas = document.getElementById("confetti");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let maxP = 0, celebrated = false, ticking = false;

    function celebrate() {
      celebrated = true;
      sec.classList.add("celebrate");
      txt.textContent = "Ahh, that's better. Cheers! On to the 7th inning.";
      if (!reduce) confetti(canvas);
    }
    function reset() {
      maxP = 0;
      celebrated = false;
      sec.classList.remove("celebrate");
      sec.style.setProperty("--p", "0");
      txt.textContent = "Stand up, reach for the sky, and keep scrolling. The 7th inning is coming up.";
    }

    function update() {
      ticking = false;
      const r = sec.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.top > vh) { if (maxP > 0) reset(); return; }   // back above the section
      const total = r.height - vh;
      const p = Math.min(1, Math.max(0, total > 0 ? -r.top / total : 0));
      maxP = Math.max(maxP, p);                       // only ever moves forward
      const eased = maxP < 0.5 ? 2 * maxP * maxP : 1 - Math.pow(-2 * maxP + 2, 2) / 2;
      sec.style.setProperty("--p", eased.toFixed(4));

      // The crowd does "the wave" while the stage is on screen.
      sec.classList.toggle("waving", r.top < vh * 0.6 && r.bottom > vh * 0.4);

      if (maxP >= 0.97 && !celebrated) celebrate();
    }
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  // Simple confetti burst on a canvas laid over the fans.
  function confetti(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const c = canvas.getContext("2d");
    c.scale(dpr, dpr);
    const colors = ["#d2383d", "#3987e5", "#e3b45f", "#f4efe2", "#199e70", "#d55181"];
    const bits = Array.from({ length: 170 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * 80,
      y: h * 0.3,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 11 - 4,
      s: 5 + Math.random() * 6,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      col: colors[(Math.random() * colors.length) | 0],
    }));
    const t0 = performance.now();
    (function frame(t) {
      c.clearRect(0, 0, w, h);
      const life = (t - t0) / 3200;
      bits.forEach((b) => {
        b.vy += 0.28; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        c.save();
        c.globalAlpha = Math.max(0, 1 - life);
        c.translate(b.x, b.y); c.rotate(b.r);
        c.fillStyle = b.col;
        c.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        c.restore();
      });
      if (life < 1) requestAnimationFrame(frame); else c.clearRect(0, 0, w, h);
    })(t0);
  }

  // Night-game stadium drawn behind the fans: stars, light towers with beams,
  // an upper deck full of fans (who do "the wave"), bunting, the outfield wall,
  // a video board and a flag. Deterministic "random" so it looks the same each load.
  function stadiumSVG() {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const stars = Array.from({ length: 70 }, () =>
      `<circle cx="${(rnd() * 1000).toFixed(0)}" cy="${(rnd() * 250).toFixed(0)}" r="${(0.6 + rnd() * 1.4).toFixed(1)}" class="star" style="animation-delay:${(rnd() * 4).toFixed(2)}s"/>`).join("");
    const crowdColors = ["#d2383d", "#e9e4d6", "#3987e5", "#e3b45f", "#7a86a8", "#1f6b4a", "#f2878b"];
    const crowd = [];
    for (let row = 0; row < 7; row++) {
      const y = 322 + row * 15;
      for (let x = 20 + (row % 2) * 7; x < 990; x += 14) {
        if (rnd() < 0.1) continue;                          // a few empty seats
        const c = crowdColors[(rnd() * crowdColors.length) | 0];
        crowd.push(`<g class="crowd" style="animation-delay:${(x / 1000 * 1.6).toFixed(2)}s"><circle cx="${x}" cy="${y}" r="4.6" fill="${c}"/><circle cx="${x}" cy="${y - 6.5}" r="3" class="head"/></g>`);
      }
    }
    const tower = (x, flip) => {
      const bulbs = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) bulbs.push(`<circle cx="${x - 37 + c * 15}" cy="${97 + r * 12}" r="4" class="bulb"/>`);
      return `
        <path d="M${x} 110 L${x + (flip ? -330 : 330)} 700 L${x + (flip ? -110 : 110)} 700 Z" class="beam"/>
        <path d="M${x - 6} 140 L${x - 14} 470 H${x + 14} L${x + 6} 140 Z" class="tower"/>
        ${[180, 240, 300, 360, 420].map((y) => `<path d="M${x - 11} ${y} L${x + 11} ${y + 30} M${x + 11} ${y} L${x - 11} ${y + 30}" class="truss"/>`).join("")}
        <rect x="${x - 48}" y="84" width="96" height="46" rx="4" class="lamp-bank"/>
        ${bulbs.join("")}`;
    };
    const bunting = Array.from({ length: 12 }, (_, i) => {
      const x = i * 86 + 12;
      return `<path d="M${x} 428 Q${x + 43} 462 ${x + 86} 428 Z" class="bunt"/>
              <path d="M${x + 8} 432 Q${x + 43} 454 ${x + 78} 432" class="bunt-w"/>
              <path d="M${x + 18} 436 Q${x + 43} 448 ${x + 68} 436" class="bunt-b"/>`;
    }).join("");
    return `
      <svg class="stadium" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id="st-sky" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#060b1a"/><stop offset="0.55" stop-color="#14224a"/><stop offset="1" stop-color="#1b2c5c"/></linearGradient>
          <linearGradient id="st-beam" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="rgba(255,244,210,0.22)"/><stop offset="1" stop-color="rgba(255,244,210,0)"/></linearGradient>
          <linearGradient id="st-deck" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1a2547"/><stop offset="1" stop-color="#0e1630"/></linearGradient>
          <linearGradient id="st-grass" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1f5a3a"/><stop offset="1" stop-color="#0f2e1f"/></linearGradient>
        </defs>
        <rect width="1000" height="700" fill="url(#st-sky)"/>
        ${stars}
        <circle cx="820" cy="70" r="26" class="moon"/>
        ${tower(70, false)}${tower(930, true)}
        <!-- upper deck with the crowd -->
        <path d="M0 300 Q500 270 1000 300 V428 H0 Z" fill="url(#st-deck)"/>
        <path d="M0 300 Q500 270 1000 300" class="deck-lip"/>
        ${crowd.join("")}
        ${bunting}
        <!-- outfield wall + grass -->
        <rect x="0" y="470" width="1000" height="60" class="wall"/>
        <text x="500" y="508" class="wall-text" text-anchor="middle">LAHMAN FIELD · EST. 1871</text>
        <rect x="0" y="530" width="1000" height="170" fill="url(#st-grass)"/>
        <path d="M0 530 H1000" class="wall-cap"/>
        <!-- video board -->
        <g class="board">
          <rect x="170" y="150" width="210" height="110" rx="6" class="board-frame"/>
          <rect x="182" y="162" width="186" height="86" rx="3" class="board-screen"/>
          <text x="275" y="196" text-anchor="middle" class="board-small">INNING 7</text>
          <text x="275" y="232" text-anchor="middle" class="board-big stretch-word">STRETCH!</text>
          <text x="275" y="232" text-anchor="middle" class="board-big cheers-word">CHEERS!</text>
          <path d="M240 260 V300 M310 260 V300" class="board-leg"/>
        </g>
        <!-- flag -->
        <path d="M720 300 V150" class="flagpole"/>
        <path d="M720 152 Q760 142 800 156 T880 160 V204 Q840 200 800 196 T720 196 Z" class="flag"/>
      </svg>`;
  }
})();
