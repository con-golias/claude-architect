# SEO and Metadata — Complete Implementation Specification

> **AI Plugin Directive:** When a developer asks "how do I add meta tags?", "Open Graph tags for social sharing?", "Twitter Card setup?", "JSON-LD structured data?", "how do I generate a sitemap?", "robots.txt configuration?", "canonical URL?", "hreflang for i18n?", "Next.js Metadata API?", "dynamic OG images?", "Core Web Vitals for SEO?", "how to add FAQ schema?", "Product schema?", "breadcrumb structured data?", or "prerender hints?", use this directive. SEO is NOT optional for any publicly accessible web application. Incorrect meta tags cause wrong previews on social media. Missing structured data means lost rich snippets in search. Wrong canonical URLs cause duplicate content penalties. You MUST implement SEO correctly from the start — retrofitting is expensive and error-prone. ALWAYS validate structured data with Google's Rich Results Test.

---

## 1. The Meta Tags Foundation

### Essential Meta Tags — Every Page MUST Have These

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <!-- === REQUIRED: Character encoding MUST be first === -->
  <meta charset="utf-8">

  <!-- === REQUIRED: Viewport for mobile rendering === -->
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- NEVER: width=device-width, initial-scale=1, maximum-scale=1
       This BLOCKS pinch-to-zoom — accessibility violation (WCAG 1.4.4) -->

  <!-- === REQUIRED: Page title (50-60 chars, unique per page) === -->
  <title>Product Name - Page Description | Brand</title>
  <!--
    RULES:
    - MUST be unique for every page
    - MUST be 50-60 characters (Google truncates at ~60)
    - Format: Primary Keyword - Secondary Keyword | Brand
    - Home page: Brand Name - Primary Value Proposition
    - NEVER: "Home" or "Welcome to our website"
  -->

  <!-- === REQUIRED: Meta description (150-160 chars) === -->
  <meta name="description"
        content="Concise, compelling description with primary keyword. Include a call to action. This appears in search results.">
  <!--
    RULES:
    - MUST be 150-160 characters
    - MUST include primary keyword naturally
    - MUST be unique per page
    - Include call-to-action when appropriate
    - NEVER duplicate across pages
  -->

  <!-- === REQUIRED: Canonical URL (prevents duplicate content) === -->
  <link rel="canonical" href="https://example.com/products/widget">
  <!--
    RULES:
    - MUST be absolute URL (not relative)
    - MUST be the preferred version (https, www or non-www, no query params)
    - Self-referencing canonicals are REQUIRED (page points to itself)
    - Paginated content: canonical points to page itself, NOT page 1
    - NEVER point canonical to a 404 or redirect
  -->

  <!-- === CONDITIONAL: Robots directives === -->
  <meta name="robots" content="index, follow">
  <!--
    Values:
    - index, follow (default — can omit)
    - noindex, follow (don't index but follow links — staging, thin pages)
    - index, nofollow (index but don't follow links — rarely used)
    - noindex, nofollow (completely hidden — admin pages, previews)
    - noarchive (don't show cached version)
    - nosnippet (don't show description snippet)
    - max-snippet:160 (limit snippet length)
    - max-image-preview:large (allow large image previews)
    - max-video-preview:-1 (unlimited video preview length)
  -->

  <!-- === REQUIRED for i18n sites: hreflang === -->
  <link rel="alternate" hreflang="en" href="https://example.com/products/widget">
  <link rel="alternate" hreflang="es" href="https://example.com/es/productos/widget">
  <link rel="alternate" hreflang="fr" href="https://example.com/fr/produits/widget">
  <link rel="alternate" hreflang="x-default" href="https://example.com/products/widget">
  <!--
    RULES:
    - MUST include x-default for language/region selector page
    - MUST be reciprocal (page A points to B, B points to A)
    - MUST use ISO 639-1 language codes
    - Can use ISO 3166-1 Alpha-2 for regions: en-US, en-GB, pt-BR
    - NEVER mix hreflang in HTML and sitemap — use ONE method
  -->
</head>
```

### Meta Tag Architecture Diagram

```
 PAGE METADATA HIERARCHY:
 ┌──────────────────────────────────────────────────────────────────────┐
 │                        <head> Element                                │
 │                                                                      │
 │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
 │  │   Basic Meta     │  │  Open Graph (OG)  │  │  Twitter Cards   │  │
 │  │                  │  │                    │  │                  │  │
 │  │ title            │  │ og:title          │  │ twitter:card     │  │
 │  │ description      │  │ og:description    │  │ twitter:title    │  │
 │  │ robots           │  │ og:image          │  │ twitter:image    │  │
 │  │ canonical        │  │ og:url            │  │ twitter:site     │  │
 │  │ viewport         │  │ og:type           │  │                  │  │
 │  │ charset          │  │ og:site_name      │  │ Falls back to OG │  │
 │  │ hreflang         │  │ og:locale         │  │ if not specified │  │
 │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
 │                                                                      │
 │  ┌──────────────────────────────────────────────────────────────┐   │
 │  │                    JSON-LD Structured Data                    │   │
 │  │  <script type="application/ld+json">                         │   │
 │  │    Organization, Article, Product, FAQ, BreadcrumbList,      │   │
 │  │    WebSite (SearchAction), LocalBusiness, Event, HowTo       │   │
 │  │  </script>                                                    │   │
 │  └──────────────────────────────────────────────────────────────┘   │
 │                                                                      │
 │  ┌──────────────────────────────────────────────────────────────┐   │
 │  │                    Resource Hints                             │   │
 │  │  <link rel="preconnect">   — TCP+TLS to critical origins     │   │
 │  │  <link rel="dns-prefetch"> — DNS only for non-critical       │   │
 │  │  <link rel="preload">      — Critical resources this page    │   │
 │  │  <link rel="prefetch">     — Resources for next navigation   │   │
 │  │  <link rel="prerender">    — Speculatively render next page  │   │
 │  └──────────────────────────────────────────────────────────────┘   │
 └──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Open Graph Protocol — Social Sharing

```html
<!-- === REQUIRED: Open Graph meta tags for social previews === -->

<!-- Core OG tags (MUST for every public page) -->
<meta property="og:title" content="Product Name - Compelling Headline">
<meta property="og:description" content="Engaging description that makes people click. 2-4 sentences.">
<meta property="og:image" content="https://example.com/images/og/product-widget.png">
<meta property="og:url" content="https://example.com/products/widget">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Example">
<meta property="og:locale" content="en_US">

<!--
  OG IMAGE RULES:
  - MUST be absolute URL (https://...)
  - Recommended: 1200 x 630 pixels (1.91:1 ratio)
  - Minimum: 600 x 315 pixels
  - Maximum file size: 8MB (Facebook), 5MB (LinkedIn)
  - Format: PNG or JPG (PNG for text-heavy, JPG for photos)
  - MUST include og:image:width and og:image:height for instant rendering
  - NEVER use SVG (not supported by social platforms)
-->
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Descriptive alt text for the image">
<meta property="og:image:type" content="image/png">

<!-- Article-specific OG tags -->
<meta property="og:type" content="article">
<meta property="article:published_time" content="2025-01-15T08:00:00Z">
<meta property="article:modified_time" content="2025-01-20T12:00:00Z">
<meta property="article:author" content="https://example.com/authors/jane-doe">
<meta property="article:section" content="Technology">
<meta property="article:tag" content="Web Development">
<meta property="article:tag" content="Performance">

<!-- Multi-locale support -->
<meta property="og:locale" content="en_US">
<meta property="og:locale:alternate" content="es_ES">
<meta property="og:locale:alternate" content="fr_FR">
```

### Twitter Cards

```html
<!-- === Twitter Card tags === -->
<!-- MUST: twitter:card is REQUIRED — without it, no card renders -->
<meta name="twitter:card" content="summary_large_image">
<!--
  Card types:
  - summary: Small image + title + description (default)
  - summary_large_image: Large image above title + description
  - player: Video/audio player embed
  - app: App install card (deprecated)
-->

<meta name="twitter:site" content="@examplebrand">
<meta name="twitter:creator" content="@janedoe">

<!-- Twitter falls back to OG tags for these — only needed if different -->
<meta name="twitter:title" content="Different title for Twitter (optional)">
<meta name="twitter:description" content="Different description for Twitter (optional)">
<meta name="twitter:image" content="https://example.com/images/twitter/product.png">
<meta name="twitter:image:alt" content="Alt text for the Twitter card image">
<!--
  TWITTER IMAGE RULES:
  - summary_large_image: 2:1 ratio, 300x157 min, 4096x4096 max
  - summary: 1:1 ratio, 144x144 min, 4096x4096 max
  - Max file size: 5MB
  - Format: JPG, PNG, WEBP, GIF
-->
```

---

## 3. JSON-LD Structured Data — Rich Results

### Organization Schema (Site-Wide)

```typescript
// === MUST: Add Organization schema to the root layout ===

// src/lib/seo/schemas.ts
export function generateOrganizationSchema(config: {
  name: string;
  url: string;
  logo: string;
  sameAs: string[];
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: config.name,
    url: config.url,
    logo: {
      '@type': 'ImageObject',
      url: config.logo,
      width: 512,
      height: 512,
    },
    sameAs: config.sameAs,
    // MUST: Include contactPoint for businesses
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+1-555-123-4567',
      contactType: 'customer service',
      availableLanguage: ['English', 'Spanish'],
    },
  };
}
```

### WebSite Schema with Search Action

```typescript
// === MUST: Add WebSite schema for sitelinks search box ===
export function generateWebSiteSchema(config: {
  name: string;
  url: string;
  searchUrl: string;
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: config.name,
    url: config.url,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${config.searchUrl}?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
```

### Article Schema

```typescript
// === MUST: Add Article schema to all blog/article pages ===
export function generateArticleSchema(article: {
  title: string;
  description: string;
  url: string;
  image: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
  authorUrl: string;
  publisherName: string;
  publisherLogo: string;
}): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,           // MUST: Max 110 characters
    description: article.description,
    image: [
      article.image,                   // MUST: At least one image
    ],
    datePublished: article.datePublished, // MUST: ISO 8601
    dateModified: article.dateModified,   // MUST: ISO 8601
    author: {
      '@type': 'Person',
      name: article.authorName,
      url: article.authorUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: article.publisherName,
      logo: {
        '@type': 'ImageObject',
        url: article.publisherLogo,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.url,
    },
  };
}
```

### Product Schema

```typescript
// === MUST: Add Product schema for all product pages ===
export function generateProductSchema(product: {
  name: string;
  description: string;
  image: string[];
  sku: string;
  brand: string;
  price: number;
  currency: string;
  availability: 'InStock' | 'OutOfStock' | 'PreOrder';
  ratingValue?: number;
  reviewCount?: number;
  url: string;
}): object {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image,
    sku: product.sku,
    brand: {
      '@type': 'Brand',
      name: product.brand,
    },
    offers: {
      '@type': 'Offer',
      url: product.url,
      priceCurrency: product.currency,
      price: product.price.toFixed(2),
      availability: `https://schema.org/${product.availability}`,
      // MUST: Include priceValidUntil for price drop rich results
      priceValidUntil: new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString().split('T')[0],
    },
  };

  // MUST: Include aggregateRating if reviews exist
  if (product.ratingValue && product.reviewCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.ratingValue,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}
```

### FAQ Schema

```typescript
// === MUST: Add FAQPage schema for FAQ sections ===
// This generates the expandable FAQ rich result in Google
export function generateFAQSchema(
  faqs: Array<{ question: string; answer: string }>
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer, // MUST: Can include HTML formatting
      },
    })),
  };
}
```

### Breadcrumb Schema

```typescript
// === MUST: Add BreadcrumbList schema for all pages with breadcrumbs ===
export function generateBreadcrumbSchema(
  items: Array<{ name: string; url: string }>
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url, // MUST: Absolute URL
    })),
  };
}

