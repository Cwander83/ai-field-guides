# Project Handoff — `ai-field-guides`

**Repository:** `https://github.com/Cwander83/ai-field-guides` (`public`, branch `main`)  
**Current Library:** 10 visual 12-page handbooks (`120` pages total) under `guides/google/`

---

## 1. Current State (Phase 1 Complete)

1. **10 Google AI Ultra Guides Published (`v1.0`, `2026-11`)**:
   - `google/google-flow` — *Google Flow* (Veo 3.1, Ingredients, Frames-to-Video, Scenebuilder)
   - `google/google-antigravity-and-jules` — *Google Antigravity & Jules* (Agentic IDE, subagents, skills/MCP, async PRs)
   - `google/google-whisk` — *Google Whisk* (Subject + Scene + Style remixing, hidden captions, Seed lock, Whisk Animate)
   - `google/google-vids` — *Google Vids* (`@Drive` storyboarding, AI voiceovers, avatars, teleprompter, Veo B-roll)
   - `google/google-stitch` — *Google Stitch* (Prompt/sketch-to-UI, themes, Figma Auto-Layout copy, Tailwind & MCP)
   - `google/google-opal` — *Google Opal* (Visual no-code AI mini-app node workflows & Drive sharing)
   - `google/google-ai-studio` — *Google AI Studio* (1M+ multimodal context, Stream Realtime, Build vibe-coding, `@google/genai` SDKs)
   - `google/google-notebooklm` — *Google NotebookLM* (500+ source grounding, live `Join` Audio Overviews, Video Overviews, Mind Maps)
   - `google/google-gemini-deep-research-canvas-and-gems` — *Gemini Deep Research, Canvas & Gems*
   - `google/google-project-mariner` — *Google Project Mariner* (10 parallel cloud browsers, Teach & Repeat, safety gates)
2. **Automated Build & Swap System Ready**:
   - `catalog.json` is the single source of truth for ecosystems, versions, update dates, and paths.
   - `./scripts/build.sh` validates HTML (`0` raw backticks), renders PDFs via Headless Chrome, renders `480px` `cover.png` thumbnails + gitignored `preview_pages/page_01..12.png` via `scripts/render_pages.swift`, updates `catalog.json`, and regenerates `README.md` via `scripts/sync_readme.py`.
   - Path resolution is 100% relative to the repository root, so moving/cloning this folder anywhere on disk works without configuration changes.
   - Unit tests (`python3 -m unittest discover -s tests -v`) pass `8/8`.

---

## 2. Next Up (Phase 2 Roadmap)

1. **Convert Existing Docs & Notes**:
   - Take existing guides, Markdown docs, Obsidian notes, or repos the owner already has (dropped into `inbox/` or pointed to on disk) and redesign them into matching 12-page visual PDF handbooks.
2. **Expand Into New Ecosystems**:
   - Add new vendor/topic categories in `catalog.json` (e.g., `anthropic`, `openai`, `dev-tools`, `macos`, `workflows`) and build self-contained bundles under `guides/<ecosystem>/<slug>/`.
3. **Ongoing Guide Swaps & Version Bumps**:
   - Whenever an existing tool ships major updates, edit `guides/<ecosystem>/<slug>/guide.html`, run `./scripts/build.sh <ecosystem>/<slug> --version 1.1`, visually verify all 12 PNGs in `preview_pages/`, and push.

---

## 3. Essential Commands for Any Agent Picking Up Here

```bash
# Run test suite
python3 -m unittest discover -s tests -v

# Rebuild one guide after editing guide.html (updates PDF, cover.png, catalog.json & README.md)
./scripts/build.sh <ecosystem>/<slug> --version 1.1

# Regenerate README.md only after editing catalog.json metadata
./scripts/build.sh --readme-only

# Refresh all cover.png thumbnails and README.md from existing PDFs
./scripts/build.sh --covers-and-readme
```

---

## 4. Must-Read Before Authoring or Editing Any Guide

Always read [`AGENTS.md`](AGENTS.md) first—especially the Chromium PDF print rules:
- Write guide HTML prose in warm, clear normal English (`0` raw backticks—always use `<code>...</code>`).
- Never use `-webkit-background-clip: text` (use solid hex accent color on `.cover h1 span`) or `box-shadow` on `.callout-pin`.
- Generate 3 custom 16:9 illustrations per guide with **zero text/letters/numbers** inside the artwork.
- Visually inspect **all 12 rendered PNGs** (`preview_pages/page_01.png` .. `page_12.png`) after every build to confirm `Total pages: 12` and 100% unclipped `.page-footer` visibility.
