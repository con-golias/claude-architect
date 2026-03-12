# Backend Internationalization

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | i18n > Backend                                               |
| Importance    | High                                                         |
| Last Updated  | 2026-03-11                                                   |
| Cross-ref     | [05-frontend i18n](../../05-frontend/web/i18n/internationalization.md), [Advanced Formatting](advanced-locale-formatting.md) |

---

## Core Concepts

### Server-Side Locale Detection

Detect the user's preferred locale using a priority chain. Never rely on a single signal.

**Priority order (highest to lowest):**

1. Explicit user preference (stored in DB profile)
2. URL path/subdomain (`/de/products`, `de.example.com`)
3. Cookie or session value (`locale=de`)
4. `Accept-Language` HTTP header
5. Geo-IP fallback (CloudFlare `CF-IPCountry`, MaxMind)
6. Application default locale

```typescript
// locale-resolver.ts — Server-side locale resolution
import { match } from '@formatjs/intl-localematcher';
import Negotiator from 'negotiator';

const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'ja', 'ar'] as const;
const DEFAULT_LOCALE = 'en';

interface LocaleSource {
  userPreference?: string;  urlLocale?: string;  cookieLocale?: string;
  acceptLanguage?: string;  geoCountry?: string;
}

function resolveLocale(sources: LocaleSource): string {
  // 1. Explicit user preference (from DB profile)
  if (sources.userPreference && isSupported(sources.userPreference))
    return sources.userPreference;
  // 2. URL locale (path or subdomain)
  if (sources.urlLocale && isSupported(sources.urlLocale))
    return sources.urlLocale;
  // 3. Cookie / session value
  if (sources.cookieLocale && isSupported(sources.cookieLocale))
    return sources.cookieLocale;
  // 4. Accept-Language header negotiation
  if (sources.acceptLanguage) {
    const negotiator = new Negotiator({
      headers: { 'accept-language': sources.acceptLanguage },
    });
    try { return match(negotiator.languages(), [...SUPPORTED_LOCALES], DEFAULT_LOCALE); }
    catch { /* No match found */ }
  }
  // 5. Geo-IP country mapping
  if (sources.geoCountry) {
    const geoLocale = COUNTRY_LOCALE_MAP[sources.geoCountry];
    if (geoLocale && isSupported(geoLocale)) return geoLocale;
  }
  return DEFAULT_LOCALE; // 6. Default
}

const COUNTRY_LOCALE_MAP: Record<string, string> = {
  DE: 'de', AT: 'de', CH: 'de', FR: 'fr', JP: 'ja', SA: 'ar',
};
function isSupported(locale: string): boolean {
  return SUPPORTED_LOCALES.includes(locale as any);
}
```

### Content Negotiation

Use HTTP `Accept-Language` for API responses. Return `Content-Language` in response headers.

```typescript
// Express middleware — content negotiation
import { NextFunction, Request, Response } from 'express';

function localeMiddleware(req: Request, res: Response, next: NextFunction) {
  const locale = resolveLocale({
    userPreference: req.user?.locale,
    cookieLocale: req.cookies?.locale,
    acceptLanguage: req.headers['accept-language'],
    geoCountry: req.headers['cf-ipcountry'] as string,
  });

  req.locale = locale;
  res.setHeader('Content-Language', locale);
  res.setHeader('Vary', 'Accept-Language');
  next();
}
```

### API Response Localization

Localize error messages, validation errors, enum labels, and notification templates on the server.

```typescript
// Localized error responses
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';

await i18next.use(Backend).init({
  fallbackLng: 'en',
  preload: ['en', 'de', 'fr', 'ja', 'ar'],
  backend: { loadPath: './locales/{{lng}}/{{ns}}.json' },
  ns: ['errors', 'validation', 'enums', 'emails'],
});

// Use in route handler
function handleValidationError(req: Request, field: string, rule: string) {
  const t = i18next.getFixedT(req.locale, 'validation');
  return {
    error: {
      field,
      message: t(`${field}.${rule}`, { field: t(`fields.${field}`) }),
      code: 'VALIDATION_ERROR',
    },
  };
}

// Localized email templates
async function sendWelcomeEmail(user: User) {
  const t = i18next.getFixedT(user.locale, 'emails');
  await sendEmail({
    to: user.email,
    subject: t('welcome.subject', { name: user.name }),
    body: t('welcome.body', { name: user.name, appName: 'MyApp' }),
  });
}
```

### Database Schema for Multilingual Content

Three patterns for storing translations in relational databases:

**Pattern 1: Column-per-locale** — Simple, limited scalability.