// Usage:
// generateBreadcrumbSchema([
//   { name: 'Home', url: 'https://example.com' },
//   { name: 'Products', url: 'https://example.com/products' },
//   { name: 'Widget', url: 'https://example.com/products/widget' },
// ]);
```

---

## 4. Next.js Metadata API — Complete Implementation

### Static Metadata (App Router)

```typescript
// === src/app/layout.tsx — Root metadata ===
import type { Metadata, Viewport } from 'next';

// MUST: Define viewport separately from metadata (Next.js 14+)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // NEVER: maximumScale: 1 — blocks pinch-to-zoom
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export const metadata: Metadata = {
  // MUST: metadataBase required for resolving relative OG image URLs
  metadataBase: new URL('https://example.com'),

  title: {
    default: 'Example — Build Better Software',
    template: '%s | Example', // Page title is inserted at %s
  },
  description: 'Example helps teams build better software with modern tools.',

  // Keywords — low SEO value but still used by some engines
  keywords: ['software', 'development', 'tools'],

  // Authors
  authors: [{ name: 'Example Team', url: 'https://example.com/team' }],
  creator: 'Example Inc.',
  publisher: 'Example Inc.',

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Open Graph (applied to ALL pages via template)
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://example.com',
    siteName: 'Example',
    title: 'Example — Build Better Software',
    description: 'Example helps teams build better software.',
    images: [
      {
        url: '/images/og-default.png', // Resolved via metadataBase
        width: 1200,
        height: 630,
        alt: 'Example — Build Better Software',
      },
    ],
  },

  // Twitter
  twitter: {
    card: 'summary_large_image',
    site: '@example',
    creator: '@example',
  },

  // Icons
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },

  // Manifest (PWA)
  manifest: '/manifest.webmanifest',

  // Verification
  verification: {
    google: 'google-verification-code',
    // yandex: 'yandex-verification',
    // yahoo: 'yahoo-verification',
  },

  // Alternate languages
  alternates: {
    canonical: 'https://example.com',
    languages: {
      'en-US': 'https://example.com',
      'es-ES': 'https://example.com/es',
      'fr-FR': 'https://example.com/fr',
    },
  },

  // Category
  category: 'technology',
};
```

### Dynamic Metadata (Per-Page)

```typescript
// === src/app/blog/[slug]/page.tsx — Dynamic metadata ===
import type { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ slug: string }>;
}

