# Astro Project Structure

> **Domain:** Project Structure > Web > Frontend
> **Difficulty:** Intermediate-Advanced
> **Last Updated:** 2025

---

## Overview

Astro is a content-focused web framework built around the "Islands Architecture" -- it ships zero
JavaScript by default and lets you selectively hydrate interactive components (islands) using any
UI framework (React, Vue, Svelte, Solid, etc.). Astro 4.x and 5.x (2024-2025) introduced Content
Collections with type-safe schemas, Content Layer API, Server Islands, and improved Actions.

Astro is the ideal choice for content-heavy sites (blogs, documentation, marketing, e-commerce
storefronts), but with Astro Actions and server islands it increasingly handles dynamic
application scenarios as well.

---

## Why Structure Matters in Astro

- **`src/pages/` is file-based routing**: Every `.astro` or `.md` file in `pages/` becomes a route;
  misplaced files create unintended routes
- **Content Collections require `src/content/`**: Collections must live in this specific directory
  with a `config.ts` schema definition
- **Islands require explicit hydration directives**: Components without `client:*` directives ship
  zero JS -- this means component placement and import patterns matter
- **Integration-based architecture**: Astro's capabilities come from integrations (`@astrojs/react`,
  `@astrojs/tailwind`, etc.) which affect configuration but not directory structure
- **Mixed framework components**: Astro can use React, Vue, and Svelte components in the same
  project, requiring clear organizational patterns

---

## Enterprise Astro Project Structure

