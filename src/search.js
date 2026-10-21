/* ---------------- search: inline completion + suggestions ---------------- */
(function searchSuggest() {
  const words = s => s.toLowerCase().split(/[\s\-\/(),.&+]+/).filter(Boolean);
  // lower = better; -1 = no match
  const THIRD_PARTY = new Set(["native-integrations", "imports", "bidirectional-syncs", "extensions"]);
  function score(f, q) {
    const s = baseScore(f, q);
    return s < 0 ? s : s + (THIRD_PARTY.has(f.category) ? 0.4 : 0) + (f.parent ? 0.2 : 0);
  }
  function baseScore(f, q) {
    const n = f.feature.toLowerCase();
    if (n === q) return 0;
    if (words(n).includes(q)) return n.startsWith(q) ? 0.5 : 1.5;   // whole word
    if (n.startsWith(q)) return 1;
    if (words(n).some(w => w.startsWith(q))) return 2;
    if (n.includes(q)) return 3;
    if ((f.tags || []).some(t => t.toLowerCase().startsWith(q))) return 4;
    if (f.surface.toLowerCase().startsWith(q)) return 5;
    if (f._hay.includes(q)) return 6;
    return -1;
  }
  function search(raw) {
    const q = raw.trim().toLowerCase();
    if (!q) return null;
    const inPlan = f => state.plan === "all" || f.plans.includes(state.plan);
    const ranked = live.filter(inPlan).map(f => [score(f, q), f]).filter(x => x[0] >= 0)
      .sort((a, b) => a[0] - b[0] || a[1].feature.length - b[1].feature.length)
      .map(x => x[1]);
    const cats = CATS.filter(c => c.name.toLowerCase().includes(q) || words(c.name).some(w => w.startsWith(q))).slice(0, 3);
    const upcoming = state.plan === "all" ? soon.map(f => [score(f, q), f]).filter(x => x[0] >= 0 && x[0] <= 3).sort((a, b) => a[0] - b[0]).map(x => x[1]).slice(0, 2) : [];
    // inline completion: the best name that starts with what was typed
    const cand = [...ranked.slice(0, 40), ...cats.map(c => ({ feature: c.name }))].map(x => x.feature).find(n => n.toLowerCase().startsWith(q) && n.length > q.length);
    return { q, ranked, cats, upcoming, completion: cand ? cand.slice(raw.trimStart().length) : "" };
  }

  document.querySelectorAll("[data-search]").forEach((label, k) => {
    const input = label.querySelector("input");
    // wrap the input so the ghost text sits exactly under it
    const field = document.createElement("span");
    field.className = "search__field";
    input.replaceWith(field);
    field.append(input);
    field.insertAdjacentHTML("beforeend", `<span class="search__ghost" aria-hidden="true"><b></b><i></i></span>`);
    const ghostTyped = field.querySelector(".search__ghost b"), ghostRest = field.querySelector(".search__ghost i");
    ghostRest.style.fontStyle = "normal";

    const box = document.createElement("div");
    box.className = "sg"; box.id = `sg-${k}`; box.setAttribute("role", "listbox");
    label.parentElement.style.position ||= "relative";
    label.parentElement.append(box);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "both");
    input.setAttribute("aria-controls", box.id);
    input.setAttribute("aria-expanded", "false");

    let items = [], active = -1, res = null;
    const place = () => {
      box.style.left = label.offsetLeft + "px";
      box.style.top = label.offsetTop + label.offsetHeight + 8 + "px";
      box.style.width = Math.min(Math.max(label.offsetWidth, 440), innerWidth - 32) + "px";
    };
    const open = on => { box.classList.toggle("is-open", on); input.setAttribute("aria-expanded", on); if (on) place(); };
    const setGhost = () => {
      const show = res && res.completion && document.activeElement === input && input.selectionStart === input.value.length;
      ghostTyped.textContent = show ? input.value : "";
      ghostRest.textContent = show ? res.completion : "";
    };
    const row = (i, ico, title, meta, end, cat) =>
      `<button class="sg__row" type="button" role="option" id="${box.id}-${i}" data-i="${i}" aria-selected="false" tabindex="-1"${cat ? ` style="${acc(cat)}"` : ""}>
        <span class="sg__ico">${ico}</span><span class="sg__txt"><b class="text-sm">${title}</b><span class="text-xs">${meta}</span></span>
        <span class="sg__end">${end}${icon("arrowRight", "ico-16")}</span></button>`;

    function paint() {
      res = search(input.value);
      items = []; active = -1;
      if (!res) { open(false); setGhost(); return; }
      const raw = input.value.trim();
      let h = "";
      const feats = res.ranked.slice(0, 6);
      if (feats.length) {
        h += `<div class="sg__label text-xs medium">Features</div>`;
        h += feats.map(f => { items.push({ t: "f", id: f.id }); const p = minPlan(f);
          return row(items.length - 1, icon(f.icon_resolved), hl(f.feature, raw), `${esc(catById.get(f.category).name)} · ${esc(f.surface)}`, p ? `<span class="tag">${p}</span>` : "", f.category); }).join("");
      }
      if (res.cats.length) {
        h += `<div class="sg__label text-xs medium">Categories</div>`;
        h += res.cats.map(c => { items.push({ t: "c", id: c.id }); const n = live.filter(f => f.category === c.id && (state.plan === "all" || f.plans.includes(state.plan))).length;
          return row(items.length - 1, icon(c.icon), hl(c.name, raw), `${esc(c.area.name)} · ${n} ${n === 1 ? "feature" : "features"}`, "", c.id); }).join("");
      }
      if (res.upcoming.length) {
        h += `<div class="sg__label text-xs medium">Coming soon</div>`;
        h += res.upcoming.map(f => { items.push({ t: "f", id: f.id });
          return row(items.length - 1, icon(f.icon_resolved), hl(f.feature, raw), esc(catById.get(f.category).name), `<span class="tag tag--accent">Soon</span>`, f.category); }).join("");
      }
      if (res.ranked.length) {
        items.push({ t: "all" });
        h += `<button class="sg__row sg__all" type="button" role="option" id="${box.id}-${items.length - 1}" data-i="${items.length - 1}" aria-selected="false" tabindex="-1">
          <span class="text-sm medium">See all ${res.ranked.length} results for “${esc(raw)}”</span><span class="sg__end">${icon("arrowRight", "ico-16")}</span></button>`;
      }
      if (!items.length) h = `<div class="sg__empty text-sm">No feature matches “${esc(raw)}”. Try another word, or <a href="#build">build it with Brain</a>.</div>`;
      else h = `<div class="sg__hint text-xs"><span><kbd>↑</kbd> <kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span>${res.completion ? `<span><kbd>Tab</kbd> to complete</span>` : ""}<span><kbd>esc</kbd> to close</span></div>` + h;
      box.innerHTML = h;
      open(true);
      select(items.length ? 0 : -1);
      setGhost();
    }
    function select(i) {
      active = i;
      box.querySelectorAll(".sg__row").forEach(r => r.setAttribute("aria-selected", +r.dataset.i === i));
      const el = box.querySelector(`[data-i="${i}"]`);
      if (el) { input.setAttribute("aria-activedescendant", el.id); el.scrollIntoView({ block: "nearest" }); }
      else input.removeAttribute("aria-activedescendant");
    }
    function go(i) {
      const it = items[i]; if (!it) return;
      open(false); setGhost();
      if (it.t === "f") openFeature(it.id, input);
      else if (it.t === "c") { input.blur(); document.getElementById(it.id)?.scrollIntoView({ block: "start" }); }
      else { input.blur(); document.getElementById(visible[0]?.category || "catalog")?.scrollIntoView({ block: "start" }); }
    }
    function complete() {
      if (!res || !res.completion) return false;
      input.value = input.value + res.completion;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }

    input.addEventListener("input", paint);
    input.addEventListener("focus", () => { if (input.value.trim()) paint(); });
    input.addEventListener("keyup", setGhost);
    input.addEventListener("click", setGhost);
    input.addEventListener("keydown", e => {
      const isOpen = box.classList.contains("is-open");
      if (e.key === "ArrowDown" && isOpen && items.length) { e.preventDefault(); select((active + 1) % items.length); }
      else if (e.key === "ArrowUp" && isOpen && items.length) { e.preventDefault(); select((active - 1 + items.length) % items.length); }
      else if (e.key === "Tab" && !e.shiftKey && res && res.completion && input.selectionStart === input.value.length) { e.preventDefault(); complete(); }
      else if (e.key === "ArrowRight" && input.selectionStart === input.value.length && res && res.completion) { e.preventDefault(); complete(); }
      else if (e.key === "Enter") { e.preventDefault(); if (isOpen && active >= 0) go(active); else { input.blur(); document.getElementById(visible[0]?.category || "catalog")?.scrollIntoView({ block: "start" }); } }
      else if (e.key === "Escape") { if (isOpen) { open(false); setGhost(); } else { input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true })); } }
    });
    box.addEventListener("pointermove", e => { const r = e.target.closest(".sg__row"); if (r && +r.dataset.i !== active) select(+r.dataset.i); });
    box.addEventListener("mousedown", e => e.preventDefault()); // keep focus in the input
    box.addEventListener("click", e => { const r = e.target.closest(".sg__row"); if (r) go(+r.dataset.i); });
    input.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== input) { open(false); setGhost(); } }, 120));
    addEventListener("resize", () => box.classList.contains("is-open") && place());
    // the plan filter changes what can be suggested
    document.querySelectorAll("[data-plans]").forEach(g => g.addEventListener("click", () => document.activeElement === input && setTimeout(paint)));
  });
})();