// MUST: generateMetadata runs on the server — can fetch data
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return {
      title: 'Post Not Found',
      robots: { index: false }, // MUST: noindex 404-like pages
    };
  }

  // MUST: Access parent metadata for fallbacks
  const parentImages = (await parent).openGraph?.images || [];

  return {
    title: post.title, // Uses template from layout: "Post Title | Example"
    description: post.excerpt,

    // MUST: Unique canonical for each post
    alternates: {
      canonical: `/blog/${slug}`,
    },

    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author.name],
      images: post.coverImage
        ? [
            {
              url: post.coverImage,
              width: 1200,
              height: 630,
              alt: post.title,
            },
          ]
        : parentImages, // Fallback to parent OG image
    },

    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

// MUST: generateStaticParams for SSG
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const posts = await getAllPostSlugs();
  return posts.map((slug) => ({ slug }));
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <>
      {/* MUST: Add JSON-LD structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateArticleSchema({
              title: post.title,
              description: post.excerpt,
              url: `https://example.com/blog/${slug}`,
              image: post.coverImage,
              datePublished: post.publishedAt,
              dateModified: post.updatedAt,
              authorName: post.author.name,
              authorUrl: `https://example.com/authors/${post.author.slug}`,
              publisherName: 'Example',
              publisherLogo: 'https://example.com/logo.png',
            })
          ),
        }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: 'https://example.com' },
              { name: 'Blog', url: 'https://example.com/blog' },
              { name: post.title, url: `https://example.com/blog/${slug}` },
            ])
          ),
        }}
      />

      <article>{/* ... */}</article>
    </>
  );
}
```

### Product Page with Full SEO

```typescript
// === src/app/products/[id]/page.tsx ===
import type { Metadata } from 'next';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return { title: 'Product Not Found', robots: { index: false } };

  return {
    title: `${product.name} - ${product.category}`,
    description: product.shortDescription,
    alternates: {
      canonical: `/products/${id}`,
    },
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      type: 'website', // MUST: Use 'website' NOT 'product' (OG has no product type)
      images: product.images.map((img) => ({
        url: img.url,
        width: img.width,
        height: img.height,
        alt: `${product.name} - ${img.label}`,
      })),
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <>
      {/* Product structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateProductSchema({
              name: product.name,
              description: product.description,
              image: product.images.map((i) => i.url),
              sku: product.sku,
              brand: product.brand,
              price: product.price,
              currency: 'USD',
              availability: product.inStock ? 'InStock' : 'OutOfStock',
              ratingValue: product.rating,
              reviewCount: product.reviewCount,
              url: `https://example.com/products/${id}`,
            })
          ),
        }}
      />

      {/* Breadcrumb structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: 'https://example.com' },
              { name: product.category, url: `https://example.com/products?cat=${product.categorySlug}` },
              { name: product.name, url: `https://example.com/products/${id}` },
            ])
          ),
        }}
      />

      {/* FAQ structured data (if product has FAQ section) */}
      {product.faqs && product.faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(generateFAQSchema(product.faqs)),
          }}
        />
      )}

      <main>{/* Product page content */}</main>
    </>
  );
}
```

---

## 5. Dynamic OG Images — Next.js ImageResponse

```typescript
// === src/app/api/og/route.tsx — Dynamic OG image generation ===
import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

