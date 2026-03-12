# App Store Optimization — Complete Specification

> **AI Plugin Directive:** When a developer asks "app store optimization", "ASO strategy", "app store listing", "app screenshots", "app keywords", "app store reviews", "app rating strategy", "Play Store listing", "App Store Connect", "app store A/B testing", "app launch checklist", or any ASO question, ALWAYS consult this directive. App Store Optimization (ASO) is the process of improving an app's visibility and conversion rate in the App Store and Google Play Store. ALWAYS optimize the app title and subtitle with relevant keywords. ALWAYS include 6-10 localized screenshots showing key features. ALWAYS implement a rating prompt at the RIGHT moment using the native in-app review API.

**Core Rule: ASO is the mobile equivalent of SEO — it determines whether users FIND and DOWNLOAD your app. ALWAYS use the native in-app review API (StoreKit on iOS, Google Play In-App Review on Android) — NEVER redirect users to the store page. ALWAYS localize app store listings for target markets. ALWAYS A/B test screenshots and descriptions. The app title is the MOST important ranking factor — include primary keyword in the title.**

---

## 1. ASO Architecture

```
  APP STORE OPTIMIZATION COMPONENTS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  DISCOVERABILITY (getting found):                    │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  App Title        — primary keyword (30 chars) │  │
  │  │  Subtitle (iOS)   — secondary keywords (30 ch) │  │
  │  │  Short desc (And) — hook + keywords (80 chars) │  │
  │  │  Keywords (iOS)   — 100 chars, comma-separated │  │
  │  │  Long description — features + keywords         │  │
  │  │  Category          — primary + secondary        │  │
  │  │  Developer name    — brand recognition          │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  CONVERSION (getting downloads):                     │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  App icon          — recognizable, simple       │  │
  │  │  Screenshots       — 6-10, feature-focused      │  │
  │  │  Preview video     — 15-30 sec demo             │  │
  │  │  Ratings/reviews   — 4.5+ average target        │  │
  │  │  App size           — <100MB for instant DL      │  │
  │  │  What's New         — recent updates listed      │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RETENTION (keeping users):                          │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Update frequency  — regular (biweekly)         │  │
  │  │  Crash-free rate    — >99.5% target             │  │
  │  │  Rating management  — respond to reviews        │  │
  │  │  Deep linking       — re-engagement             │  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

---

## 2. In-App Review API

```swift
// iOS — StoreKit in-app review
import StoreKit

class ReviewManager {
    static func requestReviewIfAppropriate() {
        // Check conditions
        guard let windowScene = UIApplication.shared.connectedScenes
            .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
              shouldRequestReview() else { return }

        SKStoreReviewController.requestReview(in: windowScene)
    }

    private static func shouldRequestReview() -> Bool {
        let defaults = UserDefaults.standard
        let launchCount = defaults.integer(forKey: "launchCount") + 1
        defaults.set(launchCount, forKey: "launchCount")

        let lastReviewVersion = defaults.string(forKey: "lastReviewVersion") ?? ""
        let currentVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? ""

        // Request after 5+ launches AND version changed since last review
        return launchCount >= 5 && lastReviewVersion != currentVersion
    }
}
```

```kotlin
// Android — Google Play In-App Review
class ReviewHelper(private val activity: Activity) {
    private val reviewManager = ReviewManagerFactory.create(activity)

    fun requestReviewIfAppropriate() {
        if (!shouldRequestReview()) return

        val request = reviewManager.requestReviewFlow()
        request.addOnCompleteListener { task ->
            if (task.isSuccessful) {
                val reviewInfo = task.result
                reviewManager.launchReviewFlow(activity, reviewInfo)
            }
        }
    }

