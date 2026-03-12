# Translation Management

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | i18n > Translation                                           |
| Importance    | High                                                         |
| Last Updated  | 2026-03-11                                                   |
| Cross-ref     | [Backend i18n](backend-i18n.md), [05-frontend i18n](../../05-frontend/web/i18n/internationalization.md) |

---

## Core Concepts

### Translation Management Workflow

```
  Developer                  CI/CD                    TMS                   Translators
  ─────────                  ─────                    ───                   ───────────
  1. Add keys in code  ──►  2. Extract strings  ──►  3. Upload new keys  ──►  4. Translate
       t('cart.title')       i18next-parser           Crowdin / Lokalise       + Review
                             formatjs extract
                                                                                 │
  7. Deploy with       ◄──  6. Pull translations ◄── 5. Export completed  ◄──────┘
     updated locales        on build/merge            translations
```

**Key principle:** Developers never edit translation files manually except for the source locale. All translations flow through the TMS (Translation Management System).

### TMS Platform Comparison

| Platform | CLI/API | GitHub Integration | MT Integration | Branching | Pricing Tier |
|----------|---------|-------------------|----------------|-----------|-------------|
| **Crowdin** | CLI + API | Native (GitHub App) | DeepL, Google, MT | Branch-based | Free OSS, from $40/mo |
| **Lokalise** | CLI + API | Webhooks + Actions | DeepL, Google | Branch sync | From $120/mo |
| **Phrase** | CLI + API | GitHub App | Built-in MT | Branching | From $25/mo |
| **Transifex** | CLI (tx) | Native integration | MT suggestions | Resource-based | Free OSS, from $100/mo |
| **POEditor** | API only | Manual / webhook | Google, Microsoft | No branching | Free tier, from $15/mo |

Choose Crowdin or Lokalise for teams with active GitHub workflows and branch-based development. Choose POEditor for budget-constrained projects with simple workflows.

### Translation File Formats

| Format | Extension | Use Case | Tooling |
|--------|-----------|----------|---------|
| **JSON** | `.json` | JavaScript/TypeScript (i18next, next-intl) | Universal |
| **PO/POT** | `.po` / `.pot` | Python (gettext), PHP, C/C++ | pybabel, xgettext |
| **XLIFF** | `.xlf` / `.xliff` | Enterprise, Angular, iOS | CAT tools |
| **ARB** | `.arb` | Flutter/Dart | intl_translation |
| **YAML** | `.yml` | Ruby on Rails, some Node.js | rails-i18n |

```json
// JSON — nested key structure (i18next / next-intl)
{
  "cart": {
    "title": "Shopping Cart",
    "items": "You have {count, plural, one {# item} other {# items}}",
    "empty": "Your cart is empty",
    "checkout": "Proceed to Checkout"
  }
}
```

```
# PO format — Python gettext
# messages.pot (template)
msgid "cart.title"
msgstr ""

msgid "cart.items"
msgid_plural "cart.items_plural"
msgstr[0] ""
msgstr[1] ""

# de/LC_MESSAGES/messages.po
msgid "cart.title"
msgstr "Warenkorb"
```

### Key-Based vs Content-Based Translation

| Approach | Example Source | Pros | Cons |
|----------|--------------|------|------|
| **Key-based** | `t('cart.checkout')` | Stable keys, refactor-safe | Keys can drift from content |
| **Content-based** | `t('Proceed to Checkout')` | Source text is the key, readable | Renaming source breaks translations |

Use key-based for applications with structured UI. Use content-based for content-heavy sites where the English text is the natural identifier.

### CI/CD Integration

```yaml
# .github/workflows/translations.yml — Sync translations with Crowdin
name: Translation Sync

on:
  push:
    branches: [main]
    paths:
      - 'src/locales/en/**'         # Only when source strings change
  schedule:
    - cron: '0 6 * * *'             # Daily pull of completed translations

jobs:
  upload-sources:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Upload source strings to Crowdin
        uses: crowdin/github-action@v2
        with:
          upload_sources: true
          upload_translations: false
          crowdin_branch_name: main
        env:
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_TOKEN }}

  download-translations:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Download translations from Crowdin
        uses: crowdin/github-action@v2
        with:
          download_translations: true
          create_pull_request: true
          pull_request_title: 'chore(i18n): update translations'
          pull_request_base_branch_name: main
        env:
          CROWDIN_PROJECT_ID: ${{ secrets.CROWDIN_PROJECT_ID }}
          CROWDIN_PERSONAL_TOKEN: ${{ secrets.CROWDIN_TOKEN }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

```yaml
# crowdin.yml — Crowdin CLI configuration
project_id_env: CROWDIN_PROJECT_ID
api_token_env: CROWDIN_TOKEN
base_path: '.'
preserve_hierarchy: true