// MUST: Edge runtime for ImageResponse
export const runtime = 'edge';

export async function GET(request: NextRequest): Promise<ImageResponse> {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') ?? 'Default Title';
  const description = searchParams.get('description') ?? '';
  const type = searchParams.get('type') ?? 'default';

  // MUST: Load fonts (Inter as example)
  const interBold = await fetch(
    new URL('../../../assets/fonts/Inter-Bold.ttf', import.meta.url)
  ).then((res) => res.arrayBuffer());

  const interRegular = await fetch(
    new URL('../../../assets/fonts/Inter-Regular.ttf', import.meta.url)
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 80px',
          // MUST: Use absolute positioning or flexbox — no CSS Grid support
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
          fontFamily: 'Inter',
          color: 'white',
        }}
      >
        {/* Logo area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* MUST: Use <img> with src={absoluteUrl} or inline SVG */}
          <svg width="48" height="48" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="24" fill="#3b82f6" />
          </svg>
          <span style={{ fontSize: '24px', fontWeight: 400 }}>Example</span>
        </div>

        {/* Title and description */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              fontSize: title.length > 40 ? '48px' : '64px',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              // MUST: Limit to 2-3 lines max
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {title}
          </div>

          {description && (
            <div
              style={{
                fontSize: '24px',
                fontWeight: 400,
                color: '#a1a1aa',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {description}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '18px',
            color: '#71717a',
          }}
        >
          <span>example.com</span>
          <span style={{
            padding: '8px 16px',
            background: '#3b82f6',
            borderRadius: '8px',
            color: 'white',
          }}>
            {type === 'article' ? 'Article' : type === 'product' ? 'Product' : 'Read More'}
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: interBold, weight: 700, style: 'normal' },
        { name: 'Inter', data: interRegular, weight: 400, style: 'normal' },
      ],
    }
  );
}

