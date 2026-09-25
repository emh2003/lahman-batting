// "Take a swing" ballpark at the top of the dashboard.
//
// The field is split into zones by how far a ball travels from home plate:
// singles (shallow), doubles (the gaps), triples (the warning track) and home
// runs (over the wall). Each zone shows its share of all hits in the current
// dashboard view, so the labels change with the filters. Click (or tap) the
// field to hit a ball there; the result is called out with the matching
// number from the data. The "Swing" button hits a random ball (keyboard friendly).

(function () {
  "use strict";

  const HOME = { x: 200, y: 282 };
  const R = { single: 118, double: 172, triple: 206 };   // zone edges (distance from home)
  const ZONES = [
    { key: "B1", name: "Single", plural: "Singles", base: "b1" },
    { key: "B2", name: "Double", plural: "Doubles", base: "b2" },
    { key: "B3", name: "Triple", plural: "Triples", base: "b3" },
    { key: "HR", name: "Home run", plural: "Home runs", base: "home" },
  ];
  const fmtPct = (x) => (x == null || !isFinite(x) ? "–" : (x * 100).toFixed(1) + "%");
  const fmtInt = (x) => Math.round(x).toLocaleString("en-US");

  let svg, callout, counts = null, busy = false;

  // Arc path helper: an arc of radius r around home plate, between the foul lines.
  const arc = (r) => {
    const a = Math.PI / 4, x1 = HOME.x - r * Math.sin(a), y1 = HOME.y - r * Math.cos(a);
    const x2 = HOME.x + r * Math.sin(a);
    return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const wedge = (r0, r1) => {
    const a = Math.PI / 4, s = Math.sin(a), c = Math.cos(a);
    const p = (r, sign) => `${(HOME.x + sign * r * s).toFixed(1)} ${(HOME.y - r * c).toFixed(1)}`;
    return `M${p(r0, -1)} A${r0} ${r0} 0 0 1 ${p(r0, 1)} L${p(r1, 1)} A${r1} ${r1} 0 0 0 ${p(r1, -1)} Z`;
  };

  function draw() {
    const crowd = [];
    for (let i = 0; i < 90; i++) {                      // little dots of fans in the bleachers
      const t = -0.78 + (1.56 * i) / 89, r = 222 + (i % 3) * 7;
      crowd.push(`<circle cx="${(HOME.x + r * Math.sin(t)).toFixed(1)}" cy="${(HOME.y - r * Math.cos(t)).toFixed(1)}" r="2.2" class="fan-dot d${i % 5}"/>`);
    }
    svg.innerHTML = `
      <defs>
        <radialGradient id="hf-grass" cx="50%" cy="95%" r="90%"><stop offset="0" stop-color="#3f8a55"/><stop offset="1" stop-color="#1d4d31"/></radialGradient>
        <pattern id="hf-mow" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="13" height="26" fill="rgba(255,255,255,0.06)"/></pattern>
        <radialGradient id="hf-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="rgba(255,238,200,0.35)"/><stop offset="1" stop-color="rgba(255,238,200,0)"/></radialGradient>
      </defs>
      <!-- light towers with a soft glow -->
      ${[[34, 60], [366, 60]].map(([x, y]) => `
        <ellipse cx="${x}" cy="${y}" rx="46" ry="30" fill="url(#hf-glow)"/>
        <path d="M${x} ${y + 4} V${y + 70}" class="tower"/>
        <rect x="${x - 12}" y="${y - 7}" width="24" height="11" rx="2" class="lamps"/>
        ${[-8, -3, 2, 7].map((dx) => `<circle cx="${x + dx}" cy="${y - 1.5}" r="1.8" class="bulb"/>`).join("")}`).join("")}
      <!-- bleachers + crowd -->
      <path d="${wedge(214, 244)}" class="stands"/>
      ${crowd.join("")}
      <!-- outfield, warning track, wall -->
      <path d="${wedge(0, 214)}" fill="url(#hf-grass)"/>
      <path d="${wedge(0, 214)}" fill="url(#hf-mow)"/>
      <path d="${wedge(R.triple - 10, R.triple + 8)}" class="track"/>
      <path d="${arc(214)}" class="wall"/>
      <!-- zones (highlight on hover) -->
      <path d="${wedge(24, R.single)}" class="zone" data-z="B1"/>
      <path d="${wedge(R.single, R.double)}" class="zone" data-z="B2"/>
      <path d="${wedge(R.double, R.triple + 8)}" class="zone" data-z="B3"/>
      <path d="${wedge(R.triple + 8, 244)}" class="zone" data-z="HR"/>
      <path d="${arc(R.single)}" class="ring"/><path d="${arc(R.double)}" class="ring"/>
      <!-- infield -->
      <path d="M${HOME.x} ${HOME.y + 8} L${HOME.x - 76} ${HOME.y - 68} A106 106 0 0 1 ${HOME.x + 76} ${HOME.y - 68} Z" class="dirt"/>
      <path d="M${HOME.x} ${HOME.y - 10} L${HOME.x - 48} ${HOME.y - 58} L${HOME.x} ${HOME.y - 106} L${HOME.x + 48} ${HOME.y - 58} Z" class="infield-grass"/>
      <path d="M${HOME.x} ${HOME.y} L${HOME.x - 150} ${HOME.y - 150} M${HOME.x} ${HOME.y} L${HOME.x + 150} ${HOME.y - 150}" class="chalk"/>
      <path d="M${HOME.x} ${HOME.y} L${HOME.x - 52} ${HOME.y - 52} L${HOME.x} ${HOME.y - 104} L${HOME.x + 52} ${HOME.y - 52} Z" class="paths"/>
      <circle cx="${HOME.x}" cy="${HOME.y - 56}" r="9" class="mound"/>
      <!-- dugouts, batter's boxes, on-deck circles -->
      <rect x="${HOME.x - 118}" y="${HOME.y - 44}" width="40" height="10" rx="3" transform="rotate(-45 ${HOME.x - 98} ${HOME.y - 39})" class="dugout"/>
      <rect x="${HOME.x + 78}" y="${HOME.y - 44}" width="40" height="10" rx="3" transform="rotate(45 ${HOME.x + 98} ${HOME.y - 39})" class="dugout"/>
      <rect x="${HOME.x - 15}" y="${HOME.y - 9}" width="9" height="14" class="box"/><rect x="${HOME.x + 6}" y="${HOME.y - 9}" width="9" height="14" class="box"/>
      <circle cx="${HOME.x - 40}" cy="${HOME.y + 4}" r="4" class="ondeck"/><circle cx="${HOME.x + 40}" cy="${HOME.y + 4}" r="4" class="ondeck"/>
      <rect x="${HOME.x - 5}" y="${HOME.y - 57}" width="10" height="2.5" class="rubber"/>
      <!-- foul poles -->
      <path d="M${HOME.x - 151} ${HOME.y - 151} v-24 M${HOME.x + 151} ${HOME.y - 151} v-24" class="pole"/>
      <!-- bases -->
      <rect id="hf-b1" x="${HOME.x + 47}" y="${HOME.y - 57}" width="10" height="10" transform="rotate(45 ${HOME.x + 52} ${HOME.y - 52})" class="base"/>
      <rect id="hf-b2" x="${HOME.x - 5}" y="${HOME.y - 109}" width="10" height="10" transform="rotate(45 ${HOME.x} ${HOME.y - 104})" class="base"/>
      <rect id="hf-b3" x="${HOME.x - 57}" y="${HOME.y - 57}" width="10" height="10" transform="rotate(45 ${HOME.x - 52} ${HOME.y - 52})" class="base"/>
      <path id="hf-home" d="M${HOME.x - 6} ${HOME.y - 3} h12 v5 l-6 5 l-6 -5 z" class="base"/>
      <!-- distance markers on the wall -->
      <text x="${HOME.x - 118}" y="${HOME.y - 150}" class="dist" text-anchor="middle">330</text>
      <text x="${HOME.x}" y="${HOME.y - 199}" class="dist" text-anchor="middle">400</text>
      <text x="${HOME.x + 118}" y="${HOME.y - 150}" class="dist" text-anchor="middle">330</text>
      <!-- zone labels (filled in by update) -->
      <g class="zlabel" data-z="B1"><text x="${HOME.x + 50}" y="${HOME.y - 98}" text-anchor="middle"><tspan class="zn">1B</tspan> <tspan class="zp" id="hf-p-B1">–</tspan></text></g>
      <g class="zlabel" data-z="B2"><text x="${HOME.x - 80}" y="${HOME.y - 118}" text-anchor="middle"><tspan class="zn">2B</tspan> <tspan class="zp" id="hf-p-B2">–</tspan></text></g>
      <g class="zlabel" data-z="B3"><text x="${HOME.x + 98}" y="${HOME.y - 160}" text-anchor="middle"><tspan class="zn">3B</tspan> <tspan class="zp" id="hf-p-B3">–</tspan></text></g>
      <g class="zlabel" data-z="HR"><text x="${HOME.x}" y="${HOME.y - 250}" text-anchor="middle"><tspan class="zn">HR</tspan> <tspan class="zp" id="hf-p-HR">–</tspan></text></g>
      <!-- ball flight -->
      <ellipse id="hf-shadow" rx="4" ry="1.8" class="ball-shadow" opacity="0"/>
      <circle id="hf-ball" r="4" class="ball" opacity="0"/>
      <g id="hf-burst-pos"><g id="hf-burst" opacity="0"></g></g>`;

    // Hovering a label or zone highlights that zone.
    svg.querySelectorAll("[data-z]").forEach((el) => {
      const z = el.dataset.z;
      el.addEventListener("mouseenter", () => svg.querySelector(`.zone[data-z="${z}"]`).classList.add("hot"));
      el.addEventListener("mouseleave", () => svg.querySelector(`.zone[data-z="${z}"]`).classList.remove("hot"));
    });
    svg.addEventListener("click", (e) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX; pt.y = e.clientY;
      const p = pt.matrixTransform(svg.getScreenCTM().inverse());
      hit(p.x, p.y);
    });
  }

  function classify(x, y) {
    const dx = x - HOME.x, dy = HOME.y - y;
    const d = Math.hypot(dx, dy);
    const angle = Math.atan2(dx, dy);            // 0 = straight to center field
    if (dy <= 0 || Math.abs(angle) > Math.PI / 4 + 0.02) return null;   // foul ball
    if (d < R.single) return ZONES[0];
    if (d < R.double) return ZONES[1];
    if (d < R.triple + 8) return ZONES[2];
    return ZONES[3];
  }

  function hit(x, y) {
    if (busy) return;
    busy = true;
    const zone = classify(x, y);
    const ball = svg.getElementById("hf-ball"), shadow = svg.getElementById("hf-shadow");
    const d = Math.hypot(x - HOME.x, y - HOME.y);
    const peak = Math.min(120, 30 + d * 0.45);   // longer hits fly higher
    const t0 = performance.now(), dur = 450 + d * 2.4;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    svg.querySelectorAll(".base").forEach((b) => b.classList.remove("lit"));

    function frame(t) {
      const k = reduce ? 1 : Math.min(1, (t - t0) / dur);
      const gx = HOME.x + (x - HOME.x) * k, gy = HOME.y + (y - HOME.y) * k;
      const h = 4 * peak * k * (1 - k);
      ball.setAttribute("cx", gx); ball.setAttribute("cy", gy - h);
      ball.setAttribute("r", 3.5 + h / 30);
      shadow.setAttribute("cx", gx); shadow.setAttribute("cy", gy);
      ball.setAttribute("opacity", 1); shadow.setAttribute("opacity", 0.5);
      if (k < 1) requestAnimationFrame(frame);
      else land(x, y, zone);
    }
    requestAnimationFrame(frame);
  }

  function land(x, y, zone) {
    const burst = svg.getElementById("hf-burst");
    svg.getElementById("hf-burst-pos").setAttribute("transform", `translate(${x} ${y})`);
    const color = zone ? (zone.key === "HR" ? "#e3b45f" : "#f4efe2") : "#f2878b";
    burst.innerHTML = Array.from({ length: 10 }, (_, i) =>
      `<path d="M0 -6 V-${zone && zone.key === "HR" ? 20 : 12}" stroke="${color}" transform="rotate(${i * 36})"/>`).join("");
    burst.classList.remove("pop"); void burst.getBBox(); burst.classList.add("pop");

    if (!zone) {
      say("Foul ball! Try hitting it between the white foul lines.");
    } else {
      svg.getElementById("hf-" + zone.base).classList.add("lit");
      if (counts && counts.H > 0) {
        const n = counts[zone.key], share = n / counts.H;
        say(`${zone.name.toUpperCase()}${zone.key === "HR" ? "!" : ""} ${zone.plural} are ${fmtPct(share)} of hits in this view (${fmtInt(n)} of ${fmtInt(counts.H)}).`);
      } else {
        say(`${zone.name}! No hits match the current filters.`);
      }
    }
    setTimeout(() => {
      svg.getElementById("hf-ball").setAttribute("opacity", 0);
      svg.getElementById("hf-shadow").setAttribute("opacity", 0);
      busy = false;
    }, 700);
  }

  function say(text) {
    callout.textContent = text;
    callout.classList.remove("flash"); void callout.offsetWidth; callout.classList.add("flash");
  }

  window.HitField = {
    init(svgEl, calloutEl, swingBtn) {
      svg = svgEl; callout = calloutEl;
      draw();
      swingBtn.addEventListener("click", () => {
        // A random fair ball, weighted a little toward shorter hits.
        const ang = (Math.random() - 0.5) * (Math.PI / 2) * 0.95;
        const d = 60 + Math.pow(Math.random(), 0.8) * 180;
        hit(HOME.x + d * Math.sin(ang), HOME.y - d * Math.cos(ang));
      });
    },
    // counts = { H, B1, B2, B3, HR } for the rows that pass the current filters
    update(c) {
      counts = c;
      ZONES.forEach((z) => {
        const el = document.getElementById("hf-p-" + z.key);
        if (el) el.textContent = c.H > 0 ? fmtPct(c[z.key] / c.H) : "–";
      });
    },
  };
})();
