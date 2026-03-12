# Advanced Locale Formatting

| Attribute      | Value                                                        |
|---------------|--------------------------------------------------------------|
| Domain        | i18n > Formatting                                            |
| Importance    | Medium                                                       |
| Last Updated  | 2026-03-11                                                   |
| Cross-ref     | [Backend i18n](backend-i18n.md), [05-frontend i18n](../../05-frontend/web/i18n/internationalization.md) |

---

## Core Concepts

### CLDR — Common Locale Data Repository

CLDR is the Unicode Consortium's repository of locale-specific data. The JavaScript `Intl` API, ICU libraries, and every major platform rely on CLDR data for formatting rules.

**What CLDR provides:**
- Number formatting (decimal, grouping, percent, currency symbols)
- Date/time formatting (patterns, calendar data, timezone names)
- Plural rules (cardinal and ordinal per language)
- Collation (sorting rules per locale)
- Currency information (symbols, decimal places, formatting)
- Units (measurement systems, unit patterns)
- Language/region/script display names

**CLDR is versioned** — the `Intl` APIs use whichever CLDR version ships with the runtime (Node.js, browser). Check coverage with `Intl.Locale` support.

### Number Systems

The `Intl.NumberFormat` `numberingSystem` option renders digits in different scripts.

```typescript
// Latin (default for most Western locales)
new Intl.NumberFormat('en', { numberingSystem: 'latn' }).format(12345);
// → "12,345"

// Arabic-Indic (used in Arabic-speaking countries)
new Intl.NumberFormat('ar-EG', { numberingSystem: 'arab' }).format(12345);
// → "١٢٬٣٤٥"

// Devanagari (Hindi)
new Intl.NumberFormat('hi-IN', { numberingSystem: 'deva' }).format(12345);
// → "१२,३४५"

// Thai
new Intl.NumberFormat('th', { numberingSystem: 'thai' }).format(12345);
// → "๑๒,๓๔๕"

// Chinese financial (formal accounting numerals)
new Intl.NumberFormat('zh-CN', { numberingSystem: 'hansfin' }).format(12345);
// → "壹万贰仟叁佰肆拾伍"
```

### Complex Pluralization — CLDR Plural Rules

Each language maps numbers to plural categories based on CLDR rules. Use `Intl.PluralRules` to determine the category.

```typescript
// English: only 'one' and 'other'
const enPR = new Intl.PluralRules('en');
enPR.select(0);   // → "other"
enPR.select(1);   // → "one"
enPR.select(2);   // → "other"

// Arabic: all 6 categories
const arPR = new Intl.PluralRules('ar');
arPR.select(0);   // → "zero"
arPR.select(1);   // → "one"
arPR.select(2);   // → "two"
arPR.select(3);   // → "few"     (3-10)
arPR.select(11);  // → "many"    (11-99)
arPR.select(100); // → "other"   (100, 101, 102...)

// Polish: complex 'few' and 'many' (Slavic pattern)
const plPR = new Intl.PluralRules('pl');
plPR.select(1);   // → "one"
plPR.select(2);   // → "few"     (2-4, 22-24, 32-34...)
plPR.select(5);   // → "many"    (5-21, 25-31...)
plPR.select(1.5); // → "other"   (fractional numbers)

// Welsh: rare 'zero' and 'two' categories
const cyPR = new Intl.PluralRules('cy');
cyPR.select(0);   // → "zero"
cyPR.select(1);   // → "one"
cyPR.select(2);   // → "two"
cyPR.select(3);   // → "few"
cyPR.select(6);   // → "many"
cyPR.select(4);   // → "other"
```

### Ordinal Numbers

Ordinal plural rules determine suffixes like 1st, 2nd, 3rd.

```typescript
const enOrd = new Intl.PluralRules('en', { type: 'ordinal' });
enOrd.select(1);  // → "one"   → 1st
enOrd.select(2);  // → "two"   → 2nd
enOrd.select(3);  // → "few"   → 3rd
enOrd.select(4);  // → "other" → 4th

const suffixes: Record<string, string> = {
  one: 'st', two: 'nd', few: 'rd', other: 'th',
};

function ordinal(n: number, locale = 'en'): string {
  const pr = new Intl.PluralRules(locale, { type: 'ordinal' });
  const category = pr.select(n);
  return `${n}${suffixes[category] ?? 'th'}`;
}
// ordinal(1) → "1st", ordinal(22) → "22nd", ordinal(103) → "103rd"
```

