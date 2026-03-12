# Static Site Generation (SSG)

> **AI Plugin Directive — Static Site Generation:**
> When the developer builds content-driven sites, marketing pages, blogs, documentation, or any page where content changes infrequently, APPLY static generation patterns. Use SSG as the DEFAULT rendering strategy. Generate HTML at build time, serve from CDN, achieve near-instant TTFB. Fall back to ISR or SSR ONLY when content freshness requirements exceed build-time capabilities.

**Core Rule: GENERATE pages at build time whenever content is known ahead of user request. Static HTML served from CDN edge is the fastest possible delivery — use SSG as the baseline and ONLY add dynamic rendering when static is insufficient.**

---

## Table of Contents
1. [SSG Rendering Model](#1-ssg-rendering-model)
2. [Build-Time Data Fetching](#2-build-time-data-fetching)
3. [Static Path Generation](#3-static-path-generation)
4. [Next.js App Router SSG](#4-nextjs-app-router-ssg)
5. [Astro Static Generation](#5-astro-static-generation)
6. [Hugo / Eleventy Pure SSG](#6-hugo--eleventy-pure-ssg)
7. [CDN and Caching Architecture](#7-cdn-and-caching-architecture)
8. [Build Performance Optimization](#8-build-performance-optimization)
9. [Dynamic Elements in Static Pages](#9-dynamic-elements-in-static-pages)
10. [Content Pipeline Integration](#10-content-pipeline-integration)
11. [SEO Advantages of SSG](#11-seo-advantages-of-ssg)
12. [When SSG Breaks Down](#12-when-ssg-breaks-down)
13. [Anti-Patterns](#13-anti-patterns)
14. [Enforcement Checklist](#14-enforcement-checklist)

---

## 1. SSG Rendering Model

```
BUILD TIME (CI/CD)                              REQUEST TIME (CDN Edge)
┌──────────────────────────────────┐             ┌─────────────────────┐
│                                  │             │                     │
│  CMS / API / Files               │             │   User Request      │
│       │                          │             │       │             │
│       ▼                          │             │       ▼             │
│  Fetch ALL Data                  │             │   CDN Edge Cache    │
│       │                          │             │   (already built)   │
│       ▼                          │             │       │             │
│  Render HTML + CSS + JS          │             │       ▼             │
│       │                          │             │   Return HTML       │
│       ▼                          │             │   (< 50ms TTFB)     │
│  Write .html Files               │             │                     │
│       │                          │             └─────────────────────┘
│       ▼                          │
│  Upload to CDN                   │
│                                  │
└──────────────────────────────────┘
```

### Performance Characteristics

| Metric | SSG Value | Why |
|--------|-----------|-----|
| TTFB | **< 50ms** | Pre-built HTML at CDN edge |
| FCP | **< 1s** | Full HTML delivered immediately |
| LCP | **< 1.5s** | No server computation delay |
| TTI | **< 2s** | Minimal JS to hydrate (or zero) |
| CLS | **~0** | Layout known at build time |
| Server Cost | **Near $0** | CDN serves static files |

### What the CDN Serves

```html
<!-- Fully rendered HTML — no server processing at request time -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Complete Page Title — Built at 2024-01-15T10:30:00Z</title>
  <meta name="description" content="Full meta description available">
  <link rel="stylesheet" href="/styles/page-abc123.css">
  <!-- Critical CSS inlined for instant render -->
  <style>
    .hero { display: flex; min-height: 60vh; }
    .hero-title { font-size: 3rem; font-weight: 700; }
  </style>
</head>
<body>
  <!-- Complete content — crawlers see everything -->
  <main>
    <article>
      <h1>Article Title</h1>
      <p>Full article content rendered at build time...</p>
    </article>
  </main>
  <!-- Minimal JS for interactivity (optional) -->
  <script src="/js/interactions-def456.js" defer></script>
</body>
</html>
```

---

## 2. Build-Time Data Fetching

### Data Source Patterns

```
┌─────────────────────────────────────────────────────┐
│                   BUILD PROCESS                      │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Headless │  │ Markdown │  │ External APIs     │  │
│  │ CMS      │  │ / MDX    │  │ (REST / GraphQL)  │  │
│  │          │  │ Files    │  │                   │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │              │
│       └──────────────┼─────────────────┘              │
│                      ▼                                │
│              Data Aggregation Layer                   │
│                      │                                │
│                      ▼                                │
│              Template Rendering                       │
│                      │                                │
│                      ▼                                │
│              Static HTML Output                       │
└─────────────────────────────────────────────────────┘
```

### Fetching from Headless CMS

```typescript
// lib/cms.ts — Build-time CMS integration
interface Article {
  slug: string;
  title: string;
  content: string;
  publishedAt: string;
  author: { name: string; avatar: string };
  tags: string[];
}

// ALWAYS cache CMS responses during build to avoid redundant API calls
const buildCache = new Map<string, unknown>();

export async function getArticles(): Promise<Article[]> {
  const cacheKey = 'all-articles';
  if (buildCache.has(cacheKey)) {
    return buildCache.get(cacheKey) as Article[];
  }

  const response = await fetch(`${process.env.CMS_URL}/api/articles`, {
    headers: { Authorization: `Bearer ${process.env.CMS_TOKEN}` },
  });

  if (!response.ok) {
    throw new Error(`CMS fetch failed: ${response.status}`);
  }

  const articles = await response.json();
  buildCache.set(cacheKey, articles);
  return articles;
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const articles = await getArticles(); // Uses build cache
  return articles.find(a => a.slug === slug) ?? null;
}
```

### Fetching from Markdown / MDX

```typescript
// lib/content.ts — File-based content
import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import { compileMDX } from 'next-mdx-remote/rsc';

const CONTENT_DIR = path.join(process.cwd(), 'content');

export async function getAllPosts() {
  const files = await fs.readdir(path.join(CONTENT_DIR, 'blog'));

  const posts = await Promise.all(
    files
      .filter(f => f.endsWith('.mdx'))
      .map(async (filename) => {
        const filePath = path.join(CONTENT_DIR, 'blog', filename);
        const source = await fs.readFile(filePath, 'utf-8');
        const { data } = matter(source);

        return {
          slug: filename.replace('.mdx', ''),
          title: data.title,
          date: data.date,
          excerpt: data.excerpt,
          tags: data.tags ?? [],
        };
      })
  );

  // ALWAYS sort posts — never rely on filesystem order
  return posts.sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export async function getPostContent(slug: string) {
  const filePath = path.join(CONTENT_DIR, 'blog', `${slug}.mdx`);
  const source = await fs.readFile(filePath, 'utf-8');

  const { content, frontmatter } = await compileMDX<{
    title: string;
    date: string;
    tags: string[];
  }>({
    source,
    options: { parseFrontmatter: true },
  });

  return { content, frontmatter };
}
```

---

## 3. Static Path Generation

### Next.js generateStaticParams

```typescript
// app/blog/[slug]/page.tsx
import { getAllPosts, getPostContent } from '@/lib/content';

// MUST export generateStaticParams for dynamic SSG routes
export async function generateStaticParams() {
  const posts = await getAllPosts();

  return posts.map((post) => ({
    slug: post.slug,
  }));
}

// MUST export generateMetadata for SSG SEO
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const { frontmatter } = await getPostContent(slug);

  return {
    title: frontmatter.title,
    description: frontmatter.excerpt,
    openGraph: {
      title: frontmatter.title,
      type: 'article',
      publishedTime: frontmatter.date,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const { content, frontmatter } = await getPostContent(slug);

  return (
    <article>
      <h1>{frontmatter.title}</h1>
      <time dateTime={frontmatter.date}>
        {new Date(frontmatter.date).toLocaleDateString()}
      </time>
      <div className="prose">{content}</div>
    </article>
  );
}
```

### Nested Dynamic Routes

```typescript
// app/docs/[category]/[slug]/page.tsx
export async function generateStaticParams() {
  const docs = await getAllDocs();

  // MUST return ALL combinations of nested params
  return docs.map((doc) => ({
    category: doc.category,
    slug: doc.slug,
  }));
}
```

### Catch-All Routes

```typescript
// app/docs/[...slug]/page.tsx
export async function generateStaticParams() {
  const pages = await getAllDocPages();

  // Returns arrays for catch-all: /docs/getting-started/installation
  return pages.map((page) => ({
    slug: page.path.split('/'), // ['getting-started', 'installation']
  }));
}
```

### Fallback Behavior

```typescript
// next.config.js — Control behavior for non-generated paths
/** @type {import('next').NextConfig} */
const nextConfig = {
  // For full SSG export (no server)
  output: 'export',

  // For hybrid — control dynamic route behavior
  // dynamicParams in page.tsx controls fallback
};

// In page.tsx:
// false = 404 for non-generated paths (true SSG)
// true = generate on-demand (becomes ISR)
export const dynamicParams = false;
```

---

## 4. Next.js App Router SSG

### Force Static Generation

```typescript
// app/about/page.tsx
// Pages without dynamic data are AUTOMATICALLY static in App Router

export default function AboutPage() {
  return (
    <main>
      <h1>About Us</h1>
      <p>This page is statically generated at build time.</p>
    </main>
  );
}

// Force static even with dynamic-looking code:
export const dynamic = 'force-static';
export const revalidate = false; // Never revalidate = pure SSG
```

### Static Generation with Data

```typescript
// app/products/page.tsx
// Server Components fetch data at BUILD time by default

async function getProducts() {
  // This fetch happens at BUILD TIME (not request time)
  const res = await fetch('https://api.store.com/products', {
    // No cache option = static by default in App Router
  });
  return res.json();
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <main>
      <h1>Products</h1>
      <div className="grid grid-cols-3 gap-4">
        {products.map((product: Product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </main>
  );
}
```

### Full Static Export

```typescript
// next.config.js — Complete static site (no Node.js server)
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',

  // MUST configure for static export
  images: {
    unoptimized: true, // No Image Optimization API available
  },

  // Optional: trailing slashes for static hosting
  trailingSlash: true,

  // Optional: base path for non-root deployment
  basePath: '/docs',
};

module.exports = nextConfig;
```

### Features NOT Available in Static Export

| Feature | Available? | Alternative |
|---------|------------|-------------|
| Image Optimization | ❌ | Use external service (Cloudinary, imgix) |
| API Routes | ❌ | Use external API / serverless functions |
| ISR | ❌ | Rebuild on content change via webhook |
| Middleware | ❌ | Use CDN edge rules (Cloudflare Workers) |
| Draft Mode | ❌ | Use CMS preview URL |
| Server Actions | ❌ | Use external API endpoints |

---

## 5. Astro Static Generation

### Astro — Built for SSG

```astro
---
// src/pages/blog/[slug].astro
import { getCollection } from 'astro:content';
import BlogLayout from '@/layouts/BlogLayout.astro';

// MUST export getStaticPaths for dynamic routes
export async function getStaticPaths() {
  const posts = await getCollection('blog');

  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await post.render();
---

<BlogLayout title={post.data.title}>
  <article>
    <h1>{post.data.title}</h1>
    <time datetime={post.data.date.toISOString()}>
      {post.data.date.toLocaleDateString()}
    </time>
    <Content />
  </article>
</BlogLayout>
```

### Astro Content Collections

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    draft: z.boolean().default(false),
    tags: z.array(z.string()),
    image: z.string().optional(),
  }),
});

const docs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    order: z.number(),
    category: z.string(),
  }),
});

export const collections = { blog, docs };
```

### Astro Island Architecture

```astro
---
// Static page with interactive islands
import StaticHeader from '@/components/StaticHeader.astro';
import SearchWidget from '@/components/SearchWidget.tsx';
import Newsletter from '@/components/Newsletter.tsx';
---

<!-- Static — zero JS shipped -->
<StaticHeader />

<!-- Island — hydrated on page load -->
<SearchWidget client:load />

<!-- Island — hydrated when visible -->
<Newsletter client:visible />

<!-- Island — hydrated on idle -->
<RelatedPosts client:idle posts={relatedPosts} />

<!-- Island — hydrated on media query -->
<MobileMenu client:media="(max-width: 768px)" />
```

### Zero-JS by Default

```
ASTRO OUTPUT COMPARISON
┌──────────────────────────────────────────────────┐
│ Traditional SSG (Next.js static export)          │
│ HTML: 15 KB + JS Bundle: 85 KB = 100 KB total    │
│                                                   │
│ Astro (no islands)                                │
│ HTML: 15 KB + JS Bundle: 0 KB = 15 KB total      │
│                                                   │
│ Astro (with 2 islands)                            │
│ HTML: 15 KB + JS: 12 KB (only island code) = 27 KB│
└──────────────────────────────────────────────────┘
```

---

## 6. Hugo / Eleventy Pure SSG

### Hugo — Build Speed Champion

```toml
# hugo.toml — Configuration
baseURL = 'https://example.com'
languageCode = 'en-us'
title = 'My Site'

[params]
  description = 'Site description for SEO'

[markup.goldmark.renderer]
  unsafe = false  # NEVER enable unsafe HTML in markdown

[outputs]
  home = ['HTML', 'RSS', 'JSON']  # Generate search index
```

```html
<!-- layouts/_default/single.html — Hugo template -->
{{ define "main" }}
<article>
  <h1>{{ .Title }}</h1>
  <time datetime="{{ .Date.Format "2006-01-02" }}">
    {{ .Date.Format "January 2, 2006" }}
  </time>

  {{ if .Params.toc }}
    <nav class="toc">{{ .TableOfContents }}</nav>
  {{ end }}

  <div class="content">
    {{ .Content }}
  </div>

  {{ with .GetTerms "tags" }}
    <div class="tags">
      {{ range . }}
        <a href="{{ .Permalink }}">{{ .LinkTitle }}</a>
      {{ end }}
    </div>
  {{ end }}
</article>
{{ end }}
```

### Eleventy (11ty) — Flexibility Champion

```javascript
// .eleventy.js — Configuration
module.exports = function(eleventyConfig) {
  // Collections
  eleventyConfig.addCollection('posts', (collectionApi) => {
    return collectionApi
      .getFilteredByGlob('src/posts/**/*.md')
      .sort((a, b) => b.date - a.date);
  });

  // Filters
  eleventyConfig.addFilter('dateFormat', (date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    }).format(date);
  });

  // Shortcodes
  eleventyConfig.addShortcode('image', (src, alt) => {
    return `<img src="${src}" alt="${alt}" loading="lazy" decoding="async">`;
  });

  // Passthrough copy
  eleventyConfig.addPassthroughCopy('src/assets');

  return {
    dir: { input: 'src', output: '_site' },
    markdownTemplateEngine: 'njk',
  };
};
```

### SSG Framework Comparison

| Feature | Next.js (export) | Astro | Hugo | Eleventy |
|---------|-------------------|-------|------|----------|
| Build Speed (1K pages) | ~60s | ~30s | **~2s** | ~15s |
| Language | TypeScript | TS/JS | Go templates | JS |
| JS in Output | Framework bundle | **Islands only** | None | None |
| Component Framework | React | Any (React/Vue/Svelte) | None | None |
| Content Collections | Manual | **Built-in** | Built-in | Plugin |
| Image Optimization | External only | Built-in | Built-in | Plugin |
| Learning Curve | Medium | Low | Medium | Low |
| Best For | React teams | Content + islands | Speed-critical | Maximum flexibility |

---

## 7. CDN and Caching Architecture

### Deployment Architecture

```
┌──────────┐     ┌──────────────────────────────────────┐
│ Build CI │────▶│         CDN Edge Network              │
│ (GitHub  │     │                                       │
│  Actions)│     │  ┌─────────┐  ┌─────────┐  ┌──────┐  │
│          │     │  │ Edge    │  │ Edge    │  │ Edge │  │
│          │     │  │ US-East │  │ EU-West │  │ APAC │  │
│          │     │  └────┬────┘  └────┬────┘  └──┬───┘  │
│          │     │       │            │           │      │
└──────────┘     │       ▼            ▼           ▼      │
                 │      Users        Users       Users   │
                 └──────────────────────────────────────┘
```

### Cache Headers for Static Assets

```nginx
# MUST set immutable cache for hashed assets
location ~* \.(js|css)$ {
  # Hashed filenames (page-abc123.js) — cache forever
  add_header Cache-Control "public, max-age=31536000, immutable";
}

# HTML pages — short cache with revalidation
location ~* \.html$ {
  add_header Cache-Control "public, max-age=3600, must-revalidate";
}

# Images with content hash
location ~* \.(png|jpg|webp|avif|svg)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
}

# Fonts — long cache
location ~* \.(woff2|woff)$ {
  add_header Cache-Control "public, max-age=31536000, immutable";
  add_header Access-Control-Allow-Origin "*";
}
```

### CDN Invalidation on Deploy

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy SSG
on:
  push:
    branches: [main]
  # Webhook from CMS for content changes
  repository_dispatch:
    types: [content-update]

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install and Build
        run: |
          npm ci
          npm run build

      - name: Deploy to CDN
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          projectName: my-site
          directory: out

      - name: Purge CDN Cache
        run: |
          curl -X POST "https://api.cloudflare.com/client/v4/zones/${{ secrets.CF_ZONE_ID }}/purge_cache" \
            -H "Authorization: Bearer ${{ secrets.CF_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            --data '{"purge_everything":true}'
```

---

## 8. Build Performance Optimization

### Problem: Build Time Grows with Pages

```
PAGES vs BUILD TIME (unoptimized)
┌────────────────────────────────────────┐
│                                    ╱   │
│ Build                           ╱      │
│ Time                         ╱         │
│ (min)                     ╱            │
│                        ╱               │
│                     ╱                  │
│                  ╱                     │
│               ╱                        │
│            ╱                           │
│         ╱                              │
│      ╱                                 │
│   ╱                                    │
├────────────────────────────────────────┤
│ 100   1K    5K    10K   50K   100K     │
│              Number of Pages           │
└────────────────────────────────────────┘
```

### Optimization Strategies

```typescript
// 1. Parallel data fetching — NEVER sequential
// ❌ BAD: Sequential fetching
const categories = await getCategories();
const authors = await getAuthors();
const tags = await getTags();

// ✅ GOOD: Parallel fetching
const [categories, authors, tags] = await Promise.all([
  getCategories(),
  getAuthors(),
  getTags(),
]);
```

```typescript
// 2. Build-time caching — Cache API responses across pages
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.build-cache');

function getCachedData<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cachePath = path.join(CACHE_DIR, `${key}.json`);

  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, 'utf-8'));
  }

  return fetcher().then(data => {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cachePath, JSON.stringify(data));
    return data;
  });
}
```

```typescript
// 3. Incremental builds — Only rebuild changed pages
// next.config.js
module.exports = {
  // Enable build cache
  generateBuildId: async () => {
    // Use git commit hash for deterministic builds
    return require('child_process')
      .execSync('git rev-parse HEAD')
      .toString()
      .trim();
  },
};
```

### Large-Scale SSG Strategies

| Scale | Strategy | Example |
|-------|----------|---------|
| < 1K pages | Full rebuild | Standard Next.js/Astro build |
| 1K–10K pages | Parallel build + caching | Worker pools, build cache |
| 10K–100K pages | Incremental + on-demand | ISR, build only changed pages |
| 100K+ pages | Hybrid SSG/ISR | Pre-build top pages, ISR for long tail |

---

## 9. Dynamic Elements in Static Pages

### Client-Side Dynamic Sections

```tsx
// Static page with dynamic sections — NEVER make entire page dynamic
// for a single dynamic element

// components/StaticPage.tsx (Server Component — rendered at build)
import { CommentSection } from './CommentSection';
import { ViewCounter } from './ViewCounter';

export default function BlogPost({ post }: { post: Post }) {
  return (
    <article>
      {/* Static — built at compile time */}
      <h1>{post.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: post.htmlContent }} />

      {/* Dynamic — fetched on client */}
      <ViewCounter slug={post.slug} />
      <CommentSection postId={post.id} />
    </article>
  );
}

// components/ViewCounter.tsx — Client Component
'use client';
import { useEffect, useState } from 'react';

export function ViewCounter({ slug }: { slug: string }) {
  const [views, setViews] = useState<number | null>(null);

  useEffect(() => {
    // Fire-and-forget view increment
    fetch(`/api/views/${slug}`, { method: 'POST' });

    // Fetch current count
    fetch(`/api/views/${slug}`)
      .then(res => res.json())
      .then(data => setViews(data.count));
  }, [slug]);

  return (
    <span className="text-sm text-gray-500">
      {views !== null ? `${views.toLocaleString()} views` : ''}
    </span>
  );
}
```

### Hybrid Static + API Pattern

```
PAGE STRUCTURE
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │     STATIC SHELL (SSG)              │ │
│ │     Header, Nav, Footer, Layout     │ │
│ │                                     │ │
│ │  ┌──────────────────────────────┐   │ │
│ │  │   STATIC CONTENT (SSG)       │   │ │
│ │  │   Article body, images       │   │ │
│ │  └──────────────────────────────┘   │ │
│ │                                     │ │
│ │  ┌──────────┐  ┌───────────────┐   │ │
│ │  │ DYNAMIC  │  │ DYNAMIC       │   │ │
│ │  │ Comments │  │ Related Posts │   │ │
│ │  │ (client) │  │ (client)      │   │ │
│ │  └──────────┘  └───────────────┘   │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Search in Static Sites

```typescript
// Build-time search index generation
// scripts/build-search-index.ts
import { getAllPosts } from '@/lib/content';
import { writeFileSync } from 'fs';

async function buildSearchIndex() {
  const posts = await getAllPosts();

  const index = posts.map(post => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    tags: post.tags,
    // Include content for full-text search
    content: post.plainText.slice(0, 500),
  }));

  writeFileSync(
    'public/search-index.json',
    JSON.stringify(index)
  );
}

buildSearchIndex();
```

```tsx
// Client-side search using pre-built index
'use client';
import { useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';

export function SearchWidget() {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState<SearchItem[]>([]);

  useEffect(() => {
    fetch('/search-index.json')
      .then(res => res.json())
      .then(setIndex);
  }, []);

  const fuse = useMemo(
    () => new Fuse(index, {
      keys: ['title', 'excerpt', 'tags', 'content'],
      threshold: 0.3,
    }),
    [index]
  );

  const results = query ? fuse.search(query).slice(0, 10) : [];

  return (
    <div role="search">
      <input
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search articles..."
        aria-label="Search articles"
      />
      {results.length > 0 && (
        <ul role="listbox">
          {results.map(({ item }) => (
            <li key={item.slug} role="option">
              <a href={`/blog/${item.slug}`}>{item.title}</a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

---

## 10. Content Pipeline Integration

### CMS Webhook → Rebuild

```
CONTENT UPDATE FLOW
┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌─────┐
│ Content  │────▶│ CMS Webhook  │────▶│ CI/CD    │────▶│ CDN │
│ Editor   │     │ (POST)       │     │ Rebuild  │     │     │
│ publishes│     │              │     │ + Deploy │     │     │
└──────────┘     └──────────────┘     └──────────┘     └─────┘
     │                                      │
     │         Typical latency: 1-5 min     │
     └──────────────────────────────────────┘
```

### GitHub Actions Webhook Trigger

```yaml
# .github/workflows/content-update.yml
name: Content Update Rebuild
on:
  repository_dispatch:
    types: [content-published, content-updated, content-deleted]

jobs:
  rebuild:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Log content change
        run: |
          echo "Content event: ${{ github.event.action }}"
          echo "Payload: ${{ toJSON(github.event.client_payload) }}"

      - name: Build
        run: npm ci && npm run build

      - name: Deploy
        run: npm run deploy
```

### CMS Webhook Handler

```typescript
// api/webhook/cms.ts — Validate and trigger rebuild
import crypto from 'crypto';

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get('x-webhook-signature');

  // MUST validate webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return new Response('Invalid signature', { status: 401 });
  }

  // Trigger GitHub Actions rebuild
  await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPO}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: 'content-published',
        client_payload: JSON.parse(body),
      }),
    }
  );

  return new Response('Rebuild triggered', { status: 200 });
}
```

---

## 11. SEO Advantages of SSG

### Why SSG is Optimal for SEO

| SEO Factor | SSG Advantage |
|------------|---------------|
| Crawlability | Complete HTML — no JS execution needed |
| Page Speed | Fastest possible TTFB from CDN |
| Core Web Vitals | Best LCP/CLS scores achievable |
| Consistency | Same content for every crawler visit |
| Sitemap | Generated at build time with accurate lastmod |
| Structured Data | Embedded in HTML, immediately parseable |
| Meta Tags | Correct on first byte — no client-side injection |

### Build-Time Sitemap Generation

```typescript
// app/sitemap.ts — Next.js automatic sitemap
import { getAllPosts } from '@/lib/content';
import { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getAllPosts();
  const baseUrl = 'https://example.com';

  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 1 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.9 },
  ];

  const blogPages = posts.map(post => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt ?? post.date),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...blogPages];
}
```

---

## 12. When SSG Breaks Down

### SSG Limitations Decision Tree

```
Does the page need user-specific content?
├── YES → DO NOT use SSG → Use SSR or CSR
│
├── NO → Does content change more than once per hour?
│   ├── YES → Consider ISR (revalidate: 3600)
│   │         or SSR with CDN caching
│   │
│   └── NO → Does the site have > 100K pages?
│       ├── YES → Hybrid: SSG for top pages + ISR for long tail
│       │
│       └── NO → Does build take > 10 minutes?
│           ├── YES → Optimize build OR switch to ISR
│           │
│           └── NO → ✅ USE SSG
```

### When to Move Away from SSG

| Scenario | Problem | Solution |
|----------|---------|----------|
| Real-time prices | Stale data within seconds | SSR + short cache or CSR |
| User dashboards | Personalized content | CSR with API |
| A/B testing | Different content per user | Edge middleware + SSR |
| Inventory status | Rapid changes | Client-side fetch overlay |
| Comments/reviews | User-generated content | Static page + client-side fetch |
| Build > 15 min | Too slow for content team | ISR or on-demand revalidation |
| 500K+ pages | Build time impractical | ISR for long tail pages |

---

## 13. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| SSG for authenticated pages | Shows wrong user data / login wall | Use CSR or SSR for authenticated content |
| Rebuilding entire site for 1 change | 15+ minute builds for a typo fix | Use ISR or targeted rebuild pipelines |
| No build cache | Each build fetches same CMS data | Cache API responses in `.build-cache/` |
| Embedding secrets in HTML | API keys visible in page source | Use environment variables, server-side only |
| Dynamic imports without fallback | Flash of empty content | Add loading skeleton in static HTML |
| No CDN cache headers | Origin hit for every request | Set immutable headers for hashed assets |
| Storing dynamic data in SSG | View counts, stock levels become stale | Fetch dynamic data client-side as overlay |
| Missing `generateStaticParams` | Dynamic routes fallback to SSR | Define all paths at build time |
| Sequential CMS API calls | Build time grows linearly | Parallelize with `Promise.all()` |
| Skipping sitemap generation | Crawlers miss pages | Auto-generate sitemap at build time |

---

## 14. Enforcement Checklist

- [ ] Default to SSG for all content-driven pages
- [ ] Run `generateStaticParams` for every dynamic SSG route
- [ ] Set `dynamicParams = false` for true SSG (no fallback)
- [ ] Fetch all build-time data with `Promise.all()` (never sequential)
- [ ] Cache CMS API responses during build to avoid redundant calls
- [ ] Set `Cache-Control: public, max-age=31536000, immutable` for hashed assets
- [ ] Set `Cache-Control: public, max-age=3600, must-revalidate` for HTML
- [ ] Generate sitemap.xml at build time with accurate `lastmod`
- [ ] Use client-side fetching for dynamic elements (comments, views, prices)
- [ ] Configure CMS webhooks to trigger rebuild on publish
- [ ] Verify TTFB < 50ms from CDN edge after deployment
- [ ] Confirm no `<!-- TODO -->` placeholders or secrets in generated HTML
- [ ] Use `output: 'export'` for pure static sites (no server dependency)
- [ ] Monitor build times — escalate to ISR if builds exceed 10 minutes
- [ ] Verify all pages pass Lighthouse SEO audit at 100