```
my-astro-site/
├── .astro/                              # GENERATED - gitignored, type cache
│   └── types.d.ts
├── public/                              # Static assets (served as-is, no processing)
│   ├── favicon.svg
│   ├── favicon.ico
│   ├── robots.txt
│   ├── sitemap.xml                      # Or generated via @astrojs/sitemap
│   ├── fonts/
│   │   ├── inter-var.woff2
│   │   └── mono.woff2
│   ├── images/                          # Non-optimized images (logos, og-images)
│   │   ├── og-default.png
│   │   └── logo.svg
│   └── _headers                         # Netlify/Cloudflare headers (if applicable)
├── src/
│   ├── actions/                         # Astro Actions (server mutations, Astro 4.15+)
│   │   ├── index.ts                     # Action definitions entry point
│   │   ├── newsletter.ts               # Newsletter subscription action
│   │   ├── contact.ts                   # Contact form action
│   │   └── auth.ts                      # Authentication actions
│   ├── assets/                          # Processed assets (optimized by Astro)
│   │   ├── images/                      # Images optimized via <Image> component
│   │   │   ├── hero.jpg
│   │   │   ├── team/
│   │   │   │   ├── alice.jpg
│   │   │   │   └── bob.jpg
│   │   │   └── blog/                    # Blog post images
│   │   │       └── post-1-cover.jpg
│   │   └── icons/                       # SVG icons (processed)
│   │       ├── arrow-right.svg
│   │       └── menu.svg
│   ├── components/                      # Reusable components
│   │   ├── astro/                       # Pure Astro components (zero JS)
│   │   │   ├── Card.astro
│   │   │   ├── Badge.astro
│   │   │   ├── Prose.astro             # Markdown content wrapper
│   │   │   ├── TableOfContents.astro
│   │   │   ├── Pagination.astro
│   │   │   ├── SEO.astro               # Meta tags component
│   │   │   ├── Breadcrumb.astro
│   │   │   └── Image.astro             # Enhanced image wrapper
│   │   ├── layout/                      # Layout-specific components
│   │   │   ├── Header.astro
│   │   │   ├── Footer.astro
│   │   │   ├── Navigation.astro
│   │   │   ├── Sidebar.astro
│   │   │   ├── MobileMenu.astro        # May contain an island for interactivity
│   │   │   └── ThemeToggle.astro
│   │   ├── sections/                    # Page sections (landing page blocks)
│   │   │   ├── Hero.astro
│   │   │   ├── Features.astro
│   │   │   ├── Pricing.astro
│   │   │   ├── Testimonials.astro
│   │   │   ├── CTA.astro
│   │   │   └── FAQ.astro
│   │   ├── blog/                        # Blog-specific components
│   │   │   ├── PostCard.astro
│   │   │   ├── PostList.astro
│   │   │   ├── PostHeader.astro
│   │   │   ├── PostMeta.astro
│   │   │   ├── AuthorCard.astro
│   │   │   ├── RelatedPosts.astro
│   │   │   └── ShareButtons.astro
│   │   ├── docs/                        # Documentation-specific components
│   │   │   ├── DocsSidebar.astro
│   │   │   ├── DocsSearch.astro         # May wrap a React search island
│   │   │   ├── DocsNavigation.astro
│   │   │   └── CodeBlock.astro
│   │   ├── islands/                     # Interactive components (HYDRATED)
│   │   │   ├── react/                   # React islands
│   │   │   │   ├── SearchDialog.tsx     # Used with client:load
│   │   │   │   ├── CommentSection.tsx   # Used with client:visible
│   │   │   │   ├── ShoppingCart.tsx     # Used with client:load
│   │   │   │   ├── LiveChat.tsx        # Used with client:idle
│   │   │   │   └── DataTable.tsx       # Used with client:visible
│   │   │   ├── vue/                     # Vue islands (if multi-framework)
│   │   │   │   └── ImageGallery.vue
│   │   │   ├── svelte/                  # Svelte islands
│   │   │   │   └── Counter.svelte
│   │   │   └── solid/                   # Solid islands
│   │   │       └── Toggle.tsx
│   │   └── common/                      # Framework-agnostic shared components
│   │       ├── Button.astro
│   │       ├── Icon.astro
│   │       └── Tooltip.astro
│   ├── content/                         # Content Collections (Astro's killer feature)
│   │   ├── config.ts                    # Collection schemas (Zod-based)
│   │   ├── blog/                        # Blog posts collection
│   │   │   ├── getting-started.md
│   │   │   ├── advanced-patterns.md
│   │   │   ├── performance-tips.mdx     # MDX for interactive posts
│   │   │   └── _drafts/                # Underscore prefix = excluded
│   │   │       └── upcoming-post.md
│   │   ├── docs/                        # Documentation collection
│   │   │   ├── 01-introduction/
│   │   │   │   ├── 01-getting-started.md
│   │   │   │   └── 02-installation.md
│   │   │   ├── 02-guides/
│   │   │   │   ├── 01-routing.md
│   │   │   │   └── 02-data-fetching.md
│   │   │   └── 03-api-reference/
│   │   │       ├── 01-components.md
│   │   │       └── 02-utilities.md
│   │   ├── authors/                     # Authors collection (data collection)
│   │   │   ├── alice.json
│   │   │   └── bob.json
│   │   ├── changelog/                   # Changelog entries
│   │   │   ├── v1.0.0.md
│   │   │   └── v1.1.0.md
│   │   └── testimonials/               # Testimonials (data collection)
│   │       ├── company-a.yaml
│   │       └── company-b.yaml
│   ├── data/                            # Static data files (not collections)
│   │   ├── navigation.ts               # Nav menu structure
│   │   ├── site-config.ts              # Site-wide configuration
│   │   └── social-links.ts
│   ├── layouts/                         # Page layouts
│   │   ├── BaseLayout.astro             # HTML skeleton (head, body)
│   │   ├── PageLayout.astro             # Standard page (header, footer)
│   │   ├── BlogLayout.astro             # Blog post layout
│   │   ├── DocsLayout.astro             # Documentation with sidebar
│   │   ├── LandingLayout.astro          # Full-width landing page
│   │   └── MinimalLayout.astro          # No header/footer
│   ├── middleware/                       # Astro middleware (SSR mode)
│   │   └── index.ts                     # Request middleware (auth, logging)
│   ├── pages/                           # File-based routing
│   │   ├── index.astro                  # -> / (home page)
│   │   ├── about.astro                  # -> /about
│   │   ├── contact.astro                # -> /contact
│   │   ├── pricing.astro                # -> /pricing
│   │   ├── 404.astro                    # Custom 404 page
│   │   ├── blog/
│   │   │   ├── index.astro              # -> /blog (list page)
│   │   │   ├── [...slug].astro          # -> /blog/:slug (dynamic from collection)
│   │   │   ├── category/
│   │   │   │   └── [category].astro     # -> /blog/category/:category
│   │   │   └── tags/
│   │   │       └── [tag].astro          # -> /blog/tags/:tag
│   │   ├── docs/
│   │   │   ├── index.astro              # -> /docs
│   │   │   └── [...slug].astro          # -> /docs/* (from docs collection)
│   │   ├── api/                         # API endpoints (SSR/hybrid mode)
│   │   │   ├── search.json.ts           # -> /api/search.json
│   │   │   ├── newsletter.ts            # -> /api/newsletter
│   │   │   └── og/
│   │   │       └── [...slug].ts         # -> /api/og/* (dynamic OG images)
│   │   ├── rss.xml.ts                   # -> /rss.xml (RSS feed)
│   │   └── sitemap-index.xml.ts         # -> /sitemap-index.xml
│   ├── styles/                          # Global styles
│   │   ├── global.css                   # Base styles, CSS variables
│   │   ├── prose.css                    # Typography for markdown content
│   │   ├── animations.css
│   │   └── fonts.css                    # @font-face declarations
│   ├── utils/                           # Utility functions
│   │   ├── collections.ts              # Helper functions for querying collections
│   │   ├── formatters.ts               # Date/number formatting
│   │   ├── reading-time.ts             # Calculate reading time
│   │   ├── og-image.ts                 # OG image generation logic
│   │   ├── search.ts                   # Search indexing utilities
│   │   └── constants.ts
│   ├── types/                           # TypeScript types
│   │   ├── index.ts
│   │   └── content.ts                  # Content-related types
│   └── env.d.ts                         # Environment reference
├── scripts/                             # Build/utility scripts
│   ├── generate-search-index.ts
│   └── optimize-images.ts
├── .env
├── .env.example
├── .gitignore
├── astro.config.mjs                     # Astro configuration
├── package.json
├── tailwind.config.mjs                  # If using Tailwind
└── tsconfig.json
```

