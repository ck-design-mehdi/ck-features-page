/* ---------------- hero visual variants ---------------- */
const HV = document.getElementById("heroVisual");
let hvToken = 0, hvUpdate = null;
const wait = ms => new Promise(r => setTimeout(r, ms));
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const CURSOR = name => `<div class="cursor"><svg viewBox="0 0 18 18"><path d="M2 1.5l13 6.2-5.6 1.6L7 15z" fill="#202020" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round"/></svg><b>${name}</b></div>`;
function moveCursor(cur, host, target, dx = 0.8, dy = 0.5) {
  const h = host.getBoundingClientRect(), t = target.getBoundingClientRect();
  cur.style.transform = `translate(${t.left - h.left + t.width * dx}px, ${t.top - h.top + t.height * dy}px)`;
}

/* tools shown in the "workspace" variants */
const TOOLS = [
  { n: "Inbox", i: "inbox", d: "Notifications for the work you follow", keep: true },
  { n: "My Tasks", i: "task", d: "Everything assigned to you", keep: true },
  { n: "Chat", i: "chatView", d: "Channels and DMs next to your work", keep: true },
  { n: "Docs", i: "doc", d: "Wikis, notes and specs", keep: true },
  { n: "Dashboards", i: "dashboard", d: "Live reporting cards" },
  { n: "Whiteboards", i: "whiteboards", d: "Brainstorm on an infinite canvas" },
  { n: "Goals", i: "goals", d: "Targets tracked from task progress" },
  { n: "Timesheets", i: "timesheetView", d: "Weekly tracked time and approvals" },
  { n: "Sprints", i: "sprint", d: "Agile sprints with points and burndown", keep: true },
  { n: "Clips", i: "video", d: "Screen recordings with transcripts" },
  { n: "Forms", i: "formView", d: "Intake forms that create tasks" },
];
const rail = () => `<div class="rail">${[["Home", "inbox", 1], ["Spaces", "space"], ["Chat", "chatView"], ["Brain", "brainMemory"], ["Apps", "everything"]].map(([l, i, on]) => `<span class="${on ? "is-on" : ""}">${icon(i)}${l}</span>`).join("")}</div>`;
const sideItem = (t, extra = "") => `<div class="side__item" data-tool="${t.n}">${icon(t.i)}${t.n}${extra}</div>`;

/* V1 — Toggles: a teammate turns tools off, the sidebar tidies itself */
function vToggles(el, tok) {
  el.innerHTML = `<div class="card hv-card pt"><div class="win">
    ${rail()}
    <div class="side"><div class="side__ws"><i></i>Acme Inc.</div><div class="side__label">Home</div>${TOOLS.map(t => sideItem(t)).join("")}</div>
    <div class="tg">
      <div class="tg__head"><b>Customize your Workspace</b><span>Turn on what your team uses. Everything else stays out of the way.</span></div>
      ${TOOLS.slice(2).map(t => `<div class="tg__row" data-tool="${t.n}"><span class="tg__ico">${icon(t.i)}</span><span class="tg__txt"><b>${t.n}</b><span>${t.d}</span></span><span class="sw"></span></div>`).join("")}
    </div>
  </div>${CURSOR("Maya")}</div>`;
  const host = el.querySelector(".hv-card"), cur = el.querySelector(".cursor");
  const off = TOOLS.filter(t => !t.keep).map(t => t.n);
  const set = (name, on) => {
    el.querySelector(`.tg__row[data-tool="${name}"] .sw`).classList.toggle("is-off", !on);
    el.querySelector(`.side__item[data-tool="${name}"]`).classList.toggle("is-off", !on);
  };
  if (REDUCED) { off.forEach(n => set(n, false)); cur.remove(); return; }
  cur.style.transform = "translate(70%, 60%)";
  (async () => {
    await wait(900);
    while (tok === hvToken) {
      for (const n of off) {
        const sw = el.querySelector(`.tg__row[data-tool="${n}"] .sw`);
        if (!sw || tok !== hvToken) return;
        moveCursor(cur, host, sw); await wait(820);
        cur.classList.add("is-press"); await wait(140); set(n, false); cur.classList.remove("is-press");
        await wait(520);
      }
      await wait(2600);
      if (tok !== hvToken) return;
      off.forEach(n => set(n, true)); // reset quietly, then loop
      await wait(1400);
    }
  })();
}

