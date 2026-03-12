# Kotlin Multiplatform (KMP) Project Structure

> **AI Plugin Directive:** When generating a Kotlin Multiplatform project, ALWAYS use this structure. Apply shared/platform separation with `expect`/`actual` declarations. This guide covers KMP with Compose Multiplatform for UI, Koin for DI, Ktor for networking, and SQLDelight for database across Android, iOS, Desktop, and Web targets. ALWAYS maximize code in `commonMain`. The shared module is the single source of truth for business logic. Platform source sets contain ONLY platform API wrappers.

**Core Rule: Maximize shared code in `commonMain`. Platform-specific code uses `expect`/`actual` declarations. NEVER duplicate business logic across platform source sets. The shared module IS the single source of truth. Use Koin for DI, Ktor for networking, SQLDelight for persistence, and Compose Multiplatform for shared UI.**

---

## 1. KMM vs KMP Naming

```
HISTORICAL NAMING:
KMM (Kotlin Multiplatform Mobile) — deprecated name, was Android + iOS only
KMP (Kotlin Multiplatform)        — current name, covers ALL targets

TARGETS SUPPORTED BY KMP:
├── JVM (Android, Desktop, Server)
├── Native (iOS, macOS, watchOS, tvOS, Linux, Windows)
├── JS (Browser, Node.js)
└── Wasm (WebAssembly, experimental)

ALWAYS use "KMP" in new projects. "KMM" is legacy terminology.
```

---

## 2. Enterprise Project Structure (60+ files)