---

## Content Collections Deep Dive

Content Collections are Astro's most distinctive feature. They provide type-safe content
management with schema validation.

### Schema Definition

```typescript
// src/content/config.ts
import { defineCollection, z, reference } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content',                    // Markdown/MDX content
  schema: ({ image }) => z.object({   // image() helper for optimized images
    title: z.string(),
    description: z.string().max(160),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: image().optional(),    // Validates image exists in assets/
    author: reference('authors'),     // Reference to authors collection
    category: z.enum(['tutorials', 'news', 'guides', 'opinion']),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    canonicalURL: z.string().url().optional(),
  }),
});

const authorsCollection = defineCollection({
  type: 'data',                       // JSON/YAML data (no markdown body)
  schema: ({ image }) => z.object({
    name: z.string(),
    bio: z.string(),
    avatar: image(),
    twitter: z.string().optional(),
    github: z.string().optional(),
    website: z.string().url().optional(),
  }),
});

const docsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    section: z.string(),
    order: z.number(),
    draft: z.boolean().default(false),
  }),
});

const testimonialsCollection = defineCollection({
  type: 'data',
  schema: z.object({
    quote: z.string(),
    author: z.string(),
    company: z.string(),
    role: z.string(),
    rating: z.number().min(1).max(5),
  }),
});

export const collections = {
  blog: blogCollection,
  authors: authorsCollection,
  docs: docsCollection,
  testimonials: testimonialsCollection,
};
```

