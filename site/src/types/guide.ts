export type GoalId =
  | 'meetings-work'
  | 'design-video'
  | 'notes-knowledge'
  | 'apps-coding';

export interface GoalCategory {
  id: GoalId;
  label: string;
  shortLabel: string;
  description: string;
}

export interface EcosystemCategory {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
}

export interface EnrichedGuide {
  id: string;
  ecosystem: string;
  ecosystemTitle: string;
  ecosystemShort: string;
  slug: string;
  title: string;
  subtitle: string;
  version: string;
  updated: string;
  pages: number;
  tags: string[];
  goals: GoalId[];
  readingMinutes: number;
  url: string;
  markdownUrl: string;
  ogImageUrl: string;
  coverWebpUrl: string;
  coverPngUrl: string;
  coverWidth: number;
  coverHeight: number;
  pdfUrl: string;
  pdfFilename: string;
  pdfSizeBytes: number;
  pdfSizeLabel: string;
  sourceDir: string;
  isFeaturedNew?: boolean;
}

export interface CoverPillar {
  title: string;
  description: string;
}

export interface GuideChapter {
  number: number;
  id: string;
  sectionTag: string;
  title: string;
  leadHtml: string;
  bodyHtml: string;
}

export interface ParsedGuide {
  guide: EnrichedGuide;
  heroImageUrl: string | null;
  heroImageAlt: string;
  heroImageWidth?: number;
  heroImageHeight?: number;
  badges: string[];
  pillars: CoverPillar[];
  scopedCss: string;
  chapters: GuideChapter[];
}
