// Ballpark at the top of the dashboard, plus the "Step Up to the Plate" game.
//
// SMALL FIELD (in the page header): each zone shows its share of all hits in
// the current dashboard view (singles / doubles / triples / home runs), so the
// labels change with the filters. Clicking it opens the game.
//
// GAME (a pop-up on the same page, closed with the X, Esc, or a click outside):
// a notable player from the data steps up. Click the field to swing:
//   * outside the foul lines  -> foul ball (a strike, up to two)
//   * a fair ball             -> a hit with probability = the batter's real
//                                career batting average (H / AB); otherwise
//                                it's caught for an out
//   * over the wall           -> a home run with probability based on how
//                                often his hits were home runs (HR / H);
//                                otherwise he's robbed at the wall
// Hits move the batter around the bases. An out, a home run, or running all
// the way home ends the at-bat, and a new batter steps up.

(function () {
  "use strict";

  const HOME = { x: 200, y: 282 };
  const R = { single: 118, double: 172, triple: 206, wall: 214 };  // zone edges (distance from home)
  const FEET_PER_UNIT = 400 / R.wall;                                // center-field wall = 400 ft
  const ZONES = [
    { key: "B1", name: "Single", plural: "Singles", bases: 1 },
    { key: "B2", name: "Double", plural: "Doubles", bases: 2 },
    { key: "B3", name: "Triple", plural: "Triples", bases: 3 },
    { key: "HR", name: "Home run", plural: "Home runs", bases: 4 },
  ];
  const BASE_PTS = [HOME, { x: 252, y: 230 }, { x: 200, y: 178 }, { x: 148, y: 230 }, HOME];
  const fmtPct = (x) => (x == null || !isFinite(x) ? "–" : (x * 100).toFixed(1) + "%");
  const fmtInt = (x) => Math.round(x).toLocaleString("en-US");
  const fmtAvg = (x) => x.toFixed(3).replace(/^0/, "");
  const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------------------
  // Drawing (shared by the small field and the game field)
  // ---------------------------------------------------------------------------
  const arc = (r) => {
    const s = Math.SQRT1_2, x1 = HOME.x - r * s, y1 = HOME.y - r * s, x2 = HOME.x + r * s;
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const wedge = (r0, r1) => {
    const s = Math.SQRT1_2;
    const p = (r, sign) => `${(HOME.x + sign * r * s).toFixed(1)} ${(HOME.y - r * s).toFixed(1)}`;
    return `M${p(r0, -1)} A${r0} ${r0} 0 0 1 ${p(r0, 1)} L${p(r1, 1)} A${r1} ${r1} 0 0 0 ${p(r1, -1)} Z`;
  };

  function drawField(svg, id) {
    const crowd = [];
    for (let i = 0; i < 90; i++) {
      const t = -0.78 + (1.56 * i) / 89, r = 222 + (i % 3) * 7;
      crowd.push(`<circle cx="${(HOME.x + r * Math.sin(t)).toFixed(1)}" cy="${(HOME.y - r * Math.cos(t)).toFixed(1)}" r="2.2" class="fan-dot d${i % 5}"/>`);
    }
    const X = HOME.x, Y = HOME.y;
    svg.innerHTML = `
      <defs>
        <radialGradient id="${id}-grass" cx="50%" cy="95%" r="90%"><stop offset="0" stop-color="#3f8a55"/><stop offset="1" stop-color="#1d4d31"/></radialGradient>
        <pattern id="${id}-mow" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="13" height="26" fill="rgba(255,255,255,0.06)"/></pattern>
        <radialGradient id="${id}-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(255,238,200,0.35)"/><stop offset="1" stop-color="rgba(255,238,200,0)"/></radialGradient>
      </defs>
      ${[[34, 60], [366, 60]].map(([x, y]) => `
        <ellipse cx="${x}" cy="${y}" rx="46" ry="30" fill="url(#${id}-glow)"/>
        <path d="M${x} ${y + 4} V${y + 70}" class="tower"/>
        <rect x="${x - 12}" y="${y - 7}" width="24" height="11" rx="2" class="lamps"/>
        ${[-8, -3, 2, 7].map((dx) => `<circle cx="${x + dx}" cy="${y - 1.5}" r="1.8" class="bulb"/>`).join("")}`).join("")}
      <path d="${wedge(R.wall, 244)}" class="stands"/>
      ${crowd.join("")}
      <path d="${wedge(0, R.wall)}" fill="url(#${id}-grass)"/>
      <path d="${wedge(0, R.wall)}" fill="url(#${id}-mow)"/>
      <path d="${wedge(R.triple - 10, R.triple + 8)}" class="track"/>
      <path d="${arc(R.wall)}" class="wall"/>
      <path d="${wedge(24, R.single)}" class="zone" data-z="B1"/>
      <path d="${wedge(R.single, R.double)}" class="zone" data-z="B2"/>
      <path d="${wedge(R.double, R.triple + 8)}" class="zone" data-z="B3"/>
      <path d="${wedge(R.triple + 8, 244)}" class="zone" data-z="HR"/>
      <path d="${arc(R.single)}" class="ring"/><path d="${arc(R.double)}" class="ring"/>
      <path d="M${X} ${Y + 8} L${X - 76} ${Y - 68} A106 106 0 0 1 ${X + 76} ${Y - 68} Z" class="dirt"/>
      <path d="M${X} ${Y - 10} L${X - 48} ${Y - 58} L${X} ${Y - 106} L${X + 48} ${Y - 58} Z" class="infield-grass"/>
      <path d="M${X} ${Y} L${X - 150} ${Y - 150} M${X} ${Y} L${X + 150} ${Y - 150}" class="chalk"/>
      <path d="M${X} ${Y} L${X - 52} ${Y - 52} L${X} ${Y - 104} L${X + 52} ${Y - 52} Z" class="paths"/>
      <circle cx="${X}" cy="${Y - 56}" r="9" class="mound"/>
      <rect x="${X - 118}" y="${Y - 44}" width="40" height="10" rx="3" transform="rotate(-45 ${X - 98} ${Y - 39})" class="dugout"/>
      <rect x="${X + 78}" y="${Y - 44}" width="40" height="10" rx="3" transform="rotate(45 ${X + 98} ${Y - 39})" class="dugout"/>
      <rect x="${X - 15}" y="${Y - 9}" width="9" height="14" class="box"/><rect x="${X + 6}" y="${Y - 9}" width="9" height="14" class="box"/>
      <circle cx="${X - 40}" cy="${Y + 4}" r="4" class="ondeck"/><circle cx="${X + 40}" cy="${Y + 4}" r="4" class="ondeck"/>
      <rect x="${X - 5}" y="${Y - 57}" width="10" height="2.5" class="rubber"/>
      <path d="M${X - 151} ${Y - 151} v-24 M${X + 151} ${Y - 151} v-24" class="pole"/>
      <rect data-base="1" x="${X + 47}" y="${Y - 57}" width="10" height="10" transform="rotate(45 ${X + 52} ${Y - 52})" class="base"/>
      <rect data-base="2" x="${X - 5}" y="${Y - 109}" width="10" height="10" transform="rotate(45 ${X} ${Y - 104})" class="base"/>
      <rect data-base="3" x="${X - 57}" y="${Y - 57}" width="10" height="10" transform="rotate(45 ${X - 52} ${Y - 52})" class="base"/>
      <path data-base="4" d="M${X - 6} ${Y - 3} h12 v5 l-6 5 l-6 -5 z" class="base"/>
      <text x="${X - 118}" y="${Y - 150}" class="dist" text-anchor="middle">330</text>
      <text x="${X}" y="${Y - 199}" class="dist" text-anchor="middle">400</text>
      <text x="${X + 118}" y="${Y - 150}" class="dist" text-anchor="middle">330</text>
      <g class="zlabel" data-z="B1"><text x="${X + 50}" y="${Y - 98}" text-anchor="middle"><tspan class="zn">1B</tspan> <tspan class="zp" data-p="B1">–</tspan></text></g>
      <g class="zlabel" data-z="B2"><text x="${X - 80}" y="${Y - 118}" text-anchor="middle"><tspan class="zn">2B</tspan> <tspan class="zp" data-p="B2">–</tspan></text></g>
      <g class="zlabel" data-z="B3"><text x="${X + 98}" y="${Y - 160}" text-anchor="middle"><tspan class="zn">3B</tspan> <tspan class="zp" data-p="B3">–</tspan></text></g>
      <g class="zlabel" data-z="HR"><text x="${X}" y="${Y - 250}" text-anchor="middle"><tspan class="zn">HR</tspan> <tspan class="zp" data-p="HR">–</tspan></text></g>
      <circle class="runner" r="5.5" cx="${X}" cy="${Y}" opacity="0"/>
      <ellipse class="ball-shadow" rx="4" ry="1.8" opacity="0"/>
      <circle class="ball" r="4" opacity="0"/>
      <g class="burst-pos"><g class="burst" opacity="0"></g></g>
      <text class="field-banner" x="${X}" y="${Y - 150}" text-anchor="middle" opacity="0"></text>`;

    svg.querySelectorAll("[data-z]").forEach((el) => {
      const z = svg.querySelector(`.zone[data-z="${el.dataset.z}"]`);
      el.addEventListener("mouseenter", () => z.classList.add("hot"));
      el.addEventListener("mouseleave", () => z.classList.remove("hot"));
    });
  }

  function setShares(svg, c) {
    ZONES.forEach((z) => {
      const el = svg.querySelector(`[data-p="${z.key}"]`);
      if (el) el.textContent = c && c.H > 0 ? fmtPct(c[z.key] / c.H) : "–";
    });
  }

  function svgPoint(svg, e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  // Where did the ball go? -> zone, distance in feet, and a field direction.
  function locate(x, y) {
    const dx = x - HOME.x, dy = HOME.y - y;
    const d = Math.hypot(dx, dy);
    const ang = Math.atan2(dx, dy) * 180 / Math.PI;       // 0 = dead center, negative = left
    const fair = dy > 0 && Math.abs(ang) <= 45.5;
    const dir = ang < -27 ? "left field" : ang < -9 ? "left-center" : ang <= 9 ? "center field" : ang <= 27 ? "right-center" : "right field";
    const infield = ang < -22 ? "third base" : ang < -4 ? "shortstop" : ang <= 4 ? "the pitcher" : ang <= 22 ? "second base" : "first base";
    let zone = null;
    if (fair) zone = d < R.single ? ZONES[0] : d < R.double ? ZONES[1] : d < R.triple + 8 ? ZONES[2] : ZONES[3];
    return { fair, d, feet: Math.round(d * FEET_PER_UNIT), dir, infield, zone, side: ang < 0 ? "third-base" : "first-base" };
  }

  // Animate a ball from home plate to (x, y); calls done() when it lands.
  function flyBall(svg, x, y, done) {
    const ball = svg.querySelector(".ball"), shadow = svg.querySelector(".ball-shadow");
    const d = Math.hypot(x - HOME.x, y - HOME.y);
    const peak = Math.min(120, 30 + d * 0.45);
    const t0 = performance.now(), dur = reduceMotion() ? 0 : 450 + d * 2.4;
    (function frame(t) {
      const k = dur ? Math.min(1, (t - t0) / dur) : 1;
      const gx = HOME.x + (x - HOME.x) * k, gy = HOME.y + (y - HOME.y) * k, h = 4 * peak * k * (1 - k);
      ball.setAttribute("cx", gx); ball.setAttribute("cy", gy - h); ball.setAttribute("r", 3.5 + h / 30);
      shadow.setAttribute("cx", gx); shadow.setAttribute("cy", gy);
      ball.setAttribute("opacity", 1); shadow.setAttribute("opacity", 0.5);
      if (k < 1) requestAnimationFrame(frame); else done();
    })(t0);
  }

  function burst(svg, x, y, color, big) {
    svg.querySelector(".burst-pos").setAttribute("transform", `translate(${x} ${y})`);
    const b = svg.querySelector(".burst");
    b.innerHTML = Array.from({ length: 10 }, (_, i) =>
      `<path d="M0 -6 V-${big ? 22 : 12}" stroke="${color}" transform="rotate(${i * 36})"/>`).join("");
    b.classList.remove("pop"); void b.getBBox(); b.classList.add("pop");
  }

  function hideBall(svg) {
    svg.querySelector(".ball").setAttribute("opacity", 0);
    svg.querySelector(".ball-shadow").setAttribute("opacity", 0);
  }

  // ---------------------------------------------------------------------------
  // The game
  // ---------------------------------------------------------------------------
  let pool = [], counts = null;
  let modal, gsvg, lastFocus = null;
  let st = null;                                  // state of the current at-bat
  let runs = 0, atBats = 0, busy = false, resetTimer = null;
  const $g = (id) => document.getElementById(id);

  function newBatter() {
    clearTimeout(resetTimer);
    const prev = st && st.p;
    let p = pool[(Math.random() * pool.length) | 0];
    if (pool.length > 1) while (p === prev) p = pool[(Math.random() * pool.length) | 0];
    st = { p, strikes: 0, bases: 0, over: false, log: [] };
    gsvg.querySelectorAll(".base").forEach((b) => b.classList.remove("lit"));
    const runner = gsvg.querySelector(".runner");
    runner.setAttribute("opacity", 0);
    runner.setAttribute("cx", HOME.x); runner.setAttribute("cy", HOME.y);
    const banner = gsvg.querySelector(".field-banner");
    banner.setAttribute("opacity", 0);
    hideBall(gsvg);

    $g("gb-name").textContent = p.name;
    $g("gb-meta").textContent = `${p.y0}–${p.y1} · bats ${p.bats.toLowerCase()} · ${p.team}`;
    $g("gb-avg").textContent = fmtAvg(p.avg);
    $g("gb-hr").textContent = fmtInt(p.HR);
    $g("gb-h").textContent = fmtInt(p.H);
    $g("gb-note").textContent = p.note;
    $g("gb-odds").textContent = `Chance a fair ball is a hit: ${fmtPct(p.avg)} (his career AVG). Chance a ball over the wall stays gone: ${fmtPct(p.hrOdds)}.`;
    const photo = $g("gb-photo");
    photo.innerHTML = p.photo
      ? `<img src="${p.photo}" alt="" referrerpolicy="no-referrer">`
      : `<span>${p.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>`;
    const img = photo.querySelector("img");
    if (img) img.addEventListener("error", () => { photo.innerHTML = `<span>${p.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>`; }, { once: true });
    $g("gb-play").textContent = `Now batting: ${p.name}. Click the field to swing.`;
    $g("gb-log").innerHTML = "";
    renderCount();
  }

  function renderCount() {
    $g("gb-strikes").innerHTML = [0, 1].map((i) => `<i class="${i < st.strikes ? "on" : ""}"></i>`).join("");
    $g("gb-outs").innerHTML = `<i class="${st.over === "out" ? "on out" : ""}"></i>`;
    $g("gb-bases").querySelectorAll("[data-b]").forEach((b) => b.classList.toggle("on", +b.dataset.b === st.bases));
    $g("gb-runs").textContent = runs;
    $g("gb-ab").textContent = atBats;
  }

  function log(text, cls) {
    st.log.unshift({ text, cls });
    $g("gb-log").innerHTML = st.log.slice(0, 5).map((l) => `<li class="${l.cls || ""}">${l.text}</li>`).join("");
    $g("gb-play").textContent = text;
  }

  // Move the runner dot from base `from` to base `to` (4 = home).
  function runBases(from, to, done) {
    const runner = gsvg.querySelector(".runner");
    runner.setAttribute("opacity", 1);
    const steps = [];
    for (let b = from; b < to; b++) steps.push([BASE_PTS[b], BASE_PTS[b + 1]]);
    let i = 0;
    const leg = () => {
      if (i >= steps.length) {
        gsvg.querySelectorAll(".base").forEach((el) => el.classList.toggle("lit", +el.dataset.base === Math.min(to, 4)));
        return done && done();
      }
      const [a, b] = steps[i++], t0 = performance.now(), dur = reduceMotion() ? 0 : 260;
      (function frame(t) {
        const k = dur ? Math.min(1, (t - t0) / dur) : 1;
        runner.setAttribute("cx", a.x + (b.x - a.x) * k); runner.setAttribute("cy", a.y + (b.y - a.y) * k);
        if (k < 1) requestAnimationFrame(frame); else leg();
      })(t0);
    };
    leg();
  }

  function endAtBat(kind, text) {
    st.over = kind;
    atBats += 1;
    if (kind === "run") runs += 1;
    renderCount();
    const banner = gsvg.querySelector(".field-banner");
    banner.textContent = kind === "run" ? "RUN SCORES!" : "OUT!";
    banner.setAttribute("class", "field-banner " + kind);
    banner.setAttribute("opacity", 1);
    $g("gb-play").textContent = text + " New batter coming up…";
    resetTimer = setTimeout(newBatter, 2600);
  }

  function swing(x, y) {
    if (busy || !st || st.over) return;
    busy = true;
    const L = locate(x, y);
    flyBall(gsvg, x, y, () => {
      busy = false;
      const p = st.p;
      if (!L.fair) {
        burst(gsvg, x, y, "#f2878b", false);
        if (st.strikes < 2) st.strikes += 1;
        log(`Foul ball down the ${L.side} line. Strike ${st.strikes}${st.strikes === 2 ? " (fouls can't be strike three)" : ""}.`, "foul");
        renderCount();
        setTimeout(() => hideBall(gsvg), 600);
        return;
      }
      const z = L.zone;
      const where = z.key === "HR" ? `to ${L.dir}` : L.d < 70 ? `to ${L.infield}` : `to ${L.dir}`;
      const isHit = z.key === "HR" ? Math.random() < p.hrOdds : Math.random() < p.avg;
      if (!isHit) {
        burst(gsvg, x, y, "#8993ad", false);
        const how = z.key === "HR" ? `Robbed at the wall in ${L.dir}!` :
                    L.d < 70 ? `Ground out ${where}.` : L.d < R.single ? `Line out ${where}.` : `Fly out ${where}, ${L.feet} ft.`;
        log(`${how} ${p.name} is out.`, "out");
        setTimeout(() => hideBall(gsvg), 600);
        return endAtBat("out", `${how}`);
      }
      burst(gsvg, x, y, z.key === "HR" ? "#e3b45f" : "#f4efe2", z.key === "HR");
      const share = counts && counts.H > 0 ? ` ${z.plural} are ${fmtPct(counts[z.key] / counts.H)} of hits in your current dashboard view.` : "";
      const label = z.key === "HR" ? `HOME RUN! ${L.feet} ft ${L.dir === "center field" ? "to dead center" : "to " + L.dir}.` :
                    `${z.name.toUpperCase()}! ${z.key === "B1" && L.d < 70 ? "Infield single" : "Line drive"} ${where}, ${L.feet} ft.`;
      log(label + share, "hit");
      const from = st.bases;
      st.bases = Math.min(4, st.bases + z.bases);
      st.strikes = 0;
      renderCount();
      setTimeout(() => hideBall(gsvg), 600);
      runBases(from, st.bases, () => {
        if (st.bases >= 4) endAtBat("run", z.key === "HR" ? `${p.name} rounds the bases!` : `${p.name} comes around to score!`);
        else log(`${p.name} is on ${["", "first", "second", "third"][st.bases]}. Swing again to keep going.`, "info");
      });
    });
  }

  function open() {
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("game-open");
    requestAnimationFrame(() => modal.classList.add("show"));
    if (!st) newBatter();
    $g("game-close").focus();
  }
  function close() {
    modal.classList.remove("show");
    document.body.classList.remove("game-open");
    clearTimeout(resetTimer);
    if (st && st.over) newBatter();
    setTimeout(() => { modal.hidden = true; }, reduceMotion() ? 0 : 200);
    if (lastFocus) lastFocus.focus();
  }

  window.HitField = {
    // small = the header field; players = notable batters for the game
    init({ small, openBtn, players }) {
      pool = players;
      drawField(small, "hf");
      small.addEventListener("click", open);
      small.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
      openBtn.addEventListener("click", open);

      modal = $g("game");
      gsvg = $g("game-field");
      drawField(gsvg, "gf");
      gsvg.addEventListener("click", (e) => { const p = svgPoint(gsvg, e); swing(p.x, p.y); });
      $g("game-swing").addEventListener("click", () => {
        const ang = (Math.random() - 0.5) * Math.PI * 0.55;
        const d = 50 + Math.pow(Math.random(), 0.75) * 200;
        swing(HOME.x + d * Math.sin(ang), HOME.y - d * Math.cos(ang));
      });
      $g("game-next").addEventListener("click", newBatter);
      $g("game-close").addEventListener("click", close);
      modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });
      // keep keyboard focus inside the pop-up while it's open
      modal.addEventListener("keydown", (e) => {
        if (e.key !== "Tab") return;
        const f = [...modal.querySelectorAll("button, [href], [tabindex]:not([tabindex='-1'])")].filter((el) => !el.hidden);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      });
    },
    // counts = { H, B1, B2, B3, HR } for the rows that pass the current filters
    update(c) {
      counts = c;
      [document.getElementById("hit-field"), gsvg].forEach((svg) => svg && setShares(svg, c));
    },
  };
})();