### Relative Time Formatting

```typescript
const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
rtf.format(-1, 'day');     // → "yesterday"
rtf.format(0, 'day');      // → "today"
rtf.format(1, 'day');      // → "tomorrow"
rtf.format(-3, 'hour');    // → "3 hours ago"
rtf.format(2, 'month');    // → "in 2 months"

// Auto-select best unit
function relativeTime(date: Date, locale = 'en'): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);
  const diffMo = Math.round(diffDay / 30);
  const diffYr = Math.round(diffDay / 365);

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHr) < 24)  return rtf.format(diffHr, 'hour');
  if (Math.abs(diffDay) < 30) return rtf.format(diffDay, 'day');
  if (Math.abs(diffMo) < 12)  return rtf.format(diffMo, 'month');
  return rtf.format(diffYr, 'year');
}
```

### Unit Formatting

```typescript
// Speed, distance, volume, temperature, data units
new Intl.NumberFormat('en', { style: 'unit', unit: 'kilometer-per-hour' }).format(120);
// → "120 km/h"

new Intl.NumberFormat('en-US', { style: 'unit', unit: 'mile', unitDisplay: 'long' }).format(5);
// → "5 miles"

new Intl.NumberFormat('de', { style: 'unit', unit: 'celsius' }).format(22);
// → "22 °C"

new Intl.NumberFormat('en', { style: 'unit', unit: 'gigabyte', unitDisplay: 'narrow' }).format(256);
// → "256GB"

new Intl.NumberFormat('en', { style: 'unit', unit: 'liter', unitDisplay: 'long' }).format(3.5);
// → "3.5 liters"
```

### List Formatting

```typescript
// Conjunction (and)
new Intl.ListFormat('en', { type: 'conjunction' }).format(['Alice', 'Bob', 'Charlie']);
// → "Alice, Bob, and Charlie"

new Intl.ListFormat('de', { type: 'conjunction' }).format(['Alice', 'Bob', 'Charlie']);
// → "Alice, Bob und Charlie"

new Intl.ListFormat('ja', { type: 'conjunction' }).format(['Alice', 'Bob', 'Charlie']);
// → "Alice、Bob、Charlie"

// Disjunction (or)
new Intl.ListFormat('en', { type: 'disjunction' }).format(['red', 'blue', 'green']);
// → "red, blue, or green"

// Unit (no conjunction — for measurements)
new Intl.ListFormat('en', { style: 'narrow', type: 'unit' }).format(['5 lb', '3 oz']);
// → "5 lb 3 oz"
```

### Display Names

```typescript
// Language names
new Intl.DisplayNames('en', { type: 'language' }).of('de');     // → "German"
new Intl.DisplayNames('de', { type: 'language' }).of('de');     // → "Deutsch"
new Intl.DisplayNames('ja', { type: 'language' }).of('en');     // → "英語"

// Region names
new Intl.DisplayNames('en', { type: 'region' }).of('JP');       // → "Japan"
new Intl.DisplayNames('ja', { type: 'region' }).of('JP');       // → "日本"

// Currency names
new Intl.DisplayNames('en', { type: 'currency' }).of('JPY');    // → "Japanese Yen"
new Intl.DisplayNames('de', { type: 'currency' }).of('EUR');    // → "Euro"

// Script names
new Intl.DisplayNames('en', { type: 'script' }).of('Arab');     // → "Arabic"
new Intl.DisplayNames('en', { type: 'script' }).of('Hant');     // → "Traditional Chinese"
```

### Calendar Systems

