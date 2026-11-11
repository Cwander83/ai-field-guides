#!/usr/bin/env zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
REPO_ROOT="${REPO_ROOT_OVERRIDE:-${SCRIPT_DIR:h}}"
CATALOG_PATH="${CATALOG_FILE:-$REPO_ROOT/catalog.json}"
README_PATH="$REPO_ROOT/README.md"
CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/build.sh <guide-id> [--version <X.Y>]   Rebuild one guide PDF, cover.png, QA previews, and sync README.md
  ./scripts/build.sh --all                          Rebuild every guide in catalog.json and sync README.md
  ./scripts/build.sh --covers-and-readme            Generate cover.png from existing PDFs and sync README.md
  ./scripts/build.sh --readme-only                  Sync README.md from catalog.json without rendering PDFs
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

if [[ "$1" == "--help" || "$1" == "-h" ]]; then
  usage
  exit 0
fi

if [[ "$1" == "--readme-only" ]]; then
  python3 "$SCRIPT_DIR/sync_readme.py" --catalog "$CATALOG_PATH" --readme "$README_PATH"
  exit 0
fi

if [[ "$1" == "--covers-and-readme" ]]; then
  python3 - "$REPO_ROOT" "$CATALOG_PATH" "$SCRIPT_DIR/render_pages.swift" <<'PY'
import json
import subprocess
import sys
from pathlib import Path

repo_root = Path(sys.argv[1])
catalog_path = Path(sys.argv[2])
swift_script = Path(sys.argv[3])

catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
for g in catalog.get("guides", []):
    pdf_path = repo_root / g["pdf"]
    cover_path = repo_root / g["cover"]
    preview_dir = repo_root / g["source_dir"] / "preview_pages"
    if not pdf_path.exists():
        raise SystemExit(f"Missing PDF for {g['id']}: {pdf_path}")
    out = subprocess.check_output(
        ["swift", str(swift_script), str(pdf_path), str(preview_dir), "--cover-out", str(cover_path), "--cover-only"],
        text=True,
    )
    print(f"[{g['id']}] {out.strip()}")
    for line in out.splitlines():
        if line.startswith("Total pages:"):
            g["pages"] = int(line.split(":")[1].strip())

catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
PY
  python3 "$SCRIPT_DIR/sync_readme.py" --catalog "$CATALOG_PATH" --readme "$README_PATH"
  exit 0
fi

build_single_guide() {
  local target_id="$1"
  local bump_version="${2:-}"

  local meta
  if ! meta=$(python3 - "$CATALOG_PATH" "$target_id" <<'PY'
import json
import sys
from pathlib import Path

cat = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
target = sys.argv[2]
for g in cat.get("guides", []):
    if g["id"] == target:
        print(f"{g['source_dir']}\t{g['pdf']}\t{g['cover']}")
        sys.exit(0)

valid = ", ".join(g["id"] for g in cat.get("guides", []))
sys.stderr.write(f"Error: Unknown guide ID '{target}'. Valid IDs: {valid}\n")
sys.exit(2)
PY
  ); then
    exit 2
  fi

  local rel_src rel_pdf rel_cover
  IFS=$'\t' read -r rel_src rel_pdf rel_cover <<< "$meta"

  local src_dir="$REPO_ROOT/$rel_src"
  local html_file="$src_dir/guide.html"
  local pdf_file="$REPO_ROOT/$rel_pdf"
  local cover_file="$REPO_ROOT/$rel_cover"
  local preview_dir="$src_dir/preview_pages"

  if [[ ! -f "$html_file" ]]; then
    echo "Error: Missing $html_file" >&2
    exit 1
  fi

  local backtick_count
  backtick_count=$(python3 -c 'import sys; print(open(sys.argv[1], encoding="utf-8").read().count("`"))' "$html_file")
  if [[ "$backtick_count" != "0" ]]; then
    echo "Error: Found $backtick_count raw backtick character(s) in $html_file. Replace with <code>...</code> tags first." >&2
    exit 1
  fi

  echo "==> Rendering PDF for $target_id..."
  "$CHROME_BIN" \
    --headless \
    --disable-gpu \
    --allow-file-access-from-files \
    --no-pdf-header-footer \
    --print-to-pdf="$pdf_file" \
    "file://$html_file"

  echo "==> Rendering cover.png and QA preview pages for $target_id..."
  local render_out
  render_out=$(swift "$SCRIPT_DIR/render_pages.swift" "$pdf_file" "$preview_dir" --cover-out "$cover_file")
  echo "$render_out"

  python3 - "$CATALOG_PATH" "$target_id" "$bump_version" "$render_out" <<'PY'
import datetime
import json
import sys
from pathlib import Path

cat_path = Path(sys.argv[1])
target_id = sys.argv[2]
bump_version = sys.argv[3]
render_out = sys.argv[4]

pages = None
for line in render_out.splitlines():
    if line.startswith("Total pages:"):
        pages = int(line.split(":")[1].strip())

cat = json.loads(cat_path.read_text(encoding="utf-8"))
for g in cat.get("guides", []):
    if g["id"] == target_id:
        if pages is not None:
            g["pages"] = pages
        g["updated"] = datetime.date.today().strftime("%Y-%m")
        if bump_version:
            g["version"] = bump_version
        break

cat_path.write_text(json.dumps(cat, indent=2) + "\n", encoding="utf-8")
PY
}

if [[ "$1" == "--all" ]]; then
  guide_ids=("${(@f)$(python3 -c 'import json,sys; print("\n".join(g["id"] for g in json.load(open(sys.argv[1]))["guides"]))' "$CATALOG_PATH")}")
  for gid in "${guide_ids[@]}"; do
    build_single_guide "$gid" ""
  done
  python3 "$SCRIPT_DIR/sync_readme.py" --catalog "$CATALOG_PATH" --readme "$README_PATH"
  exit 0
fi

TARGET_GUIDE_ID="$1"
BUMP_VERSION=""
if [[ "${2:-}" == "--version" ]]; then
  if [[ -z "${3:-}" ]]; then
    echo "Error: --version requires a value (e.g. --version 1.1)" >&2
    exit 1
  fi
  BUMP_VERSION="$3"
fi

build_single_guide "$TARGET_GUIDE_ID" "$BUMP_VERSION"
if [[ -f "$README_PATH" ]]; then
  python3 "$SCRIPT_DIR/sync_readme.py" --catalog "$CATALOG_PATH" --readme "$README_PATH"
fi