// === Using dynamic OG in metadata ===
// In generateMetadata:
// openGraph: {
//   images: [{
//     url: `/api/og?title=${encodeURIComponent(post.title)}&type=article`,
//     width: 1200,
//     height: 630,
//   }],
// }
```

---

## 6. Sitemap Generation — Next.js

```typescript
// === src/app/sitemap.ts — Dynamic sitemap ===
import type { MetadataRoute } from 'next';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://example.com';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
  ];

  // Dynamic pages — blog posts
  const posts = await getAllPosts();
  const postPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  // Dynamic pages — products
  const products = await getAllProducts();
  const productPages: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/products/${product.id}`,
    lastModified: new Date(product.updatedAt),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  return [...staticPages, ...postPages, ...productPages];
}

// === For large sites (>50,000 URLs): Multiple sitemaps ===
// src/app/sitemap/[id]/route.ts

// OR use sitemap index:
// src/app/sitemap.xml/route.ts → generates sitemap index
// src/app/sitemaps/posts/[page].xml/route.ts → paginated post sitemaps
```

### Sitemap with Alternates (i18n)

```typescript
// === Sitemap with hreflang alternates ===
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://example.com';
  const locales = ['en', 'es', 'fr'] as const;

  const posts = await getAllPosts();

  return posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    alternates: {
      languages: Object.fromEntries(
        locales.map((locale) => [
          locale,
          `${baseUrl}/${locale}/blog/${post.slugs[locale] || post.slug}`,
        ])
      ),
    },
  }));
}
```

---

## 7. robots.txt — Configuration Patterns

```typescript
// === src/app/robots.ts ===
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://example.com';

  // MUST: Different config for production vs staging
  if (process.env.VERCEL_ENV !== 'production') {
    return {
      rules: {
        userAgent: '*',
        disallow: '/', // MUST: Block ALL crawling on staging/preview
      },
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',           // API routes
          '/admin/',         // Admin area
          '/_next/',         // Next.js internals
          '/private/',       // Private pages
          '*.json',          // JSON data endpoints
          '/search?*',       // Search result pages (thin content)
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/', // MUST: Block AI training crawlers if desired
      },
      {
        userAgent: 'CCBot',
        disallow: '/', // Common Crawl (used by AI training)
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    // MUST: Point to sitemap
  };
}
```

```
 ROBOTS.TXT RULES:
 ┌───────────────────────────────────────────────────────────────────┐
 │                                                                   │
 │  Allow: /                    → Crawl everything (unless blocked)  │
 │  Disallow: /admin/           → Block /admin/ and all subpaths     │
 │  Disallow: /api/             → Block API routes from indexing     │
 │  Disallow: /*.json           → Block all .json files              │
 │  Disallow: /search?*         → Block parameterized search pages   │
 │                                                                   │
 │  IMPORTANT:                                                       │
 │  - robots.txt is advisory — crawlers CAN ignore it                │
 │  - Use <meta name="robots" content="noindex"> for enforcement     │
 │  - Use X-Robots-Tag HTTP header for non-HTML resources            │
 │  - NEVER block CSS/JS in robots.txt (Google needs them to render) │
 │  - ALWAYS include Sitemap: directive                              │
 │                                                                   │
 │  robots.txt vs noindex:                                           │
 │  ┌──────────────┬────────────────┬──────────────────┐            │
 │  │              │ robots.txt     │ meta noindex      │            │
 │  ├──────────────┼────────────────┼──────────────────┤            │
 │  │ Enforcement  │ Advisory       │ Mandatory         │            │
 │  │ Indexing     │ May still index│ Guaranteed no-idx │            │
 │  │ Crawling     │ Blocks crawl   │ Must crawl to see │            │
 │  │ Use for      │ Crawl budget   │ Hide from results │            │
 │  └──────────────┴────────────────┴──────────────────┘            │
 └───────────────────────────────────────────────────────────────────┘
```

