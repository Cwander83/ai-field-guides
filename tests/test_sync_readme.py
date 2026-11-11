import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

from scripts.sync_readme import (
    render_catalog_block,
    render_stats_block,
    update_readme_text,
)

SAMPLE_README = (
    "# AI Field Guides\n"
    "<!-- STATS:START -->\n"
    "old stats\n"
    "<!-- STATS:END -->\n\n"
    "## Library\n"
    "<!-- CATALOG:START -->\n"
    "old catalog\n"
    "<!-- CATALOG:END -->\n"
    "## Footer\n"
)


class SyncReadmeTests(unittest.TestCase):
    def test_odd_guide_count_pads_two_column_table_and_encodes_urls(self):
        catalog = {
            "categories": [
                {
                    "id": "google",
                    "title": "Google AI & Creative Studios",
                    "description": "Visual handbooks for Google AI Ultra.",
                }
            ],
            "guides": [
                {
                    "id": "google/flow",
                    "category": "google",
                    "title": "Google Flow",
                    "subtitle": "AI Filmmaking Studio",
                    "pdf": "guides/google/flow/My Guide.pdf",
                    "cover": "guides/google/flow/cover image.png",
                    "source_dir": "guides/google/flow",
                    "pages": 12,
                    "version": "1.0",
                    "updated": "2026-11",
                    "tags": ["Video", "Veo 3.1"],
                }
            ],
        }
        out = update_readme_text(SAMPLE_README, catalog)
        self.assertIn("1%20Guide", out)
        self.assertIn("12%20Pages", out)
        self.assertIn("guides/google/flow/My%20Guide.pdf", out)
        self.assertIn("guides/google/flow/cover%20image.png", out)
        self.assertIn("<td width=\"50%\"></td>", out)
        self.assertIn("v1.0", out)
        self.assertIn("2026-11", out)

    def test_even_guide_count_has_no_empty_padding_cell(self):
        catalog = {
            "categories": [
                {"id": "google", "title": "Google AI", "description": "Desc"}
            ],
            "guides": [
                {
                    "id": f"google/g{i}",
                    "category": "google",
                    "title": f"Guide {i}",
                    "subtitle": "Sub",
                    "pdf": f"guides/google/g{i}/g{i}.pdf",
                    "cover": f"guides/google/g{i}/cover.png",
                    "source_dir": f"guides/google/g{i}",
                    "pages": 12,
                    "version": "1.0",
                    "updated": "2026-11",
                    "tags": ["AI"],
                }
                for i in (1, 2)
            ],
        }
        block = render_catalog_block(catalog)
        self.assertNotIn("<td width=\"50%\"></td>", block)
        stats = render_stats_block(catalog)
        self.assertIn("2%20Guides", stats)
        self.assertIn("24%20Pages", stats)

    def test_missing_stats_markers_raises_value_error(self):
        bad = "<!-- CATALOG:START -->\nx\n<!-- CATALOG:END -->"
        with self.assertRaises(ValueError):
            update_readme_text(bad, {"categories": [], "guides": []})

    def test_missing_catalog_markers_raises_value_error(self):
        bad = "<!-- STATS:START -->\nx\n<!-- STATS:END -->"
        with self.assertRaises(ValueError):
            update_readme_text(bad, {"categories": [], "guides": []})

    def test_pipe_and_html_escaping_plus_multi_category_jumps(self):
        catalog = {
            "categories": [
                {"id": "google", "title": "Google & Labs", "description": "G"},
                {"id": "anthropic", "title": "Anthropic Tools", "description": "A"},
            ],
            "guides": [
                {
                    "id": "google/a",
                    "category": "google",
                    "title": "Flow | Studio <Pro>",
                    "subtitle": "Fast | Clean & Crisp",
                    "pdf": "guides/google/a/a.pdf",
                    "cover": "guides/google/a/cover.png",
                    "source_dir": "guides/google/a",
                    "pages": 12,
                    "version": "1.0",
                    "updated": "2026-11",
                    "tags": ["A&B"],
                },
                {
                    "id": "anthropic/b",
                    "category": "anthropic",
                    "title": "Claude Code",
                    "subtitle": "CLI Agent",
                    "pdf": "guides/anthropic/b/b.pdf",
                    "cover": "guides/anthropic/b/cover.png",
                    "source_dir": "guides/anthropic/b",
                    "pages": 12,
                    "version": "1.0",
                    "updated": "2026-11",
                    "tags": ["CLI"],
                },
            ],
        }
        block = render_catalog_block(catalog)
        self.assertIn("**Jump to Ecosystem:** [Google & Labs](#google--labs) &bull; [Anthropic Tools](#anthropic-tools)", block)
        self.assertIn("Flow | Studio &lt;Pro&gt;", block)
        self.assertIn("<code>A&amp;B</code>", block)
        self.assertIn(r"**Flow \| Studio <Pro>** — Fast \| Clean & Crisp", block)


