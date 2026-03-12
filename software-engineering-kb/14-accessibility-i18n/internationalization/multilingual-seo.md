# Multilingual SEO

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | i18n > SEO                                                   |
| Importance    | Medium                                                       |
| Last Updated  | 2026-03-11                                                   |
| Cross-ref     | [Backend i18n](backend-i18n.md), [Translation Management](translation-management.md) |

---

## Core Concepts

### Why Multilingual SEO Matters

Over 60% of internet users are non-English speakers. Search engines serve locale-specific results — a page in German ranks for German queries on google.de, not google.com. Without proper multilingual SEO signals, translated content competes with (or is treated as duplicate of) the source-language version.

### Hreflang Implementation

The `hreflang` attribute tells search engines which language and regional version of a page to serve to which audience.

```html
<!-- In <head> of every page — EVERY version links to ALL versions -->
<link rel="alternate" hreflang="en" href="https://example.com/en/products" />
<link rel="alternate" hreflang="de" href="https://example.com/de/products" />
<link rel="alternate" hreflang="fr" href="https://example.com/fr/products" />
<link rel="alternate" hreflang="ja" href="https://example.com/ja/products" />
<link rel="alternate" hreflang="ar" href="https://example.com/ar/products" />

<!-- x-default: shown when no hreflang matches the user's locale -->
<!-- Points to language selector page or default locale -->
<link rel="alternate" hreflang="x-default" href="https://example.com/products" />
```

**Regional variants** (same language, different region):

```html
<!-- English for US, UK, and Australia -->
<link rel="alternate" hreflang="en-US" href="https://example.com/en-us/pricing" />
<link rel="alternate" hreflang="en-GB" href="https://example.co.uk/pricing" />
<link rel="alternate" hreflang="en-AU" href="https://example.com.au/pricing" />

<!-- Portuguese for Brazil vs Portugal -->
<link rel="alternate" hreflang="pt-BR" href="https://example.com/pt-br/produtos" />
<link rel="alternate" hreflang="pt-PT" href="https://example.com/pt/produtos" />
```

**HTTP headers** (for PDFs and non-HTML resources):

```
Link: <https://example.com/en/whitepaper.pdf>; rel="alternate"; hreflang="en",
      <https://example.com/de/whitepaper.pdf>; rel="alternate"; hreflang="de",
      <https://example.com/fr/whitepaper.pdf>; rel="alternate"; hreflang="fr"
```

**Common hreflang mistakes:**

- Missing return links (page A links to B, but B does not link back to A)
- Using unsupported language codes (use ISO 639-1, not full names)
- Pointing hreflang to redirecting URLs (must point to final, canonical URL)
- Not including self-referencing hreflang (each page must link to itself)
- Mixing hreflang with `rel="canonical"` pointing to another language version

### Next.js Hreflang Implementation

```typescript
// app/[locale]/products/page.tsx — Next.js App Router with next-intl
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'ja', 'ar'];
const BASE_URL = 'https://example.com';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'products' });

  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      canonical: `${BASE_URL}/${locale}/products`,
      languages: Object.fromEntries([
        ...SUPPORTED_LOCALES.map(l => [l, `${BASE_URL}/${l}/products`]),
        ['x-default', `${BASE_URL}/products`],
      ]),
    },
    openGraph: {
      title: t('meta.title'),
      description: t('meta.description'),
      locale: locale,
      alternateLocales: SUPPORTED_LOCALES.filter(l => l !== locale),
    },
  };
}
```

### URL Strategy Comparison

| Strategy | Example | SEO Signal | Complexity | Cost |
|----------|---------|-----------|------------|------|
| **Subdirectories** | `example.com/de/` | Strong (shared domain authority) | Low | None |
| **Subdomains** | `de.example.com` | Moderate (treated as separate sites) | Medium | DNS setup |
| **Country domains** | `example.de` | Strongest (geo-targeting) | High | Domain per country |

```
RECOMMENDED: Subdirectories
  example.com/en/products    ← Default
  example.com/de/products    ← German
  example.com/fr/products    ← French
  example.com/ja/products    ← Japanese

REASONS:
  ✓ Single domain authority — all backlinks benefit all locales
  ✓ Single SSL certificate
  ✓ Single hosting setup
  ✓ Simplest implementation with Next.js, Nuxt, SvelteKit
  ✓ Google Search Console: one property

COUNTRY DOMAINS — use only when:
  • Legal entity per country (e.g., financial services)
  • Regulatory requirement for local domain
  • Strong brand per market (example.de vs example.com/de)
```

### Multilingual Sitemaps