---

## 8. Core Web Vitals Impact on SEO

```
 CORE WEB VITALS — SEO RANKING SIGNALS:

 ┌───────────────┬──────────────┬──────────────┬──────────────┐
 │ Metric        │ Good         │ Needs Work   │ Poor         │
 ├───────────────┼──────────────┼──────────────┼──────────────┤
 │ LCP           │ ≤ 2.5s       │ 2.5s–4.0s    │ > 4.0s       │
 │ INP           │ ≤ 200ms      │ 200ms–500ms  │ > 500ms      │
 │ CLS           │ ≤ 0.1        │ 0.1–0.25     │ > 0.25       │
 └───────────────┴──────────────┴──────────────┴──────────────┘

 SEO IMPACT:
 - Core Web Vitals are a RANKING SIGNAL (confirmed by Google)
 - They are a TIEBREAKER — content relevance still dominates
 - Pages that fail CWV may not appear in Top Stories carousel
 - Chrome User Experience Report (CrUX) provides field data
 - MUST pass CWV at the 75th percentile of page loads

 OPTIMIZATION PRIORITY FOR SEO:
 ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
 │ Content  │ > │ Backlinks│ > │ Technical│ > │ CWV      │
 │ Quality  │   │ Authority│   │ SEO      │   │ Speed    │
 └──────────┘   └──────────┘   └──────────┘   └──────────┘
 Most important                               Tiebreaker
```

### CWV Optimization Patterns for SEO

```typescript
// === MUST: Optimize LCP for SEO ===

// 1. Preload hero image
// In Next.js layout or page:
export const metadata: Metadata = {
  // ... other metadata
};

// In the component:
function HeroSection({ imageUrl, alt }: { imageUrl: string; alt: string }) {
  return (
    <>
      {/* MUST: Use Next.js Image with priority for LCP element */}
      <Image
        src={imageUrl}
        alt={alt}
        width={1200}
        height={600}
        priority              // MUST: Adds preload link, disables lazy loading
        sizes="100vw"         // MUST: Accurate sizes for responsive images
        quality={85}
        placeholder="blur"    // Shows blur placeholder during load
        blurDataURL={blurHash} // Pre-generated blur hash
      />
    </>
  );
}

// === MUST: Prevent CLS for SEO ===

// 1. ALWAYS set explicit dimensions on images and videos
function MediaEmbed({ src, aspectRatio = '16/9' }: MediaProps) {
  return (
    <div style={{ aspectRatio, width: '100%', position: 'relative' }}>
      {/* Container reserves space — NO layout shift when media loads */}
      <iframe
        src={src}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
        loading="lazy"
      />
    </div>
  );
}

// 2. NEVER inject content above existing content
// ❌ Inserting a banner above the hero pushes everything down
// ✅ Use CSS transforms or fixed positioning for dynamic banners

// 3. Font loading strategy to prevent CLS
// In next.config.ts or layout.tsx:
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',     // MUST: swap for performance
  // display: 'optional' for zero CLS (may show fallback font permanently)
  fallback: ['system-ui', 'arial'],
  preload: true,
  adjustFontFallback: true, // Next.js auto-adjusts fallback to match web font metrics
});
```

---

## 9. Resource Hints — Preconnect, Prefetch, Prerender

```typescript
// === Resource hints in Next.js ===

// In layout.tsx or page.tsx head:
export const metadata: Metadata = {
  // ... other metadata
  other: {
    // Preconnect: Establish early connection to critical origins
    // MUST: Only for origins used on THIS page
    'link': [
      // These are handled by Next.js metadata API automatically
    ],
  },
};

// For manual resource hints in components:
function ResourceHints() {
  return (
    <>
      {/* MUST: Preconnect to critical third-party origins */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

      {/* DNS-prefetch: Lighter than preconnect, for non-critical origins */}
      <link rel="dns-prefetch" href="https://analytics.example.com" />

      {/* Prefetch: Load resources needed on the NEXT page */}
      <link rel="prefetch" href="/api/products" as="fetch" />

      {/* Prerender: Speculatively render the next page (Speculation Rules) */}
    </>
  );
}

// === Speculation Rules API (Chrome 109+) — Better than <link rel="prerender"> ===
function SpeculationRules() {
  return (
    <script
      type="speculationrules"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          prerender: [
            {
              where: {
                and: [
                  { href_matches: '/products/*' },
                  { not: { href_matches: '/products/*/edit' } },
                ],
              },
              eagerness: 'moderate', // prerender on hover
            },
          ],
          prefetch: [
            {
              where: { href_matches: '/blog/*' },
              eagerness: 'conservative', // prefetch only on strong signal
            },
          ],
        }),
      }}
    />
  );
}
```