```sql
-- Good for few locales (2-5) with always-translated content
CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  sku         VARCHAR(50) NOT NULL,
  name_en     VARCHAR(255) NOT NULL,
  name_de     VARCHAR(255),
  name_fr     VARCHAR(255),
  desc_en     TEXT NOT NULL,
  desc_de     TEXT,
  desc_fr     TEXT,
  price       DECIMAL(10,2) NOT NULL
);

-- Query: simple, fast
SELECT id, sku, name_en AS name, desc_en AS description, price
FROM products WHERE id = 1;
```

**Pattern 2: Separate translation table** — Flexible, normalized.

```sql
-- Best for many locales or dynamic locale addition
CREATE TABLE products (
  id    SERIAL PRIMARY KEY,
  sku   VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL
);

CREATE TABLE product_translations (
  product_id  INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  locale      VARCHAR(10) NOT NULL,  -- BCP 47: 'en', 'de', 'ar'
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  PRIMARY KEY (product_id, locale)
);

-- Query: JOIN required
SELECT p.id, p.sku, p.price, pt.name, pt.description
FROM products p
JOIN product_translations pt ON p.id = pt.product_id AND pt.locale = 'de';

-- Fallback query (COALESCE with default locale)
SELECT p.id, p.sku, p.price,
  COALESCE(pt.name, pt_default.name) AS name,
  COALESCE(pt.description, pt_default.description) AS description
FROM products p
LEFT JOIN product_translations pt
  ON p.id = pt.product_id AND pt.locale = 'de'
JOIN product_translations pt_default
  ON p.id = pt_default.product_id AND pt_default.locale = 'en';
```

**Pattern 3: JSON column** — Flexible, no schema changes.

```sql
-- Good for PostgreSQL/MySQL 8+ with JSON support
CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  sku         VARCHAR(50) NOT NULL,
  price       DECIMAL(10,2) NOT NULL,
  name        JSONB NOT NULL DEFAULT '{}',  -- {"en":"Chair","de":"Stuhl"}
  description JSONB NOT NULL DEFAULT '{}'
);

-- Query with locale extraction
SELECT id, sku, price,
  COALESCE(name->>'de', name->>'en') AS name,
  COALESCE(description->>'de', description->>'en') AS description
FROM products WHERE id = 1;

-- Index for locale-specific search
CREATE INDEX idx_products_name_en ON products ((name->>'en'));
```

| Pattern | Pros | Cons | Use When |
|---------|------|------|----------|
| Column-per-locale | Fast queries, simple | Schema change per locale | 2-5 fixed locales |
| Translation table | Unlimited locales, normalized | JOIN overhead, more complex | Many locales, CMS |
| JSON column | Flexible, no migrations | Harder to index, validate | Dynamic content |

### Backend Translation Libraries

```python
# Python — gettext with Babel for extraction
# Install: pip install Babel
# Extract: pybabel extract -F babel.cfg -o messages.pot .
# Init:    pybabel init -l de -d translations -i messages.pot
# Compile: pybabel compile -d translations

import gettext
import os

def get_translator(locale: str):
    localedir = os.path.join(os.path.dirname(__file__), 'translations')
    return gettext.translation('messages', localedir, languages=[locale],
                               fallback=True)

# Usage in Flask/FastAPI
def format_error(locale: str, field: str) -> str:
    t = get_translator(locale)
    return t.gettext(f"Validation failed for {field}")
    # With ngettext for plurals:
    # t.ngettext("%(count)d item", "%(count)d items", count) % {"count": count}
```

```go
// Go — go-i18n v2 (github.com/nicksnyder/go-i18n/v2/i18n)
bundle := i18n.NewBundle(language.English)
bundle.RegisterUnmarshalFunc("json", json.Unmarshal)
bundle.LoadMessageFile("locales/en.json")
bundle.LoadMessageFile("locales/de.json")

localizer := i18n.NewLocalizer(bundle, "de", "en")
msg, _ := localizer.Localize(&i18n.LocalizeConfig{
    MessageID: "welcome",
    TemplateData: map[string]string{"Name": "Max"},
    PluralCount: 5,
})
```

### Locale-Aware Sorting and Searching

```sql
-- PostgreSQL: ICU collation for locale-aware sorting
-- Create a collation for German phonebook ordering
CREATE COLLATION german_phonebook (
  provider = icu, locale = 'de-u-co-phonebk'
);

-- Use in queries
SELECT name FROM customers
ORDER BY name COLLATE german_phonebook;

-- Locale-aware LIKE with unaccented matching
CREATE EXTENSION IF NOT EXISTS unaccent;
SELECT * FROM products
WHERE unaccent(name) ILIKE unaccent('%cafe%');

-- ICU collation with case-insensitive, accent-insensitive comparison
CREATE COLLATION ci_ai (
  provider = icu, locale = 'und-u-ks-level1', deterministic = false
);
ALTER TABLE products ALTER COLUMN name SET DATA TYPE text COLLATE ci_ai;
```

### Timezone and Currency Handling

