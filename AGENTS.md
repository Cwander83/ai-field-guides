# Agent Authoring & Maintenance Playbook (`ai-field-guides`)

Read this file before creating a new field guide, converting rough material from `inbox/`, or updating an existing guide after a product release.

---

## 1. Repository Architecture

- **`catalog.json`**: Single source of truth for all categories (`categories[]`) and handbooks (`guides[]`). Never hand-edit between `<!-- STATS:START -->` and `<!-- CATALOG:END -->` inside `README.md`; always update `catalog.json` and run `./scripts/build.sh`.
- **`guides/<ecosystem>/<slug>/`**: Self-contained guide bundle containing:
  - `<Title>_Complete_How_To_Guide.pdf` (final print-verified 12-page PDF)
  - `cover.png` (`480px`-wide Page 1 thumbnail generated automatically by `scripts/build.sh`)
  - `guide.html` (12-page HTML source)
  - `style.css` (print stylesheet with guide-specific cover gradient & accent hue)
  - `assets/` (3 custom 16:9 zero-text illustrations: `hero_cover.jpg` + 2 interior visual showcases)
  - `preview_pages/` (**gitignored** 2x Retina PNGs `page_01.png`..`page_12.png` used strictly for visual QA)
- **`templates/starter-guide/`**: Clean 12-page boilerplate (`guide.html` + `style.css`) to copy when starting a brand-new handbook.
- **`inbox/`**: Staging folder where the user drops rough notes, Markdown drafts, existing PDFs, or URLs to be transformed into a polished 12-page field guide.

---

## 2. Non-Negotiable Quality & Print Standards

1. **Warm, Clear Publication English**:
   - Even if chat rules request terse responses, all prose inside `guide.html`, `README.md`, and docs MUST be written in warm, vivid, beginner-friendly normal English.
2. **Exact 12-Page Magazine Structure**:
   - Every `<section class="page">` is fixed at `width: 8.5in; height: 11in; overflow: hidden;`.
   - Standard 12-page arc:
     - **Page 1**: Cover (`.page.cover`, series pill, `h1` with solid `<span>` accent color, 6 capability badges, `assets/hero_cover.jpg`, 3 bottom value pillars).
     - **Page 2**: Quick Navigation 2-column TOC + Core Mental Model + inline vector `<svg>` architecture diagram.
     - **Page 3**: Setup, Tiers/Quotas, & Ecosystem Decision Matrix.
     - **Page 4**: Annotated Workspace UI Tour (`.ui-window` CSS mockup with numbered `.callout-pin` `1`–`7` + legend).
     - **Pages 5–8**: Core workflows, color-coded `.p-tag` prompt/config anatomy, and 2 full-width 16:9 custom illustrations (`width: 100%; height: 250px–270px; object-fit: cover; object-position: center;`).
     - **Page 9**: 5 Real-World Copy-Paste Recipes table.
     - **Page 10**: Collaboration, Sharing, Security, or Developer Export.
     - **Page 11**: Cross-Tool Synergy Pipeline (`<svg>` workflow diagram).
     - **Page 12**: Troubleshooting Clinic (Top 7 issues & 10-second fixes) + 6-Point Pre-Flight Checklist.
3. **Chromium Headless PDF Gotchas (Critical)**:
   - **Zero Raw Backticks**: Never leave literal `` ` `` characters in `guide.html` (`build.sh` rejects them). Always wrap inline code/commands/paths in `<code>...</code>`.
   - **No Gradient Text Clipping**: Never use `-webkit-background-clip: text; -webkit-text-fill-color: transparent;` (Chromium PDF rasterizes solid rectangular blocks over letters). Use a solid hex accent color on `.cover h1 span`.
   - **No Pin Box-Shadows**: Never put `box-shadow` on small circular `.callout-pin` badges; use `border: 1.5px solid #ffffff;` instead.
   - **Zero-Text Generated Illustrations**: When generating custom 16:9 illustrations (`hero_cover.jpg` and interior showcases), instruct image models to include **ZERO text, ZERO words, ZERO letters, and ZERO numbers**. Put all labels in crisp HTML/SVG captions underneath.
4. **Mandatory Page-by-Page Visual Inspection**:
   - After running `./scripts/build.sh <ecosystem>/<slug>`, inspect **every single rendered PNG** (`preview_pages/page_01.png` through `page_12.png`) with an image-capable file reader.
   - Confirm `Total pages: 12` and verify that `.page-footer` (`Page X of 12`) is 100% visible and unclipped at the bottom of Pages 2–12. If any page overflows `11in`, tighten vertical margins/padding in `guide.html` and re-run `./scripts/build.sh`.

---

## 3. Standard Workflows

### Workflow A: Updating an Existing Guide After a Product Release
1. Research the product's new features, UI changes, or updated model names/limits.
2. Edit `guides/<ecosystem>/<slug>/guide.html` (and regenerate `assets/*.jpg` if visuals changed).
3. Run:
   ```bash
   ./scripts/build.sh <ecosystem>/<slug> --version <new_version>
   ```
4. Visually inspect `guides/<ecosystem>/<slug>/preview_pages/page_01.png` .. `page_12.png` to confirm zero footer clipping.
5. Run `python3 -m unittest discover -s tests -v` and commit `guides/<ecosystem>/<slug>/`, `catalog.json`, and `README.md`.

### Workflow B: Converting an `inbox/` Draft Into a New Handbook
1. Read all source material in `inbox/<draft>` and supplement with current official docs research.
2. Copy `templates/starter-guide/` to `guides/<ecosystem>/<slug>/` and customize `style.css` with a distinct cover gradient and accent color.
3. Generate 3 zero-text 16:9 illustrations into `guides/<ecosystem>/<slug>/assets/` and inspect them.
4. Author the 12-page `guide.html`, add the guide metadata (and category if new) to `catalog.json`, and run `./scripts/build.sh <ecosystem>/<slug> --version 1.0`.
5. Visually verify all 12 rendered PNGs in `preview_pages/`, remove or archive the processed draft from `inbox/` as requested by the user, and commit.
