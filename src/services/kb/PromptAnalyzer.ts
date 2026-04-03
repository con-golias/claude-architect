/**
 * Prompt Analyzer — extracts concepts, technologies, and domains
 * from natural language user prompts for KB-first lookup.
 *
 * @module prompt-analyzer
 */

import type { PromptAnalysis } from "./KbTypes";

/** Words to skip during concept extraction. */
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "need", "want",
  "for", "and", "nor", "but", "or", "yet", "so", "in", "on", "at",
  "to", "of", "with", "by", "from", "up", "about", "into", "through",
  "during", "before", "after", "then", "once", "here", "there", "when",
  "where", "why", "how", "all", "both", "each", "some", "no", "not",
  "only", "just", "also", "its", "it", "this", "that", "these", "those",
  "what", "which", "who", "if", "else", "me", "my", "i", "you", "your",
  "we", "our", "they", "he", "she", "make", "build", "create", "add",
  "implement", "fix", "update", "change", "write", "set", "get", "use",
  "new", "like", "using", "please", "let", "one", "feature", "function",
  "system", "way", "thing", "something", "everything", "μου", "να",
  "το", "τα", "θελω", "φτιαξε", "κανε", "βαλε", "ενα", "μια",
]);

/** Map common terms and abbreviations to KB folder segments. */
const SYNONYMS: Record<string, string[]> = {
  // Backend
  auth: ["authentication", "authorization"],
  login: ["authentication", "session-management"],
  signup: ["authentication"],
  oauth: ["authentication", "oauth2-oidc"],
  jwt: ["authentication", "jwt-tokens"],
  session: ["session-management", "authentication"],
  api: ["api-design", "api-security"],
  rest: ["api-design", "rest"],
  graphql: ["api-design", "graphql", "graphql-security"],
  grpc: ["api-design", "grpc"],
  websocket: ["real-time", "websockets"],
  ws: ["real-time", "websockets"],
  realtime: ["real-time"],
  "real-time": ["real-time"],
  email: ["email-notifications"],
  mail: ["email-notifications"],
  smtp: ["email-notifications"],
  notification: ["email-notifications"],
  queue: ["message-queues", "background-jobs"],
  mq: ["message-queues"],
  rabbitmq: ["message-queues"],
  kafka: ["message-queues"],
  job: ["background-jobs"],
  cron: ["background-jobs"],
  worker: ["background-jobs"],
  scheduler: ["background-jobs"],
  cache: ["caching", "caching-strategies"],
  redis: ["caching", "message-queues"],
  memcached: ["caching"],
  webhook: ["webhooks"],
  upload: ["file-handling"],
  file: ["file-handling"],
  search: ["search", "query-optimization"],
  elasticsearch: ["search"],
  middleware: ["middleware-pipeline"],
  logging: ["logging-observability"],
  log: ["logging-observability"],
  monitoring: ["monitoring-observability"],
  metrics: ["monitoring-observability", "analytics-telemetry"],
  validation: ["data-validation"],
  rate: ["rate-limiting"],
  throttle: ["rate-limiting"],
  error: ["error-handling"],
  health: ["health-resilience"],
  config: ["configuration"],

  // Database
  db: ["database"],
  database: ["database"],
  sql: ["relational", "query-optimization"],
  postgres: ["relational"],
  postgresql: ["relational"],
  mysql: ["relational"],
  sqlite: ["relational"],
  mongo: ["nosql"],
  mongodb: ["nosql"],
  dynamodb: ["nosql"],
  nosql: ["nosql"],
  migration: ["migrations"],
  orm: ["orm-and-query-builders"],
  prisma: ["orm-and-query-builders"],
  sequelize: ["orm-and-query-builders"],
  transaction: ["transactions"],
  index: ["query-optimization"],
  query: ["query-optimization"],
  vector: ["vector-databases"],
  embedding: ["vector-databases"],

  // Frontend
  react: ["frontend", "web"],
  nextjs: ["frontend", "web"],
  vue: ["frontend", "web"],
  angular: ["frontend", "web"],
  svelte: ["frontend", "web"],
  css: ["frontend", "design-systems"],
  tailwind: ["frontend", "design-systems"],
  component: ["frontend", "design-systems"],
  ui: ["frontend", "design-systems"],
  ux: ["product-engineering"],
  state: ["frontend"],
  redux: ["frontend"],
  mobile: ["mobile"],
  ios: ["mobile", "swift"],
  android: ["mobile"],
  flutter: ["mobile", "dart"],
  "react-native": ["mobile"],
  electron: ["desktop"],
  desktop: ["desktop"],

  // Security
  security: ["security"],
  encrypt: ["data-security"],
  encryption: ["data-security"],
  hash: ["data-security"],
  xss: ["secure-coding", "web-application-security"],
  injection: ["secure-coding"],
  csrf: ["web-application-security"],
  cors: ["web-application-security"],
  ssl: ["infrastructure-security"],
  tls: ["infrastructure-security"],
  https: ["infrastructure-security"],
  owasp: ["owasp-references"],
  gdpr: ["compliance"],
  compliance: ["compliance"],
  vulnerability: ["security-testing"],
  pentest: ["security-testing"],

  // DevOps
  docker: ["containers"],
  container: ["containers"],
  kubernetes: ["containers"],
  k8s: ["containers"],
  ci: ["ci-cd"],
  cd: ["ci-cd"],
  cicd: ["ci-cd"],
  pipeline: ["ci-cd"],
  deploy: ["ci-cd"],
  deployment: ["ci-cd"],
  terraform: ["infrastructure-as-code"],
  iac: ["infrastructure-as-code"],
  cloud: ["cloud-providers"],
  aws: ["cloud-providers"],
  gcp: ["cloud-providers"],
  azure: ["cloud-providers"],
  incident: ["incident-management"],

  // Testing
  test: ["testing"],
  testing: ["testing"],
  unittest: ["unit-testing"],
  unit: ["unit-testing"],
  integration: ["integration-testing"],
  e2e: ["e2e-testing"],
  cypress: ["e2e-testing"],
  playwright: ["e2e-testing"],
  mock: ["unit-testing"],
  tdd: ["testing-philosophy"],

  // Architecture
  architecture: ["architecture"],
  microservice: ["architectural-patterns"],
  microservices: ["architectural-patterns"],
  monolith: ["architectural-patterns"],
  ddd: ["domain-driven-design"],
  domain: ["domain-driven-design"],
  solid: ["solid-principles"],
  pattern: ["design-patterns"],
  clean: ["clean-architecture"],
  cqrs: ["architectural-patterns"],
  event: ["architectural-patterns"],

  // Performance & Scalability
  performance: ["performance"],
  optimize: ["performance"],
  optimization: ["performance"],
  speed: ["performance"],
  fast: ["performance"],
  slow: ["performance"],
  scale: ["scalability"],
  scalability: ["scalability"],
  load: ["horizontal-scaling"],
  cdn: ["cdn-and-edge"],
  async: ["async-processing"],

  // AI
  ai: ["ai-integration"],
  llm: ["llm-integration"],
  ml: ["ml-in-production"],
  openai: ["llm-integration"],
  chatbot: ["llm-integration"],
  prompt: ["llm-integration"],
  rag: ["llm-integration"],

  // Code Quality
  refactor: ["refactoring"],
  lint: ["linting-formatting"],
  review: ["code-review"],
  documentation: ["documentation"],
  docs: ["documentation"],
  debt: ["technical-debt"],

  // Product
  analytics: ["analytics-telemetry"],
  telemetry: ["analytics-telemetry"],
  a11y: ["accessibility"],
  accessibility: ["accessibility"],
  i18n: ["internationalization"],
  internationalization: ["internationalization"],
};