```
my-kmp-app/
├── shared/                                    # Shared Kotlin module (ALL platforms)
│   ├── src/
│   │   ├── commonMain/                        # Shared code — MAXIMIZE THIS
│   │   │   └── kotlin/com/example/shared/
│   │   │       ├── features/
│   │   │       │   ├── auth/
│   │   │       │   │   ├── data/
│   │   │       │   │   │   ├── repository/
│   │   │       │   │   │   │   └── AuthRepositoryImpl.kt
│   │   │       │   │   │   ├── remote/
│   │   │       │   │   │   │   ├── AuthApi.kt            # Ktor API calls
│   │   │       │   │   │   │   └── dto/
│   │   │       │   │   │   │       ├── LoginRequestDto.kt
│   │   │       │   │   │   │       ├── LoginResponseDto.kt
│   │   │       │   │   │   │       └── RegisterRequestDto.kt
│   │   │       │   │   │   └── local/
│   │   │       │   │   │       └── TokenStorage.kt        # Interface
│   │   │       │   │   ├── domain/
│   │   │       │   │   │   ├── model/
│   │   │       │   │   │   │   ├── User.kt               # Domain entity
│   │   │       │   │   │   │   └── AuthToken.kt
│   │   │       │   │   │   ├── repository/
│   │   │       │   │   │   │   └── AuthRepository.kt     # Interface
│   │   │       │   │   │   └── usecase/
│   │   │       │   │   │       ├── LoginUseCase.kt
│   │   │       │   │   │       ├── RegisterUseCase.kt
│   │   │       │   │   │       └── LogoutUseCase.kt
│   │   │       │   │   └── presentation/
│   │   │       │   │       └── AuthViewModel.kt           # Shared ViewModel
│   │   │       │   │
│   │   │       │   ├── users/
│   │   │       │   │   ├── data/
│   │   │       │   │   │   ├── repository/
│   │   │       │   │   │   │   └── UserRepositoryImpl.kt
│   │   │       │   │   │   ├── remote/
│   │   │       │   │   │   │   ├── UserApi.kt
│   │   │       │   │   │   │   └── dto/
│   │   │       │   │   │   │       ├── UserDto.kt
│   │   │       │   │   │   │       └── UserListResponseDto.kt
│   │   │       │   │   │   └── local/
│   │   │       │   │   │       ├── UserDao.kt             # SQLDelight DAO
│   │   │       │   │   │       └── UserEntity.sq           # SQLDelight queries
│   │   │       │   │   ├── domain/
│   │   │       │   │   │   ├── model/
│   │   │       │   │   │   │   └── User.kt
│   │   │       │   │   │   ├── repository/
│   │   │       │   │   │   │   └── UserRepository.kt
│   │   │       │   │   │   └── usecase/
│   │   │       │   │   │       ├── GetUsersUseCase.kt
│   │   │       │   │   │       ├── GetUserDetailUseCase.kt
│   │   │       │   │   │       └── DeleteUserUseCase.kt
│   │   │       │   │   └── presentation/
│   │   │       │   │       └── UserListViewModel.kt
│   │   │       │   │
│   │   │       │   └── settings/
│   │   │       │       ├── data/
│   │   │       │       │   └── repository/
│   │   │       │       │       └── SettingsRepositoryImpl.kt
│   │   │       │       ├── domain/
│   │   │       │       │   ├── model/
│   │   │       │       │   │   └── AppSettings.kt
│   │   │       │       │   └── repository/
│   │   │       │       │       └── SettingsRepository.kt
│   │   │       │       └── presentation/
│   │   │       │           └── SettingsViewModel.kt
│   │   │       │
│   │   │       ├── core/
│   │   │       │   ├── network/
│   │   │       │   │   ├── HttpClientFactory.kt           # expect/actual
│   │   │       │   │   ├── ApiClient.kt                   # Ktor HttpClient wrapper
│   │   │       │   │   ├── NetworkError.kt                # Sealed class for errors
│   │   │       │   │   ├── ApiResponse.kt                 # Result wrapper
│   │   │       │   │   └── interceptors/
│   │   │       │   │       ├── AuthInterceptor.kt
│   │   │       │   │       └── LoggingInterceptor.kt
│   │   │       │   ├── database/
│   │   │       │   │   ├── DatabaseDriverFactory.kt       # expect/actual
│   │   │       │   │   ├── AppDatabase.kt                 # SQLDelight schema
│   │   │       │   │   └── migrations/
│   │   │       │   │       └── 1.sqm                      # Migration file
│   │   │       │   ├── storage/
│   │   │       │   │   └── KeyValueStorage.kt             # expect/actual interface
│   │   │       │   ├── di/
│   │   │       │   │   ├── SharedModule.kt                # Koin module
│   │   │       │   │   ├── NetworkModule.kt
│   │   │       │   │   ├── DatabaseModule.kt
│   │   │       │   │   └── FeatureModules.kt
│   │   │       │   └── util/
│   │   │       │       ├── CoroutineDispatchers.kt        # expect/actual
│   │   │       │       ├── DateTimeUtil.kt                # kotlinx-datetime
│   │   │       │       ├── UuidGenerator.kt               # expect/actual
│   │   │       │       └── Logger.kt                      # expect/actual
│   │   │       │
│   │   │       └── Platform.kt                             # expect declaration
│   │   │
│   │   ├── androidMain/                       # Android-specific implementations
│   │   │   └── kotlin/com/example/shared/
│   │   │       ├── core/
│   │   │       │   ├── network/
│   │   │       │   │   └── HttpClientFactory.android.kt   # OkHttp engine
│   │   │       │   ├── database/
│   │   │       │   │   └── DatabaseDriverFactory.android.kt # AndroidSqliteDriver
│   │   │       │   ├── storage/
│   │   │       │   │   └── KeyValueStorage.android.kt     # SharedPreferences
│   │   │       │   └── util/
│   │   │       │       ├── CoroutineDispatchers.android.kt
│   │   │       │       ├── UuidGenerator.android.kt
│   │   │       │       └── Logger.android.kt              # android.util.Log
│   │   │       └── Platform.android.kt
│   │   │
│   │   ├── iosMain/                           # iOS-specific implementations
│   │   │   └── kotlin/com/example/shared/
│   │   │       ├── core/
│   │   │       │   ├── network/
│   │   │       │   │   └── HttpClientFactory.ios.kt       # Darwin engine
│   │   │       │   ├── database/
│   │   │       │   │   └── DatabaseDriverFactory.ios.kt   # NativeSqliteDriver
│   │   │       │   ├── storage/
│   │   │       │   │   └── KeyValueStorage.ios.kt         # NSUserDefaults
│   │   │       │   └── util/
│   │   │       │       ├── CoroutineDispatchers.ios.kt
│   │   │       │       ├── UuidGenerator.ios.kt           # NSUUID
│   │   │       │       └── Logger.ios.kt                  # NSLog
│   │   │       └── Platform.ios.kt
│   │   │
│   │   ├── desktopMain/                       # JVM Desktop implementations
│   │   │   └── kotlin/com/example/shared/
│   │   │       ├── core/
│   │   │       │   ├── network/
│   │   │       │   │   └── HttpClientFactory.desktop.kt   # CIO / Java engine
│   │   │       │   ├── database/
│   │   │       │   │   └── DatabaseDriverFactory.desktop.kt # JdbcSqliteDriver
│   │   │       │   ├── storage/
│   │   │       │   │   └── KeyValueStorage.desktop.kt     # java.util.prefs
│   │   │       │   └── util/
│   │   │       │       └── Logger.desktop.kt              # SLF4J
│   │   │       └── Platform.desktop.kt
│   │   │
│   │   ├── commonTest/                        # Shared tests
│   │   │   └── kotlin/com/example/shared/
│   │   │       ├── features/
│   │   │       │   ├── auth/
│   │   │       │   │   ├── domain/
│   │   │       │   │   │   └── usecase/
│   │   │       │   │   │       └── LoginUseCaseTest.kt
│   │   │       │   │   └── data/
│   │   │       │   │       └── repository/
│   │   │       │   │           └── AuthRepositoryImplTest.kt
│   │   │       │   └── users/
│   │   │       │       └── domain/
│   │   │       │           └── usecase/
│   │   │       │               └── GetUsersUseCaseTest.kt
│   │   │       └── core/
│   │   │           └── network/
│   │   │               └── ApiClientTest.kt
│   │   │
│   │   ├── androidUnitTest/                   # Android-specific tests
│   │   │   └── kotlin/com/example/shared/
│   │   │       └── core/
│   │   │           └── storage/
│   │   │               └── KeyValueStorageAndroidTest.kt
│   │   │
│   │   └── iosTest/                           # iOS-specific tests
│   │       └── kotlin/com/example/shared/
│   │           └── core/
│   │               └── storage/
│   │                   └── KeyValueStorageIosTest.kt
│   │
│   └── build.gradle.kts                       # KMP shared module config
│
├── composeApp/                                # Compose Multiplatform UI
│   ├── src/
│   │   ├── commonMain/
│   │   │   └── kotlin/com/example/app/
│   │   │       ├── App.kt                     # Root composable
│   │   │       ├── navigation/
│   │   │       │   ├── AppNavigation.kt       # NavHost / Voyager
│   │   │       │   ├── Screen.kt             # Sealed class for screens
│   │   │       │   └── NavGraph.kt
│   │   │       ├── theme/
│   │   │       │   ├── Theme.kt               # MaterialTheme wrapper
│   │   │       │   ├── Color.kt               # Color scheme
│   │   │       │   ├── Type.kt                # Typography
│   │   │       │   └── Shape.kt               # Shape scheme
│   │   │       ├── features/
│   │   │       │   ├── auth/
│   │   │       │   │   ├── LoginScreen.kt
│   │   │       │   │   ├── RegisterScreen.kt
│   │   │       │   │   └── components/
│   │   │       │   │       ├── LoginForm.kt
│   │   │       │   │       └── SocialLoginButtons.kt
│   │   │       │   ├── users/
│   │   │       │   │   ├── UserListScreen.kt
│   │   │       │   │   ├── UserDetailScreen.kt
│   │   │       │   │   └── components/
│   │   │       │   │       ├── UserCard.kt
│   │   │       │   │       └── UserAvatar.kt
│   │   │       │   └── settings/
│   │   │       │       ├── SettingsScreen.kt
│   │   │       │       └── components/
│   │   │       │           └── SettingsToggle.kt
│   │   │       └── components/                # Shared UI components
│   │   │           ├── AppButton.kt
│   │   │           ├── AppTextField.kt
│   │   │           ├── LoadingIndicator.kt
│   │   │           ├── ErrorView.kt
│   │   │           └── EmptyState.kt
│   │   │
│   │   ├── androidMain/
│   │   │   ├── kotlin/com/example/app/
│   │   │   │   └── MainActivity.kt            # Android entry point
│   │   │   └── AndroidManifest.xml
│   │   │
│   │   ├── iosMain/
│   │   │   └── kotlin/com/example/app/
│   │   │       └── MainViewController.kt      # iOS entry point
│   │   │
│   │   └── desktopMain/
│   │       └── kotlin/com/example/app/
│   │           └── Main.kt                    # Desktop entry point (JVM)
│   │
│   └── build.gradle.kts
│
├── iosApp/                                    # iOS native wrapper (Xcode project)
│   ├── iosApp/
│   │   ├── iOSApp.swift                       # SwiftUI App entry
│   │   ├── ContentView.swift                  # Hosts ComposeView
│   │   ├── Info.plist
│   │   └── Assets.xcassets/
│   ├── iosApp.xcodeproj/
│   │   └── project.pbxproj
│   └── Podfile                                # CocoaPods (if using)
│
├── gradle/
│   ├── libs.versions.toml                     # Version catalog
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
│
├── build.gradle.kts                           # Root build file
├── settings.gradle.kts                        # Module declarations
├── gradle.properties                          # Gradle + Kotlin config
├── .gitignore
└── README.md
```

