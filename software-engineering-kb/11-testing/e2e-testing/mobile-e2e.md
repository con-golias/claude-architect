# Mobile E2E Testing

| Attribute      | Value                                      |
|----------------|--------------------------------------------|
| Domain         | Testing > E2E Testing                      |
| Importance     | High                                       |
| Last Updated   | 2026-03-10                                 |
| Cross-ref      | [E2E Overview](overview.md), [Playwright](playwright.md), [Visual Regression](visual-regression.md) |

---

## Core Concepts

### Mobile Testing Landscape

Mobile E2E testing spans four distinct application types, each with different tooling requirements:

| App Type       | Technology                        | Primary Test Tools                  |
|----------------|-----------------------------------|-------------------------------------|
| Native iOS     | Swift / Objective-C               | XCUITest, Appium, Maestro          |
| Native Android | Kotlin / Java                     | Espresso, UI Automator, Appium, Maestro |
| React Native   | TypeScript / JavaScript           | Detox, Appium, Maestro             |
| Flutter        | Dart                              | Flutter integration_test, Appium, Maestro |

Choose tools based on the technology stack, team expertise, and the scope of cross-platform coverage required.

### Tool Comparison

| Tool        | Language    | Speed     | Cross-Platform | Real Device | Flakiness | Setup Complexity |
|-------------|-------------|-----------|----------------|-------------|-----------|------------------|
| Detox       | TypeScript  | Fast      | iOS + Android  | Limited     | Low       | Medium           |
| Maestro     | YAML        | Fast      | iOS + Android  | Yes         | Low       | Low              |
| Appium      | Any         | Slow      | iOS + Android  | Yes         | Medium    | High             |
| XCUITest    | Swift       | Fast      | iOS only       | Yes         | Low       | Low (Xcode)      |
| Espresso    | Kotlin/Java | Fast      | Android only   | Yes         | Low       | Low (AS)         |

---

## Code Examples

### Detox Test for React Native (TypeScript)

```typescript
// e2e/login.test.ts
import { device, element, by, expect } from 'detox';

describe('Login Flow', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should display login screen on launch', async () => {
    await expect(element(by.id('login-screen'))).toBeVisible();
    await expect(element(by.id('login-email-input'))).toBeVisible();
    await expect(element(by.id('login-password-input'))).toBeVisible();
  });

  it('should login successfully with valid credentials', async () => {
    await element(by.id('login-email-input')).typeText('user@example.com');
    await element(by.id('login-password-input')).typeText('secureP@ss1');
    await element(by.id('login-submit-button')).tap();

    await waitFor(element(by.id('home-screen')))
      .toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('welcome-message'))).toHaveText(
      'Welcome back, User',
    );
  });

  it('should show error on invalid credentials', async () => {
    await element(by.id('login-email-input')).typeText('user@example.com');
    await element(by.id('login-password-input')).typeText('wrong');
    await element(by.id('login-submit-button')).tap();

    await waitFor(element(by.id('login-error-message')))
      .toBeVisible()
      .withTimeout(3000);

    await expect(element(by.id('login-error-message'))).toHaveText(
      'Invalid email or password',
    );
  });
});
```

### Detox: Navigation and Gestures

```typescript
// e2e/navigation.test.ts
import { device, element, by, expect } from 'detox';

describe('Navigation and Gestures', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    // Programmatic login via device launch args
    await device.launchApp({
      launchArgs: { mockAuth: 'true', userId: 'test-user-1' },
    });
  });

  it('should navigate between tabs', async () => {
    await element(by.id('tab-home')).tap();
    await expect(element(by.id('home-screen'))).toBeVisible();

    await element(by.id('tab-profile')).tap();
    await expect(element(by.id('profile-screen'))).toBeVisible();

    await element(by.id('tab-settings')).tap();
    await expect(element(by.id('settings-screen'))).toBeVisible();
  });

  it('should pull to refresh the feed', async () => {
    await element(by.id('tab-home')).tap();
    await element(by.id('feed-list')).swipe('down', 'slow', 0.5);

    await waitFor(element(by.id('feed-item-latest')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should swipe to delete an item', async () => {
    await element(by.id('feed-item-0')).swipe('left', 'fast', 0.7);
    await element(by.id('delete-action')).tap();

    await expect(element(by.id('feed-item-0'))).not.toHaveText(
      'Deleted Item Title',
    );
  });

  it('should scroll to bottom of long list', async () => {
    await waitFor(element(by.id('list-end-marker')))
      .toBeVisible()
      .whileElement(by.id('feed-list'))
      .scroll(200, 'down');
  });
});
```

### Detox Configuration

