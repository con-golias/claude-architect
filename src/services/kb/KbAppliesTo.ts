/**
 * Generates "appliesTo" mappings that determine when a KB article is relevant:
 * which file extensions, path patterns, and keywords trigger it.
 *
 * @module kb-applies-to
 */

/** Extension groups by KB category. */
const CATEGORY_EXTENSIONS: Record<string, string[]> = {
  frontend: [".tsx", ".jsx", ".vue", ".svelte", ".html", ".css", ".scss", ".sass", ".less"],
  backend: [".ts", ".js", ".py", ".go", ".java", ".kt", ".rb", ".rs", ".cs"],
  database: [".sql", ".ts", ".py", ".go", ".java", ".prisma"],
  security: [".ts", ".js", ".tsx", ".jsx", ".py", ".go", ".java", ".kt", ".rb", ".rs", ".cs",
    ".html", ".sql", ".sh", ".yaml", ".yml", ".json", ".env", ".dockerfile"],
  testing: [".test.ts", ".test.tsx", ".spec.ts", ".test.js", ".spec.js", ".test.py",
    ".spec.rb", ".test.go", ".test.java"],
  devops: [".yaml", ".yml", ".json", ".sh", ".dockerfile", ".tf", ".hcl", ".toml"],
  accessibility: [".tsx", ".jsx", ".vue", ".svelte", ".html"],
  performance: [".ts", ".js", ".tsx", ".py", ".go", ".java", ".sql", ".rs"],
  fundamentals: [".ts", ".js", ".py", ".go", ".java", ".kt", ".rb", ".rs", ".cs", ".tsx", ".jsx"],
  architecture: [".ts", ".js", ".py", ".go", ".java", ".kt"],
  languages: [],
  scalability: [".ts", ".js", ".py", ".go", ".java", ".yaml", ".yml"],
  "code-quality": [".ts", ".js", ".tsx", ".jsx", ".py", ".go", ".java", ".kt", ".rb", ".rs", ".cs"],
  product: [],
  ai: [".ts", ".js", ".py", ".java"],
  "case-studies": [],
  "project-structure": [],
};

/** Language to file extensions mapping. */
const LANG_TO_EXT: Record<string, string[]> = {
  typescript: [".ts", ".tsx"],
  javascript: [".js", ".jsx", ".mjs"],
  python: [".py"],
  go: [".go"],
  java: [".java"],
  kotlin: [".kt", ".kts"],
  csharp: [".cs"],
  ruby: [".rb"],
  rust: [".rs"],
  swift: [".swift"],
  dart: [".dart"],
  sql: [".sql"],
  css: [".css", ".scss", ".sass", ".less"],
  html: [".html", ".htm"],
  yaml: [".yaml", ".yml"],
  bash: [".sh", ".bash"],
  docker: [".dockerfile"],
  hcl: [".tf", ".hcl"],
  graphql: [".graphql", ".gql"],
  protobuf: [".proto"],
};

