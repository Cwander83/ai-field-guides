#!/usr/bin/env python3
"""Synchronize README.md dynamic stats and visual bookshelf blocks from catalog.json."""

from __future__ import annotations

import argparse
import html
import json
from pathlib import Path
from urllib.parse import quote

STATS_START = "<!-- STATS:START -->"
STATS_END = "<!-- STATS:END -->"
CATALOG_START = "<!-- CATALOG:START -->"
CATALOG_END = "<!-- CATALOG:END -->"


def _encode_rel_path(rel_path: str) -> str:
    return "/".join(quote(segment) for segment in rel_path.split("/"))


def _slugify_anchor(title: str) -> str:
    cleaned = []
    for ch in title.lower():
        if ch.isalnum() or ch in (" ", "-"):
            cleaned.append(ch)
    return "".join(cleaned).strip().replace(" ", "-")


def render_stats_block(catalog: dict) -> str:
    guides = catalog.get("guides", [])
    categories = catalog.get("categories", [])
    n_guides = len(guides)
    total_pages = sum(int(g.get("pages", 0)) for g in guides)
    n_cats = len(categories)

    guide_label = "Guide" if n_guides == 1 else "Guides"
    cat_label = "Ecosystem" if n_cats == 1 else "Ecosystems"

    badges = [
        f"![Library Size](https://img.shields.io/badge/Library-{n_guides}%20{guide_label}-2563eb?style=for-the-badge)",
        f"![Illustrated Pages](https://img.shields.io/badge/Total-{total_pages}%20Pages-059669?style=for-the-badge)",
        f"![Ecosystems](https://img.shields.io/badge/Scope-{n_cats}%20{cat_label}-7c3aed?style=for-the-badge)",
        "![Format](https://img.shields.io/badge/Format-PDF%20%2B%20HTML%2FCSS-ea580c?style=for-the-badge)",
    ]
    return "\n".join(badges)


def _render_card_cell(guide: dict) -> str:
    title = html.escape(guide["title"])
    subtitle = html.escape(guide.get("subtitle", ""))
    pdf_url = _encode_rel_path(guide["pdf"])
    cover_url = _encode_rel_path(guide["cover"])
    src_url = _encode_rel_path(guide["source_dir"])
    version = html.escape(str(guide.get("version", "1.0")))
    updated = html.escape(str(guide.get("updated", "")))
    pages = int(guide.get("pages", 12))
    tags = guide.get("tags", [])
    tags_html = " &middot; ".join(f"<code>{html.escape(t)}</code>" for t in tags)

    lines = [
        '    <td width="50%" valign="top">',
        f'      <a href="{pdf_url}"><img src="{cover_url}" alt="{title} Cover" width="100%" /></a>',
        f"      <h3><a href=\"{pdf_url}\">{title}</a></h3>",
        f"      <p><sub><strong>v{version}</strong> &bull; Updated <code>{updated}</code> &bull; {pages} Pages</sub></p>",
        f"      <p>{subtitle}</p>",
    ]
    if tags_html:
        lines.append(f"      <p>{tags_html}</p>")
    lines.append(
        f'      <p><a href="{pdf_url}"><strong>&#128214; Read / Download PDF</strong></a> &nbsp;|&nbsp; '
        f'<a href="{src_url}">&#128736; Editable Source</a></p>'
    )
    lines.append("    </td>")
    return "\n".join(lines)


def render_catalog_block(catalog: dict) -> str:
    categories = catalog.get("categories", [])
    guides = catalog.get("guides", [])

    by_cat: dict[str, list[dict]] = {c["id"]: [] for c in categories}
    for g in guides:
        by_cat.setdefault(g["category"], []).append(g)

    sections: list[str] = []

    if len(categories) > 1:
        jumps = " &bull; ".join(
            f"[{c['title']}](#{_slugify_anchor(c['title'])})"
            for c in categories
            if by_cat.get(c["id"])
        )
        if jumps:
            sections.append(f"**Jump to Ecosystem:** {jumps}\n")

    for cat in categories:
        cat_guides = by_cat.get(cat["id"], [])
        if not cat_guides:
            continue
        sections.append(f"### {cat['title']}")
        if cat.get("description"):
            sections.append(f"{cat['description']}\n")

        table_lines = ["<table>"]
        for idx in range(0, len(cat_guides), 2):
            table_lines.append("  <tr>")
            table_lines.append(_render_card_cell(cat_guides[idx]))
            if idx + 1 < len(cat_guides):
                table_lines.append(_render_card_cell(cat_guides[idx + 1]))
            else:
                table_lines.append('    <td width="50%"></td>')
            table_lines.append("  </tr>")
        table_lines.append("</table>\n")
        sections.append("\n".join(table_lines))

    if guides:
        sections.append("### Quick-Reference Index")
        sections.append(
            "| Guide | Ecosystem | Version | Updated | Pages | Direct Links |"
        )
        sections.append("| :--- | :--- | :---: | :---: | :---: | :--- |")
        cat_titles = {c["id"]: c["title"] for c in categories}
        for g in guides:
            pdf_url = _encode_rel_path(g["pdf"])
            src_url = _encode_rel_path(g["source_dir"])
            eco = cat_titles.get(g["category"], g["category"])
            sections.append(
                f"| **{g['title']}** — {g.get('subtitle', '')} | {eco} | `v{g.get('version', '1.0')}` | `{g.get('updated', '')}` | {g.get('pages', 12)} | [PDF]({pdf_url}) &middot; [Source]({src_url}) |"
            )

    return "\n".join(sections).strip()


def _replace_between_markers(
    text: str, start_marker: str, end_marker: str, replacement: str
) -> str:
    start_idx = text.find(start_marker)
    end_idx = text.find(end_marker)
    if start_idx == -1 or end_idx == -1 or end_idx < start_idx:
        raise ValueError(
            f"Missing or misordered markers: {start_marker} .. {end_marker}"
        )
    before = text[: start_idx + len(start_marker)]
    after = text[end_idx:]
    return f"{before}\n{replacement}\n{after}"


def update_readme_text(readme_text: str, catalog: dict) -> str:
    updated = _replace_between_markers(
        readme_text, STATS_START, STATS_END, render_stats_block(catalog)
    )
    updated = _replace_between_markers(
        updated, CATALOG_START, CATALOG_END, render_catalog_block(catalog)
    )
    return updated


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Sync README.md stats and bookshelf blocks from catalog.json."
    )
    parser.add_argument(
        "--catalog",
        type=Path,
        default=repo_root / "catalog.json",
        help="Path to catalog.json",
    )
    parser.add_argument(
        "--readme",
        type=Path,
        default=repo_root / "README.md",
        help="Path to README.md",
    )
    args = parser.parse_args()

    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    readme_text = args.readme.read_text(encoding="utf-8")
    new_text = update_readme_text(readme_text, catalog)
    args.readme.write_text(new_text, encoding="utf-8")
    print(f"Synced {args.readme} with {len(catalog.get('guides', []))} guides.")


if __name__ == "__main__":
    main()