class BuildScriptValidationTests(unittest.TestCase):
    def setUp(self):
        self.repo_root = Path(__file__).resolve().parents[1]
        self.build_sh = self.repo_root / "scripts" / "build.sh"

    def test_unknown_guide_id_exits_nonzero_and_lists_valid_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            cat = {
                "categories": [{"id": "google", "title": "Google", "description": "D"}],
                "guides": [
                    {
                        "id": "google/google-flow",
                        "category": "google",
                        "title": "Google Flow",
                        "subtitle": "Sub",
                        "pdf": "guides/google/google-flow/out.pdf",
                        "cover": "guides/google/google-flow/cover.png",
                        "source_dir": "guides/google/google-flow",
                        "pages": 12,
                        "version": "1.0",
                        "updated": "2026-11",
                        "tags": [],
                    }
                ],
            }
            cat_file = tmp_path / "catalog.json"
            cat_file.write_text(json.dumps(cat), encoding="utf-8")
            env = os.environ.copy()
            env["CATALOG_FILE"] = str(cat_file)
            proc = subprocess.run(
                [str(self.build_sh), "google/does-not-exist"],
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("google/google-flow", proc.stdout + proc.stderr)

    def test_raw_backtick_in_guide_html_fails_fast_before_pdf_render(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            gdir = tmp_path / "guides" / "google" / "bad"
            gdir.mkdir(parents=True)
            (gdir / "guide.html").write_text(
                "<html><body>Oops `raw_backtick` here</body></html>", encoding="utf-8"
            )
            cat = {
                "categories": [{"id": "google", "title": "Google", "description": "D"}],
                "guides": [
                    {
                        "id": "google/bad",
                        "category": "google",
                        "title": "Bad",
                        "subtitle": "Sub",
                        "pdf": "guides/google/bad/out.pdf",
                        "cover": "guides/google/bad/cover.png",
                        "source_dir": "guides/google/bad",
                        "pages": 12,
                        "version": "1.0",
                        "updated": "2026-11",
                        "tags": [],
                    }
                ],
            }
            cat_file = tmp_path / "catalog.json"
            cat_file.write_text(json.dumps(cat), encoding="utf-8")
            env = os.environ.copy()
            env["CATALOG_FILE"] = str(cat_file)
            env["REPO_ROOT_OVERRIDE"] = str(tmp_path)
            proc = subprocess.run(
                [str(self.build_sh), "google/bad"],
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertNotEqual(proc.returncode, 0)
            self.assertIn("backtick", (proc.stdout + proc.stderr).lower())

    def test_empty_catalog_build_all_succeeds(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            cat_file = tmp_path / "catalog.json"
            cat_file.write_text(
                json.dumps({"categories": [], "guides": []}), encoding="utf-8"
            )
            (tmp_path / "README.md").write_text(SAMPLE_README, encoding="utf-8")
            env = os.environ.copy()
            env["CATALOG_FILE"] = str(cat_file)
            env["REPO_ROOT_OVERRIDE"] = str(tmp_path)
            proc = subprocess.run(
                [str(self.build_sh), "--all"],
                capture_output=True,
                text=True,
                env=env,
            )
            self.assertEqual(proc.returncode, 0, msg=proc.stdout + proc.stderr)


if __name__ == "__main__":
    unittest.main()
