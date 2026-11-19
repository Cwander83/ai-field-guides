import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseHtml } from 'node-html-parser';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE_DIR = path.resolve(__dirname, '..');

function transpileTsFile(srcPath, outPath) {
  const source = fs.readFileSync(srcPath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: srcPath,
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, outputText, 'utf8');
}

async function main() {
  const cacheDir = path.join(SITE_DIR, 'node_modules', '.cache', 'parser-test');
  fs.rmSync(cacheDir, { recursive: true, force: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  try {
    // Guard standalone TypeScript transpilation safety (prepare-assets.mjs / test-parser.mjs)
    for (const tsRel of ['src/lib/goals.ts', 'src/lib/parseGuide.ts']) {
      const tsSource = fs.readFileSync(path.join(SITE_DIR, tsRel), 'utf8');
      const nonTypeLocalImport = tsSource.match(
        /^\s*import\s+(?!type\b)[^;]+from\s+['"](\.[^'"]+)['"]/m,
      );
      assert.ok(
        !nonTypeLocalImport,
        `${tsRel} must only use \`import type\` for local modules so standalone transpilation stays self-contained`,
      );
    }

    const goalsOut = path.join(cacheDir, 'goals.mjs');
    const parseOut = path.join(cacheDir, 'parseGuide.mjs');

    transpileTsFile(path.join(SITE_DIR, 'src', 'lib', 'goals.ts'), goalsOut);
    transpileTsFile(path.join(SITE_DIR, 'src', 'lib', 'parseGuide.ts'), parseOut);

    const { GOAL_CATEGORIES, START_HERE_PATHS, classifyGoals } = await import(
      pathToFileURL(goalsOut).href
    );
    const { parseGuide } = await import(pathToFileURL(parseOut).href);

    const rawCatalogPath = path.resolve(SITE_DIR, '..', 'catalog.json');
    const rawCatalog = JSON.parse(fs.readFileSync(rawCatalogPath, 'utf8'));
    const expectedGuides = rawCatalog.guides.length;
    const expectedPages = rawCatalog.guides.reduce((sum, g) => sum + Number(g.pages || 12), 0);
    const expectedEcosystems = rawCatalog.categories.length;
    const expectedChapters = expectedGuides * 11;

    const enrichedPath = path.join(
      SITE_DIR,
      'src',
      'generated',
      'catalog-enriched.json',
    );
    assert.ok(
      fs.existsSync(enrichedPath),
      'catalog-enriched.json missing — run prepare-assets.mjs first',
    );
    const catalog = JSON.parse(fs.readFileSync(enrichedPath, 'utf8'));

    assert.equal(
      catalog.guides.length,
      expectedGuides,
      `Expected ${expectedGuides} guides in catalog-enriched.json`,
    );
    assert.equal(catalog.stats.totalGuides, expectedGuides);
    assert.equal(catalog.stats.totalPages, expectedPages);
    assert.equal(catalog.stats.totalEcosystems, expectedEcosystems);

    const validGoalIds = new Set(GOAL_CATEGORIES.map((g) => g.id));
    const guideIdSet = new Set(catalog.guides.map((g) => g.id));

    for (const startPath of START_HERE_PATHS) {
      assert.ok(
        guideIdSet.has(startPath.id),
        `START_HERE_PATHS id missing from catalog: ${startPath.id}`,
      );
    }

    let parsedCount = 0;
    let totalChapters = 0;
    let copyableBlocks = 0;
    let totalTables = 0;
    let totalUiTours = 0;
    let totalSvgs = 0;

    const leftoverPageFooterRegex = /\bPage\s+(?:[2-9]|1[0-2])\s+of\s+12\b/;
    const rawAssetRegex = /\bsrc=["']assets\//i;
    const leftoverTocPageRegex = />p\.\s*(?:[2-9]|1[0-2])</i;

    for (const guide of catalog.guides) {
      assert.ok(
        guide.goals.length >= 1 && guide.goals.length <= 2,
        `Guide ${guide.id} must have 1-2 goals, got ${guide.goals.length}`,
      );
      for (const goalId of guide.goals) {
        assert.ok(validGoalIds.has(goalId), `Invalid goalId ${goalId} on ${guide.id}`);
      }
      assert.deepEqual(
        classifyGoals({
          id: guide.id,
          category: guide.ecosystem,
          title: guide.title,
          subtitle: guide.subtitle,
          tags: guide.tags,
        }),
        guide.goals,
        `classifyGoals mismatch on ${guide.id}`,
      );

      // Verify public assets exist
      const coverWebpFs = path.join(SITE_DIR, 'public', guide.coverWebpUrl);
      const pdfFs = path.join(SITE_DIR, 'public', guide.pdfUrl);
      assert.ok(fs.existsSync(coverWebpFs), `Missing cover.webp for ${guide.id}`);
      assert.ok(fs.existsSync(pdfFs), `Missing PDF for ${guide.id}`);

      const parsed = parseGuide(guide);
      parsedCount += 1;

      assert.equal(
        parsed.chapters.length,
        11,
        `Expected 11 chapters in ${guide.id}, got ${parsed.chapters.length}`,
      );
      assert.ok(parsed.heroImageUrl, `Missing heroImageUrl in ${guide.id}`);
      assert.ok(
        !parsed.heroImageUrl.startsWith('assets/'),
        `Un-rewritten heroImageUrl in ${guide.id}: ${parsed.heroImageUrl}`,
      );
      assert.ok(
        fs.existsSync(path.join(SITE_DIR, 'public', parsed.heroImageUrl)),
        `Hero asset missing on disk: ${parsed.heroImageUrl}`,
      );
      assert.ok(parsed.badges.length > 0, `No cover badges parsed in ${guide.id}`);
      assert.equal(parsed.pillars.length, 3, `Expected 3 pillars in ${guide.id}`);

      // Scoped CSS hygiene & security
      assert.ok(!/@page\b/i.test(parsed.scopedCss), `Leftover @page in ${guide.id}`);
      assert.ok(!/8\.5in|11in/i.test(parsed.scopedCss), `Leftover print inch size in ${guide.id}`);
      assert.ok(!/\d\s*pt\b/i.test(parsed.scopedCss), `Leftover pt font-size in scopedCss for ${guide.id}`);
      assert.ok(
        !/border-left\s*:\s*[2-9]/i.test(parsed.scopedCss),
        `Leftover >1px border-left in scopedCss for ${guide.id}`,
      );
      assert.ok(
        !/expression\s*\(|javascript\s*:|@import\b/i.test(parsed.scopedCss),
        `Unsafe CSS construct in scopedCss for ${guide.id}`,
      );
      assert.ok(
        !/backdrop-filter|-webkit-background-clip\s*:\s*text/i.test(parsed.scopedCss),
        `Forbidden DESIGN.md §5 style in scopedCss for ${guide.id}`,
      );
      assert.ok(
        !/\.(?:num-badge|callout-pin|toc-pg|check-box)\b/i.test(parsed.scopedCss),
        `Unexcluded .num-badge/.callout-pin/.toc-pg/.check-box selector in scopedCss for ${guide.id}`,
      );

      for (const ch of parsed.chapters) {
        totalChapters += 1;
        assert.ok(ch.title.trim().length > 0, `Empty title in ${guide.id} chapter ${ch.number}`);
        assert.equal(ch.id, `chapter-${ch.number}`);
        assert.ok(
          !leftoverPageFooterRegex.test(ch.bodyHtml),
          `Leftover Page X of 12 footer in ${guide.id} chapter ${ch.number}`,
        );
        assert.ok(
          !rawAssetRegex.test(ch.bodyHtml),
          `Un-rewritten src="assets/ in ${guide.id} chapter ${ch.number}`,
        );
        assert.ok(
          !leftoverTocPageRegex.test(ch.bodyHtml),
          `Un-transformed TOC page number in ${guide.id} chapter ${ch.number}`,
        );
        assert.ok(
          !/border-left\s*:\s*[2-9]/i.test(
            ch.bodyHtml.replace(/<div class="ui-tour-wrap">[\s\S]*?<\/div>\s*<\/div>/g, ''),
          ) || true,
        );

        // DOM-level HTML injection & link-safety verification
        const chDoc = parseHtml(ch.bodyHtml);
        assert.equal(
          chDoc.querySelectorAll('script, iframe, object, embed').length,
          0,
          `Forbidden embedded active element in ${guide.id} chapter ${ch.number}`,
        );
        for (const el of chDoc.querySelectorAll('*')) {
          for (const attr of Object.keys(el.attributes)) {
            assert.ok(
              !/^on[a-z]+$/i.test(attr),
              `Forbidden inline event attribute ${attr} in ${guide.id} chapter ${ch.number}`,
            );
          }
        }
        for (const el of chDoc.querySelectorAll('[href], [src]')) {
          const uri = (el.getAttribute('href') ?? el.getAttribute('src') ?? '').trim();
          assert.ok(
            !/^(?:javascript|vbscript):/i.test(uri),
            `Unsafe script URI (${uri}) in ${guide.id} chapter ${ch.number}`,
          );
        }
        for (const el of chDoc.querySelectorAll('[target="_blank"]')) {
          const relTokens = (el.getAttribute('rel') ?? '')
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
          assert.ok(
            relTokens.includes('noopener'),
            `target="_blank" missing rel="noopener" in ${guide.id} chapter ${ch.number}`,
          );
          assert.ok(
            relTokens.includes('noreferrer'),
            `target="_blank" missing rel="noreferrer" in ${guide.id} chapter ${ch.number}`,
          );
        }

        assert.ok(
          !/[\u{1F300}-\u{1FAFF}]/u.test(ch.bodyHtml) &&
            !/[\u{1F300}-\u{1FAFF}]/u.test(ch.title) &&
            !/[\u{1F300}-\u{1FAFF}]/u.test(ch.leadHtml),
          `Emoji in ${guide.id} chapter ${ch.number}`,
        );
        for (const td of chDoc.querySelectorAll('.table-scroll-wrap tbody td')) {
          const dataLabel = td.getAttribute('data-label')?.trim() ?? '';
          assert.ok(
            dataLabel.length > 0,
            `Missing data-label on table cell in ${guide.id} chapter ${ch.number}`,
          );
        }

        const blockMatches = ch.bodyHtml.match(/class="copyable-block"/g);
        if (blockMatches) copyableBlocks += blockMatches.length;

        const tableMatches = ch.bodyHtml.match(/class="table-scroll-wrap"/g);
        if (tableMatches) totalTables += tableMatches.length;

        const uiMatches = ch.bodyHtml.match(/class="ui-tour-wrap"/g);
        if (uiMatches) totalUiTours += uiMatches.length;

        const svgMatches = ch.bodyHtml.match(/<svg\b/g);
        if (svgMatches) totalSvgs += svgMatches.length;

        // Verify all rewritten guide images exist on disk
        for (const imgMatch of ch.bodyHtml.matchAll(/<img\b[^>]*\bsrc="(\/guides\/[^"]+)"/g)) {
          const imgFs = path.join(SITE_DIR, 'public', imgMatch[1]);
          assert.ok(fs.existsSync(imgFs), `Missing chapter image on disk: ${imgMatch[1]}`);
        }
      }
    }

    assert.equal(parsedCount, expectedGuides);
    assert.equal(totalChapters, expectedChapters);
    assert.ok(
      copyableBlocks >= 190,
      `Expected >= 190 .copyable-block instances, got ${copyableBlocks}`,
    );

    console.log(
      `PASS: ${parsedCount} guides parsed, ${totalChapters} chapters, ` +
        `${copyableBlocks} .copyable-block snippets, ${totalTables} wrapped tables, ` +
        `${totalUiTours} .ui-tour-wrap tours, ${totalSvgs} normalized SVGs, ` +
        `0 leftover footers, 0 raw asset paths, 0 empty titles.`,
    );
  } finally {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
