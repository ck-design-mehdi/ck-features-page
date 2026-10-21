"""Build index.html from src/template.html + data/ + assets/.

Dev build by default (includes React Grab + live reload client). Pass --prod to leave it out.
"""
import json, re, sys, urllib.parse
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
cats = json.loads((R / "data/categories.json").read_text())
feats = json.loads((R / "data/features.json").read_text())

KEEP = ["id", "category", "surface", "feature", "description", "plans", "plan_values", "icon_resolved",
        "status", "docs_url", "link", "parent", "tags", "limits", "summary", "coming_soon"]
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
    "__CATS__": json.dumps(cats, separators=(",", ":")),
    "__FEATURES__": json.dumps(slim, separators=(",", ":")).replace("</", "<\\/"),
    "__TOTAL__": str(len(live)),
    "__SOON__": str(len(feats) - len(live)),
    "__AREAS__": {15: "Fifteen"}.get(len({c["area"]["id"] for c in cats}), str(len({c["area"]["id"] for c in cats}))),
}.items():
    out = out.replace(k, v)
(R / "index.html").write_text(out)
print(f"index.html ({'prod' if PROD else 'dev'}) {len(out)//1024} KB · {len(live)} live · {len(syms)} icons")