```xml
<!-- sitemap-index.xml — one sitemap per locale -->
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemaps/en.xml</loc>
    <lastmod>2025-01-15</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemaps/de.xml</loc>
    <lastmod>2025-01-15</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemaps/fr.xml</loc>
    <lastmod>2025-01-15</lastmod>
  </sitemap>
</sitemapindex>

<!-- sitemaps/en.xml — with hreflang alternates -->
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://example.com/en/products</loc>
    <lastmod>2025-01-15</lastmod>
    <xhtml:link rel="alternate" hreflang="en"
                href="https://example.com/en/products"/>
    <xhtml:link rel="alternate" hreflang="de"
                href="https://example.com/de/products"/>
    <xhtml:link rel="alternate" hreflang="fr"
                href="https://example.com/fr/products"/>
    <xhtml:link rel="alternate" hreflang="x-default"
                href="https://example.com/products"/>
  </url>
</urlset>
```

```typescript
// Dynamic sitemap generation — Next.js App Router
// app/sitemaps/[locale]/sitemap.ts
import type { MetadataRoute } from 'next';

const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'ja', 'ar'];
const BASE_URL = 'https://example.com';

export default async function sitemap({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<MetadataRoute.Sitemap> {
  const pages = await getPages(locale); // Fetch from CMS/DB

  return pages.map(page => ({
    url: `${BASE_URL}/${locale}${page.path}`,
    lastModified: page.updatedAt,
    alternates: {
      languages: Object.fromEntries([
        ...SUPPORTED_LOCALES.map(l => [l, `${BASE_URL}/${l}${page.path}`]),
        ['x-default', `${BASE_URL}${page.path}`],
      ]),
    },
  }));
}
```

### Language Detection and Redirects

**Never auto-redirect based on `Accept-Language` or geo-IP.** Users on VPNs, travelers, and multilingual users get the wrong locale with no escape.

```typescript
// CORRECT: suggest locale with a dismissible banner
// middleware.ts (Next.js)
import { NextRequest, NextResponse } from 'next/server';
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';

const SUPPORTED = ['en', 'de', 'fr', 'ja', 'ar'];
const DEFAULT = 'en';

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Already has locale prefix — do nothing
  if (SUPPORTED.some(l => pathname.startsWith(`/${l}/`) || pathname === `/${l}`)) {
    return NextResponse.next();
  }

  // Detect preferred locale
  const negotiator = new Negotiator({
    headers: { 'accept-language': req.headers.get('accept-language') || '' },
  });
  const preferred = match(negotiator.languages(), SUPPORTED, DEFAULT);

  // If preferred differs from default, suggest via cookie (banner reads this)
  const response = NextResponse.rewrite(new URL(`/${DEFAULT}${pathname}`, req.url));
  if (preferred !== DEFAULT) {
    response.cookies.set('suggested-locale', preferred, { maxAge: 60 * 60 });
  }
  return response;
}
```

### Canonical URLs for Translated Pages

Each translated page is a **self-referencing canonical**. Translations are `rel="alternate"`, never `rel="canonical"` pointing to another language.

```html
<!-- On example.com/de/products -->
<!-- CORRECT: self-referencing canonical -->
<link rel="canonical" href="https://example.com/de/products" />
<link rel="alternate" hreflang="en" href="https://example.com/en/products" />
<link rel="alternate" hreflang="de" href="https://example.com/de/products" />
<link rel="alternate" hreflang="fr" href="https://example.com/fr/products" />

<!-- WRONG: canonical pointing to English version -->
<!-- This tells Google the German page is a duplicate of English -->
<link rel="canonical" href="https://example.com/en/products" />
```

### Translated Metadata and Structured Data

```html
<!-- Each locale gets unique, translated metadata -->
<!-- example.com/de/products -->
<title>Produkte | Beispiel GmbH</title>
<meta name="description" content="Entdecken Sie unsere Produkte..." />
<meta property="og:title" content="Produkte | Beispiel GmbH" />
<meta property="og:description" content="Entdecken Sie unsere Produkte..." />
<meta property="og:locale" content="de_DE" />
<meta property="og:locale:alternate" content="en_US" />
<meta property="og:locale:alternate" content="fr_FR" />
```

```html
<!-- schema.org — localized structured data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Ergonomischer Bürostuhl",
  "description": "Verstellbarer Bürostuhl mit Lendenstütze...",
  "offers": {
    "@type": "Offer",
    "price": "349.99",
    "priceCurrency": "EUR",
    "availability": "https://schema.org/InStock"
  },
  "inLanguage": "de"
}
</script>
```