```typescript
// Store UTC, convert on display — use user's timezone
import { formatInTimeZone } from 'date-fns-tz';

function formatForUser(utcDate: Date, user: { timezone: string; locale: string }) {
  return formatInTimeZone(utcDate, user.timezone, 'PPpp', {
    locale: getDateFnsLocale(user.locale),
  });
}

// Currency: store amount in smallest unit (cents) + ISO 4217 code
interface MonetaryAmount {
  amount: number;     // in smallest unit (cents/pence)
  currency: string;   // ISO 4217: 'USD', 'EUR', 'JPY'
}

function formatCurrency(money: MonetaryAmount, locale: string): string {
  const divisor = getDecimalDivisor(money.currency); // JPY=1, USD=100
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
  }).format(money.amount / divisor);
}
// formatCurrency({ amount: 1999, currency: 'USD' }, 'en-US') → "$19.99"
// formatCurrency({ amount: 1999, currency: 'USD' }, 'de-DE') → "19,99 $"
// formatCurrency({ amount: 1500, currency: 'JPY' }, 'ja-JP') → "¥1,500"
```

### Server-Side ICU MessageFormat

```typescript
// Node.js — @formatjs/intl-messageformat for server-side formatting
import IntlMessageFormat from 'intl-messageformat';

const messages: Record<string, Record<string, string>> = {
  en: {
    cart: `You have {count, plural,
      =0 {no items}
      one {# item}
      other {# items}
    } in your cart.`,
  },
  ar: {
    cart: `لديك {count, plural,
      =0 {لا عناصر}
      one {عنصر واحد}
      two {عنصران}
      few {# عناصر}
      many {# عنصرًا}
      other {# عنصر}
    } في سلة التسوق.`,
  },
};

function formatMessage(locale: string, key: string, values: Record<string, any>) {
  const template = messages[locale]?.[key] ?? messages['en'][key];
  const msg = new IntlMessageFormat(template, locale);
  return msg.format(values);
}
// formatMessage('ar', 'cart', { count: 11 }) → "لديك ١١ عنصرًا في سلة التسوق."
```

---

## Best Practices

1. **Resolve locale once per request** — compute in middleware, attach to request context, reuse everywhere in the handler chain.
2. **Always return `Content-Language` and `Vary: Accept-Language`** — enable correct HTTP caching for localized responses.
3. **Store translations in namespaced files** — separate `errors.json`, `validation.json`, `emails.json` to avoid loading unused strings.
4. **Use the translation table pattern for CMS content** — it scales to unlimited locales without schema migrations.
5. **Implement locale fallback chains** — `de-AT` -> `de` -> `en` prevents empty translations.
6. **Store all timestamps in UTC** — convert to user timezone only at the presentation layer.
7. **Store monetary values as integers in smallest currency unit** — avoids floating-point rounding errors.
8. **Use ICU MessageFormat for all pluralized server messages** — handles Arabic (6 forms), Slavic languages, and all CLDR plural rules.
9. **Set PostgreSQL collation per column, not per database** — allows different sorting rules for different content types.
10. **Cache translation bundles in memory** — reload only on deployment, not per request.

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Hardcoding locale to `en-US` in API responses | Non-English users see English error messages | Use request locale from middleware |
| Storing formatted dates/currencies in DB | Cannot re-format for different locales | Store raw values (UTC, cents), format at display |
| Auto-redirecting based on geo-IP without option | Users on VPN get wrong locale, no escape | Suggest locale with a dismissible banner |
| Adding locale columns for every new language | Schema migration per locale, column sprawl | Use translation table or JSON column pattern |
| String concatenation for plurals | Breaks in languages with complex plural rules | Use ICU MessageFormat |
| Storing timezone offset instead of timezone ID | Offset changes with DST; `+01:00` is ambiguous | Store IANA timezone: `Europe/Berlin` |
| Loading all translation namespaces per request | Wastes memory and parse time on server | Load only needed namespaces per route |
| Using `LIKE` without collation for search | Misses accented characters, wrong sort order | Use ICU collation or `unaccent` extension |

---

## Enforcement Checklist

- [ ] Every API endpoint returns `Content-Language` header matching response locale
- [ ] Locale middleware runs before all route handlers
- [ ] Locale fallback chain is configured (`de-AT` -> `de` -> `en`)
- [ ] All user-facing server messages use translation keys, not hardcoded strings
- [ ] Database stores timestamps in UTC with `TIMESTAMPTZ` column type
- [ ] Monetary amounts stored as integers with ISO 4217 currency code
- [ ] Translation files are loaded at startup and cached in memory
- [ ] PostgreSQL columns with user-searchable text have ICU collation
- [ ] Email and notification templates use the recipient's stored locale preference
- [ ] CI pipeline checks for missing translation keys across all supported locales