---

## 3. Gradle Configuration

### 3.1 Root build.gradle.kts

```kotlin
// build.gradle.kts (root)
plugins {
    alias(libs.plugins.androidApplication) apply false
    alias(libs.plugins.androidLibrary) apply false
    alias(libs.plugins.kotlinMultiplatform) apply false
    alias(libs.plugins.composeMultiplatform) apply false
    alias(libs.plugins.composeCompiler) apply false
    alias(libs.plugins.sqldelight) apply false
}
```

### 3.2 settings.gradle.kts

```kotlin
// settings.gradle.kts
pluginManagement {
    repositories {
        google()
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "my-kmp-app"

include(":shared")
include(":composeApp")
```

### 3.3 Shared Module build.gradle.kts

```kotlin
// shared/build.gradle.kts
plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.androidLibrary)
    alias(libs.plugins.sqldelight)
    kotlin("plugin.serialization")
}

kotlin {
    // Target declarations
    androidTarget {
        compilations.all {
            kotlinOptions {
                jvmTarget = "17"
            }
        }
    }

    // iOS targets
    listOf(
        iosX64(),
        iosArm64(),
        iosSimulatorArm64()
    ).forEach { iosTarget ->
        iosTarget.binaries.framework {
            baseName = "Shared"
            isStatic = true
        }
    }

    // Desktop target
    jvm("desktop")

    // Source sets
    sourceSets {
        val commonMain by getting {
            dependencies {
                // Networking
                implementation(libs.ktor.client.core)
                implementation(libs.ktor.client.content.negotiation)
                implementation(libs.ktor.serialization.kotlinx.json)

                // Serialization
                implementation(libs.kotlinx.serialization.json)

                // Coroutines
                implementation(libs.kotlinx.coroutines.core)

                // DateTime
                implementation(libs.kotlinx.datetime)

                // DI
                implementation(libs.koin.core)

                // Database
                implementation(libs.sqldelight.runtime)
                implementation(libs.sqldelight.coroutines)
            }
        }

        val commonTest by getting {
            dependencies {
                implementation(kotlin("test"))
                implementation(libs.kotlinx.coroutines.test)
                implementation(libs.koin.test)
                implementation(libs.ktor.client.mock)
            }
        }

        val androidMain by getting {
            dependencies {
                implementation(libs.ktor.client.okhttp)
                implementation(libs.sqldelight.android.driver)
                implementation(libs.koin.android)
            }
        }

        val iosX64Main by getting
        val iosArm64Main by getting
        val iosSimulatorArm64Main by getting
        val iosMain by creating {
            dependsOn(commonMain)
            iosX64Main.dependsOn(this)
            iosArm64Main.dependsOn(this)
            iosSimulatorArm64Main.dependsOn(this)
            dependencies {
                implementation(libs.ktor.client.darwin)
                implementation(libs.sqldelight.native.driver)
            }
        }

        val desktopMain by getting {
            dependencies {
                implementation(libs.ktor.client.cio)
                implementation(libs.sqldelight.jvm.driver)
            }
        }
    }
}

android {
    namespace = "com.example.shared"
    compileSdk = 34
    defaultConfig {
        minSdk = 24
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

sqldelight {
    databases {
        create("AppDatabase") {
            packageName.set("com.example.shared.db")
            schemaOutputDirectory.set(file("src/commonMain/sqldelight/databases"))
            verifyMigrations.set(true)
        }
    }
}
```

