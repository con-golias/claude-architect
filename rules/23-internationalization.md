---
mode: manual
paths:
  - "src/**/*.tsx"
  - "src/**/*.jsx"
  - "src/**/*.vue"
  - "src/**/*.ts"
  - "src/**/*.js"
---
## Internationalization & Localization

### String Externalization
- NEVER hardcode user-facing strings in source code — extract to translation files
- Store translations in structured format: JSON, YAML, or ICU message bundles
- Organize translation files per locale: `locales/{lang}.json` or `locales/{lang}/{namespace}.json`
- Use namespace-based splitting for large apps: `common`, `auth`, `dashboard`, `errors`
- Server-rendered content (emails, PDFs, error messages) MUST also use translation files
- Mark all user-facing strings during code review — reject hardcoded literals

### Translation Key Naming
- Use dot-notation hierarchy: `{namespace}.{context}.{element}`
  - Example: `auth.login.submitButton`, `errors.network.timeout`
- Keys MUST be descriptive — never use the English text as key
  - Good: `order.status.shipped`
  - Bad: `Shipped` or `shipped_text`
- Use consistent suffixes: `.title`, `.description`, `.label`, `.placeholder`, `.error`, `.success`
- NEVER reuse keys across unrelated contexts — same English text may translate differently
- Document keys that contain dynamic values with a comment in the translation file

### ICU Message Format
- Use ICU MessageFormat for plurals, gender, and selections — not manual if/else
- Plural rules: ALWAYS define `one`, `other` at minimum; add `zero`, `few`, `many` per locale
  ```
  {count, plural, =0 {No items} one {1 item} other {{count} items}}
  ```
- Use `select` for gender and enum-based variations — never concatenate translated fragments
- NEVER assemble sentences from translated parts — word order varies across languages
- Provide translator context comments for ambiguous strings

### Date, Number & Currency Formatting
- ALWAYS use `Intl.DateTimeFormat`, `Intl.NumberFormat`, or equivalent locale-aware APIs
- NEVER format dates with manual string concatenation or hardcoded patterns
- Store all timestamps in UTC — format to local timezone only at display time
- Currency: use ISO 4217 codes (USD, EUR) and locale-aware formatting — never hardcode symbols
- Use relative time formatting (`Intl.RelativeTimeFormat`) for recency indicators
- Number separators differ by locale (1,000.00 vs 1.000,00) — never assume format

### RTL & Layout Support
- Use logical CSS properties: `margin-inline-start` not `margin-left`
- Set `dir="auto"` or explicit `dir="rtl"` on root element based on active locale
- Mirror layout for RTL: icons, navigation, progress bars, swipe directions
- Test every page in at least one RTL locale (Arabic or Hebrew) before release
- NEVER use absolute positioning based on left/right for locale-sensitive content

### Locale Fallback & Loading
- Define explicit fallback chain: `fr-CA` -> `fr` -> `en` (base)
- ALWAYS set a base/default locale — never leave translations undefined
- Lazy-load translation bundles per locale — do not ship all locales in main bundle
- Validate locale codes against BCP 47 standard — reject invalid locale parameters
- Detect user locale from: explicit preference > Accept-Language header > browser default
- Cache loaded translations in memory — avoid re-fetching on navigation
