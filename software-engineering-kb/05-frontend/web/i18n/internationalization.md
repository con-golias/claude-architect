# Internationalization (i18n) — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to add i18n to React?", "internationalization setup", "react-intl vs next-intl", "translation management", "RTL support", "locale routing", "pluralization rules", "date/number formatting", "ICU message format", or any i18n question, ALWAYS consult this directive. Internationalization enables applications to support multiple languages and regions. ALWAYS use ICU message format for translations — it handles pluralization, gender, and complex messages correctly. ALWAYS use the Intl API (built into browsers) for date, number, and currency formatting — NEVER build custom formatters. ALWAYS store translations in separate JSON files per locale — NEVER hardcode strings in components.

**Core Rule: EVERY user-facing string MUST go through the i18n system — NEVER hardcode text in components. Use next-intl for Next.js, react-intl for React SPAs, vue-i18n for Vue, and $t() for Svelte. ALWAYS use ICU MessageFormat for pluralization and interpolation. Format dates, numbers, and currencies with the Intl API using the user's locale. EVERY application MUST support at minimum LTR and RTL text direction via CSS logical properties.**

---

## 1. i18n Architecture

```
  INTERNATIONALIZATION ARCHITECTURE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  TRANSLATION FILES (JSON)                            │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  locales/                                     │  │
  │  │  ├── en.json    { "greeting": "Hello" }       │  │
  │  │  ├── de.json    { "greeting": "Hallo" }       │  │
  │  │  ├── ja.json    { "greeting": "こんにちは" }     │  │
  │  │  └── ar.json    { "greeting": "مرحبا" }        │  │
  │  └────────────────────────────────────────────────┘  │
  │                          │                           │
  │                          ▼                           │
  │  I18N LIBRARY                                        │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • Loads correct locale file                  │  │
  │  │  • Resolves message keys                      │  │
  │  │  • Handles interpolation, pluralization       │  │
  │  │  • Provides formatting (date, number)         │  │
  │  └────────────────────────────────────────────────┘  │
  │                          │                           │
  │                          ▼                           │
  │  COMPONENT RENDERING                                 │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  <h1>{t('greeting')}</h1>  →  <h1>Hello</h1> │  │
  │  │  <h1>{t('greeting')}</h1>  →  <h1>Hallo</h1> │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 1.1 Library Comparison

| Library | Framework | Features | Bundle |
|---|---|---|---|
| **next-intl** | Next.js (App Router) | ICU, server components, routing | ~12 KB |
| **react-intl** | React SPA | ICU, FormatJS, rich text | ~20 KB |
| **i18next** | Any (React, Vue, Angular) | Plugins, namespaces, backends | ~15 KB |
| **vue-i18n** | Vue 3 | Composition API, SFC i18n block | ~14 KB |
| **svelte-i18n** | Svelte/SvelteKit | Stores-based, formatters | ~5 KB |
| **@angular/localize** | Angular | Built-in, AOT, extraction | 0 KB (built-in) |

---

## 2. Next.js Internationalization (next-intl)

### 2.1 Setup

```typescript
// i18n.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./locales/${locale}.json`)).default,
}));
```

```json
// locales/en.json
{
  "home": {
    "title": "Welcome to Our App",
    "description": "The best tool for managing your projects.",
    "cta": "Get Started"
  },
  "nav": {
    "home": "Home",
    "about": "About",
    "pricing": "Pricing",
    "login": "Log In"
  },
  "common": {
    "loading": "Loading...",
    "error": "Something went wrong",
    "retry": "Try Again",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "confirm": "Are you sure?"
  }
}
```

### 2.2 Usage in Components

```tsx
// Server Component
import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('home');

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <a href="/signup">{t('cta')}</a>
    </main>
  );
}

// Client Component
'use client';
import { useTranslations } from 'next-intl';

