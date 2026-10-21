/* ---------------- hero: features on a curved surface ---------------- */
let cylUpdate = null;
(function curvedHero() {
  const host = document.querySelector(".hero__bg"), cyl = document.getElementById("cyl");
  // open-grid cells (Homepage 4.0 "Feature Box"): icon above the name, 1px lines
  const SMALL = matchMedia("(max-width: 760px)").matches;
  const CW = SMALL ? 120 : 164, CH = SMALL ? 112 : 148;
  const ROWS = Math.ceil((host.clientHeight || 760) / CH) + 1;
  const SPEED = 16; // px/s, one direction for every row so the grid stays aligned
  const CA_MAX = 2.5; // px of RGB split at the very edge
  const FLARE = 0.55, STRETCH = 0.18, SKEW = 14; // edge warp: share of the row offset pushed out, vertical stretch, max tilt (deg)
  const smooth = (a, b, v) => { const k = Math.min(1, Math.max(0, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
  // spread every shipped feature across the rows, mixing categories so neighbours differ
  const pool = [...live].sort((a, b) => (a.id.length * 7 + a.feature.length * 13) % 97 - (b.id.length * 7 + b.feature.length * 13) % 97);
  const rows = Array.from({ length: ROWS }, (_, r) => ({ items: pool.filter((_, i) => i % ROWS === r), off: 0 }));
  cyl.innerHTML = rows.map((r, ri) => `<div class="crow" data-r="${ri}">${r.items.map(f => `<button class="chip" type="button" data-open="${f.id}" tabindex="-1" style="width:${CW}px;height:${CH}px">${icon(f.icon_resolved)}<span>${esc(f.feature)}</span></button>`).join("")}</div>`).join("");
  const rowEls = [...cyl.querySelectorAll(".crow")];
  let W, H, R, LIM;

  function layout() {
    W = host.clientWidth; H = host.clientHeight;
    // size the cylinder so its projected edge lands at the screen edge:
    // projected x of the rim = R * P / (P + R)  ->  R = a * P / (P - a)
    const a = W * 0.53, P = Math.max(1500, a * 2.1);
    R = a * P / (P - a);
    host.style.perspective = `${P}px`;
    LIM = Math.PI / 2 * 0.98;               // show the front half of the cylinder
    const top0 = (H - ROWS * CH) / 2;
    rowEls.forEach((el, ri) => {
      el.style.top = `${top0 + ri * CH}px`;
      const r = rows[ri];
      r.chips = [...el.children].map((c, i) => ({ el: c, x: i * CW, w: CW, vis: false }));
      r.len = r.chips.length * CW;
      r.dy = top0 + ri * CH + CH / 2 - H / 2; // row centre relative to the middle of the hero
    });
  }

  function frame(dt) {
    rows.forEach(r => {
      r.off = (r.off + SPEED * dt) % r.len;
      for (const c of r.chips) {
        let s = (c.x + c.w / 2 + r.off) % r.len;   // centre of the chip along the row
        if (s > r.len / 2) s -= r.len;             // -> [-len/2, len/2), 0 = middle of the screen
        const th = s / R;
        const on = Math.abs(th) < LIM;
        if (on !== c.vis) { c.el.style.visibility = on ? "visible" : "hidden"; c.vis = on; }
        if (!on) continue;
        const x = R * Math.sin(th), z = R * (Math.cos(th) - 1);
        // "sucked into the corners": near the rim, rows are pulled toward the vertical centre and squeezed
        const t = Math.abs(th) / LIM, edge = smooth(0.22, 0.95, t);
        // flare toward the corners: rows above the middle bend up, rows below bend down, cells stretch
        const pull = r.dy * FLARE * edge * edge, sy = 1 + STRETCH * edge * edge;
        // tilt each cell along the flare so the grid lines curve out to the corners
        const skew = Math.sign(th) * (r.dy / (H / 2)) * SKEW * edge;
        c.el.style.transform = `translate3d(${(x - c.w / 2).toFixed(1)}px,${pull.toFixed(1)}px,${z.toFixed(1)}px) rotateY(${th.toFixed(4)}rad) skewY(${skew.toFixed(2)}deg) scaleY(${sy.toFixed(3)})`;
        // faint chromatic aberration, only on the sides
        const ca = Math.round(smooth(0.55, 1, t) * CA_MAX * 4) / 4 * Math.sign(th);
        if (ca !== c.ca) { c.el.style.setProperty("--ca", ca); c.ca = ca; }
      }
    });
  }

  layout(); frame(0);
  let last = performance.now(), running = true, paused = false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const loop = t => {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (!paused) frame(dt);
    if (running) requestAnimationFrame(loop);
  };
  if (!reduced) requestAnimationFrame(loop);
  // only animate while the hero is on screen
  new IntersectionObserver(([e]) => { running = e.isIntersecting && !reduced; if (running) { last = performance.now(); requestAnimationFrame(loop); } }).observe(host);
  host.addEventListener("pointerover", e => { paused = !!e.target.closest(".chip"); });
  host.addEventListener("pointerleave", () => { paused = false; });
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { layout(); frame(0); }, 150); });

  // search + plan filters light up the matching features in the stream
  cylUpdate = () => {
    const ql = state.q.toLowerCase();
    const filtering = !!ql || state.plan !== "all";
    host.classList.toggle("is-filtering", filtering);
    if (!filtering) return;
    rows.forEach(r => r.chips.forEach(c => {
      const f = byId.get(c.el.dataset.open);
      c.el.classList.toggle("is-hit", (state.plan === "all" || f.plans.includes(state.plan)) && (!ql || f._hay.includes(ql)));
    }));
  };
})();