### Content Collection Frontmatter

```markdown
---
# src/content/blog/getting-started.md
title: "Getting Started with Astro"
description: "Learn how to build your first Astro project"
pubDate: 2025-01-15
heroImage: "../../assets/images/blog/getting-started-cover.jpg"
author: alice                        # References src/content/authors/alice.json
category: "tutorials"
tags: ["astro", "beginner", "web"]
draft: false
---

# Getting Started with Astro

Content goes here...
```

### Querying Collections

```typescript
// src/utils/collections.ts
import { getCollection, getEntry } from 'astro:content';

export async function getPublishedPosts() {
  const posts = await getCollection('blog', ({ data }) => {
    return data.draft !== true;
  });
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

export async function getPostsByCategory(category: string) {
  const posts = await getPublishedPosts();
  return posts.filter(post => post.data.category === category);
}

export async function getPostsByTag(tag: string) {
  const posts = await getPublishedPosts();
  return posts.filter(post => post.data.tags.includes(tag));
}

export async function getAllTags() {
  const posts = await getPublishedPosts();
  const tags = new Set(posts.flatMap(post => post.data.tags));
  return [...tags].sort();
}
```

### Dynamic Pages from Collections

```astro
---
// src/pages/blog/[...slug].astro
import { getCollection } from 'astro:content';
import BlogLayout from '../../layouts/BlogLayout.astro';
import AuthorCard from '../../components/blog/AuthorCard.astro';

export async function getStaticPaths() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map(post => ({
    params: { slug: post.slug },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content, headings } = await post.render();
const author = await getEntry(post.data.author);
---

<BlogLayout title={post.data.title} description={post.data.description}>
  <article>
    <h1>{post.data.title}</h1>
    <AuthorCard author={author.data} />
    <Content />
  </article>
</BlogLayout>
```

---

## Content Layer API (Astro 5.x)

Astro 5 introduced the Content Layer API, which generalizes content collections beyond
local files. You can load content from CMSes, APIs, databases, or any source:

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

// Local files (traditional)
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    pubDate: z.coerce.date(),
  }),
});

// JSON data file
const countries = defineCollection({
  loader: file('src/data/countries.json'),
  schema: z.object({
    name: z.string(),
    code: z.string(),
    continent: z.string(),
  }),
});

// Custom loader (API, CMS, database)
const products = defineCollection({
  loader: {
    name: 'shopify-loader',
    load: async ({ store }) => {
      const response = await fetch('https://api.shopify.com/products.json');
      const products = await response.json();
      for (const product of products) {
        store.set({
          id: product.id,
          data: product,
        });
      }
    },
  },
  schema: z.object({
    title: z.string(),
    price: z.number(),
    image: z.string().url(),
  }),
});

export const collections = { blog, countries, products };
```

---

## Islands Architecture: Hydration Directives

The core of Astro's performance model. Components are static HTML by default.
Interactive components ("islands") must explicitly opt in to client-side JavaScript:

```astro
---
// Page or component
import StaticCard from '../components/astro/Card.astro';       // Zero JS
import SearchDialog from '../components/islands/react/SearchDialog.tsx';
import CommentSection from '../components/islands/react/CommentSection.tsx';
import ImageGallery from '../components/islands/vue/ImageGallery.vue';
import Counter from '../components/islands/svelte/Counter.svelte';
---

<!-- Static: ships zero JavaScript -->
<StaticCard title="Hello" />

<!-- Island: hydrates immediately on page load -->
<SearchDialog client:load />

<!-- Island: hydrates when element becomes visible -->
<CommentSection client:visible />

<!-- Island: hydrates when browser is idle -->
<ImageGallery client:idle />

<!-- Island: hydrates only at specified media query -->
<Counter client:media="(max-width: 768px)" />

