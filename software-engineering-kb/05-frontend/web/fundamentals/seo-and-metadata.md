# SEO & Metadata — Complete Specification

> **AI Plugin Directive:** When implementing SEO, meta tags, structured data, social sharing, or search engine optimization for any web application, ALWAYS consult this guide. Apply these metadata rules to ensure proper indexing, rich search results, and optimal social media previews. This guide covers meta tags, Open Graph, JSON-LD, sitemaps, robots configuration, and Core Web Vitals SEO impact.

**Core Rule: EVERY page MUST have a unique `<title>`, `<meta name="description">`, canonical URL, and Open Graph tags. ALWAYS use JSON-LD for structured data — NEVER use microdata or RDFa for new implementations. Server-side render ALL SEO-critical content — search engines CANNOT reliably index client-side rendered content. NEVER block Googlebot from CSS/JS resources.**

---

## 1. HTML Meta Tag Architecture

```
                    META TAG HIERARCHY

  <head>
  │
  ├── charset ─────────── MUST be first (within 1024 bytes)
  │   └── <meta charset="utf-8">
  │
  ├── viewport ────────── MUST be present for mobile
  │   └── <meta name="viewport" content="width=device-width, initial-scale=1">
  │
  ├── title ───────────── UNIQUE per page, 50-60 chars
  │   └── <title>Primary Keyword — Brand Name</title>
  │
  ├── description ─────── UNIQUE per page, 150-160 chars
  │   └── <meta name="description" content="...">
  │
  ├── canonical ───────── ALWAYS present, absolute URL
  │   └── <link rel="canonical" href="https://example.com/page">
  │
  ├── robots ──────────── Control indexing per page
  │   └── <meta name="robots" content="index, follow">
  │
  ├── Open Graph ──────── Social sharing (Facebook, LinkedIn)
  │   ├── og:title
  │   ├── og:description
  │   ├── og:image (1200×630px)
  │   ├── og:url
  │   └── og:type
  │
  ├── Twitter Card ────── Twitter/X sharing
  │   ├── twitter:card
  │   ├── twitter:title
  │   ├── twitter:description
  │   └── twitter:image
  │
  ├── JSON-LD ─────────── Structured data
  │   └── <script type="application/ld+json">
  │
  ├── Alternate ───────── i18n, RSS, mobile
  │   ├── hreflang tags
  │   └── <link rel="alternate" type="application/rss+xml">
  │
  └── Performance ─────── Resource hints
      ├── <link rel="preconnect">
      ├── <link rel="preload">
      └── <link rel="dns-prefetch">
  </head>
```

### 1.1 Complete Meta Tag Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- MUST be within first 1024 bytes -->
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">

  <!-- ─── Primary SEO ─── -->
  <title>Product Name — Feature Description | Brand</title>
  <meta name="description" content="Concise 150-160 character description with primary keywords. Include a call-to-action when relevant.">
  <link rel="canonical" href="https://example.com/current-page">

  <!-- ─── Robots ─── -->
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1">

  <!-- ─── Open Graph (Facebook, LinkedIn, Discord, Slack) ─── -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="Page Title — 60 chars max">
  <meta property="og:description" content="Compelling description for social sharing, 100-200 chars">
  <meta property="og:image" content="https://example.com/images/og-image.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Descriptive alt text for the image">
  <meta property="og:url" content="https://example.com/current-page">
  <meta property="og:site_name" content="Brand Name">
  <meta property="og:locale" content="en_US">

  <!-- ─── Twitter Card ─── -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@brandhandle">
  <meta name="twitter:creator" content="@authorhandle">
  <meta name="twitter:title" content="Page Title — 70 chars max">
  <meta name="twitter:description" content="200 chars max for Twitter cards">
  <meta name="twitter:image" content="https://example.com/images/twitter-card.jpg">
  <meta name="twitter:image:alt" content="Descriptive alt text">

  <!-- ─── Alternate Languages ─── -->
  <link rel="alternate" hreflang="en" href="https://example.com/en/page">
  <link rel="alternate" hreflang="es" href="https://example.com/es/page">
  <link rel="alternate" hreflang="x-default" href="https://example.com/page">

  <!-- ─── Favicon Set ─── -->
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <meta name="theme-color" content="#4285f4" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1a1a2e" media="(prefers-color-scheme: dark)">

  <!-- ─── Performance ─── -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://cdn.example.com" crossorigin>
  <link rel="dns-prefetch" href="https://analytics.example.com">