### Resource Hints Comparison

| Hint | What it does | When to use | Cost |
|------|-------------|-------------|------|
| `dns-prefetch` | DNS resolution only | Third-party scripts loaded later | Tiny |
| `preconnect` | DNS + TCP + TLS | Critical third-party origins | Low |
| `preload` | Downloads resource | Critical resources for current page | Medium |
| `prefetch` | Downloads for next navigation | Resources for likely next page | Low (idle) |
| `modulepreload` | Downloads + parses JS module | Critical JS modules | Medium |
| `prerender` (Speculation Rules) | Full page render in background | Very likely next navigation | High |

---

## 10. Complete SEO Component Library

### JSON-LD Component for React/Next.js

```typescript
// === src/components/seo/json-ld.tsx ===
// MUST: Centralize all JSON-LD generation

interface JsonLdProps {
  data: Record<string, unknown> | Array<Record<string, unknown>>;
}

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data, null, 0), // MUST: Minified in production
      }}
    />
  );
}

// === src/components/seo/schemas.ts ===
// Centralized schema generators

export const schemas = {
  organization: generateOrganizationSchema,
  webSite: generateWebSiteSchema,
  article: generateArticleSchema,
  product: generateProductSchema,
  faq: generateFAQSchema,
  breadcrumb: generateBreadcrumbSchema,

  // LocalBusiness (for businesses with physical locations)
  localBusiness(config: {
    name: string;
    address: { street: string; city: string; state: string; zip: string; country: string };
    geo: { lat: number; lng: number };
    phone: string;
    hours: string[];
    url: string;
    image: string;
  }): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: config.name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: config.address.street,
        addressLocality: config.address.city,
        addressRegion: config.address.state,
        postalCode: config.address.zip,
        addressCountry: config.address.country,
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: config.geo.lat,
        longitude: config.geo.lng,
      },
      telephone: config.phone,
      openingHoursSpecification: config.hours.map((spec) => {
        const [days, hours] = spec.split(': ');
        const [open, close] = hours.split('-');
        return {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: days.split(',').map((d) => d.trim()),
          opens: open.trim(),
          closes: close.trim(),
        };
      }),
      url: config.url,
      image: config.image,
    };
  },

  // HowTo (for tutorial/how-to pages)
  howTo(config: {
    name: string;
    description: string;
    totalTime: string; // ISO 8601 duration: PT30M
    steps: Array<{ name: string; text: string; image?: string }>;
  }): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'HowTo',
      name: config.name,
      description: config.description,
      totalTime: config.totalTime,
      step: config.steps.map((step, i) => ({
        '@type': 'HowToStep',
        position: i + 1,
        name: step.name,
        text: step.text,
        ...(step.image && { image: step.image }),
      })),
    };
  },

  // SoftwareApplication (for app/SaaS product pages)
  softwareApplication(config: {
    name: string;
    description: string;
    operatingSystem: string;
    category: string;
    offers: { price: number; currency: string };
    ratingValue?: number;
    reviewCount?: number;
    screenshot?: string;
  }): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: config.name,
      description: config.description,
      operatingSystem: config.operatingSystem,
      applicationCategory: config.category,
      offers: {
        '@type': 'Offer',
        price: config.offers.price.toFixed(2),
        priceCurrency: config.offers.currency,
      },
      ...(config.ratingValue && {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: config.ratingValue,
          reviewCount: config.reviewCount,
        },
      }),
      ...(config.screenshot && { screenshot: config.screenshot }),
    };
  },
};
```

---