<!-- Island: never hydrates on server, only renders on client -->
<SearchDialog client:only="react" />
```

### Hydration Directive Reference

| Directive | When JS Loads | Use Case |
|-----------|-------------|----------|
| `client:load` | Immediately on page load | Critical interactive elements (nav menus, auth) |
| `client:idle` | After page is done loading (requestIdleCallback) | Non-critical but soon-needed (chat widgets) |
| `client:visible` | When element enters viewport (IntersectionObserver) | Below-the-fold content (comments, galleries) |
| `client:media="query"` | When media query matches | Mobile-only interactions |
| `client:only="framework"` | Client render only (no SSR) | Components that cannot be server-rendered |
| (none) | Never (zero JS) | Static content, pure HTML output |

### Organizing Components by Hydration Strategy

```
components/
├── astro/          # NEVER hydrated (zero JS) -- .astro components
├── islands/        # ALWAYS hydrated -- framework components
│   ├── react/      # Use with client:* directives
│   ├── vue/
│   └── svelte/
└── common/         # Could be either (document in component)
```

---

## Astro Configuration and Integrations

```typescript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vue from '@astrojs/vue';
import svelte from '@astrojs/svelte';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';           // or node, cloudflare, netlify

export default defineConfig({
  site: 'https://example.com',
  output: 'hybrid',                              // static + on-demand routes
  adapter: vercel(),                              // Server adapter

  integrations: [
    react(),                                      // Enable React components
    vue(),                                        // Enable Vue components
    svelte(),                                     // Enable Svelte components
    tailwind(),                                   // Tailwind CSS
    mdx(),                                        // MDX support in content
    sitemap(),                                    // Auto-generate sitemap
  ],

  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
    domains: ['images.unsplash.com'],
  },

  vite: {
    // Vite-specific config
  },

  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
    remarkPlugins: [],
    rehypePlugins: [],
  },
});
```

### Output Modes

| Mode | Behavior | Best For |
|------|----------|----------|
| `'static'` (default) | All pages pre-rendered at build time | Blogs, docs, marketing sites |
| `'server'` | All pages rendered on request | Dynamic apps, dashboards |
| `'hybrid'` | Static by default, opt-in to server per page | Mixed sites (static pages + dynamic API) |

Per-page override in hybrid mode:

```astro
---
// This page is server-rendered even in hybrid mode
export const prerender = false;
---
```

---

## API Endpoints (SSR/Hybrid Mode)

```typescript
// src/pages/api/search.json.ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ url }) => {
  const query = url.searchParams.get('q') ?? '';
  const posts = await getCollection('blog');

  const results = posts
    .filter(post =>
      post.data.title.toLowerCase().includes(query.toLowerCase()) ||
      post.body.toLowerCase().includes(query.toLowerCase())
    )
    .map(post => ({
      title: post.data.title,
      slug: post.slug,
      description: post.data.description,
    }));

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

```typescript
// src/pages/api/newsletter.ts
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  const data = await request.formData();
  const email = data.get('email');

  if (!email || typeof email !== 'string') {
    return new Response(JSON.stringify({ error: 'Email required' }), {
      status: 400,
    });
  }

  await addToMailingList(email);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
  });
};
```

---

## Astro Actions (Astro 4.15+)

Actions provide type-safe server mutations with built-in validation:

```typescript
// src/actions/index.ts
import { defineAction, z } from 'astro:actions';
import { db } from '../utils/db';

export const server = {
  newsletter: {
    subscribe: defineAction({
      accept: 'form',
      input: z.object({
        email: z.string().email(),
        name: z.string().min(2).optional(),
      }),
      handler: async ({ email, name }) => {
        await db.insert(subscribers).values({ email, name });
        return { success: true, message: 'Subscribed!' };
      },
    }),
  },

  contact: {
    send: defineAction({
      input: z.object({
        name: z.string().min(2),
        email: z.string().email(),
        message: z.string().min(10),
      }),
      handler: async (input) => {
        await sendContactEmail(input);
        return { success: true };
      },
    }),
  },
};
```