/** Multi-word compounds to detect before tokenizing. */
const COMPOUNDS: Record<string, string> = {
  "background jobs": "background-jobs",
  "real time": "real-time",
  "api design": "api-design",
  "error handling": "error-handling",
  "state management": "state-management",
  "data modeling": "data-modeling",
  "code review": "code-review",
  "design patterns": "design-patterns",
  "clean architecture": "clean-architecture",
  "rate limiting": "rate-limiting",
  "load balancing": "load-balancing",
  "message queue": "message-queues",
  "file upload": "file-handling",
  "email marketing": "email-notifications",
  "push notification": "email-notifications",
  "web security": "web-application-security",
  "sql injection": "secure-coding",
  "unit test": "unit-testing",
  "integration test": "integration-testing",
  "ci cd": "ci-cd",
  "machine learning": "ml-in-production",
  "design system": "design-systems",
  "data validation": "data-validation",
  "session management": "session-management",
  "access control": "authentication-authorization",
  "role based": "rbac-abac",
};

/** Map concept keywords to top-level KB categories. */
const CATEGORY_MAP: Record<string, string> = {
  frontend: "frontend", react: "frontend", vue: "frontend", angular: "frontend",
  css: "frontend", component: "frontend", ui: "frontend", svelte: "frontend",
  backend: "backend", api: "backend", server: "backend", express: "backend",
  middleware: "backend", route: "backend", endpoint: "backend",
  database: "database", sql: "database", mongo: "database", postgres: "database",
  orm: "database", migration: "database", query: "database",
  security: "security", auth: "security", encrypt: "security", xss: "security",
  owasp: "security", vulnerability: "security", csrf: "security",
  testing: "testing", test: "testing", spec: "testing", e2e: "testing",
  jest: "testing", cypress: "testing", playwright: "testing",
  devops: "devops", docker: "devops", kubernetes: "devops", ci: "devops",
  deploy: "devops", pipeline: "devops", terraform: "devops",
  performance: "performance", optimize: "performance", cache: "performance",
  speed: "performance", benchmark: "performance",
  scalability: "scalability", scale: "scalability", load: "scalability",
  architecture: "architecture", microservice: "architecture", pattern: "architecture",
  ddd: "architecture", solid: "architecture", clean: "architecture",
  ai: "ai", llm: "ai", ml: "ai", openai: "ai", chatbot: "ai",
};