    private fun shouldRequestReview(): Boolean {
        val prefs = activity.getSharedPreferences("review", Context.MODE_PRIVATE)
        val completedActions = prefs.getInt("completedActions", 0)
        return completedActions >= 3
    }
}
```

```
  WHEN TO REQUEST REVIEWS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  ✅ GOOD MOMENTS:                                     │
  │  • After completing a key task successfully           │
  │  • After 5th app launch (user is engaged)            │
  │  • After positive outcome (order delivered, goal met)│
  │  • After unlocking an achievement                    │
  │                                                      │
  │  ❌ BAD MOMENTS:                                      │
  │  • First launch                                      │
  │  • During onboarding                                 │
  │  • After an error or crash                           │
  │  • Interrupting a task in progress                   │
  │  • Immediately after purchase                        │
  │                                                      │
  │  RULES:                                              │
  │  • iOS: System controls display — max 3x per year    │
  │  • Android: Quota managed by Google — respect it     │
  │  • NEVER show custom "Rate us!" dialogs              │
  │  • NEVER incentivize reviews (against store policies)│
  │  • NEVER redirect to store page (use native API)     │
  └──────────────────────────────────────────────────────┘
```

---

## 3. App Store Listing Optimization

| Element | iOS (App Store) | Android (Play Store) | Tips |
|---|---|---|---|
| **Title** | 30 chars | 30 chars | Primary keyword first, brand last |
| **Subtitle** | 30 chars | N/A | Secondary keywords |
| **Short Description** | N/A | 80 chars | Hook + call to action |
| **Description** | 4000 chars | 4000 chars | Keywords in first 3 lines |
| **Keywords** | 100 chars | N/A | No spaces after commas, no duplicates |
| **Screenshots** | Up to 10 | Up to 8 | First 2-3 visible without scrolling |
| **Preview Video** | 30 sec max | 30 sec-2 min | Auto-plays on iOS, thumbnail on Android |
| **Category** | Primary + Secondary | Primary + Secondary | Most relevant, not least competitive |

### 3.1 Screenshot Strategy

```
  SCREENSHOT BEST PRACTICES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Screenshot 1: Hero shot — core value proposition    │
  │  Screenshot 2: Primary feature in action             │
  │  Screenshot 3: Secondary feature                     │
  │  Screenshot 4: Social proof / stats                  │
  │  Screenshot 5: Unique differentiator                 │
  │  Screenshot 6: Call to action / pricing              │
  │                                                      │
  │  RULES:                                              │
  │  • Captions on EVERY screenshot (benefit-focused)    │
  │  • Show real UI (not mockups)                        │
  │  • Use device frames for context                     │
  │  • Localize screenshots per market                   │
  │  • First 2 screenshots are CRITICAL (visible in      │
  │    search results without scrolling)                 │
  │  • Test variations with A/B experiments              │
  └──────────────────────────────────────────────────────┘
```

---

## 4. Keyword Research & Optimization

```
  KEYWORD RESEARCH PROCESS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  STEP 1: Brainstorm seed keywords                    │
  │  • What problem does the app solve?                  │
  │  • What would users search for?                      │
  │  • What category does the app belong to?             │
  │                                                      │
  │  STEP 2: Analyze competitors                         │
  │  • Search top apps in your category                  │
  │  • Note their title, subtitle, keywords              │
  │  • Find gaps they're not targeting                   │
  │                                                      │
  │  STEP 3: Use ASO tools                               │
  │  • App Annie, Sensor Tower, AppTweak                 │
  │  • Check search volume + difficulty                  │
  │  • Target medium-volume, low-competition keywords    │
  │                                                      │
  │  STEP 4: Optimize placement                          │
  │  • Title: highest weight keyword                     │
  │  • Subtitle (iOS) / Short desc (Android): secondary  │
  │  • Keywords field (iOS): remaining keywords          │
  │  • Description: natural keyword integration          │
  │                                                      │
  │  STEP 5: Monitor and iterate                         │
  │  • Track keyword rankings weekly                     │
  │  • A/B test title/subtitle variations                │
  │  • Update keywords based on seasonal trends          │
  │                                                      │
  │  RULES:                                              │
  │  • iOS keywords: no spaces after commas, 100 chars   │
  │  • Don't duplicate words across title/subtitle/keys  │
  │  • Don't use competitor brand names (rejection risk) │
  │  • Localize keywords per market                      │
  └──────────────────────────────────────────────────────┘