/* V2 — Feature wall: every icon is a feature; search and plan filters light up the matches */
function vWall(el, tok) {
  const step = Math.max(1, Math.floor(live.length / 220));
  const tiles = live.filter((_, i) => i % step === 0).slice(0, 220);
  el.innerHTML = `<div class="card hv-card hv-wall pt">
    <div class="wall">${tiles.map(f => `<button class="wt" type="button" data-open="${f.id}" title="${esc(f.feature)}" tabindex="-1">${icon(f.icon_resolved)}</button>`).join("")}</div>
    <div class="wall__q">${icon("search")}<b></b><em></em></div></div>`;
  const card = el.querySelector(".hv-wall"), q = el.querySelector(".wall__q b"), cnt = el.querySelector(".wall__q em");
  const btns = [...el.querySelectorAll(".wt")];
  const show = (query, plan) => {
    const ql = query.toLowerCase();
    const hit = f => (plan === "all" || f.plans.includes(plan)) && (!ql || f._hay.includes(ql));
    const filtering = !!ql || plan !== "all";
    card.classList.toggle("is-filtering", filtering);
    btns.forEach((b, i) => b.classList.toggle("is-hit", filtering && hit(tiles[i])));
    q.textContent = query;
    const n = live.filter(hit).length;
    cnt.textContent = `${n} ${n === 1 ? "feature" : "features"}`;
  };
  let demo = true;
  hvUpdate = () => {
    demo = !state.q && state.plan === "all";
    if (!demo) show(state.q, state.plan);
  };
  show("", "all");
  if (REDUCED) return;
  (async () => {
    const qs = ["brain", "time", "chat", "dashboard", "automation", ""];
    let k = 0;
    await wait(1200);
    while (tok === hvToken) {
      if (demo) {
        const word = qs[k++ % qs.length];
        for (let c = 1; c <= word.length && demo && tok === hvToken; c++) { show(word.slice(0, c), "all"); await wait(90); }
        if (!word) show("", "all");
      }
      await wait(2200);
    }
  })();
}

/* V3 — Before / After */
function vBeforeAfter(el) {
  const busy = [...TOOLS, { n: "Portfolios", i: "folder" }, { n: "Mind Maps", i: "mindMapView" }, { n: "Automations", i: "automations" }, { n: "Templates", i: "templates" }, { n: "Integrations", i: "connections" }];
  const badge = ["3", "", "12", "", "", "", "1", "", "", "5", "", "", "", "2", "", ""];
  el.innerHTML = `<div class="og ba">
    <div class="cell ba__before"><span class="mono-xs eyebrow gray" style="text-align:center">Before · ${live.length} features</span>
      <div class="ba__crop pt"><div class="ba__side"><div class="side__ws"><i></i>Acme Inc.</div>${busy.map((t, i) => sideItem(t, badge[i] ? `<small>${badge[i]}</small>` : "")).join("")}</div></div>
      <div class="ba__text"><b class="text-md semibold">Every tool, all at once</b><p class="text-sm">Menus full of things your team never opens.</p></div></div>
    <div class="cell ba__after"><span class="mono-xs eyebrow" style="text-align:center">After · ${TOOLS.filter(t => t.keep).length} you use</span>
      <div class="ba__crop pt"><div class="ba__side"><div class="side__ws"><i></i>Acme Inc.</div>${TOOLS.filter(t => t.keep).map((t, i) => sideItem(t).replace('class="side__item"', i === 1 ? 'class="side__item is-on"' : 'class="side__item"')).join("")}</div></div>
      <div class="ba__text"><b class="text-md semibold">Only what your team needs</b><p class="text-sm">Turn on what you use and hide everything else.</p></div></div>
  </div>`;
  const g = el.querySelector(".ba"); grids.add(g); lineUp(g);
}