### 3.4 Version Catalog (libs.versions.toml)

```toml
# gradle/libs.versions.toml
[versions]
kotlin = "2.0.21"
agp = "8.5.2"
compose-multiplatform = "1.7.1"
ktor = "3.0.1"
sqldelight = "2.0.2"
koin = "4.0.0"
coroutines = "1.9.0"
serialization = "1.7.3"
datetime = "0.6.1"

[libraries]
# Ktor
ktor-client-core = { module = "io.ktor:ktor-client-core", version.ref = "ktor" }
ktor-client-okhttp = { module = "io.ktor:ktor-client-okhttp", version.ref = "ktor" }
ktor-client-darwin = { module = "io.ktor:ktor-client-darwin", version.ref = "ktor" }
ktor-client-cio = { module = "io.ktor:ktor-client-cio", version.ref = "ktor" }
ktor-client-content-negotiation = { module = "io.ktor:ktor-client-content-negotiation", version.ref = "ktor" }
ktor-serialization-kotlinx-json = { module = "io.ktor:ktor-serialization-kotlinx-json", version.ref = "ktor" }
ktor-client-mock = { module = "io.ktor:ktor-client-mock", version.ref = "ktor" }

# Kotlinx
kotlinx-coroutines-core = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-core", version.ref = "coroutines" }
kotlinx-coroutines-test = { module = "org.jetbrains.kotlinx:kotlinx-coroutines-test", version.ref = "coroutines" }
kotlinx-serialization-json = { module = "org.jetbrains.kotlinx:kotlinx-serialization-json", version.ref = "serialization" }
kotlinx-datetime = { module = "org.jetbrains.kotlinx:kotlinx-datetime", version.ref = "datetime" }

# SQLDelight
sqldelight-runtime = { module = "app.cash.sqldelight:runtime", version.ref = "sqldelight" }
sqldelight-coroutines = { module = "app.cash.sqldelight:coroutines-extensions", version.ref = "sqldelight" }
sqldelight-android-driver = { module = "app.cash.sqldelight:android-driver", version.ref = "sqldelight" }
sqldelight-native-driver = { module = "app.cash.sqldelight:native-driver", version.ref = "sqldelight" }
sqldelight-jvm-driver = { module = "app.cash.sqldelight:sqlite-driver", version.ref = "sqldelight" }

# Koin
koin-core = { module = "io.insert-koin:koin-core", version.ref = "koin" }
koin-android = { module = "io.insert-koin:koin-android", version.ref = "koin" }
koin-test = { module = "io.insert-koin:koin-test", version.ref = "koin" }
koin-compose = { module = "io.insert-koin:koin-compose", version.ref = "koin" }

[plugins]
kotlinMultiplatform = { id = "org.jetbrains.kotlin.multiplatform", version.ref = "kotlin" }
androidApplication = { id = "com.android.application", version.ref = "agp" }
androidLibrary = { id = "com.android.library", version.ref = "agp" }
composeMultiplatform = { id = "org.jetbrains.compose", version.ref = "compose-multiplatform" }
composeCompiler = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
sqldelight = { id = "app.cash.sqldelight", version.ref = "sqldelight" }
```

---

## 4. expect/actual Pattern (Complete Examples)

### 4.1 Platform Detection

```kotlin
// shared/src/commonMain/kotlin/com/example/shared/Platform.kt
expect class Platform() {
    val name: String
    val version: String
}

expect fun getPlatform(): Platform

// shared/src/androidMain/kotlin/com/example/shared/Platform.android.kt
actual class Platform actual constructor() {
    actual val name: String = "Android"
    actual val version: String = "${android.os.Build.VERSION.SDK_INT}"
}

actual fun getPlatform(): Platform = Platform()

// shared/src/iosMain/kotlin/com/example/shared/Platform.ios.kt
import platform.UIKit.UIDevice

actual class Platform actual constructor() {
    actual val name: String = UIDevice.currentDevice.systemName()
    actual val version: String = UIDevice.currentDevice.systemVersion
}

actual fun getPlatform(): Platform = Platform()

// shared/src/desktopMain/kotlin/com/example/shared/Platform.desktop.kt
actual class Platform actual constructor() {
    actual val name: String = "Desktop"
    actual val version: String = System.getProperty("os.version") ?: "unknown"
}

actual fun getPlatform(): Platform = Platform()
```

