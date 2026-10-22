"""Build index.html from src/template.html + data/ + assets/.

Data: data/rollup.json (the landing features dataset; `--fetch` refreshes it).

Dev build by default (includes React Grab + live reload client). Pass --prod to leave it out.
"""
import base64, json, re, sys, urllib.parse
from pathlib import Path

R = Path(__file__).parent
PROD = "--prod" in sys.argv
LIVERELOAD = """<script>(() => {
  if (!location.port) return; // only when served by dev.py
  let v = null;
  const es = new EventSource("/__livereload");
  es.onmessage = e => { if (v === null) v = e.data; else if (e.data !== v) location.reload(); };
})();</script>"""
DEVTOOLS = "" if PROD else '<script src="https://unpkg.com/react-grab@0.2.0/dist/index.global.js" crossorigin="anonymous"></script>' + LIVERELOAD
ROLLUP_URL = "https://staging-landing.clickup.com/_edge/v1/datasets/features/rollup"
if "--fetch" in sys.argv:  # refresh data/rollup.json from the landing dataset
    import urllib.request
    with urllib.request.urlopen(ROLLUP_URL, timeout=60) as r:
        (R / "data/rollup.json").write_bytes(r.read())
rollup = json.loads((R / "data/rollup.json").read_text())
cats, feats = rollup["categories"], rollup["features"]
# the dataset has no per-feature icon: reuse the ones from the original page, else the category icon
ICONS = json.loads((R / "data/feature-icons.json").read_text())
cat_icon = {c["id"]: c["icon"] for c in cats}
for f in feats:
    f["icon_resolved"] = ICONS.get(f["id"]) or cat_icon[f["category"]]
# off the page for now: pricing and plans (that category, paid add-ons and every plan field), and unreleased features
HIDDEN = {"billing-and-plans"}
cats = [c for c in cats if c["id"] not in HIDDEN]
feats = [f for f in feats if f["category"] not in HIDDEN and f["status"] != "coming_soon" and "pricing" not in [t.lower() for t in f.get("tags") or []]]

KEEP = ["id", "category", "surface", "feature", "description", "icon_resolved",
        "status", "docs_url", "link", "parent", "tags", "summary"]
slim = [{k: f[k] for k in KEEP if k in f} for f in feats]

# icon sprite: only the symbols the page references
UI = {"closeSmall", "chevronLeft", "chevronRight", "arrowRight", "arrowUpRight", "search", "send",
      "attachment", "skillSparkle", "circleCheck", "listView", "boardView", "calendarView", "dashboard"}
used = {f["icon_resolved"] for f in feats} | {c["icon"] for c in cats} | UI
sprite = (R / "assets/icons-all.svg").read_text()
# feature-specific icons (ftr*) only when used; every generic UI icon ships so the page code can use any of them
syms = [s for s in re.findall(r"<symbol[\s\S]*?</symbol>", sprite)
        if (n := re.search(r'id="cu3-icon-([a-zA-Z0-9]+)"', s).group(1)) in used or not n.startswith("ftr")]
missing = used - {re.search(r'id="cu3-icon-([a-zA-Z0-9]+)"', s).group(1) for s in syms}
assert not missing, missing
sprite_out = ('<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">'
              + "".join(syms) + "</svg>")

marker = (R / "assets/grid-marker.svg").read_text().strip()
marker_uri = "data:image/svg+xml," + urllib.parse.quote(marker, safe=" =:/;,'")

live = [f for f in feats if f["status"] != "coming_soon"]
out = (R / "src/template.html").read_text()
for k, v in {
    "__DEVTOOLS__": DEVTOOLS,
    "/*__HVCSS__*/": (R / "src/hero-curved.css").read_text(),
    "/*__HVJS__*/": (R / "src/hero-curved.js").read_text(),
    "/*__SEARCHCSS__*/": (R / "src/search.css").read_text(),
    "/*__SEARCHJS__*/": (R / "src/search.js").read_text(),
    "/*__BASECSS__*/": (R / "assets/clickup-base.css").read_text(),
    "__SPRITE__": sprite_out,
    "__LOGO__": (R / "assets/clickup-logo.svg").read_text().strip(),
    "__MARKER__": marker_uri,
    "__CTAIMG__": "data:image/webp;base64," + base64.b64encode((R / "assets/cta-app.webp").read_bytes()).decode(),
    "__CATS__": json.dumps(cats, separators=(",", ":")),
    "__FEATURES__": json.dumps(slim, separators=(",", ":")).replace("</", "<\\/"),
    "__TOTAL__": str(len(live)),
    "__SOON__": str(len(feats) - len(live)),
    "__AREAS__": {12: "Twelve", 13: "Thirteen", 14: "Fourteen", 15: "Fifteen", 16: "Sixteen"}.get(len({c["area"]["id"] for c in cats}), str(len({c["area"]["id"] for c in cats}))),
}.items():
    out = out.replace(k, v)
(R / "index.html").write_text(out)
print(f"index.html ({'prod' if PROD else 'dev'}) {len(out)//1024} KB · {len(live)} live · {len(syms)} icons")