```javascript
// .detoxrc.js
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/MyApp.app',
      build:
        'xcodebuild -workspace ios/MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [8081],
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 15 Pro' },
    },
    emulator: {
      type: 'android.emulator',
      device: { avdName: 'Pixel_7_API_34' },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
  },
};
```

### Maestro Flow Definition (YAML)

```yaml
# flows/login.yaml
appId: com.example.myapp
---
- launchApp

- assertVisible: "Welcome"

- tapOn:
    id: "login-email-input"
- inputText: "user@example.com"

- tapOn:
    id: "login-password-input"
- inputText: "secureP@ss1"

- tapOn:
    id: "login-submit-button"

- assertVisible:
    id: "home-screen"
    timeout: 5000

- assertVisible: "Welcome back, User"
```

```yaml
# flows/checkout.yaml
appId: com.example.myapp
---
- launchApp

- runFlow: flows/login.yaml

- tapOn:
    id: "tab-shop"

- tapOn:
    id: "product-card-0"

- tapOn:
    id: "add-to-cart-button"

- assertVisible: "Added to cart"

- tapOn:
    id: "cart-icon"

- assertVisible:
    id: "cart-item-0"

- tapOn:
    id: "checkout-button"

- tapOn:
    id: "place-order"

- assertVisible:
    id: "order-confirmation"
    timeout: 10000
```

```bash
# Run Maestro flows
maestro test flows/login.yaml
maestro test flows/           # Run all flows in directory
maestro test --platform ios flows/checkout.yaml
maestro cloud --app-file app.apk flows/  # Run on Maestro Cloud
```

### Device Farms

| Service             | Real Devices | Emulators | Parallel | CI Integration       |
|---------------------|--------------|-----------|----------|----------------------|
| BrowserStack        | Yes          | Yes       | Yes      | GitHub Actions, Jenkins |
| AWS Device Farm     | Yes          | No        | Yes      | CodePipeline, CLI    |
| Firebase Test Lab   | Yes          | Yes       | Yes      | gcloud CLI, GitHub   |
| Sauce Labs          | Yes          | Yes       | Yes      | Most CI platforms    |

```yaml
# .github/workflows/mobile-e2e.yml — Firebase Test Lab integration
name: Mobile E2E
on:
  pull_request:
    paths:
      - 'src/**'
      - 'android/**'
      - 'ios/**'

jobs:
  android-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 17

      - name: Build debug APK and test APK
        run: |
          cd android
          ./gradlew assembleDebug assembleAndroidTest

      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - uses: google-github-actions/setup-gcloud@v2

      - name: Run on Firebase Test Lab
        run: |
          gcloud firebase test android run \
            --type instrumentation \
            --app android/app/build/outputs/apk/debug/app-debug.apk \
            --test android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk \
            --device model=Pixel7,version=34,locale=en,orientation=portrait \
            --timeout 10m \
            --results-bucket=${{ vars.FIREBASE_RESULTS_BUCKET }}
```

---

## Emulator vs Real Device Testing

| Dimension          | Emulator / Simulator            | Real Device                          |
|--------------------|---------------------------------|--------------------------------------|
| Speed              | Fast boot, instant snapshot restore | Slower setup, physical constraints  |
| Cost               | Free (local) or low (CI)       | Device farm fees per minute          |
| Accuracy           | Good for logic, layout          | Exact hardware behavior, GPS, sensors |
| Flakiness          | Low (deterministic environment) | Higher (battery, network, OS updates)|
| CI integration     | Simple (AVD, iOS Simulator)     | Requires device farm or lab          |
| Hardware features   | Limited (no real camera, NFC)   | Full hardware access                 |

**Recommendation**: Run the majority of tests on emulators in CI. Reserve real device testing for:

- Final pre-release validation.
- Performance and battery profiling.
- Hardware-specific features (camera, NFC, biometrics).
- OS fragmentation testing across manufacturer skins.

---

## Platform-Specific Challenges

### iOS

- **Signing and provisioning**: Tests on real devices require valid provisioning profiles. Automate with `fastlane match`.
- **Simulator management**: Use `xcrun simctl` to create, boot, and reset simulators in CI.
- **Permission dialogs**: Pre-grant permissions via `xcrun simctl privacy` or Detox `launchArgs`.
- **App Store review**: E2E test artifacts (screenshots) can feed App Store Connect submission.

### Android

- **Fragmentation**: Test on at least 3 API levels (latest, latest-2, latest-4) and 2 manufacturer skins.
- **Emulator cold boot**: Use AVD snapshots (`-no-snapshot-save` with `-snapshot`) to reduce boot time.
- **Permission handling**: Grant permissions at install time with `adb shell pm grant` or via test orchestrator.
- **ProGuard / R8**: Ensure test builds disable obfuscation or test IDs are preserved in minified builds.