### 4.2 HTTP Client Factory

```kotlin
// commonMain
expect fun createHttpClientEngine(): io.ktor.client.engine.HttpClientEngine

// androidMain
import io.ktor.client.engine.okhttp.*

actual fun createHttpClientEngine(): io.ktor.client.engine.HttpClientEngine {
    return OkHttp.create {
        config {
            connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
        }
    }
}

// iosMain
import io.ktor.client.engine.darwin.*

actual fun createHttpClientEngine(): io.ktor.client.engine.HttpClientEngine {
    return Darwin.create {
        configureRequest {
            setAllowsCellularAccess(true)
        }
    }
}

// desktopMain
import io.ktor.client.engine.cio.*

actual fun createHttpClientEngine(): io.ktor.client.engine.HttpClientEngine {
    return CIO.create()
}
```

### 4.3 Database Driver Factory

```kotlin
// commonMain
expect class DatabaseDriverFactory {
    fun createDriver(): app.cash.sqldelight.db.SqlDriver
}

// androidMain
import android.content.Context
import app.cash.sqldelight.driver.android.AndroidSqliteDriver

actual class DatabaseDriverFactory(private val context: Context) {
    actual fun createDriver(): SqlDriver {
        return AndroidSqliteDriver(
            schema = AppDatabase.Schema,
            context = context,
            name = "app.db"
        )
    }
}

// iosMain
import app.cash.sqldelight.driver.native.NativeSqliteDriver

actual class DatabaseDriverFactory {
    actual fun createDriver(): SqlDriver {
        return NativeSqliteDriver(
            schema = AppDatabase.Schema,
            name = "app.db"
        )
    }
}

// desktopMain
import app.cash.sqldelight.driver.jdbc.sqlite.JdbcSqliteDriver

actual class DatabaseDriverFactory {
    actual fun createDriver(): SqlDriver {
        val driver = JdbcSqliteDriver(JdbcSqliteDriver.IN_MEMORY)
        AppDatabase.Schema.create(driver)
        return driver
    }
}
```

### 4.4 Key-Value Storage

```kotlin
// commonMain
expect class KeyValueStorage {
    fun getString(key: String): String?
    fun putString(key: String, value: String)
    fun remove(key: String)
    fun clear()
}

// androidMain
import android.content.Context
import android.content.SharedPreferences

actual class KeyValueStorage(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("app_prefs", Context.MODE_PRIVATE)

    actual fun getString(key: String): String? = prefs.getString(key, null)

    actual fun putString(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    actual fun remove(key: String) {
        prefs.edit().remove(key).apply()
    }

    actual fun clear() {
        prefs.edit().clear().apply()
    }
}

// iosMain
import platform.Foundation.NSUserDefaults

actual class KeyValueStorage {
    private val defaults = NSUserDefaults.standardUserDefaults

    actual fun getString(key: String): String? =
        defaults.stringForKey(key)

    actual fun putString(key: String, value: String) {
        defaults.setObject(value, forKey = key)
    }

    actual fun remove(key: String) {
        defaults.removeObjectForKey(key)
    }

    actual fun clear() {
        val dictionary = defaults.dictionaryRepresentation()
        dictionary.keys.forEach { key ->
            defaults.removeObjectForKey(key as String)
        }
    }
}
```

### 4.5 Coroutine Dispatchers

```kotlin
// commonMain
import kotlinx.coroutines.CoroutineDispatcher

expect val ioDispatcher: CoroutineDispatcher
expect val mainDispatcher: CoroutineDispatcher
expect val defaultDispatcher: CoroutineDispatcher

// androidMain
import kotlinx.coroutines.Dispatchers

actual val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
actual val mainDispatcher: CoroutineDispatcher = Dispatchers.Main
actual val defaultDispatcher: CoroutineDispatcher = Dispatchers.Default

// iosMain
import kotlinx.coroutines.Dispatchers

actual val ioDispatcher: CoroutineDispatcher = Dispatchers.Default
actual val mainDispatcher: CoroutineDispatcher = Dispatchers.Main
actual val defaultDispatcher: CoroutineDispatcher = Dispatchers.Default

// desktopMain
import kotlinx.coroutines.Dispatchers

actual val ioDispatcher: CoroutineDispatcher = Dispatchers.IO
actual val mainDispatcher: CoroutineDispatcher = Dispatchers.Main
actual val defaultDispatcher: CoroutineDispatcher = Dispatchers.Default
```

---

## 5. Ktor Networking (Shared API Client)