```typescript
// Hijri (Islamic) calendar
new Intl.DateTimeFormat('ar-SA', {
  calendar: 'islamic',
  dateStyle: 'full',
}).format(new Date('2025-01-15'));
// → "الأربعاء، ١٥ رجب ١٤٤٦ هـ"

// Hebrew calendar
new Intl.DateTimeFormat('he', {
  calendar: 'hebrew',
  dateStyle: 'full',
}).format(new Date('2025-01-15'));
// → "יום רביעי, ט״ו בטבת ה׳תשפ״ה"

// Japanese imperial era calendar
new Intl.DateTimeFormat('ja-JP', {
  calendar: 'japanese',
  dateStyle: 'full',
}).format(new Date('2025-01-15'));
// → "令和7年1月15日水曜日"

// Buddhist calendar (Thai)
new Intl.DateTimeFormat('th', {
  calendar: 'buddhist',
  dateStyle: 'full',
}).format(new Date('2025-01-15'));
// → "วันพุธที่ 15 มกราคม พ.ศ. 2568"

// Persian (Solar Hijri) calendar
new Intl.DateTimeFormat('fa-IR', {
  calendar: 'persian',
  dateStyle: 'full',
}).format(new Date('2025-01-15'));
// → "چهارشنبه ۲۵ دی ۱۴۰۳ هـ.ش."
```

### Locale Matching — BCP 47

```typescript
// BCP 47 language tags
const locale = new Intl.Locale('zh-Hant-TW');
locale.language;   // → "zh"       (Chinese)
locale.script;     // → "Hant"     (Traditional)
locale.region;     // → "TW"       (Taiwan)

// Locale with extensions
const localeExt = new Intl.Locale('ar-EG-u-nu-arab-ca-islamic');
localeExt.numberingSystem;  // → "arab"     (Arabic-Indic digits)
localeExt.calendar;         // → "islamic"

// Language negotiation (find best match from supported set)
// Use @formatjs/intl-localematcher
import { match } from '@formatjs/intl-localematcher';

const supported = ['en', 'de', 'fr', 'zh-Hans', 'zh-Hant', 'ar'];
const requested = ['zh-TW', 'en'];       // User prefers zh-TW, then en
const bestMatch = match(requested, supported, 'en');
// → "zh-Hant"  (zh-TW maps to Traditional Chinese)
```

### Text Segmentation

```typescript
// Word segmentation — critical for CJK (no spaces between words)
const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
const segments = [...segmenter.segment('東京都は日本の首都です')];
// Words: 東京都 | は | 日本 | の | 首都 | です

// Grapheme segmentation — correct character counting for emoji
const graphemeSeg = new Intl.Segmenter('en', { granularity: 'grapheme' });
const text = '👨‍👩‍👧‍👦 Hello! 🇯🇵';
const graphemes = [...graphemeSeg.segment(text)].map(s => s.segment);
// Counts family emoji as 1 grapheme, flag as 1 grapheme

// Sentence segmentation
const sentSeg = new Intl.Segmenter('en', { granularity: 'sentence' });
const sentences = [...sentSeg.segment('Hello! How are you? Fine.')].map(s => s.segment);
// → ["Hello! ", "How are you? ", "Fine."]

// Use case: truncate text at word boundary
function truncateAtWord(text: string, maxGraphemes: number, locale: string): string {
  const wordSeg = new Intl.Segmenter(locale, { granularity: 'word' });
  const graphSeg = new Intl.Segmenter(locale, { granularity: 'grapheme' });
  let result = '';
  let count = 0;
  for (const { segment } of wordSeg.segment(text)) {
    const graphemeCount = [...graphSeg.segment(segment)].length;
    if (count + graphemeCount > maxGraphemes) break;
    result += segment;
    count += graphemeCount;
  }
  return result.trimEnd() + (result.length < text.length ? '...' : '');
}
```

### Collation and Sorting