---

## CI Pipeline: Build, Deploy, Test

```text
+----------+     +------------+     +-------------+     +----------+
|  Build   | --> |  Deploy to | --> |  Run E2E    | --> |  Report  |
|  App     |     |  Device /  |     |  Tests      |     |  Results |
|  (APK /  |     |  Emulator  |     |  (Detox /   |     |  Upload  |
|   IPA)   |     |            |     |   Maestro)  |     |  Artifacts|
+----------+     +------------+     +-------------+     +----------+
```

Establish a clear pipeline:

1. **Build**: Compile debug/test builds. Cache Gradle/CocoaPods dependencies.
2. **Deploy**: Boot emulator or connect to device farm. Install the app binary.
3. **Test**: Execute the E2E suite. Capture logs, screenshots, and video on failure.
4. **Report**: Upload test results as CI artifacts. Post summary to the pull request.

---

## 10 Best Practices

1. **Use test IDs (`testID` / `accessibilityLabel`) on all interactive elements.** Never select by text content that changes with localization.
2. **Prefer emulators in CI for speed; real devices for pre-release.** Run 90% of tests on simulators; reserve device farms for the final validation pass.
3. **Isolate test data per run.** Seed mock data via launch arguments, environment variables, or a test-specific API endpoint.
4. **Handle permission dialogs programmatically.** Pre-grant camera, location, and notification permissions in test configuration — never rely on tapping system dialogs.
5. **Keep flows short and focused.** Each test should cover one user journey. Long chains of actions amplify flakiness.
6. **Use Maestro for smoke tests, Detox for comprehensive suites.** Maestro's YAML syntax is fast for onboarding and basic coverage; Detox offers full programmatic control.
7. **Cache build artifacts in CI.** Android Gradle builds and iOS derived data are expensive. Cache aggressively to cut pipeline time.
8. **Test on multiple API levels / OS versions.** Cover at minimum: latest, latest-2, and one older long-support version.
9. **Record video on failure.** Mobile test failures are notoriously hard to reproduce. Video artifacts make debugging tractable.
10. **Gate releases on green mobile E2E.** Integrate the mobile E2E suite into the release branch pipeline. Block builds that fail critical flows.

---

## Anti-Patterns

| Anti-Pattern | Impact | Fix |
|---|---|---|
| Selecting elements by visible text | Tests break on every i18n or copy change | Use `testID` (React Native) or `accessibilityIdentifier` (iOS) consistently |
| Running all tests on real devices only | Slow feedback (30+ min), expensive device farm bills | Run majority on emulators; reserve real devices for pre-release and hardware tests |
| Not handling permission dialogs | Tests hang or fail on first install, blocking CI | Pre-grant permissions via `adb`, `xcrun simctl`, or Detox `permissions` config |
| Building the app inside the test job | 10–20 min added per test run; no caching benefit | Separate build and test jobs; pass artifacts between them |
| Testing on a single OS version | Regressions on older API levels or manufacturer skins ship undetected | Test on at least 3 Android API levels and 2 iOS versions |
| No test data isolation | Tests depend on server state; parallel runs interfere with each other | Seed mock data per test via launch args or a dedicated test API |
| Ignoring flaky mobile tests | Team loses trust; CI failures are dismissed without investigation | Quarantine flaky tests, investigate root cause, fix within one sprint |
| Not recording video on failure | Failures require manual reproduction; debugging takes hours | Enable video capture on failure in Detox config or device farm settings |

---

## Enforcement Checklist

- [ ] All interactive elements have `testID` (React Native), `accessibilityIdentifier` (iOS), or `contentDescription` (Android)
- [ ] Detox or Maestro is configured for both iOS simulator and Android emulator
- [ ] CI builds the app binary in a separate, cached job
- [ ] Permission dialogs are handled programmatically — no manual tap on system prompts
- [ ] Tests run on at least 3 Android API levels and 2 iOS versions
- [ ] Emulators are used for CI; real device farm runs are reserved for pre-release
- [ ] Video and screenshot artifacts are captured and uploaded on test failure
- [ ] Test data is isolated per run; no shared server state between parallel tests
- [ ] Mobile E2E suite gates the release pipeline — failures block deployment
- [ ] Flaky tests are quarantined, tracked, and resolved within one sprint
- [ ] Maestro flows exist for critical smoke tests (login, checkout, onboarding)
- [ ] Build cache (Gradle, CocoaPods, derived data) is configured in CI to reduce pipeline time