```

### 4.1 Localization Strategy

```
  LOCALIZATION PRIORITY

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  TIER 1 (translate first — highest ROI):             │
  │  English, Spanish, Portuguese, French, German,       │
  │  Japanese, Korean, Chinese (Simplified + Traditional)│
  │                                                      │
  │  TIER 2 (high value):                                │
  │  Italian, Russian, Turkish, Arabic, Hindi,           │
  │  Indonesian, Thai, Vietnamese                        │
  │                                                      │
  │  WHAT TO LOCALIZE:                                   │
  │  ✅ App name / title                                  │
  │  ✅ Subtitle / short description                      │
  │  ✅ Full description                                  │
  │  ✅ Keywords (iOS)                                    │
  │  ✅ Screenshots (text overlays)                       │
  │  ✅ Preview video subtitles                           │
  │  ✅ What's New text                                   │
  │                                                      │
  │  PRO TIP: Even if app UI is English-only,            │
  │  localizing the STORE LISTING increases downloads    │
  │  by 30-50% in non-English markets.                   │
  └──────────────────────────────────────────────────────┘
```

---

## 5. Ratings & Review Management

```
  REVIEW RESPONSE STRATEGY

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  1-STAR REVIEWS:                                     │
  │  • Respond within 24 hours                           │
  │  • Apologize, ask for specific issue details          │
  │  • Provide contact email for direct support          │
  │  • Follow up when issue is resolved                  │
  │  • Update response when fix is shipped               │
  │                                                      │
  │  2-3 STAR REVIEWS:                                   │
  │  • Thank for feedback                                │
  │  • Address specific concerns mentioned               │
  │  • Explain planned improvements                      │
  │                                                      │
  │  4-5 STAR REVIEWS:                                   │
  │  • Thank the user                                    │
  │  • Highlight upcoming features                       │
  │  • Ask them to share with friends                    │
  │                                                      │
  │  METRICS TO TRACK:                                   │
  │  • Average rating (target: 4.5+)                     │
  │  • Rating velocity (trend over time)                 │
  │  • Review sentiment analysis                         │
  │  • Review response rate (target: 100% for 1-3 stars) │
  │  • Rating by version (detect regressions)            │
  └──────────────────────────────────────────────────────┘
```

---

## 6. Release Checklist

```
  PRE-LAUNCH CHECKLIST

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  TECHNICAL:                                          │
  │  □ Crash-free rate >99.5% (test on real devices)     │
  │  □ App startup <2 seconds                            │
  │  □ App size <100MB (instant download on mobile data) │
  │  □ ProGuard/R8 enabled (Android)                     │
  │  □ Bitcode enabled (iOS, if applicable)              │
  │  □ Privacy manifest completed (iOS)                  │
  │  □ Target SDK meets store requirements               │
  │                                                      │
  │  STORE LISTING:                                      │
  │  □ Title optimized with keywords                     │
  │  □ Description with features + keywords              │
  │  □ 6+ screenshots with benefit captions              │
  │  □ App icon tested at small sizes                    │
  │  □ Category selected correctly                       │
  │  □ Age rating configured                             │
  │  □ Privacy policy URL added                          │
  │                                                      │
  │  ANALYTICS:                                          │
  │  □ Crash reporting (Sentry/Crashlytics)              │
  │  □ Analytics events for key actions                  │
  │  □ Attribution tracking (optional)                   │
  │  □ In-app review prompt configured                   │
  │                                                      │
  │  COMPLIANCE:                                         │
  │  □ GDPR consent (EU users)                           │
  │  □ ATT prompt (iOS, if using tracking)               │
  │  □ Data safety section filled (Play Store)           │
  │  □ Export compliance answered (encryption)            │
  └──────────────────────────────────────────────────────┘
