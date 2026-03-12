# 14 — Accessibility & Internationalization

> Build inclusive, global software — advanced accessibility compliance, complex ARIA widgets, mobile a11y, backend i18n, translation workflows, and multilingual SEO.

## Structure (2 folders, 9 files)

### accessibility/ (4 files)
- [wcag-compliance.md](accessibility/wcag-compliance.md) — WCAG 2.2 conformance levels, legal (ADA/EAA 2025/Section 508), VPAT/ACR, audit process, remediation roadmap
- [accessible-components.md](accessibility/accessible-components.md) — Advanced ARIA: combobox, data grid, tree view, menu, dialog, carousel, drag-and-drop (React/TS)
- [mobile-accessibility.md](accessibility/mobile-accessibility.md) — iOS VoiceOver, Android TalkBack, React Native, Flutter, touch targets, Dynamic Type
- [cognitive-accessibility.md](accessibility/cognitive-accessibility.md) — WCAG 2.2 cognitive criteria, plain language, error recovery, timeouts, reduced motion

### internationalization/ (5 files)
- [backend-i18n.md](internationalization/backend-i18n.md) — Server-side locale detection, API translations, DB schema (3 patterns), timezone/currency handling
- [translation-management.md](internationalization/translation-management.md) — TMS (Crowdin/Lokalise/Phrase), CI/CD sync, machine translation, pluralization, gender, QA
- [advanced-locale-formatting.md](internationalization/advanced-locale-formatting.md) — CLDR, Intl API deep-dive, number systems, complex plurals, calendars, segmentation
- [rtl-and-bidi.md](internationalization/rtl-and-bidi.md) — CSS logical properties, Unicode BiDi algorithm, icon mirroring, RTL testing, migration
- [multilingual-seo.md](internationalization/multilingual-seo.md) — hreflang, locale URL strategies, multilingual sitemaps, localized schema.org

## Cross-References

| Topic | This Section | Related Section |
|-------|-------------|----------------|
| Frontend accessibility basics | — (fully covered) | [05-frontend/accessibility.md](../05-frontend/web/component-design/accessibility.md) (1,198 lines) |
| Accessibility testing | — (fully covered) | [11-testing/advanced-testing/accessibility-testing.md](../11-testing/advanced-testing/accessibility-testing.md) |
| Frontend i18n basics | — (fully covered) | [05-frontend/i18n/internationalization.md](../05-frontend/web/i18n/internationalization.md) (444 lines) |
| Code review a11y checklist | — (checklist items) | [13-code-quality/code-review/review-checklist.md](../13-code-quality/code-review/review-checklist.md) |

## Perspective Differentiation

| Section | Focus |
|---------|-------|
| **05-frontend** | Frontend implementation — semantic HTML, ARIA basics, React/Vue patterns, i18n libraries, Intl API basics |
| **11-testing** | Testing tools — axe-core, Pa11y, Lighthouse, Playwright a11y, Storybook addon |
| **14-accessibility-i18n** | **Advanced/cross-cutting — legal compliance, complex ARIA widgets, mobile, cognitive a11y, backend i18n, translation workflows, SEO** |