export function LoginButton() {
  const t = useTranslations('nav');
  return <button>{t('login')}</button>;
}
```

---

## 3. ICU Message Format

```
  ICU MESSAGE FORMAT — HANDLING COMPLEXITY

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  SIMPLE INTERPOLATION:                               │
  │  "Hello, {name}!"                                    │
  │  → "Hello, Alice!"                                   │
  │                                                      │
  │  PLURALIZATION:                                      │
  │  "{count, plural,                                    │
  │    =0 {No items}                                     │
  │    one {1 item}                                      │
  │    other {{count} items}                              │
  │  }"                                                  │
  │  → "No items" / "1 item" / "5 items"                 │
  │                                                      │
  │  SELECT (gender/category):                           │
  │  "{gender, select,                                   │
  │    female {She liked your post}                      │
  │    male {He liked your post}                         │
  │    other {They liked your post}                      │
  │  }"                                                  │
  │                                                      │
  │  NESTED:                                             │
  │  "{gender, select,                                   │
  │    female {{count, plural,                           │
  │      one {She has 1 cat}                             │
  │      other {She has {count} cats}                    │
  │    }}                                                │
  │    other {{count, plural,                            │
  │      one {They have 1 cat}                           │
  │      other {They have {count} cats}                  │
  │    }}                                                │
  │  }"                                                  │
  └──────────────────────────────────────────────────────┘
```

```json
// locales/en.json — ICU messages
{
  "cart": {
    "items": "{count, plural, =0 {Your cart is empty} one {1 item in cart} other {{count} items in cart}}",
    "total": "Total: {total, number, ::currency/USD}",
    "lastUpdated": "Updated {date, date, medium} at {date, time, short}"
  },
  "notifications": {
    "newFollower": "{name} started following you",
    "likes": "{count, plural, =1 {{name} liked your post} other {{name} and {count, number} others liked your post}}"
  }
}
```

```tsx
// Usage with interpolation
const t = useTranslations('cart');

// Pluralization
t('items', { count: 0 });     // "Your cart is empty"
t('items', { count: 1 });     // "1 item in cart"
t('items', { count: 5 });     // "5 items in cart"

// Number/currency formatting
t('total', { total: 49.99 }); // "Total: $49.99"

// Date formatting
t('lastUpdated', { date: new Date() });
// "Updated Mar 8, 2024 at 3:30 PM"
```

---

## 4. Intl API — Built-In Formatting

```typescript
// Date formatting — NEVER use moment.js or manual formatting
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
dateFormatter.format(new Date()); // "March 8, 2024"

// Relative time
const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
relativeTime.format(-1, 'day');    // "yesterday"
relativeTime.format(-3, 'hour');   // "3 hours ago"
relativeTime.format(2, 'week');    // "in 2 weeks"

// Number formatting
const numFormatter = new Intl.NumberFormat('de-DE');
numFormatter.format(1234567.89);   // "1.234.567,89"

// Currency formatting
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});
currencyFormatter.format(42.50);   // "$42.50"

// List formatting
const listFormatter = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' });
listFormatter.format(['Alice', 'Bob', 'Charlie']); // "Alice, Bob, and Charlie"

// Plural rules
const pluralRules = new Intl.PluralRules('en');
pluralRules.select(0);  // "other"
pluralRules.select(1);  // "one"
pluralRules.select(2);  // "other"
```

---

## 5. Locale Routing

```
  LOCALE ROUTING STRATEGIES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  STRATEGY 1: URL prefix (RECOMMENDED)                │
  │  /en/about    /de/about    /ja/about                 │
  │  PRO: SEO-friendly, shareable, cacheable             │
  │  CON: Requires routing config                        │
  │                                                      │
  │  STRATEGY 2: Subdomain                               │
  │  en.example.com    de.example.com                    │
  │  PRO: Clean URLs, separate deployments               │
  │  CON: Complex DNS, CORS issues                       │
  │                                                      │
  │  STRATEGY 3: Cookie/header only                      │
  │  example.com (Accept-Language header)                 │
  │  PRO: Simple                                         │
  │  CON: Not SEO-friendly, not shareable                │
  │                                                      │
  │  VERDICT: URL prefix for most applications.          │
  └──────────────────────────────────────────────────────┘
```

```typescript
// Next.js App Router — locale routing
// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'de', 'ja', 'ar'],
  defaultLocale: 'en',
  localeDetection: true,              // detect from Accept-Language header
});

export const config = {
  matcher: ['/((?!api|_next|favicon.ico).*)'],
};

// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

---

## 6. RTL Support

```css
/* USE CSS logical properties — works for both LTR and RTL */

/* BAD: Physical properties (break in RTL) */
.card {
  margin-left: 1rem;      /* wrong side in RTL */
  padding-right: 2rem;    /* wrong side in RTL */
  text-align: left;       /* wrong alignment in RTL */
  float: left;            /* wrong direction in RTL */
}

/* GOOD: Logical properties (auto-flip for RTL) */
.card {
  margin-inline-start: 1rem;    /* left in LTR, right in RTL */
  padding-inline-end: 2rem;     /* right in LTR, left in RTL */
  text-align: start;            /* left in LTR, right in RTL */
  float: inline-start;          /* left in LTR, right in RTL */
}

/* Logical property mapping:
   left       → inline-start
   right      → inline-end
   top        → block-start
   bottom     → block-end
   margin-left → margin-inline-start
   padding-right → padding-inline-end
   border-left → border-inline-start
   width      → inline-size
   height     → block-size
*/
```

