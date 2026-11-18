import type { GoalCategory, GoalId } from '../types/guide';

export const GOAL_CATEGORIES: GoalCategory[] = [
  {
    id: 'meetings-work',
    label: 'Meetings, Docs & Work',
    shortLabel: 'Meetings & Work',
    description:
      'Run smarter meetings, draft documents, analyze sheets, and automate daily tasks.',
  },
  {
    id: 'design-video',
    label: 'Design, Slides & Video',
    shortLabel: 'Design & Video',
    description:
      'Create storyboards, cinematic video, slide decks, interactive prototypes, and visuals.',
  },
  {
    id: 'notes-knowledge',
    label: 'Notes & Second Brain',
    shortLabel: 'Notes & Knowledge',
    description:
      'Turn Obsidian vaults, PDFs, voice memos, and research into connected knowledge.',
  },
  {
    id: 'apps-coding',
    label: 'Apps, Websites & Coding',
    shortLabel: 'Apps & Coding',
    description:
      'Build AI apps, coding agent teams, MCP servers, security audits, and deployments.',
  },
];

export const ECOSYSTEM_SHORT_NAMES: Record<string, string> = {
  google: 'Google AI',
  claude: 'Anthropic Claude',
  openai: 'OpenAI',
  vercel: 'Vercel',
  'agent-engineering': 'Agent Engineering',
  obsidian: 'Obsidian',
  'creative-media': 'Music, Video & Decks',
  'visibility-and-workflows': 'AI Visibility & Work',
  'open-harnesses': 'Open Harnesses',
  'desktop-and-os': 'Desktop & Personal Ops',
};

export const START_HERE_PATHS: Array<{
  id: string;
  pathwayTitle: string;
  rationale: string;
}> = [
  {
    id: 'claude/claude-meetings',
    pathwayTitle: 'Run Smarter Meetings',
    rationale:
      'Invite Claude into Google Meet to build Docs, Sheets, and Whiteboards live while your team talks, with a full post-call hub.',
  },
  {
    id: 'claude/claude-design',
    pathwayTitle: 'Create Designs & Prototypes',
    rationale:
      'Turn ideas, brand guidelines, or real screens into clickable prototypes, slide decks, and product one-pagers.',
  },
  {
    id: 'obsidian/obsidian-desktop-ai-agents',
    pathwayTitle: 'Connect Your Notes to AI',
    rationale:
      'Pair your Obsidian vault with Claude Desktop and Antigravity so your own notes power daily briefings and research.',
  },
];

interface GuideGoalInput {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  tags: string[];
}

const GOAL_ORDER: GoalId[] = [
  'meetings-work',
  'design-video',
  'notes-knowledge',
  'apps-coding',
];

function addGoal(set: Set<GoalId>, goal: GoalId): void {
  if (set.size < 2) {
    set.add(goal);
  }
}

/**
 * Deterministically assigns 1-2 plain-English GoalIds to any guide in the catalog.
 */
export function classifyGoals(guide: GuideGoalInput): GoalId[] {
  const id = guide.id.toLowerCase();
  const cat = guide.category.toLowerCase();
  const text = `${guide.id} ${guide.title} ${guide.subtitle} ${guide.tags.join(' ')}`.toLowerCase();

  const matches = new Set<GoalId>();

  // 1. Notes & Second Brain
  if (
    cat === 'obsidian' ||
    /\b(notebooklm|deep-research|deep research|second brain|vault|wiki|knowledge graph|rag|semantic search)\b/.test(
      text,
    ) ||
    id.includes('chatgpt-canvas-and-spaces') ||
    id.includes('granola-bot-free-meetings-and-pipelines') ||
    id.includes('ai-document-and-web-scraping-pipelines')
  ) {
    addGoal(matches, 'notes-knowledge');
  }

  // 2. Design, Slides & Video
  if (
    cat === 'creative-media' ||
    /\b(google-flow|google-whisk|google-vids|google-stitch|claude-design|claude-whiteboards|realtime-voice|omni-flash|json-canvas|notebooklm|canvas-and-gems)\b/.test(
      id,
    ) ||
    /\b(filmmaking|image remix|storyboard|slide deck|ui\/ux|figma|prototype|prototypes|design system|visual canvas|whiteboards|json canvas|mind maps|audio overviews)\b/.test(
      text,
    )
  ) {
    addGoal(matches, 'design-video');
  }

  // 3. Meetings, Docs & Work
  if (
    cat === 'desktop-and-os' ||
    /\b(claude-meetings|claude-duet|claude-sheets|claude-dashboards-and-data|claude-cowork-and-computer-use|claude-whiteboards|chatgpt-canvas-and-spaces|google-project-mariner|google-vids|obsidian-desktop-ai-agents)\b/.test(
      id,
    ) ||
    /\b(meeting|meetings|google meet|spreadsheets|\.xlsx|dashboards|cowork|computer use|morning briefs|scheduled agents|scheduled briefings|browser agent|workspace|inbox zero|calendar|n8n)\b/.test(
      text,
    ) ||
    id.includes('ai-pitch-decks-and-visual-storytelling') ||
    id.includes('geo-and-ai-search-visibility') ||
    id.includes('granola-bot-free-meetings-and-pipelines')
  ) {
    addGoal(matches, 'meetings-work');
  }

  // 4. Apps, Websites & Coding
  if (
    cat === 'vercel' ||
    cat === 'agent-engineering' ||
    cat === 'open-harnesses' ||
    id.includes('agent-ready-websites-and-webmcp') ||
    /\b(codex|claude-code|antigravity|firebase|android-cli|ai-studio|google-opal|managed-agents|agents-api|claude-security|claude-skills|graphify|google-stitch|gemini-live|realtime-voice|project-mariner)\b/.test(
      id,
    ) ||
    /\b(sdk|api|cli|mcp|coding|code|github|next\.js|tailwind|no-code apps|vibe coding|appsec|security|evals|testing|playwright|worktrees|subagents|orchestration|ollama)\b/.test(
      text,
    )
  ) {
    // Avoid tagging pure non-coding workspace guides unless primarily coding/apps
    if (
      !id.includes('google-vids') &&
      !id.includes('claude-meetings') &&
      !id.includes('claude-duet') &&
      !id.includes('claude-sheets') &&
      !id.includes('claude-dashboards-and-data') &&
      !id.includes('claude-cowork') &&
      !id.includes('claude-whiteboards') &&
      !id.includes('chatgpt-canvas') &&
      !id.includes('obsidian-desktop-ai-agents') &&
      !id.includes('obsidian-bases') &&
      !id.includes('vault-security') &&
      !id.includes('autonomous-llm-wiki') &&
      !id.includes('obsidian-capture') &&
      !id.includes('ai-pitch-decks-and-visual-storytelling') &&
      !id.includes('geo-and-ai-search-visibility') &&
      !id.includes('granola-bot-free-meetings-and-pipelines')
    ) {
      addGoal(matches, 'apps-coding');
    }
  }

  // Guarantee at least 1 goal
  if (matches.size === 0) {
    if (cat === 'obsidian') matches.add('notes-knowledge');
    else if (cat === 'creative-media') matches.add('design-video');
    else if (cat === 'vercel' || cat === 'agent-engineering') matches.add('apps-coding');
    else matches.add('meetings-work');
  }

  return GOAL_ORDER.filter((g) => matches.has(g)).slice(0, 2);
}