```typescript
// Basic locale-aware sorting
const cities = ['Zürich', 'Aachen', 'Österreich', 'Berlin', 'Ägypten'];

// German sorting (ä sorts near a)
cities.sort(new Intl.Collator('de').compare);
// → ["Aachen", "Ägypten", "Berlin", "Österreich", "Zürich"]

// Swedish sorting (ä sorts after z)
cities.sort(new Intl.Collator('sv').compare);
// → ["Aachen", "Berlin", "Zürich", "Ägypten", "Österreich"]

// Case-insensitive, accent-insensitive (base comparison)
const collator = new Intl.Collator('en', { sensitivity: 'base' });
collator.compare('cafe', 'café');   // → 0 (equal)
collator.compare('a', 'A');         // → 0 (equal)

// Sensitivity levels:
// 'base'    — ignore case and accents   (a = á = A = Á)
// 'accent'  — ignore case, compare accents (a ≠ á, a = A)
// 'case'    — compare case, ignore accents (a ≠ A, a = á)
// 'variant' — compare everything (default)

// Numeric sorting (sort "file2" before "file10")
const numCollator = new Intl.Collator('en', { numeric: true });
['file10', 'file2', 'file1'].sort(numCollator.compare);
// → ["file1", "file2", "file10"]

// German phonebook sorting (for names: ä = ae)
const phonebook = new Intl.Collator('de-DE-u-co-phonebk');
['Müller', 'Mueller', 'Maler'].sort(phonebook.compare);
// Müller and Mueller sort adjacent
```

---

## Best Practices

1. **Use `Intl` APIs instead of custom formatters** — they use CLDR data, handle edge cases, and are maintained by the platform.
2. **Always pass locale explicitly** — never rely on the system default locale; pass the user's locale to every `Intl` constructor.
3. **Use `Intl.Segmenter` for text truncation** — `String.prototype.slice` breaks emoji, CJK, and combining characters.
4. **Test plural rules for every supported language** — Arabic, Polish, and Welsh have categories that English does not; verify all forms render.
5. **Use `sensitivity: 'base'` for search matching** — allows users to find "cafe" when searching for "cafe" regardless of accent marks.
6. **Support non-Gregorian calendars for relevant locales** — Islamic, Hebrew, and Buddhist calendars are required in many regions.
7. **Use `numeric: true` collation for user-facing lists** — ensures `file2` sorts before `file10`.
8. **Format units with `Intl.NumberFormat`** — handles localized unit names, spacing, and abbreviations automatically.
9. **Use `Intl.ListFormat` for joining arrays into prose** — handles locale-specific conjunctions, serial commas, and separators.
10. **Check `Intl.Locale` for runtime CLDR capabilities** — verify that the runtime supports required numbering systems and calendars before using them.

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Using `string.length` to count characters | Wrong for emoji, CJK, combining marks | Use `Intl.Segmenter` with `granularity: 'grapheme'` |
| Hardcoding ordinal suffixes (`st`, `nd`, `rd`, `th`) | Breaks for non-English locales | Use `Intl.PluralRules` with `type: 'ordinal'` |
| Using `Array.join(', ')` to build lists | Missing locale-specific conjunctions | Use `Intl.ListFormat` |
| Sorting strings with `<` and `>` operators | Wrong order for accented characters, locale-dependent | Use `Intl.Collator` |
| Assuming Gregorian calendar for all users | Incorrect dates for Islamic, Hebrew, Buddhist contexts | Support `calendar` option in `DateTimeFormat` |
| Using `toLocaleString()` without explicit locale | Uses system locale, inconsistent across environments | Always pass explicit locale parameter |
| Building relative time strings with math and concatenation | Wrong grammar, missing special forms (`yesterday`) | Use `Intl.RelativeTimeFormat` |
| Counting emoji length with regex | Fails on ZWJ sequences and flag emoji | Use `Intl.Segmenter` grapheme granularity |

---

## Enforcement Checklist

- [ ] All number, date, currency, and unit formatting uses `Intl` APIs with explicit locale
- [ ] Plural forms are tested for Arabic (6 categories), Polish, and Russian
- [ ] Ordinal formatting uses `Intl.PluralRules` with `type: 'ordinal'`
- [ ] Text truncation and character counting uses `Intl.Segmenter`
- [ ] String sorting uses `Intl.Collator` with appropriate sensitivity
- [ ] Non-Gregorian calendars are supported for locales that require them
- [ ] Number systems (Arabic-Indic, Devanagari) are tested for relevant locales
- [ ] `Intl.ListFormat` is used for all user-facing list concatenation
- [ ] BCP 47 locale tags are parsed with `Intl.Locale` for extension support
- [ ] Search and filtering uses accent-insensitive collation