</head>
```

---

## 2. Title Tag Rules

### 2.1 Title Format Patterns

| Page Type | Format | Example |
|-----------|--------|---------|
| Homepage | Primary Keyword — Brand | `Cloud Hosting — Acme Corp` |
| Product | Product Name — Category \| Brand | `Widget Pro — Automation Tools \| Acme` |
| Blog Post | Post Title \| Brand | `10 Tips for Better SEO \| Acme Blog` |
| Category | Category Name — Brand | `Running Shoes — Acme Sports` |
| Search Results | "Query" Results — Brand | `"blue widgets" Results — Acme Store` |

### 2.2 Title Tag Rules

```
  TITLE TAG RULES:
  ┌──────────────────────────────────────────────────────┐
  │ Length: 50-60 characters (Google truncates at ~60)    │
  │ Structure: Primary Keyword — Secondary | Brand       │
  │ NEVER: duplicate across pages                        │
  │ NEVER: keyword stuff ("Buy Shoes, Cheap Shoes...")   │
  │ NEVER: start with brand name (waste prime position)  │
  │ ALWAYS: most important keyword first                 │
  │ ALWAYS: include brand name (at end, after separator) │
  │ SEPARATOR: use — (em dash) or | (pipe)               │
  └──────────────────────────────────────────────────────┘
```

---

## 3. Meta Description Rules

```typescript
// ALWAYS generate unique meta descriptions per page
// NEVER let CMS auto-generate from first paragraph

interface MetaDescriptionRules {
  minLength: 120;       // Below this — too short, lost opportunity
  maxLength: 160;       // Google truncates around 155-160 chars
  mustInclude: [
    'primary keyword',   // Natural placement, not forced
    'call to action',    // "Learn more", "Get started", "Compare"
    'value proposition', // Why click this result?
  ];
  neverDo: [
    'duplicate across pages',
    'use quotes (Google may cut off)',
    'stuff keywords',
    'say "welcome to our website"',
    'start with "this page is about..."',
  ];
}

// Good: "Build production-ready React apps with Next.js. Server components,
//        static generation, and edge rendering. Get started in 5 minutes."

// Bad:  "Welcome to our website. We offer Next.js development services
//        for React applications. Next.js, React, JavaScript, TypeScript."
```

---

## 4. Canonical URLs

```html
<!-- ALWAYS use absolute URLs for canonical -->
<!-- WRONG -->
<link rel="canonical" href="/page">

<!-- RIGHT -->
<link rel="canonical" href="https://example.com/page">
```

### 4.1 Canonical URL Decision Tree

```
  Page has canonical URL?
       │
       ├── Is this the original content?
       │       │
       │       ├── YES → canonical = self-referencing (this URL)
       │       │
       │       └── NO → canonical = URL of original content
       │
       ├── Same content with query params? (?sort=price&page=2)
       │       │
       │       ├── Pagination → canonical = self (each page is unique)
       │       │
       │       ├── Sorting/filtering → canonical = base URL (no params)
       │       │
       │       └── Tracking params (?utm_source) → canonical = clean URL
       │
       ├── HTTP + HTTPS versions?
       │       └── canonical = HTTPS version (ALWAYS)
       │
       ├── www + non-www?
       │       └── canonical = chosen version (pick one, be consistent)
       │
       └── Trailing slash variations?
               └── canonical = chosen version (pick one, be consistent)
```

### 4.2 Framework Implementation

```typescript
// Next.js App Router — metadata.ts
import type { Metadata } from 'next';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProduct(params.slug);
  const canonicalUrl = `https://example.com/products/${params.slug}`;

  return {
    title: `${product.name} — ${product.category} | Brand`,
    description: product.metaDescription || generateDescription(product),
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'en-US': `https://example.com/en/products/${params.slug}`,
        'es-ES': `https://example.com/es/products/${params.slug}`,
      },
    },
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      images: [{
        url: product.ogImage,
        width: 1200,
        height: 630,
        alt: product.imageAlt,
      }],
      url: canonicalUrl,
      type: 'website',
      siteName: 'Brand Name',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description: product.shortDescription,
      images: [product.ogImage],
    },
    robots: {
      index: product.isPublished,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large' as const,
    },
  };
}
```

---

## 5. Structured Data (JSON-LD)

### 5.1 Why JSON-LD

```
  STRUCTURED DATA FORMAT COMPARISON:
  ┌─────────────┬──────────────────────────────────────────┐
  │ JSON-LD     │ ✅ RECOMMENDED — Google's preferred       │
  │             │ ✅ Separate from HTML (clean markup)      │
  │             │ ✅ Easy to generate server-side           │
  │             │ ✅ Can be in <head> or <body>             │
  ├─────────────┼──────────────────────────────────────────┤
  │ Microdata   │ ❌ LEGACY — interleaved with HTML        │
  │             │ ❌ Hard to maintain, easy to break        │
  ├─────────────┼──────────────────────────────────────────┤
  │ RDFa        │ ❌ LEGACY — verbose, complex              │
  │             │ ❌ Only use if CMS forces it              │
  └─────────────┴──────────────────────────────────────────┘

  ALWAYS use JSON-LD for new implementations.