/** Known technology/framework names. */
const TECHNOLOGIES = new Set([
  "react", "nextjs", "vue", "nuxt", "angular", "svelte", "express", "fastify",
  "nestjs", "django", "flask", "fastapi", "spring", "rails", "laravel",
  "postgres", "postgresql", "mysql", "sqlite", "mongodb", "redis", "elasticsearch",
  "docker", "kubernetes", "terraform", "ansible", "nginx", "apache",
  "typescript", "javascript", "python", "go", "rust", "java", "kotlin", "swift",
  "dart", "csharp", "ruby", "graphql", "grpc", "kafka", "rabbitmq",
  "prisma", "sequelize", "typeorm", "drizzle", "jest", "vitest", "cypress",
  "playwright", "webpack", "vite", "bun", "deno", "node", "firebase",
  "supabase", "aws", "gcp", "azure", "vercel", "cloudflare", "tailwind",
  "bootstrap", "material", "flutter", "electron", "tauri",
]);

/**
 * Analyze a user prompt to extract concepts, technologies, and domain signals.
 */
export function analyzePrompt(prompt: string): PromptAnalysis {
  const lower = prompt.toLowerCase();

  // Step 1: Detect compound terms before tokenizing
  const expandedTerms: string[] = [];
  for (const [compound, replacement] of Object.entries(COMPOUNDS)) {
    if (lower.includes(compound)) {
      expandedTerms.push(replacement);
    }
  }

  // Step 2: Tokenize and remove stopwords
  const tokens = lower
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));

  // Step 3: Extract concepts (non-stopword tokens)
  const concepts = [...new Set(tokens)];

  // Step 4: Identify technologies
  const technologies: string[] = [];
  for (const token of concepts) {
    if (TECHNOLOGIES.has(token)) {
      technologies.push(token);
    }
  }

  // Step 5: Synonym expansion
  for (const token of concepts) {
    const synonyms = SYNONYMS[token];
    if (synonyms) {
      for (const syn of synonyms) expandedTerms.push(syn);
    }
    // Also add the raw token
    expandedTerms.push(token);
  }

  // Step 6: Infer categories
  const categorySet = new Set<string>();
  for (const token of concepts) {
    const cat = CATEGORY_MAP[token];
    if (cat) categorySet.add(cat);
  }
  for (const term of expandedTerms) {
    const cat = CATEGORY_MAP[term];
    if (cat) categorySet.add(cat);
  }

  return {
    concepts,
    technologies,
    categories: [...categorySet],
    queryTerms: concepts,
    expandedTerms: [...new Set(expandedTerms)],
  };
}