```kotlin
// shared/src/commonMain/kotlin/com/example/shared/core/network/ApiClient.kt
import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.plugins.auth.*
import io.ktor.client.plugins.auth.providers.*
import io.ktor.client.plugins.logging.*
import io.ktor.client.request.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.Json

class ApiClient(
    engine: io.ktor.client.engine.HttpClientEngine,
    private val tokenProvider: suspend () -> String?
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        prettyPrint = false
        encodeDefaults = true
    }

    val httpClient = HttpClient(engine) {
        install(ContentNegotiation) {
            json(json)
        }

        install(Logging) {
            logger = Logger.DEFAULT
            level = LogLevel.BODY
        }

        install(Auth) {
            bearer {
                loadTokens {
                    val token = tokenProvider()
                    token?.let { BearerTokens(it, "") }
                }
            }
        }

        expectSuccess = true
    }

    suspend inline fun <reified T> get(
        url: String,
        params: Map<String, String> = emptyMap()
    ): T {
        return httpClient.get(url) {
            params.forEach { (key, value) ->
                parameter(key, value)
            }
        }.body()
    }

    suspend inline fun <reified T, reified R> post(
        url: String,
        body: T
    ): R {
        return httpClient.post(url) {
            setBody(body)
        }.body()
    }

    suspend inline fun <reified T, reified R> put(
        url: String,
        body: T
    ): R {
        return httpClient.put(url) {
            setBody(body)
        }.body()
    }

    suspend fun delete(url: String) {
        httpClient.delete(url)
    }
}
```

---

## 6. SQLDelight Database (Shared Persistence)

```sql
-- shared/src/commonMain/sqldelight/com/example/shared/db/UserEntity.sq

CREATE TABLE UserEntity (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

selectAll:
SELECT * FROM UserEntity
ORDER BY name ASC;

selectById:
SELECT * FROM UserEntity
WHERE id = ?;

insert:
INSERT OR REPLACE INTO UserEntity(id, name, email, avatar_url, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?);

deleteById:
DELETE FROM UserEntity
WHERE id = ?;

deleteAll:
DELETE FROM UserEntity;

searchByName:
SELECT * FROM UserEntity
WHERE name LIKE '%' || ? || '%'
ORDER BY name ASC;
```

```kotlin
// shared/src/commonMain/kotlin/com/example/shared/features/users/data/local/UserDao.kt
import com.example.shared.db.AppDatabase
import com.example.shared.db.UserEntity
import app.cash.sqldelight.coroutines.asFlow
import app.cash.sqldelight.coroutines.mapToList
import kotlinx.coroutines.flow.Flow

class UserDao(private val database: AppDatabase) {
    private val queries = database.userEntityQueries

    fun observeAll(): Flow<List<UserEntity>> =
        queries.selectAll().asFlow().mapToList(defaultDispatcher)

    suspend fun getById(id: String): UserEntity? =
        queries.selectById(id).executeAsOneOrNull()

    suspend fun insert(user: UserEntity) {
        queries.insert(
            id = user.id,
            name = user.name,
            email = user.email,
            avatar_url = user.avatar_url,
            created_at = user.created_at,
            updated_at = user.updated_at
        )
    }

    suspend fun deleteById(id: String) = queries.deleteById(id)

    suspend fun deleteAll() = queries.deleteAll()
}
```

---

## 7. Koin Dependency Injection (Shared DI)

```kotlin
// shared/src/commonMain/kotlin/com/example/shared/core/di/SharedModule.kt
import org.koin.core.module.Module
import org.koin.dsl.module

val networkModule = module {
    single { createHttpClientEngine() }
    single { ApiClient(engine = get(), tokenProvider = { get<KeyValueStorage>().getString("auth_token") }) }
}

val databaseModule = module {
    single { get<DatabaseDriverFactory>().createDriver() }
    single { AppDatabase(get()) }
    single { UserDao(get()) }
}

val repositoryModule = module {
    single<AuthRepository> { AuthRepositoryImpl(api = get(), storage = get()) }
    single<UserRepository> { UserRepositoryImpl(api = get(), dao = get()) }
    single<SettingsRepository> { SettingsRepositoryImpl(storage = get()) }
}

val useCaseModule = module {
    factory { LoginUseCase(get()) }
    factory { RegisterUseCase(get()) }
    factory { GetUsersUseCase(get()) }
    factory { GetUserDetailUseCase(get()) }
    factory { DeleteUserUseCase(get()) }
}

val viewModelModule = module {
    factory { AuthViewModel(loginUseCase = get(), registerUseCase = get()) }
    factory { UserListViewModel(getUsersUseCase = get(), deleteUserUseCase = get()) }
    factory { SettingsViewModel(settingsRepository = get()) }
}

// Collect all shared modules
val sharedModules: List<Module> = listOf(
    networkModule,
    databaseModule,
    repositoryModule,
    useCaseModule,
    viewModelModule
)

// Platform modules add platform-specific implementations
// androidMain
val androidPlatformModule = module {
    single { DatabaseDriverFactory(get()) }  // needs Context
    single { KeyValueStorage(get()) }        // needs Context
}

// iosMain
val iosPlatformModule = module {
    single { DatabaseDriverFactory() }
    single { KeyValueStorage() }
}
```

---

## 8. Compose Multiplatform vs SwiftUI