```

### 5.2 Common Schema Types

```html
<!-- ─── Organization ─── -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Acme Corporation",
  "url": "https://example.com",
  "logo": "https://example.com/logo.png",
  "sameAs": [
    "https://twitter.com/acme",
    "https://linkedin.com/company/acme",
    "https://github.com/acme"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-800-555-0199",
    "contactType": "customer service",
    "availableLanguage": ["English", "Spanish"]
  }
}
</script>

<!-- ─── BreadcrumbList ─── -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://example.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Products",
      "item": "https://example.com/products"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Widget Pro"
    }
  ]
}
</script>

<!-- ─── Article (Blog Post) ─── -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to Optimize Core Web Vitals in 2025",
  "description": "A comprehensive guide to improving LCP, INP, and CLS scores",
  "image": [
    "https://example.com/images/article-16x9.jpg",
    "https://example.com/images/article-4x3.jpg",
    "https://example.com/images/article-1x1.jpg"
  ],
  "datePublished": "2025-01-15T08:00:00+00:00",
  "dateModified": "2025-03-10T12:00:00+00:00",
  "author": {
    "@type": "Person",
    "name": "Jane Developer",
    "url": "https://example.com/authors/jane"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Acme Tech Blog",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/logo.png"
    }
  },
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://example.com/blog/optimize-web-vitals"
  }
}
</script>

<!-- ─── Product ─── -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Widget Pro",
  "image": "https://example.com/products/widget-pro.jpg",
  "description": "Enterprise-grade widget with advanced features",
  "brand": {
    "@type": "Brand",
    "name": "Acme"
  },
  "sku": "WP-2025-001",
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/products/widget-pro",
    "priceCurrency": "USD",
    "price": "99.99",
    "availability": "https://schema.org/InStock",
    "priceValidUntil": "2025-12-31",
    "seller": {
      "@type": "Organization",
      "name": "Acme Store"
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "1243"
  }
}
</script>

<!-- ─── FAQ Page ─── -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "What is server-side rendering?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Server-side rendering (SSR) is a technique where the server generates the full HTML for a page on each request, sending a complete page to the browser."
      }
    },
    {
      "@type": "Question",
      "name": "When should I use SSG vs SSR?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Use SSG for content that doesn't change often (blogs, docs, marketing). Use SSR for personalized or frequently updated content."
      }
    }
  ]
}
</script>

<!-- ─── Software Application ─── -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Acme Editor",
  "operatingSystem": "Web, Windows, macOS",
  "applicationCategory": "DeveloperApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "5629"
  }
}
</script>
```

### 5.3 Dynamic JSON-LD Generation

```typescript
// json-ld-generator.ts — Type-safe structured data

interface ArticleSchema {
  title: string;
  description: string;
  image: string;
  datePublished: string;
  dateModified: string;
  author: { name: string; url: string };
  url: string;
}

function generateArticleJsonLd(article: ArticleSchema): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title.slice(0, 110), // Schema.org limit
    description: article.description.slice(0, 300),
    image: article.image,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: {
      '@type': 'Person',
      name: article.author.name,
      url: article.author.url,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.url,
    },
  });
}

// React component
function JsonLd({ data }: { data: string }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: data }}
    />
  );
}

// Next.js App Router — built-in support
import { Article, WithContext } from 'schema-dts';

const jsonLd: WithContext<Article> = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Article Title',
  // ... type-safe fields
};
```

---

## 6. Robots Configuration

### 6.1 robots.txt

```
# robots.txt — MUST be at site root: https://example.com/robots.txt