```

---

## 5. A/B Testing & Experimentation

```
  STORE LISTING EXPERIMENTS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  Google Play Store Listing Experiments:               │
  │  • A/B test graphics (icon, screenshots, video)      │
  │  • A/B test text (short description, full desc)      │
  │  • Test with 50/50 traffic split                     │
  │  • Run for 7+ days for statistical significance      │
  │  • Measure: install conversion rate                  │
  │                                                      │
  │  Apple App Store (Product Page Optimization):        │
  │  • Test up to 3 treatments + original                │
  │  • Can test: screenshots, app preview, app icon      │
  │  • Requires minimum traffic for significance          │
  │  • Available in App Store Connect                    │
  │                                                      │
  │  WHAT TO TEST:                                       │
  │  1. Screenshots (highest impact on conversion)       │
  │  2. App icon (second highest impact)                 │
  │  3. Short description / subtitle                     │
  │  4. Preview video (thumbnail + content)              │
  │                                                      │
  │  TESTING CADENCE:                                    │
  │  • Run one experiment at a time                      │
  │  • Test for 2-4 weeks minimum                        │
  │  • Apply winner, then test next element              │
  │  • Retest seasonally (holiday themes, etc.)          │
  └──────────────────────────────────────────────────────┘
```

### 5.1 Key Metrics to Track

```
  ASO METRICS DASHBOARD

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  VISIBILITY:                                         │
  │  • Keyword rankings (track top 20 keywords weekly)   │
  │  • Search impressions (App Store Connect analytics)  │
  │  • Browse impressions (featured, top charts)         │
  │  • Category ranking                                  │
  │                                                      │
  │  CONVERSION:                                         │
  │  • Impression → Product Page View rate               │
  │  • Product Page View → Install rate                  │
  │  • Overall conversion rate (benchmark: 25-35%)       │
  │  • A/B test lift per experiment                       │
  │                                                      │
  │  ENGAGEMENT:                                         │
  │  • Day 1, Day 7, Day 30 retention                    │
  │  • Average rating and rating velocity                │
  │  • Crash-free rate                                   │
  │  • Uninstall rate                                    │
  │                                                      │
  │  TOOLS:                                              │
  │  • App Store Connect / Google Play Console (free)    │
  │  • App Annie / data.ai (market intelligence)         │
  │  • Sensor Tower (keyword research, competitor intel) │
  │  • AppTweak (ASO optimization)                       │
  │  • SplitMetrics (A/B testing)                        │
  └──────────────────────────────────────────────────────┘
```

---

## 6. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Custom "Rate Us" dialog** | Violates App Store guidelines, may lead to rejection | Use native StoreKit / Play In-App Review API only |
| **Requesting review on first launch** | User has no experience with app — leaves 1-star or dismisses | Request after user completes meaningful action |
| **No keyword research** | App doesn't appear in relevant searches | Research keywords with App Annie, Sensor Tower, or ASO tools |
| **Generic screenshots** | Low conversion from store listing to install | Feature-focused screenshots with benefit captions |
| **No localization** | Missing 80% of global market | Localize listing for top 5-10 markets minimum |
| **Ignoring negative reviews** | Rating drops, potential users see unaddressed complaints | Respond to ALL negative reviews with resolution plan |
| **Infrequent updates** | Signals abandonment, lower store ranking | Update biweekly-monthly with meaningful improvements |
| **App size >150MB** | Requires WiFi to download on iOS, lower install rate | Optimize assets, use app thinning, on-demand resources |

---

## 6. Enforcement Checklist

### Store Listing
- [ ] Title includes primary keyword (30 chars max)
- [ ] Subtitle/short description optimized
- [ ] Long description with features and keywords
- [ ] 6+ screenshots with benefit-focused captions
- [ ] App preview video (if applicable)
- [ ] Listing localized for target markets
- [ ] Privacy policy URL added

### Reviews & Ratings
- [ ] Native in-app review API integrated
- [ ] Review prompt triggered at appropriate moments
- [ ] All negative reviews responded to
- [ ] Rating monitored weekly (target: 4.5+)

### Technical
- [ ] App size <100MB
- [ ] Crash-free rate >99.5%
- [ ] Startup time <2 seconds
- [ ] Target SDK meets latest store requirements
- [ ] Privacy manifest / data safety section completed