```
COMPOSE MULTIPLATFORM:
├── Pros
│   ├── Share 70-85% of UI code across Android, iOS, Desktop, Web
│   ├── Single language (Kotlin) for everything
│   ├── Material 3 + Cupertino-style widgets available
│   ├── Same mental model as Jetpack Compose
│   └── JetBrains actively maintaining and improving
│
├── Cons
│   ├── iOS support still maturing (beta-to-stable transition)
│   ├── Not all Android Compose libraries work on iOS
│   ├── Platform-specific look may need manual work
│   ├── Debugging on iOS less mature than Android
│   └── Xcode integration adds complexity
│
└── Best for: Kotlin teams wanting maximum code sharing

KMP + NATIVE UI (SwiftUI + Compose):
├── Pros
│   ├── Best possible platform UX
│   ├── Day-0 OS feature support
│   ├── Native navigation and accessibility
│   ├── Platform developers feel at home
│   └── Shared logic reduces bugs and feature parity
│
├── Cons
│   ├── Less code sharing (50-70% logic only)
│   ├── Need both SwiftUI and Compose skills
│   ├── Two UI codebases to maintain
│   ├── Feature parity harder to guarantee
│   └── More developers needed
│
└── Best for: Teams with platform specialists who want shared logic
```

---

## 9. CocoaPods Integration

```ruby
# iosApp/Podfile
platform :ios, '16.0'

target 'iosApp' do
  use_frameworks!

  # KMP shared framework
  pod 'shared', :path => '../shared'

  # Additional iOS-only pods
  pod 'FirebaseMessaging'
  pod 'KeychainAccess'
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
    end
  end
end
```

```kotlin
// shared/build.gradle.kts — CocoaPods integration
kotlin {
    cocoapods {
        summary = "Shared KMP module"
        homepage = "https://github.com/myorg/my-kmp-app"
        version = "1.0"
        ios.deploymentTarget = "16.0"
        podfile = project.file("../iosApp/Podfile")

        framework {
            baseName = "Shared"
            isStatic = true
        }
    }
}
```

---

## 10. Publishing Shared Module

```kotlin
// shared/build.gradle.kts — Publishing to Maven
plugins {
    `maven-publish`
}

group = "com.example"
version = "1.0.0"

publishing {
    repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/myorg/my-kmp-app")
            credentials {
                username = System.getenv("GITHUB_ACTOR")
                password = System.getenv("GITHUB_TOKEN")
            }
        }
    }
}

// Consumer (another project):
// dependencies {
//     implementation("com.example:shared:1.0.0")
//     implementation("com.example:shared-iosarm64:1.0.0")
// }
```

---

## 11. Testing Shared Code

```kotlin
// shared/src/commonTest/kotlin/com/example/shared/features/auth/domain/usecase/LoginUseCaseTest.kt
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlinx.coroutines.test.runTest

class LoginUseCaseTest {

    private val fakeRepository = FakeAuthRepository()
    private val useCase = LoginUseCase(fakeRepository)

    @Test
    fun `login with valid credentials returns user`() = runTest {
        // Given
        fakeRepository.setResponse(
            Result.success(User(id = "1", name = "Test User", email = "test@example.com"))
        )

        // When
        val result = useCase(email = "test@example.com", password = "password123")

        // Then
        assertIs<Result.Success<User>>(result)
        assertEquals("Test User", result.data.name)
    }

    @Test
    fun `login with invalid credentials returns error`() = runTest {
        // Given
        fakeRepository.setResponse(
            Result.failure(NetworkError.Unauthorized("Invalid credentials"))
        )

        // When
        val result = useCase(email = "test@example.com", password = "wrong")

        // Then
        assertIs<Result.Failure>(result)
    }
}

// Test Ktor API with MockEngine
class ApiClientTest {

    @Test
    fun `get users returns list`() = runTest {
        val mockEngine = MockEngine { request ->
            respond(
                content = """[{"id":"1","name":"Test"}]""",
                headers = headersOf("Content-Type", "application/json")
            )
        }

        val client = ApiClient(engine = mockEngine, tokenProvider = { "test-token" })
        val users: List<UserDto> = client.get("https://api.example.com/users")

        assertEquals(1, users.size)
        assertEquals("Test", users.first().name)
    }
}
```

---

## 12. Kotlin/Native Memory Model

```
CURRENT MODEL (Kotlin/Native 1.7.20+):
The new Kotlin/Native memory model is DEFAULT since Kotlin 1.7.20.

KEY POINTS:
├── Objects CAN be shared between threads freely
├── No more freezing objects required
├── Regular Kotlin coroutines work on all threads
├── Same memory model as JVM (conceptually)
├── Garbage collector: concurrent, tracing GC
└── No more InvalidMutabilityException

OLD MODEL (deprecated):
├── Objects were frozen when shared across threads
├── Required @SharedImmutable and freeze()
├── Caused InvalidMutabilityException on mutation
├── Was confusing and error-prone
└── COMPLETELY REMOVED in recent Kotlin versions

BEST PRACTICES:
├── Use regular coroutines (Dispatchers.Default, Dispatchers.Main)
├── Use StateFlow and SharedFlow for shared state
├── Avoid global mutable state (same as JVM best practices)
├── Use AtomicReference for lock-free concurrent state
└── Profile with Xcode Instruments for iOS memory issues
```

---

## 13. Source Set Hierarchy