## 11. Anti-Patterns — Symptoms and Fixes

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| Same `<title>` on every page | Google shows "Duplicate title tags" in Search Console | MUST generate unique titles per page with `generateMetadata` |
| Missing `og:image` dimensions | Social previews flash/resize on platforms | ALWAYS include `og:image:width` and `og:image:height` |
| Relative canonical URLs | Google ignores them, duplicate content issues | MUST use absolute URLs: `https://example.com/path` |
| `og:image` pointing to SVG | No social preview rendered (SVG unsupported) | MUST use PNG or JPG for OG images |
| No `hreflang` on i18n sites | Google shows wrong language version in results | MUST add reciprocal hreflang tags on ALL language versions |
| JSON-LD with hardcoded dates | stale structured data, search console warnings | MUST generate dates dynamically from CMS/database |
| `noindex` on production pages | Pages disappear from Google | MUST use environment-aware robots config |
| Blocking CSS/JS in robots.txt | Google cannot render page, ranks poorly | NEVER block CSS/JS — Google needs them to render |
| No sitemap.xml | Google discovers pages slowly, may miss deep pages | MUST generate sitemap with all public pages |
| Missing `alt` on images | Failed accessibility audit, lost image search traffic | MUST add descriptive `alt` text on ALL images |
| `display: none` for SEO text | Google penalty for hidden text | NEVER hide text for SEO purposes — use structured data |
| Orphaned pages (no internal links) | Google cannot find/rank pages | MUST link to every indexable page from at least one other page |
| Missing `viewport` meta tag | Mobile-first indexing treats page as desktop-only | MUST include viewport meta on every page |
| Dynamic OG images without caching | Slow social previews, high server load | MUST cache OG image responses with appropriate headers |

---

## 12. Enforcement Checklist

```
META TAGS:
  [ ] Every page has unique <title> (50-60 characters)
  [ ] Every page has unique <meta name="description"> (150-160 characters)
  [ ] <meta name="viewport" content="width=device-width, initial-scale=1">
  [ ] NEVER includes maximum-scale=1 (accessibility violation)
  [ ] Self-referencing <link rel="canonical"> on every page (absolute URL)
  [ ] Staging/preview environments have <meta name="robots" content="noindex">
  [ ] Production pages have index,follow (or omit robots meta entirely)

OPEN GRAPH:
  [ ] og:title, og:description, og:image, og:url on EVERY public page
  [ ] og:image is absolute URL, 1200x630px, PNG or JPG (NEVER SVG)
  [ ] og:image:width and og:image:height specified
  [ ] og:image:alt specified for accessibility
  [ ] og:type is "website" for pages, "article" for blog posts
  [ ] Validated with Facebook Sharing Debugger

TWITTER CARDS:
  [ ] twitter:card specified (summary_large_image for most pages)
  [ ] twitter:site set to brand handle
  [ ] Validated with Twitter Card Validator

STRUCTURED DATA (JSON-LD):
  [ ] Organization schema on root layout
  [ ] WebSite schema with SearchAction on root layout
  [ ] Article schema on ALL blog/article pages
  [ ] Product schema on ALL product pages with offers + rating
  [ ] BreadcrumbList schema on pages with breadcrumb navigation
  [ ] FAQ schema on pages with FAQ sections
  [ ] ALL dates in ISO 8601 format
  [ ] ALL URLs are absolute
  [ ] Validated with Google Rich Results Test
  [ ] NO errors in Google Search Console structured data report

SITEMAP AND ROBOTS:
  [ ] sitemap.xml generated with ALL public pages
  [ ] sitemap.xml includes lastmod dates
  [ ] sitemap.xml referenced in robots.txt
  [ ] robots.txt blocks /api/, /admin/, /_next/ from crawling
  [ ] robots.txt does NOT block CSS or JS files
  [ ] Staging robots.txt blocks all crawling (Disallow: /)
  [ ] AI training crawlers blocked if desired (GPTBot, CCBot)

INTERNATIONALIZATION:
  [ ] hreflang tags on ALL language versions (reciprocal)
  [ ] x-default hreflang points to language selector or primary language
  [ ] Sitemap includes alternates for each locale
  [ ] Canonical URLs are locale-specific (not all pointing to en)

CORE WEB VITALS:
  [ ] LCP element has priority loading (Next.js Image priority prop)
  [ ] All images have explicit width and height (prevent CLS)
  [ ] Fonts use display: swap or optional
  [ ] No content injected above the fold after initial render (CLS)
  [ ] INP < 200ms (no long tasks blocking interactions)

RESOURCE HINTS:
  [ ] <link rel="preconnect"> for critical third-party origins
  [ ] <link rel="dns-prefetch"> for non-critical third-party origins
  [ ] Hero/LCP image preloaded
  [ ] Speculation Rules for likely next navigations (Chrome)

DYNAMIC OG IMAGES:
  [ ] OG image endpoint returns proper Content-Type header
  [ ] OG images cached at CDN level (Cache-Control headers)
  [ ] OG images are 1200x630 pixels
  [ ] Text is readable at small sizes (social media thumbnails)
  [ ] Fallback default OG image exists for pages without custom images
```