```tsx
// Set direction on html element
<html lang={locale} dir={isRTL(locale) ? 'rtl' : 'ltr'}>

// Helper
function isRTL(locale: string): boolean {
  return ['ar', 'he', 'fa', 'ur'].includes(locale);
}
```

---

## 7. Translation Management

```
  TRANSLATION WORKFLOW

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  1. Developer adds key to en.json                    │
  │     "newFeature.title": "Amazing Feature"            │
  │                          │                           │
  │  2. CI extracts new keys → Translation Management    │
  │     (Crowdin, Lokalise, Phrase)                       │
  │                          │                           │
  │  3. Translators provide translations                 │
  │     de.json: "newFeature.title": "Tolle Funktion"    │
  │     ja.json: "newFeature.title": "素晴らしい機能"      │
  │                          │                           │
  │  4. CI pulls translations → PR                       │
  │                          │                           │
  │  5. Build includes updated translations              │
  └──────────────────────────────────────────────────────┘
```

### 7.1 Translation Key Conventions

```json
// GOOD: Namespaced, descriptive keys
{
  "auth.login.title": "Sign In",
  "auth.login.emailLabel": "Email Address",
  "auth.login.passwordLabel": "Password",
  "auth.login.submitButton": "Sign In",
  "auth.login.forgotPassword": "Forgot your password?",
  "auth.login.error.invalidCredentials": "Invalid email or password",
  "auth.login.error.accountLocked": "Your account has been locked"
}

// BAD: Flat, ambiguous keys
{
  "title": "Sign In",
  "email": "Email Address",
  "button": "Sign In",
  "error": "Invalid email or password"
}
```

---

## 8. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Hardcoded strings** | `<h1>Welcome</h1>` — impossible to translate | `<h1>{t('home.title')}</h1>` — every string through i18n |
| **String concatenation for plurals** | `count + " items"` — wrong in many languages (e.g., Arabic has 6 plural forms) | Use ICU `{count, plural, one {1 item} other {{count} items}}` |
| **Manual date formatting** | `month + "/" + day + "/" + year` — US format forced on all locales | `new Intl.DateTimeFormat(locale).format(date)` |
| **Physical CSS properties** | `margin-left`, `padding-right` — broken in RTL | Use logical properties: `margin-inline-start`, `padding-inline-end` |
| **Translations in code** | Translation objects embedded in components | Separate JSON files per locale, loaded on demand |
| **No locale in URL** | Language stored in cookie only — not shareable, bad for SEO | URL prefix (`/en/`, `/de/`) for locale routing |
| **Embedding HTML in translations** | `"welcome": "<b>Hello</b> <a href='/'>world</a>"` — XSS risk | Use rich text formatting: `t.rich('welcome', { b: (c) => <b>{c}</b> })` |
| **No fallback locale** | Missing translation shows empty string or key | Configure fallback to default locale (English) |

---

## 9. Enforcement Checklist

### Setup
- [ ] i18n library installed and configured for the framework
- [ ] Default locale and supported locales defined
- [ ] Translation files organized by locale (`locales/en.json`, `locales/de.json`)
- [ ] Locale routing configured (URL prefix strategy)
- [ ] `<html lang={locale}>` set dynamically

### Translation Quality
- [ ] ALL user-facing strings go through i18n (no hardcoded text)
- [ ] ICU MessageFormat used for pluralization and interpolation
- [ ] Translation keys are namespaced and descriptive
- [ ] Dates, numbers, and currencies formatted with Intl API
- [ ] Fallback locale configured for missing translations

### RTL Support
- [ ] CSS uses logical properties (inline-start/end, block-start/end)
- [ ] `dir="rtl"` set on `<html>` for RTL locales
- [ ] Icons and arrows flip appropriately in RTL
- [ ] Layout tested in both LTR and RTL

### Workflow
- [ ] Translation management platform connected (Crowdin, Lokalise)
- [ ] CI extracts new keys and creates translation PRs
- [ ] Missing translations surface warnings in development
- [ ] Translation coverage tracked per locale