```
STANDARD KMP SOURCE SET HIERARCHY:

                    commonMain
                   /    |     \
                  /     |      \
           androidMain  |    iosMain ─────────────────────┐
                        |   /   |    \                    |
                   desktopMain  |     \                   |
                        iosX64Main iosArm64Main iosSimulatorArm64Main

INTERMEDIATE SOURCE SETS (for Apple targets):

                    commonMain
                   /    |     \
                  /     |      \
           androidMain  |    appleMain ────────────────┐
                        |   /    |     \               |
                   desktopMain   |    macosMain       iosMain
                                 |                   /   |   \
                            watchosMain     iosX64  Arm64  SimArm64

USE INTERMEDIATE SOURCE SETS WHEN:
├── You have code shared among Apple targets only (Foundation, NSUUID, etc.)
├── You want to share iOS-specific code between device and simulator targets
└── You have macOS + iOS code that uses the same Darwin APIs
```

---

## 14. What Goes Where

| Code Type | Source Set | Example |
|-----------|-----------|---------|
| Business logic | `commonMain` | UseCases, Repositories, ViewModels |
| Data models / DTOs | `commonMain` | `@Serializable` data classes |
| API calls | `commonMain` | Ktor HTTP client calls |
| HTTP engine | `androidMain`/`iosMain`/`desktopMain` | OkHttp, Darwin, CIO |
| Database driver | `androidMain`/`iosMain`/`desktopMain` | AndroidSqliteDriver, NativeSqliteDriver |
| Local storage | `androidMain`/`iosMain` | SharedPreferences, NSUserDefaults |
| Platform APIs | `androidMain`/`iosMain` | GPS, camera, biometrics |
| Compose UI | `composeApp/commonMain` | Screens, components (Compose Multiplatform) |
| Platform UI entry | `composeApp/androidMain`/`iosMain` | Activity, MainViewController |
| Tests (shared logic) | `commonTest` | Unit tests for shared business logic |
| Tests (platform) | `androidUnitTest`/`iosTest` | Platform-specific implementation tests |
| DI modules | `commonMain` + platform | Koin module in commonMain, platform modules add implementations |
| SQL queries | `commonMain/sqldelight` | .sq files for SQLDelight |
| Migrations | `commonMain/sqldelight` | .sqm migration files |
| Logging | `commonMain` (expect) + platform (actual) | Platform-native logging |
| UUID generation | `commonMain` (expect) + platform (actual) | java.util.UUID / NSUUID |
| Date/time | `commonMain` | kotlinx-datetime (cross-platform) |
| Serialization | `commonMain` | kotlinx-serialization (cross-platform) |

---

## 15. Anti-Patterns

| Anti-Pattern | Symptom | Impact | Fix |
|-------------|---------|--------|-----|
| Duplicating logic per platform | Same algorithm in androidMain + iosMain | 2x bugs, inconsistent behavior | Move to commonMain, use expect/actual only for platform APIs |
| Fat platform modules | 80% of code in androidMain | Defeats purpose of KMP | Maximize commonMain, platform source sets for wrappers only |
| No DI in shared module | Hard-coded dependencies in commonMain | Untestable, inflexible | Use Koin modules in commonMain |
| Platform leaking into shared | Android Context in shared module | iOS build fails | Use expect/actual to abstract platform details |
| Skipping commonTest | Tests only in platform source sets | Shared logic untested | Test business logic in commonTest first |
| Using old memory model patterns | freeze(), @SharedImmutable | Unnecessary complexity | Use new memory model (default since 1.7.20) |
| Massive expect/actual surface | 50+ expect declarations | Too much platform-specific code | Use interfaces + DI instead of expect/actual for most cases |
| No version catalog | Hardcoded versions in build.gradle.kts | Version conflicts, hard upgrades | Use gradle/libs.versions.toml |
| Ignoring iOS Swift interop | Kotlin API unfriendly to Swift | iOS devs frustrated | Use @ObjCName, avoid Kotlin-specific patterns in API surface |
| Not publishing shared module | Shared code only in monorepo | Cannot reuse across projects | Publish to Maven (GitHub Packages, Artifactory) |

---

## 16. Enforcement Checklist

- [ ] Business logic 100% in `commonMain` -- NEVER in platform source sets
- [ ] `expect`/`actual` for platform-specific APIs only (storage, HTTP engine, DB driver, sensors)
- [ ] Koin DI modules in `commonMain` -- platform modules add implementations
- [ ] Ktor for HTTP -- engine configured per platform via expect/actual
- [ ] SQLDelight for persistence -- .sq files in commonMain, drivers per platform
- [ ] kotlinx-serialization for JSON -- `@Serializable` data classes in commonMain
- [ ] kotlinx-datetime for date/time -- NEVER use java.util.Date or NSDate in shared code
- [ ] Compose Multiplatform in `composeApp/commonMain` for shared UI (if using shared UI)
- [ ] Version catalog (`libs.versions.toml`) for ALL dependency management
- [ ] `commonTest` for ALL business logic tests with kotlin.test
- [ ] Platform wrappers (`iosApp/`, `MainActivity`) are thin shells -- minimal code
- [ ] iOS framework exported as static framework (`isStatic = true`)
- [ ] New Kotlin/Native memory model (no freeze, no @SharedImmutable)
- [ ] Coroutines with platform-appropriate dispatchers via expect/actual
- [ ] Shared module publishable as Maven artifact for multi-project use