files:
  - source: /src/locales/en/*.json
    translation: /src/locales/%two_letters_code%/%original_file_name%
    # %two_letters_code% → de, fr, ja, ar
```

### Machine Translation Integration

```typescript
// Post-editing workflow: MT → Human review → Approved
import { Translator } from 'deepl-node';

const translator = new Translator(process.env.DEEPL_API_KEY!);

async function preFillTranslations(
  sourceStrings: Record<string, string>,
  targetLang: string
): Promise<Record<string, string>> {
  const entries = Object.entries(sourceStrings);
  const texts = entries.map(([, v]) => v);

  const results = await translator.translateText(
    texts,
    'en',
    targetLang as any,
    {
      preserveFormatting: true,
      tagHandling: 'html',       // Preserve HTML tags in translations
      ignoreTags: ['x'],         // Ignore ICU placeholders wrapped in <x>
    }
  );

  const translated: Record<string, string> = {};
  entries.forEach(([key], i) => {
    translated[key] = Array.isArray(results) ? results[i].text : results.text;
  });
  return translated;
}
```

| MT Provider | Quality (general) | Supported Languages | Pricing |
|-------------|-------------------|--------------------|---------|
| **DeepL** | Highest for EU languages | 30+ languages | $5.49/M chars |
| **Google Cloud Translation** | Good, widest coverage | 130+ languages | $20/M chars |
| **Amazon Translate** | Good, AWS integrated | 75+ languages | $15/M chars |

### Pluralization Rules by Language

CLDR defines 6 plural categories. Not every language uses all of them.

| Category | English | Arabic | Polish | Russian |
|----------|---------|--------|--------|---------|
| `zero` | - | 0 | - | - |
| `one` | 1 | 1 | 1 | 1, 21, 31... |
| `two` | - | 2 | - | - |
| `few` | - | 3-10 | 2-4, 22-24... | 2-4, 22-24... |
| `many` | - | 11-99 | 5-21, 25-31... | 5-20, 25-30... |
| `other` | 0, 2-999 | 100-102... | - | 0, 5-19... |

```json
// Arabic — 6 plural forms required
{
  "files": "{count, plural, =0 {لا ملفات} one {ملف واحد} two {ملفان} few {# ملفات} many {# ملفًا} other {# ملف}}"
}

// Polish — complex few/many rules
{
  "files": "{count, plural, one {# plik} few {# pliki} many {# plików} other {# pliku}}"
}
```

### Gender-Aware Translations

```json
// ICU select for gendered messages
{
  "invitation": "{gender, select, male {He invited you} female {She invited you} other {They invited you}} to {event}.",
  "profile_updated": "{gender, select, male {His profile was updated} female {Her profile was updated} other {Their profile was updated}}."
}
```

For languages with grammatical gender (French, German, Arabic), the gender often affects adjectives, articles, and verb forms:

```json
// French: gender affects the entire sentence structure
{
  "user_status": "{gender, select, male {Il est connecté} female {Elle est connectée} other {Connecté(e)}}"
}
```

### Translation QA

```typescript
// CI check: detect missing translation keys
import fs from 'node:fs';
import path from 'node:path';

const LOCALES_DIR = './src/locales';
const SOURCE_LOCALE = 'en';

function findMissingKeys(): Map<string, string[]> {
  const sourceKeys = getKeys(SOURCE_LOCALE);
  const locales = fs.readdirSync(LOCALES_DIR)
    .filter(d => d !== SOURCE_LOCALE);

  const missing = new Map<string, string[]>();
  for (const locale of locales) {
    const localeKeys = getKeys(locale);
    const missingKeys = sourceKeys.filter(k => !localeKeys.includes(k));
    if (missingKeys.length > 0) missing.set(locale, missingKeys);
  }
  return missing;
}

function getKeys(locale: string, prefix = ''): string[] {
  const file = path.join(LOCALES_DIR, locale, 'common.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return flattenKeys(data, prefix);
}

function flattenKeys(obj: any, prefix: string): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' ? flattenKeys(v, key) : [key];
  });
}

// Run in CI — exit with error if missing translations found
const missing = findMissingKeys();
if (missing.size > 0) {
  for (const [locale, keys] of missing) {
    console.error(`${locale}: ${keys.length} missing keys`);
    keys.forEach(k => console.error(`  - ${k}`));
  }
  process.exit(1);
}
```

**Pseudo-localization** — test i18n readiness without real translations:

```typescript
// Transform "Hello World" → "[Ĥéĺĺö Ŵöŕĺð!!!!!!]"
function pseudoLocalize(str: string): string {
  const charMap: Record<string, string> = {
    a: 'á', e: 'é', i: 'í', o: 'ö', u: 'ü', c: 'ç', n: 'ñ',
    A: 'Á', E: 'É', I: 'Í', O: 'Ö', U: 'Ü', C: 'Ç', N: 'Ñ',
  };
  const replaced = str.replace(/[aeioucnAEIOUCN]/g, c => charMap[c] || c);
  const padded = replaced + '!'.repeat(Math.ceil(str.length * 0.3)); // +30% length
  return `[${padded}]`;  // Brackets expose concatenation bugs
}
```

### Translation Branching

When multiple feature branches add translation keys simultaneously:

1. Each branch adds keys to source locale files only
2. TMS syncs with branch-specific namespaces (Crowdin branch feature)
3. On merge to `main`, TMS merges translation branches
4. Conflicts are resolved in TMS UI by translation managers
5. Daily CI job pulls latest merged translations

---

## Best Practices

1. **Extract strings automatically** — use `i18next-parser`, `formatjs extract`, or `pybabel extract` in CI; never rely on developers remembering to add keys to translation files.
2. **Provide context for every translation key** — add screenshots, descriptions, and character limits in the TMS so translators understand UI placement.
3. **Use ICU MessageFormat for all plurals and gender** — never concatenate strings or use simple ternary logic for pluralization.
4. **Run missing-key detection in CI** — fail the build if any supported locale is missing keys present in the source locale.
5. **Use pseudo-localization in development** — it exposes hardcoded strings, concatenation bugs, and layout overflow without waiting for real translations.
6. **Implement translation branching for parallel development** — prevents feature branches from overwriting each other's translation keys.
7. **Pre-fill with machine translation, then human review** — accelerates translation by 50-70% while maintaining quality through post-editing.
8. **Maintain a project glossary in the TMS** — ensures consistent terminology across translators (e.g., "cart" is always "Warenkorb" in German).
9. **Version translation files in Git** — treat translations as code artifacts; review changes in PRs.
10. **Set character limits on UI strings** — prevent translated text from overflowing buttons and labels (German averages 30% longer than English).

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Developers editing non-source locale files manually | Overwrites translator work, causes merge conflicts | All non-source translations flow through TMS only |
| No context for translation keys | Translators guess meaning, produce incorrect translations | Add screenshots, descriptions, max length in TMS |
| Using simple `count === 1 ? singular : plural` | Fails for Arabic (6 forms), Polish, Russian | Use ICU MessageFormat plural rules |
| Shipping with untranslated strings visible to users | Broken UX in non-English locales | CI check for missing keys + fallback to source locale |
| One monolithic translation file per locale | Slow loading, merge conflicts, hard to find keys | Split by namespace: `common.json`, `cart.json`, `auth.json` |
| Machine translation without human review | Grammatical errors, wrong context, cultural issues | MT for first draft, human review before shipping |
| Ignoring string expansion in translated languages | Buttons overflow, text truncated in German/Finnish | Test with pseudo-localization, set char limits |
| No glossary or style guide for translators | Inconsistent terminology across the product | Maintain glossary in TMS, update quarterly |

---

## Enforcement Checklist

- [ ] String extraction runs automatically in CI pipeline on every push
- [ ] TMS is connected to repository via CLI or GitHub integration
- [ ] Missing translation keys fail the CI build for all supported locales
- [ ] Every translation key has context (description and/or screenshot)
- [ ] Pseudo-localization is available as a locale in development/staging
- [ ] ICU MessageFormat is used for all pluralized and gendered strings
- [ ] Character limits are set for all UI-facing translation keys
- [ ] Machine translations are flagged for human review before release
- [ ] Translation glossary exists and is maintained in the TMS
- [ ] Translation files are split by namespace and reviewed in PRs