/** Tag to path patterns mapping. */
const TAG_PATH_PATTERNS: Record<string, string[]> = {
  authentication: ["auth/", "authentication/", "identity/", "login/", "session/"],
  authorization: ["auth/", "authorization/", "permissions/", "rbac/", "policy/"],
  "api-design": ["api/", "routes/", "controllers/", "endpoints/", "handlers/"],
  "rest": ["api/", "routes/", "controllers/", "endpoints/"],
  "graphql": ["graphql/", "resolvers/", "schema/", "queries/", "mutations/"],
  "data-modeling": ["models/", "entities/", "schemas/", "domain/"],
  "database": ["db/", "database/", "migrations/", "seeds/", "repositories/"],
  middleware: ["middleware/", "interceptors/", "filters/", "pipes/"],
  "error-handling": ["errors/", "exceptions/", "handlers/"],
  testing: ["tests/", "__tests__/", "test/", "spec/", "__mocks__/"],
  validation: ["validators/", "validation/", "schemas/"],
  logging: ["logging/", "logger/", "logs/"],
  caching: ["cache/", "caching/", "redis/"],
  "state-management": ["store/", "state/", "redux/", "context/"],
  "component-design": ["components/", "ui/", "widgets/"],
  security: ["security/", "auth/", "crypto/", "encryption/"],
  config: ["config/", "configuration/", "settings/", "env/"],
  infrastructure: ["infrastructure/", "infra/", "deploy/", "terraform/", "k8s/"],
  "ci-cd": [".github/", ".gitlab/", "ci/", "pipelines/"],
  monitoring: ["monitoring/", "metrics/", "observability/", "telemetry/"],
  "file-handling": ["uploads/", "files/", "storage/", "assets/"],
  "background-jobs": ["jobs/", "workers/", "queues/", "tasks/"],
  webhooks: ["webhooks/", "hooks/", "events/"],
  search: ["search/", "elasticsearch/", "indexing/"],
  "real-time": ["websockets/", "ws/", "realtime/", "sse/"],
};

/**
 * Generate the appliesTo mapping for a KB entry.
 *
 * @param category - Top-level category (e.g., "security")
 * @param tags - Extracted tags
 * @param languages - Code block languages found
 * @param title - Article title
 * @param domain - Domain string
 */
export function generateAppliesTo(
  category: string,
  tags: string[],
  languages: string[],
  title: string,
  domain: string,
): { extensions: string[]; pathPatterns: string[]; keywords: string[] } {
  const extensions = new Set<string>();
  const pathPatterns = new Set<string>();
  const keywords = new Set<string>();

  // Extensions from category
  const catExts = CATEGORY_EXTENSIONS[category] || CATEGORY_EXTENSIONS.fundamentals;
  for (const ext of catExts) extensions.add(ext);

  // Extensions from code languages
  for (const lang of languages) {
    const exts = LANG_TO_EXT[lang];
    if (exts) {
      for (const ext of exts) extensions.add(ext);
    }
  }

  // Path patterns from tags
  for (const tag of tags) {
    if (Object.prototype.hasOwnProperty.call(TAG_PATH_PATTERNS, tag)) {
      const patterns = TAG_PATH_PATTERNS[tag];
      for (const p of patterns) pathPatterns.add(p);
    }
  }

  // Keywords from title
  const titleWords = title
    .replace(/[()—:,."']/g, " ")
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !/^(the|and|for|with|from|that|this)$/.test(w));

  for (const word of titleWords) keywords.add(word);

  // Keywords from domain
  const domainWords = domain
    .split(/[>/\s]+/)
    .map((w) => w.toLowerCase().trim())
    .filter((w) => w.length > 2);

  for (const word of domainWords) keywords.add(word);

  // Keywords from tags (only meaningful ones)
  for (const tag of tags) {
    if (tag.length > 2) keywords.add(tag);
  }

  return {
    extensions: Array.from(extensions).sort(),
    pathPatterns: Array.from(pathPatterns).sort(),
    keywords: Array.from(keywords).sort(),
  };
}

/**
 * Map a top-level KB directory name to a clean category string.
 */
export function mapCategory(dirName: string): string {
  const CATEGORY_MAP: Record<string, string> = {
    "01-fundamentals": "fundamentals",
    "02-languages-and-runtimes": "languages",
    "03-architecture": "architecture",
    "04-project-structure": "project-structure",
    "05-frontend": "frontend",
    "06-backend": "backend",
    "07-database": "database",
    "08-security": "security",
    "09-performance": "performance",
    "10-scalability": "scalability",
    "11-testing": "testing",
    "12-devops-infrastructure": "devops",
    "13-code-quality": "code-quality",
    "14-accessibility-i18n": "accessibility",
    "15-product-engineering": "product",
    "16-ai-integration": "ai",
    "17-case-studies": "case-studies",
  };

  return CATEGORY_MAP[dirName] || dirName.replace(/^\d+-/, "");
}