### Content Localization Beyond Translation

| Aspect | Example |
|--------|---------|
| **Local examples** | US: "ZIP code 90210" vs DE: "PLZ 10115" |
| **Regulations** | GDPR notice for EU, CCPA for California |
| **Cultural imagery** | Avoid culturally specific gestures, holidays |
| **Phone formats** | US: (555) 123-4567 vs DE: +49 30 12345678 |
| **Address formats** | US: Street, City, State ZIP vs DE: Street, PLZ City |
| **Units** | US: miles, Fahrenheit vs EU: km, Celsius |
| **Payment methods** | US: credit cards vs DE: SEPA/bank transfer vs JP: konbini |
| **Date conventions** | US: MM/DD/YYYY vs EU: DD.MM.YYYY vs JP: YYYY/MM/DD |

### Monitoring Multilingual SEO

```
KEY METRICS PER LOCALE:
  1. Organic traffic by locale (Google Analytics locale segment)
  2. Rankings per locale (Ahrefs / Semrush per-country tracking)
  3. Core Web Vitals per locale (Search Console per-country)
  4. Hreflang errors (Search Console > International Targeting)
  5. Indexation rate per locale (Search Console > Coverage per property)
  6. Click-through rate per locale (Search Console > Performance > Country)
  7. Bounce rate by locale (higher = possible translation quality issue)

GOOGLE SEARCH CONSOLE SETUP:
  • Add property for each subdomain or country domain
  • For subdirectories: use single property, filter by country in reports
  • Check International Targeting report monthly for hreflang errors
  • Monitor "Page indexing" report per locale for crawl issues
```

---

## Best Practices

1. **Use subdirectories for multilingual URL structure** — shares domain authority, simplest to implement, cheapest to maintain.
2. **Implement bidirectional hreflang links** — every language version must link to every other version including itself; missing return links invalidate the signal.
3. **Include `x-default` hreflang** — points to the language selector page or default locale; serves users whose language is not supported.
4. **Use self-referencing canonicals per locale** — never point `rel="canonical"` from a translated page to the source language page.
5. **Never auto-redirect based on locale detection** — suggest the preferred locale via a dismissible banner; let the user choose.
6. **Translate all metadata** — title, description, Open Graph, and structured data must be unique and translated per locale; not just the body.
7. **Generate per-locale sitemaps with hreflang alternates** — helps search engines discover all language versions efficiently.
8. **Localize structured data** — `Product`, `LocalBusiness`, and `FAQ` schemas must use localized content, currency, and `inLanguage` property.
9. **Monitor hreflang errors in Search Console monthly** — broken return links and invalid language codes silently degrade international SEO.
10. **Localize beyond translation** — adapt examples, imagery, address formats, phone numbers, and legal notices for each market.

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Auto-redirecting based on `Accept-Language` | Users on VPNs, expats, and multilingual users get wrong locale | Suggest locale via dismissible banner |
| Setting `rel="canonical"` to the English version on all locales | Google treats all translations as duplicates of English | Each page gets self-referencing canonical |
| Missing hreflang return links | Google ignores hreflang when page A links to B but B does not link to A | Every version links to every version |
| Using language names in hreflang (`hreflang="german"`) | Invalid; search engines ignore non-ISO codes | Use ISO 639-1 codes: `hreflang="de"` |
| Same metadata across all locales (just translate body) | Duplicate titles and descriptions across locales | Translate title, description, and OG tags |
| Single sitemap without hreflang alternates | Search engines cannot discover language relationships | Include `xhtml:link` alternates in sitemap |
| Machine-translating URLs without review | Broken slugs, embarrassing mistranslations in URLs | Use human-reviewed, SEO-optimized slugs per locale |
| No per-country Search Console monitoring | Missing locale-specific indexation and ranking issues | Set up per-country property or filter |

---

## Enforcement Checklist

- [ ] Every page includes hreflang links to all language versions plus `x-default`
- [ ] Hreflang links are bidirectional (verified with Screaming Frog or Ahrefs audit)
- [ ] URL structure uses subdirectories (`/en/`, `/de/`) with locale prefix
- [ ] Each translated page has a self-referencing `rel="canonical"`
- [ ] No automatic locale redirects — only suggestion banners
- [ ] Title, description, and Open Graph tags are translated per locale
- [ ] Multilingual sitemap includes `xhtml:link` hreflang alternates
- [ ] Structured data (schema.org) is localized per page language
- [ ] Google Search Console International Targeting report shows zero errors
- [ ] Per-locale organic traffic and Core Web Vitals are monitored monthly