Usage in an Astro component:

```astro
---
// With progressive enhancement (works without JS)
import { actions } from 'astro:actions';
---

<form method="POST" action={actions.newsletter.subscribe}>
  <input type="email" name="email" required />
  <button type="submit">Subscribe</button>
</form>
```

Usage in a React island:

```tsx
// src/components/islands/react/ContactForm.tsx
import { actions } from 'astro:actions';

export default function ContactForm() {
  async function handleSubmit(formData: FormData) {
    const result = await actions.contact.send({
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      message: formData.get('message') as string,
    });

    if (result.error) {
      // Handle validation errors (fully typed)
    }
  }

  return <form onSubmit={/* ... */}>...</form>;
}
```

---

## Middleware (SSR Mode)

```typescript
// src/middleware/index.ts
import { defineMiddleware, sequence } from 'astro:middleware';

const auth = defineMiddleware(async (context, next) => {
  const token = context.cookies.get('session')?.value;

  if (token) {
    const user = await validateSession(token);
    context.locals.user = user;
  }

  // Protect admin routes
  if (context.url.pathname.startsWith('/admin') && !context.locals.user?.isAdmin) {
    return context.redirect('/login');
  }

  return next();
});

const logging = defineMiddleware(async (context, next) => {
  const start = Date.now();
  const response = await next();
  const duration = Date.now() - start;
  console.log(`${context.request.method} ${context.url.pathname} ${duration}ms`);
  return response;
});

export const onRequest = sequence(logging, auth);
```

---

## Best Practices

1. **Default to zero JS**: Start with `.astro` components. Only reach for framework components
   (React, Vue, Svelte) when you need client-side interactivity
2. **Use `client:visible` as default hydration**: Most islands don't need to hydrate immediately;
   `client:visible` defers JS loading until the user scrolls to the component
3. **Organize islands by framework**: Keep React components in `islands/react/`, Vue in
   `islands/vue/` -- makes it clear which integration each component requires
4. **Use Content Collections for all structured content**: Even for data like team members,
   testimonials, or navigation -- type-safe schemas catch errors at build time
5. **Prefer `src/assets/` over `public/` for images**: Images in `assets/` get optimized by
   Astro's image service; images in `public/` are served as-is
6. **Use the `<Image>` component**: `import { Image } from 'astro:assets'` provides automatic
   format conversion (WebP/AVIF), resizing, and lazy loading
7. **Keep layouts lean**: Layouts should handle HTML structure (head, meta, body wrapper);
   sections and content go in page components
8. **Use hybrid mode for mixed sites**: If most pages are static but a few need server rendering
   (search, auth, API), hybrid mode is more efficient than full SSR

---

## Anti-Patterns

### 1. Using Framework Components When Astro Components Suffice

```astro
<!-- BAD: React component for a static card (ships unnecessary JS) -->
---
import Card from '../components/react/Card.tsx';
---
<Card client:load title="Hello" description="Static content" />

<!-- GOOD: Astro component for static content (zero JS) -->
---
import Card from '../components/astro/Card.astro';
---
<Card title="Hello" description="Static content" />
```

### 2. Using `client:load` for Everything

```astro
<!-- BAD: Everything loads immediately -->
<SearchDialog client:load />
<CommentSection client:load />
<ImageGallery client:load />
<ChatWidget client:load />
<Newsletter client:load />

<!-- GOOD: Appropriate hydration strategies -->
<SearchDialog client:load />            <!-- Critical: needs to be ready -->
<CommentSection client:visible />       <!-- Below fold: hydrate when seen -->
<ImageGallery client:visible />         <!-- Below fold: hydrate when seen -->
<ChatWidget client:idle />              <!-- Not urgent: hydrate when idle -->
<Newsletter client:visible />           <!-- Below fold: hydrate when seen -->
```