# ─── Allow All Crawlers ───
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /private/
Disallow: /search?           # Prevent crawling search result pages
Disallow: /*?sort=           # Prevent crawling sorted variants
Disallow: /*?filter=         # Prevent crawling filtered variants

# NEVER block CSS or JS — Googlebot needs them to render pages
# WRONG: Disallow: /static/css/
# WRONG: Disallow: /static/js/

# ─── Crawl Rate Limiting ───
User-agent: Googlebot
Crawl-delay: 1

# ─── Block AI Training Crawlers (if desired) ───
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: Google-Extended
Disallow: /

# ─── Sitemap Location ───
Sitemap: https://example.com/sitemap.xml
Sitemap: https://example.com/sitemap-news.xml
```

### 6.2 Meta Robots Directives

| Directive | Effect |
|-----------|--------|
| `index` | Allow indexing this page (default) |
| `noindex` | Do NOT index this page |
| `follow` | Follow links on this page (default) |
| `nofollow` | Do NOT follow links on this page |
| `noarchive` | Do NOT show cached version |
| `nosnippet` | Do NOT show description snippet |
| `max-snippet:N` | Limit snippet to N characters (-1 = unlimited) |
| `max-image-preview:large` | Allow large image previews |
| `max-video-preview:N` | Limit video preview to N seconds |
| `notranslate` | Do NOT offer page translation |
| `noimageindex` | Do NOT index images on this page |
| `unavailable_after:date` | Remove from index after date |

```html
<!-- Standard indexable page -->
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">

<!-- Page that should NOT be indexed (login, thank-you, internal tools) -->
<meta name="robots" content="noindex, nofollow">

<!-- Index page but don't follow outbound links (user-generated content) -->
<meta name="robots" content="index, nofollow">

<!-- Time-limited content (event page) -->
<meta name="robots" content="index, follow, unavailable_after: 2025-12-31T23:59:59+00:00">
```

### 6.3 X-Robots-Tag HTTP Header

```
# For non-HTML resources (PDFs, images)
X-Robots-Tag: noindex, nofollow

# For specific user agents
X-Robots-Tag: googlebot: noindex
X-Robots-Tag: bingbot: noarchive
```

---

## 7. Sitemap Configuration

### 7.1 XML Sitemap

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">

  <url>
    <loc>https://example.com/</loc>
    <lastmod>2025-03-15T10:00:00+00:00</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <!-- Alternate language versions -->
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/"/>
    <xhtml:link rel="alternate" hreflang="es" href="https://example.com/es/"/>
  </url>

  <url>
    <loc>https://example.com/products/widget-pro</loc>
    <lastmod>2025-03-10T14:30:00+00:00</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <!-- Image sitemap extension -->
    <image:image>
      <image:loc>https://example.com/images/widget-pro.jpg</image:loc>
      <image:title>Widget Pro - Enterprise Automation</image:title>
      <image:caption>The Widget Pro dashboard showing real-time analytics</image:caption>
    </image:image>
  </url>

</urlset>
```

### 7.2 Sitemap Index (Large Sites)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemaps/pages.xml</loc>
    <lastmod>2025-03-15T10:00:00+00:00</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemaps/products.xml</loc>
    <lastmod>2025-03-14T08:00:00+00:00</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemaps/blog.xml</loc>
    <lastmod>2025-03-15T12:00:00+00:00</lastmod>
  </sitemap>
</sitemapindex>
```

### 7.3 Dynamic Sitemap Generation

```typescript
// Next.js App Router — app/sitemap.ts
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://example.com';

  // Fetch all dynamic routes
  const products = await getPublishedProducts();
  const posts = await getPublishedPosts();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/products`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map(product => ({
    url: `${baseUrl}/products/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const blogRoutes: MetadataRoute.Sitemap = posts.map(post => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...productRoutes, ...blogRoutes];
}

// Next.js — app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/private/'] },
      { userAgent: 'GPTBot', disallow: '/' },
    ],
    sitemap: 'https://example.com/sitemap.xml',
  };
}
```

---

## 8. International SEO (hreflang)

### 8.1 Hreflang Rules

```
  HREFLANG RULES:
  ┌──────────────────────────────────────────────────────────┐
  │ 1. EVERY page MUST include hreflang for ALL language     │
  │    versions INCLUDING itself (self-referencing)          │
  │                                                          │
  │ 2. ALWAYS include x-default for language selector page   │
  │                                                          │
  │ 3. Hreflang MUST be reciprocal — if page A points to    │
  │    page B, page B MUST point back to page A              │
  │                                                          │
  │ 4. Use ISO 639-1 language codes (en, es, fr)             │
  │    Optionally with ISO 3166-1 Alpha 2 region (en-US)     │
  │                                                          │
  │ 5. URLs MUST be absolute and canonical                   │
  │                                                          │
  │ 6. Place in <head>, HTTP header, OR sitemap (not all 3)  │
  └──────────────────────────────────────────────────────────┘
```

```html
<!-- On https://example.com/en/about -->
<link rel="alternate" hreflang="en" href="https://example.com/en/about">
<link rel="alternate" hreflang="en-GB" href="https://example.com/en-gb/about">
<link rel="alternate" hreflang="es" href="https://example.com/es/about">
<link rel="alternate" hreflang="fr" href="https://example.com/fr/about">
<link rel="alternate" hreflang="x-default" href="https://example.com/about">
```

### 8.2 URL Strategy for i18n

| Strategy | Example | Pros | Cons |
|----------|---------|------|------|
| Subdirectory | `/en/about`, `/es/about` | Single domain authority, easy setup | Requires routing config |
| Subdomain | `en.example.com` | Separate server config | Splits domain authority |
| ccTLD | `example.co.uk` | Strong geo-signal | Expensive, complex management |
| Query param | `?lang=en` | ❌ NOT recommended | Google ignores for geo-targeting |

**ALWAYS use subdirectory strategy** unless you have specific regional domains with distinct content.

---

## 9. Core Web Vitals & SEO

```
  CORE WEB VITALS — RANKING SIGNALS (since June 2021)

  ┌─────────────┬──────────┬──────────┬──────────┐
  │ Metric      │ Good     │ Improve  │ Poor     │
  ├─────────────┼──────────┼──────────┼──────────┤
  │ LCP         │ ≤2.5s    │ 2.5-4s   │ >4s      │
  │ INP         │ ≤200ms   │ 200-500ms│ >500ms   │
  │ CLS         │ ≤0.1     │ 0.1-0.25 │ >0.25    │
  └─────────────┴──────────┴──────────┴──────────┘

  SEO IMPACT:
  ─ CWV is a tie-breaker signal, NOT a primary ranking factor
  ─ Content relevance STILL dominates rankings
  ─ BUT poor CWV can push you below competitors with equal content
  ─ HTTPS + Mobile-friendly + No intrusive interstitials also required
```

### 9.1 SEO-Specific CWV Optimizations

```html
<!-- ─── LCP: Ensure hero image loads fast ─── -->
<img
  src="/hero.webp"
  alt="Hero description"
  width="1200"
  height="600"
  fetchpriority="high"
  loading="eager"
  decoding="async"
>
<!-- NEVER lazy-load above-the-fold images -->
<!-- ALWAYS set fetchpriority="high" on LCP element -->
<!-- ALWAYS preload LCP image -->
<link rel="preload" as="image" href="/hero.webp" fetchpriority="high">

<!-- ─── CLS: Prevent layout shifts ─── -->
<!-- ALWAYS set explicit width/height on images -->
<img src="/photo.webp" width="800" height="600" alt="Description">

<!-- ALWAYS use aspect-ratio for responsive images -->
<style>
.hero-image {
  aspect-ratio: 16 / 9;
  width: 100%;
  height: auto;
}
</style>

<!-- NEVER inject content above existing content after load -->
<!-- Reserve space for ads, embeds, dynamic content -->
<div style="min-height: 250px;">
  <!-- Ad slot — height reserved to prevent CLS -->
</div>
```

---

## 10. Social Media Preview Optimization

### 10.1 Image Specifications

| Platform | Recommended Size | Aspect Ratio | Min Size | Format |
|----------|-----------------|--------------|----------|--------|
| Facebook/OG | 1200×630 | 1.91:1 | 600×315 | JPG, PNG, WebP |
| Twitter Large | 1200×628 | 1.91:1 | 300×157 | JPG, PNG, WebP, GIF |
| Twitter Summary | 144×144 | 1:1 | 144×144 | JPG, PNG, WebP |
| LinkedIn | 1200×627 | 1.91:1 | 200×200 | JPG, PNG |
| Discord | 1200×630 | 1.91:1 | 400×300 | JPG, PNG, GIF |
| Slack | 1200×630 | 1.91:1 | 250×250 | JPG, PNG, GIF |
| iMessage | 1200×630 | 1.91:1 | 300×300 | JPG, PNG |

### 10.2 Dynamic OG Image Generation

```typescript
// Next.js — app/og/route.tsx (Dynamic OG images)
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'Default Title';
  const category = searchParams.get('category') || 'General';

  return new ImageResponse(
    (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ fontSize: 24, opacity: 0.8, marginBottom: 20 }}>
          {category}
        </div>
        <div style={{ fontSize: 52, fontWeight: 'bold', lineHeight: 1.2 }}>
          {title}
        </div>
        <div style={{ fontSize: 20, marginTop: 40, opacity: 0.7 }}>
          example.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

// Usage in metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug);
  return {
    openGraph: {
      images: [{
        url: `/og?title=${encodeURIComponent(post.title)}&category=${post.category}`,
        width: 1200,
        height: 630,
      }],
    },
  };
}
```

---

## 11. Technical SEO

### 11.1 Rendering Strategy Impact

| Strategy | SEO Quality | Crawl Budget | Implementation |
|----------|-------------|-------------|----------------|
| SSR | ✅ Excellent | ✅ Efficient | Server renders full HTML |
| SSG | ✅ Excellent | ✅ Best (static) | Build-time HTML, CDN cached |
| ISR | ✅ Excellent | ✅ Very good | Static + on-demand revalidation |
| CSR | ❌ Poor | ❌ Wasteful | Client JS required for content |
| SSR + Streaming | ✅ Very good | ✅ Good | Progressive HTML delivery |

**Rule: ALWAYS server-render SEO-critical content.** Client-side rendered content MAY be indexed by Googlebot but with delays and unreliability.

### 11.2 JavaScript SEO Checklist

```
  JS SEO RULES:
  ┌──────────────────────────────────────────────────────────┐
  │ ✅ Server-render critical content (title, h1, main text) │
  │ ✅ Use semantic HTML (<article>, <nav>, <main>, <header>) │
  │ ✅ Links use <a href="..."> (NOT onClick navigation)     │
  │ ✅ Images have alt text and explicit dimensions           │
  │ ✅ Lazy-loaded content uses IntersectionObserver          │
  │ ✅ Internal links use absolute or root-relative URLs      │
  │ ✅ Dynamic content has static URL (no fragment-only)      │
  │                                                          │
  │ ❌ Do NOT rely on client-side rendering for SEO content   │
  │ ❌ Do NOT use JavaScript redirects (use 301/302)          │
  │ ❌ Do NOT hide content behind click/scroll interactions   │
  │ ❌ Do NOT use hash-based routing (#/about)                │
  │ ❌ Do NOT block Googlebot from JS/CSS resources           │
  │ ❌ Do NOT use identical titles/descriptions across pages  │
  └──────────────────────────────────────────────────────────┘
```

### 11.3 Page Speed & Crawl Budget

```typescript
// Headers for SEO-optimized caching

// Static assets — immutable, long cache
// Cache-Control: public, max-age=31536000, immutable

// Dynamic HTML pages — short cache, revalidate
// Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400

// API responses — no cache
// Cache-Control: private, no-cache, no-store, must-revalidate

// Next.js headers configuration
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '0' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};
```

---

## 12. Semantic HTML for SEO

### 12.1 HTML5 Semantic Elements

```html
<!-- ALWAYS use semantic elements — search engines understand them -->

<body>
  <header>
    <nav aria-label="Main navigation">
      <a href="/">Home</a>
      <a href="/products">Products</a>
      <a href="/blog">Blog</a>
    </nav>
  </header>

  <main>
    <article>
      <header>
        <h1>Article Title — Only ONE h1 per page</h1>
        <time datetime="2025-03-15T10:00:00Z">March 15, 2025</time>
        <address>By <a href="/authors/jane">Jane Developer</a></address>
      </header>

      <section>
        <h2>Section Heading</h2>
        <p>Content...</p>

        <figure>
          <img src="/image.webp" alt="Descriptive alt text" width="800" height="600">
          <figcaption>Caption describing the image context</figcaption>
        </figure>
      </section>

      <section>
        <h2>Another Section</h2>
        <p>More content...</p>
      </section>

      <footer>
        <p>Tags: <a href="/tags/seo">SEO</a>, <a href="/tags/performance">Performance</a></p>
      </footer>
    </article>

    <aside>
      <h2>Related Articles</h2>
      <nav aria-label="Related articles">
        <ul>
          <li><a href="/blog/related-1">Related Article 1</a></li>
          <li><a href="/blog/related-2">Related Article 2</a></li>
        </ul>
      </nav>
    </aside>
  </main>

  <footer>
    <nav aria-label="Footer navigation">
      <a href="/privacy">Privacy Policy</a>
      <a href="/terms">Terms of Service</a>
    </nav>
  </footer>
</body>
```

### 12.2 Heading Hierarchy Rules

```
  HEADING HIERARCHY:
  ┌──────────────────────────────────────────────────────────┐
  │ h1: ONE per page — primary topic (matches <title>)       │
  │ h2: Major sections (2-8 per page typical)                │
  │ h3: Subsections under h2                                 │
  │ h4-h6: Deeper nesting (avoid going beyond h4)            │
  │                                                          │
  │ NEVER skip levels (h1 → h3 without h2)                   │
  │ NEVER use headings for styling (use CSS classes instead)  │
  │ ALWAYS include target keywords naturally in h1 and h2     │
  │ NEVER stuff keywords in headings                         │
  └──────────────────────────────────────────────────────────┘
```

---

## 13. SEO Testing & Validation

### 13.1 Validation Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| [Google Rich Results Test](https://search.google.com/test/rich-results) | Validate structured data | After adding JSON-LD |
| [Google PageSpeed Insights](https://pagespeed.web.dev/) | Core Web Vitals + SEO | Every deployment |
| [Google Search Console](https://search.google.com/search-console) | Index coverage, errors | Weekly monitoring |
| [Schema.org Validator](https://validator.schema.org/) | Validate any schema markup | After structured data changes |
| [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) | Test OG tags | After OG changes |
| [Twitter Card Validator](https://cards-dev.twitter.com/validator) | Test Twitter cards | After card changes |
| Lighthouse SEO Audit | Comprehensive SEO check | CI/CD pipeline |

### 13.2 Automated SEO Testing

```typescript
// playwright SEO test suite
import { test, expect } from '@playwright/test';

test.describe('SEO Requirements', () => {
  test('homepage has required meta tags', async ({ page }) => {
    await page.goto('/');

    // Title
    const title = await page.title();
    expect(title.length).toBeGreaterThanOrEqual(30);
    expect(title.length).toBeLessThanOrEqual(60);

    // Meta description
    const description = await page.$eval(
      'meta[name="description"]',
      el => el.getAttribute('content')
    );
    expect(description).toBeTruthy();
    expect(description!.length).toBeGreaterThanOrEqual(120);
    expect(description!.length).toBeLessThanOrEqual(160);

    // Canonical
    const canonical = await page.$eval(
      'link[rel="canonical"]',
      el => el.getAttribute('href')
    );
    expect(canonical).toMatch(/^https:\/\//);

    // Open Graph
    const ogTitle = await page.$eval('meta[property="og:title"]', el => el.getAttribute('content'));
    const ogDesc = await page.$eval('meta[property="og:description"]', el => el.getAttribute('content'));
    const ogImage = await page.$eval('meta[property="og:image"]', el => el.getAttribute('content'));
    const ogUrl = await page.$eval('meta[property="og:url"]', el => el.getAttribute('content'));
    expect(ogTitle).toBeTruthy();
    expect(ogDesc).toBeTruthy();
    expect(ogImage).toMatch(/^https:\/\//);
    expect(ogUrl).toMatch(/^https:\/\//);

    // H1 — exactly one
    const h1Count = await page.$$eval('h1', els => els.length);
    expect(h1Count).toBe(1);

    // No broken heading hierarchy
    const headings = await page.$$eval('h1,h2,h3,h4,h5,h6', els =>
      els.map(el => parseInt(el.tagName[1]))
    );
    for (let i = 1; i < headings.length; i++) {
      expect(headings[i] - headings[i - 1]).toBeLessThanOrEqual(1);
    }
  });

  test('all images have alt attributes', async ({ page }) => {
    await page.goto('/');
    const imagesWithoutAlt = await page.$$eval('img:not([alt])', els => els.length);
    expect(imagesWithoutAlt).toBe(0);

    const emptyAlts = await page.$$eval('img[alt=""]', els =>
      els.filter(el => !el.getAttribute('role')?.includes('presentation')).length
    );
    expect(emptyAlts).toBe(0);
  });

  test('robots.txt is accessible', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('User-agent');
    expect(text).toContain('Sitemap');
  });

  test('sitemap.xml is valid', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    const xml = await response.text();
    expect(xml).toContain('<urlset');
    expect(xml).toContain('<loc>');
  });

  test('structured data is valid', async ({ page }) => {
    await page.goto('/');
    const jsonLdScripts = await page.$$eval(
      'script[type="application/ld+json"]',
      els => els.map(el => {
        try {
          return JSON.parse(el.textContent || '');
        } catch {
          return null;
        }
      })
    );

    expect(jsonLdScripts.length).toBeGreaterThan(0);
    jsonLdScripts.forEach(schema => {
      expect(schema).not.toBeNull();
      expect(schema['@context']).toBe('https://schema.org');
      expect(schema['@type']).toBeTruthy();
    });
  });
});
```

---

## 14. SEO for Single-Page Applications

```
  SPA SEO STRATEGY:

  ┌─────────────────────────────────────────────────┐
  │ Problem: SPAs render content client-side         │
  │ Google CAN render JS but:                        │
  │   - Delayed indexing (days/weeks)                │
  │   - Crawl budget wasted on JS execution          │
  │   - Some JS frameworks break Googlebot           │
  │   - Dynamic meta tags may not be read             │
  └─────────────────────────────────────────────────┘

  Solutions (in order of preference):
  1. SSR/SSG (Next.js, Nuxt, SvelteKit) ← BEST
  2. Pre-rendering service (Prerender.io) ← ACCEPTABLE
  3. Dynamic rendering (serve HTML to bots) ← GOOGLE DISCOURAGES
  4. Pure CSR with meta tag framework ← LAST RESORT
```

```typescript
// React Helmet Async — for CSR apps that CANNOT use SSR
import { Helmet } from 'react-helmet-async';

function ProductPage({ product }: { product: Product }) {
  return (
    <>
      <Helmet>
        <title>{product.name} — Products | Brand</title>
        <meta name="description" content={product.description} />
        <link rel="canonical" href={`https://example.com/products/${product.slug}`} />
        <meta property="og:title" content={product.name} />
        <meta property="og:image" content={product.image} />
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            image: product.image,
          })}
        </script>
      </Helmet>
      {/* Page content */}
    </>
  );
}
```

---

## 15. SEO Monitoring & Reporting

### 15.1 Key Metrics to Track

| Metric | Source | Target |
|--------|--------|--------|
| Organic traffic | Google Analytics | Month-over-month growth |
| Index coverage | Search Console | >95% of submitted pages indexed |
| Core Web Vitals (field data) | CrUX / Search Console | All metrics "Good" |
| Crawl errors | Search Console | Zero 5xx, minimal 4xx |
| Structured data errors | Search Console | Zero errors |
| Mobile usability | Search Console | Zero issues |
| Click-through rate (CTR) | Search Console | >3% average |
| Average position | Search Console | Monitor trends, not absolutes |

### 15.2 SEO Audit Automation

```typescript
// Lighthouse CI configuration — lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        'https://example.com/',
        'https://example.com/products',
        'https://example.com/blog',
      ],
      numberOfRuns: 3,
    },
    assert: {
      assertions: {
        'categories:seo': ['error', { minScore: 0.9 }],
        'categories:performance': ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'meta-description': 'error',
        'document-title': 'error',
        'http-status-code': 'error',
        'is-crawlable': 'error',
        'robots-txt': 'error',
        'canonical': 'warn',
        'hreflang': 'warn',
        'structured-data': 'warn',
      },
    },
    upload: {
      target: 'lhci',
      serverBaseUrl: 'https://lhci.example.com',
    },
  },
};
```

---

## 16. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|-------------|---------|-----|
| Duplicate titles across pages | Google picks wrong page, thin content signal | UNIQUE `<title>` per page with primary keyword |
| Missing canonical URL | Duplicate content issues, split page authority | Self-referencing `<link rel="canonical">` on EVERY page |
| Client-side only rendering for SEO content | Delayed/missed indexing, poor crawl efficiency | SSR or SSG for all content pages |
| Blocking CSS/JS in robots.txt | Googlebot can't render page, content invisible | NEVER block static assets from crawlers |
| Hash-based routing (#/about) | Google ignores fragment identifiers | Use History API pushState routing |
| Missing alt text on images | Lost image search traffic, accessibility fail | Descriptive `alt` on ALL non-decorative images |
| Keyword-stuffed meta tags | No SEO benefit, looks spammy to users | Natural language, focus on user intent |
| Missing hreflang reciprocal links | i18n pages not properly connected | EVERY language version links to ALL others |
| No structured data validation | Silent errors, rich snippets not showing | Validate with Google Rich Results Test |
| Lazy-loading above-fold images | Poor LCP, content invisible to crawlers | `loading="eager"` + `fetchpriority="high"` for hero images |
| Using JavaScript redirects | Crawlers may not follow, PageRank lost | Use 301 server-side redirects |
| Not monitoring Search Console | Crawl errors accumulate unnoticed | Weekly review of coverage and enhancement reports |
| Missing sitemap | Slower discovery of new/updated pages | XML sitemap + submit to Search Console |
| Giant sitemap (>50K URLs) | Sitemap rejected | Split into sitemap index with <50K URLs each |

---

## 17. Enforcement Checklist

- [ ] EVERY page has unique `<title>` (50-60 characters, primary keyword first)
- [ ] EVERY page has unique `<meta name="description">` (120-160 characters)
- [ ] EVERY page has `<link rel="canonical">` with absolute URL
- [ ] EVERY page has Open Graph tags (og:title, og:description, og:image, og:url)
- [ ] EVERY page has Twitter Card tags
- [ ] Only ONE `<h1>` per page, matching the topic of `<title>`
- [ ] Heading hierarchy is sequential (no skipping levels)
- [ ] ALL images have descriptive `alt` attributes
- [ ] ALL images have explicit `width` and `height` attributes (CLS prevention)
- [ ] Hero/LCP images use `loading="eager"` and `fetchpriority="high"`
- [ ] Below-fold images use `loading="lazy"`
- [ ] JSON-LD structured data present on all content pages
- [ ] Structured data validated with Google Rich Results Test
- [ ] `robots.txt` accessible at site root, allows CSS/JS crawling
- [ ] `sitemap.xml` exists, contains all canonical URLs, submitted to Search Console
- [ ] Hreflang tags present on all multilingual pages (with reciprocal links and x-default)
- [ ] SEO-critical content server-side rendered (NOT client-only)
- [ ] Internal links use `<a href>` (NOT JavaScript click handlers)
- [ ] 301 redirects used (NOT JavaScript redirects or meta refresh)
- [ ] No duplicate content without canonical consolidation
- [ ] Core Web Vitals in "Good" range (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1)
- [ ] Lighthouse SEO score ≥90 in CI/CD pipeline
- [ ] Search Console monitored weekly for crawl errors and coverage issues
- [ ] OG images are 1200×630px and tested with Facebook/Twitter debuggers
- [ ] Automated SEO tests run in CI (title, description, canonical, headings, structured data)