/* V4 — Command bar: ClickUp search showing real results */
function vSearch(el, tok) {
  el.innerHTML = `<div class="card hv-card pt"><div class="cmd">
    <div class="cmd__in">${icon("search")}<b></b><kbd>esc</kbd></div>
    <div class="cmd__tabs"><span class="is-on">All</span><span>Features</span><span>Categories</span><span>Coming soon</span></div>
    <div class="cmd__list"></div>
    <div class="cmd__foot"><span>↑↓ to navigate</span><span>↵ to open</span><span style="margin-left:auto" class="cmd__n"></span></div>
  </div></div>`;
  const qEl = el.querySelector(".cmd__in b"), list = el.querySelector(".cmd__list"), nEl = el.querySelector(".cmd__n");
  const show = (query, plan, typing) => {
    const ql = query.toLowerCase();
    const res = live.filter(f => (plan === "all" || f.plans.includes(plan)) && (!ql || f._hay.includes(ql)));
    const rank = f => (f.feature.toLowerCase().startsWith(ql) ? 0 : f.feature.toLowerCase().includes(ql) ? 1 : 2) + (f.parent ? .5 : 0);
    const top = ql ? [...res].sort((a, b) => rank(a) - rank(b)).slice(0, 5) : res.filter(f => !f.parent).slice(0, 5);
    qEl.innerHTML = hl(query, "") + (typing ? '<span class="caret"></span>' : "");
    list.innerHTML = top.length ? top.map((f, i) => `<button class="cmd__row" type="button" data-open="${f.id}" style="animation-delay:${i * 30}ms"><span class="ic">${icon(f.icon_resolved)}</span><span class="t"><b>${hl(f.feature, query)}</b><span>${esc(catById.get(f.category).name)} · ${esc(f.surface)}</span></span>${minPlan(f) ? `<span class="pl">${minPlan(f)}</span>` : ""}</button>`).join("")
      : `<div class="cmd__empty">No feature matches “${esc(query)}”</div>`;
    nEl.textContent = `${res.length} results`;
  };
  let demo = true;
  hvUpdate = () => {
    demo = !state.q && state.plan === "all";
    if (!demo) show(state.q, state.plan, false);
  };
  show("", "all", false);
  if (REDUCED) return;
  (async () => {
    const qs = ["time track", "brain", "sprint", "permissions", "whiteboard"];
    let k = 0;
    await wait(1000);
    while (tok === hvToken) {
      if (demo) {
        const word = qs[k++ % qs.length];
        for (let c = 1; c <= word.length && demo && tok === hvToken; c++) { show(word.slice(0, c), "all", true); await wait(85); }
        if (demo && tok === hvToken) show(word, "all", false);
      }
      await wait(2600);
    }
  })();
}

const VARIANTS = [
  { id: "toggles", label: "1 · Toggles", render: vToggles },
  { id: "wall", label: "2 · Feature wall", render: vWall },
  { id: "before-after", label: "3 · Before / After", render: vBeforeAfter },
  { id: "search", label: "4 · Command bar", render: vSearch },
];
function setVariant(id) {
  const v = VARIANTS.find(x => x.id === id) || VARIANTS[0];
  hvToken++; hvUpdate = null;
  HV.querySelectorAll(".og").forEach(g => grids.delete(g));
  v.render(HV, hvToken);
  hvUpdate && hvUpdate();
  const u = new URL(location.href); u.searchParams.set("v", v.id); history.replaceState(null, "", u);
  document.querySelectorAll(".vswitch .pill").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === v.id));
}
if (location.port) { // review tool, only on the dev server
  document.body.insertAdjacentHTML("beforeend", `<div class="vswitch text-sm medium" role="group" aria-label="Hero visual variant"><span>Hero visual</span>${VARIANTS.map(v => `<button class="pill text-sm medium" type="button" data-v="${v.id}" aria-pressed="false">${v.label}</button>`).join("")}</div>`);
  document.querySelector(".vswitch").addEventListener("click", e => { const b = e.target.closest(".pill"); if (b) setVariant(b.dataset.v); });
}
setVariant(new URLSearchParams(location.search).get("v") || "toggles");