### 3. Putting Optimizable Images in public/

```astro
<!-- BAD: Image in public/ gets no optimization -->
<img src="/images/hero.jpg" alt="Hero" />

<!-- GOOD: Image in assets/ gets optimized -->
---
import { Image } from 'astro:assets';
import heroImage from '../assets/images/hero.jpg';
---
<Image src={heroImage} alt="Hero" width={1200} />
```

### 4. Not Using Content Collections for Structured Content

```
<!-- BAD: Manual markdown reading and parsing -->
// Manually reading files, parsing frontmatter, no type safety
const posts = await Astro.glob('../blog/*.md');

<!-- GOOD: Content Collections with type-safe schemas -->
const posts = await getCollection('blog');
// Fully typed, validated at build time, with references
```

### 5. Mixing Framework Components Without Organization

```
<!-- BAD: Framework components scattered everywhere -->
components/
├── Header.astro
├── SearchDialog.tsx        # React -- which framework is this?
├── Gallery.vue             # Vue -- mixed in with everything
├── Counter.svelte          # Svelte
├── Card.astro
└── Chart.tsx               # React? Solid? Unclear.

<!-- GOOD: Organized by type and framework -->
components/
├── astro/                  # Static components
│   ├── Header.astro
│   └── Card.astro
└── islands/                # Interactive components
    ├── react/
    │   ├── SearchDialog.tsx
    │   └── Chart.tsx
    ├── vue/
    │   └── Gallery.vue
    └── svelte/
        └── Counter.svelte
```

### 6. Creating API Endpoints for Static Sites

```typescript
// BAD: API endpoint in a static site (will not work without adapter)
// src/pages/api/data.json.ts
export const GET = async () => {
  return new Response(JSON.stringify({ data: 'hello' }));
};
// This requires output: 'server' or 'hybrid' + an adapter

// GOOD: For static sites, fetch data at build time
// src/pages/data.json.ts
export async function GET() {
  const data = await fetchData();  // Fetched at build time
  return new Response(JSON.stringify(data));
}
export const prerender = true;  // Explicitly static
```

### 7. Overly Deep Nesting in Content Collections

```
<!-- BAD: Deeply nested content structure -->
content/
├── blog/
│   ├── 2025/
│   │   ├── january/
│   │   │   ├── week-1/
│   │   │   │   └── my-post.md    # slug: 2025/january/week-1/my-post

<!-- GOOD: Flat or shallow structure with metadata in frontmatter -->
content/
├── blog/
│   ├── my-post.md                  # slug: my-post
│   └── another-post.md            # date/category in frontmatter, not folders
```

---

## Real-World Examples and References

- **Starlight**: Astro's official documentation theme -- canonical content collections usage
  (https://github.com/withastro/starlight)
- **Astro Website**: The astro.build website itself -- built with Astro
  (https://github.com/withastro/astro.build)
- **Astro Blog Theme**: Official blog template
  (https://github.com/withastro/astro/tree/main/examples/blog)
- **Astro Docs**: The official documentation site source
  (https://github.com/withastro/docs)
- **Astro Showcase**: Community sites built with Astro
  (https://astro.build/showcase/)
- **Nue.js Comparison**: Useful architectural comparison for content-first frameworks
- **Astro + Sanity/Storyblok/Contentful templates**: Official CMS integration examples
  with Content Layer API

---

## Sources

- Astro Official Documentation -- https://docs.astro.build
- Astro Content Collections -- https://docs.astro.build/en/guides/content-collections/
- Astro Islands Architecture -- https://docs.astro.build/en/concepts/islands/
- Astro Actions -- https://docs.astro.build/en/guides/actions/
- Astro Content Layer API -- https://docs.astro.build/en/guides/content-collections/#the-content-layer-api
- Starlight Documentation -- https://starlight.astro.build
