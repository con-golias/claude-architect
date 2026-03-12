# Tauri v2 Project Structure — Complete Specification

> **AI Plugin Directive:** When generating a Tauri desktop or mobile application, ALWAYS use this structure. Apply Rust backend + web frontend separation with Tauri commands for IPC. This guide covers Tauri v2 with any frontend framework (React, Vue, Svelte, SolidJS, Angular). Tauri v2 supports desktop (Windows, macOS, Linux) AND mobile (iOS, Android).

**Core Rule: Business logic lives in Rust (src-tauri/). The web frontend handles UI only and calls Rust via Tauri commands. NEVER do file system, database, or OS operations in the frontend JavaScript. Tauri v2 uses a capability-based security model — declare minimum permissions per window.**

---

## 1. Enterprise Project Structure

```
my-app/
├── src-tauri/                         # Rust backend (Tauri core)
│   ├── src/
│   │   ├── main.rs                    # Desktop entry point (thin)
│   │   ├── lib.rs                     # App builder, plugin registration, shared setup
│   │   │
│   │   ├── commands/                  # Tauri IPC commands (frontend-callable)
│   │   │   ├── mod.rs                 # Re-exports all command modules
│   │   │   ├── file_commands.rs       # File system operations
│   │   │   ├── db_commands.rs         # Database CRUD operations
│   │   │   ├── system_commands.rs     # OS-level operations (clipboard, notifications)
│   │   │   ├── auth_commands.rs       # Authentication / keychain operations
│   │   │   └── window_commands.rs     # Window management commands
│   │   │
│   │   ├── models/                    # Data structures (serde Serialize/Deserialize)
│   │   │   ├── mod.rs
│   │   │   ├── user.rs               # User model
│   │   │   ├── settings.rs           # App settings model
│   │   │   ├── project.rs            # Domain-specific models
│   │   │   └── error.rs              # Custom error types
│   │   │
│   │   ├── services/                  # Business logic layer
│   │   │   ├── mod.rs
│   │   │   ├── file_service.rs       # File operations business logic
│   │   │   ├── db_service.rs         # Database access layer
│   │   │   ├── crypto_service.rs     # Encryption / hashing
│   │   │   └── update_service.rs     # Auto-update logic
│   │   │
│   │   ├── state/                     # Managed application state
│   │   │   ├── mod.rs
│   │   │   └── app_state.rs          # AppState struct (Mutex-wrapped)
│   │   │
│   │   ├── plugins/                   # Custom Tauri plugins
│   │   │   ├── mod.rs
│   │   │   └── analytics_plugin.rs   # Example custom plugin
│   │   │
│   │   ├── events/                    # Tauri event definitions
│   │   │   ├── mod.rs
│   │   │   └── app_events.rs         # Event payloads and names
│   │   │
│   │   ├── menu/                      # Application menu and tray
│   │   │   ├── mod.rs
│   │   │   ├── app_menu.rs           # Menu bar definition
│   │   │   └── tray.rs               # System tray icon and menu
│   │   │
│   │   └── utils/
│   │       ├── mod.rs
│   │       ├── paths.rs              # Platform-specific path resolution
│   │       └── logger.rs             # Logging configuration
│   │
│   ├── Cargo.toml                     # Rust dependencies
│   ├── tauri.conf.json                # Tauri configuration (windows, build, bundle)
│   ├── capabilities/                  # Tauri v2 permission system
│   │   ├── default.json              # Default window capabilities
│   │   ├── main-window.json          # Main window permissions
│   │   └── settings-window.json      # Settings window (limited) permissions
│   ├── icons/                         # App icons (all platforms)
│   │   ├── 32x32.png
│   │   ├── 128x128.png
│   │   ├── 128x128@2x.png
│   │   ├── icon.png                  # 1024x1024 source icon
│   │   ├── icon.ico                  # Windows
│   │   ├── icon.icns                 # macOS
│   │   └── Square*.png               # Windows Store icons
│   ├── build.rs                       # Build script (code generation, etc.)
│   └── migrations/                    # SQLite migrations (if using local DB)
│       ├── 001_initial.sql
│       └── 002_add_settings.sql
│
├── src/                               # Web frontend (React/Vue/Svelte)
│   ├── App.tsx                        # Root component
│   ├── main.tsx                       # Entry point
│   ├── features/                      # Feature modules
│   │   ├── editor/
│   │   │   ├── components/
│   │   │   │   ├── Editor.tsx
│   │   │   │   ├── Toolbar.tsx
│   │   │   │   └── StatusBar.tsx
│   │   │   └── hooks/
│   │   │       └── use-editor.ts
│   │   ├── files/
│   │   │   ├── components/
│   │   │   │   ├── FileTree.tsx
│   │   │   │   └── FileItem.tsx
│   │   │   └── hooks/
│   │   │       └── use-file-system.ts # Calls Tauri file commands
│   │   ├── settings/
│   │   │   ├── components/
│   │   │   │   └── SettingsPanel.tsx
│   │   │   └── hooks/
│   │   │       └── use-settings.ts
│   │   └── updates/
│   │       └── components/
│   │           └── UpdateNotification.tsx
│   ├── components/                    # Shared UI components
│   │   ├── ui/                        # Primitives (button, input, dialog)
│   │   └── layout/
│   │       ├── TitleBar.tsx           # Custom title bar (if decorations: false)
│   │       ├── Sidebar.tsx
│   │       └── MainLayout.tsx
│   ├── lib/
│   │   ├── tauri/
│   │   │   ├── commands.ts           # Type-safe Tauri command wrappers
│   │   │   ├── events.ts             # Event listener wrappers
│   │   │   └── types.ts              # Shared types (matching Rust models)
│   │   ├── stores/                    # Client-side state (Zustand/Pinia/Svelte stores)
│   │   │   ├── app-store.ts
│   │   │   └── editor-store.ts
│   │   └── utils.ts
│   └── styles/
│       ├── globals.css
│       └── theme.css                  # OS-aware theming (prefers-color-scheme)
│
├── src-mobile/                        # Mobile-specific frontend (if different from desktop)
│   └── (optional, usually same src/)
│
├── package.json                       # Frontend dependencies
├── vite.config.ts                     # Vite config (or framework-specific)
├── tsconfig.json
├── tailwind.config.ts
└── .github/
    └── workflows/
        ├── build.yml                  # Cross-platform build (Windows, macOS, Linux)
        ├── release.yml                # Create release with signed binaries
        └── mobile-build.yml           # iOS/Android builds
```

---

## 2. Tauri v2 Configuration

### tauri.conf.json (Main Configuration)

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "My App",
  "version": "1.0.0",
  "identifier": "com.mycompany.myapp",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "withGlobalTauri": false,
    "windows": [
      {
        "label": "main",
        "title": "My App",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "transparent": false,
        "center": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' asset: https://asset.localhost; style-src 'self' 'unsafe-inline'",
      "dangerousDisableAssetCspModification": false
    },
    "trayIcon": {
      "iconPath": "icons/tray-icon.png",
      "iconAsTemplate": true
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.ico",
      "icons/icon.icns"
    ],
    "createUpdaterArtifacts": "v2Compatible",
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "wix": {
        "language": "en-US"
      }
    },
    "macOS": {
      "minimumSystemVersion": "10.15",
      "signingIdentity": null,
      "entitlements": null
    },
    "linux": {
      "deb": {
        "depends": ["libwebkit2gtk-4.1-0", "libssl3"]
      },
      "appimage": {
        "bundleMediaFramework": true
      }
    }
  },
  "plugins": {
    "updater": {
      "endpoints": [
        "https://releases.myapp.com/{{target}}/{{arch}}/{{current_version}}"
      ],
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

### Cargo.toml (Rust Dependencies)

```toml
[package]
name = "my-app"
version = "1.0.0"
description = "My Tauri App"
edition = "2021"

[lib]
name = "my_app_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [
  "tray-icon",
  "image-png",
] }
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-notification = "2"
tauri-plugin-updater = "2"
tauri-plugin-store = "2"           # Key-value store (like electron-store)
tauri-plugin-log = "2"             # Structured logging
tauri-plugin-process = "2"         # Process management
tauri-plugin-os = "2"              # OS info
tauri-plugin-http = "2"            # HTTP client
tauri-plugin-window-state = "2"    # Remember window position/size

serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "1"
log = "0.4"
```

---

## 3. Tauri v2 Commands (Rust IPC)

### Command Organization

```rust
// src-tauri/src/commands/mod.rs
pub mod file_commands;
pub mod db_commands;
pub mod system_commands;
pub mod auth_commands;
pub mod window_commands;
```

### File Commands

```rust
// src-tauri/src/commands/file_commands.rs
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_directory: bool,
    pub modified: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub encoding: String,
}

/// Read a text file from the filesystem
#[command]
pub async fn read_file(path: String) -> Result<FileContent, String> {
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
    Ok(FileContent {
        path,
        content,
        encoding: "utf-8".to_string(),
    })
}

/// Write content to a text file
#[command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = PathBuf::from(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&path, &content)
        .map_err(|e| format!("Failed to write file '{}': {}", path, e))
}

/// List directory contents
#[command]
pub async fn list_directory(path: String) -> Result<Vec<FileInfo>, String> {
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory '{}': {}", path, e))?;

    let mut files: Vec<FileInfo> = entries
        .filter_map(|entry| entry.ok())
        .map(|entry| {
            let metadata = entry.metadata().ok();
            let modified = metadata
                .as_ref()
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    chrono::DateTime::<chrono::Utc>::from(t)
                        .format("%Y-%m-%d %H:%M:%S")
                        .to_string()
                });

            FileInfo {
                name: entry.file_name().to_string_lossy().to_string(),
                path: entry.path().to_string_lossy().to_string(),
                size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
                is_directory: metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
                modified,
            }
        })
        .collect();

    // Sort: directories first, then alphabetical
    files.sort_by(|a, b| {
        b.is_directory.cmp(&a.is_directory)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(files)
}

/// Delete a file or empty directory
#[command]
pub async fn delete_path(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);
    if path_buf.is_dir() {
        fs::remove_dir_all(&path)
            .map_err(|e| format!("Failed to delete directory: {}", e))
    } else {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to delete file: {}", e))
    }
}
```

### Database Commands

```rust
// src-tauri/src/commands/db_commands.rs
use crate::models::user::User;
use crate::services::db_service::DbService;
use tauri::{command, State};
use std::sync::Mutex;

#[command]
pub async fn get_users(
    db: State<'_, Mutex<DbService>>,
) -> Result<Vec<User>, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.get_all_users().map_err(|e| e.to_string())
}

#[command]
pub async fn create_user(
    email: String,
    full_name: String,
    db: State<'_, Mutex<DbService>>,
) -> Result<User, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.create_user(&email, &full_name).map_err(|e| e.to_string())
}

#[command]
pub async fn update_user(
    id: String,
    email: Option<String>,
    full_name: Option<String>,
    db: State<'_, Mutex<DbService>>,
) -> Result<User, String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.update_user(&id, email.as_deref(), full_name.as_deref())
        .map_err(|e| e.to_string())
}

#[command]
pub async fn delete_user(
    id: String,
    db: State<'_, Mutex<DbService>>,
) -> Result<(), String> {
    let db = db.lock().map_err(|e| e.to_string())?;
    db.delete_user(&id).map_err(|e| e.to_string())
}
```

### System Commands

```rust
// src-tauri/src/commands/system_commands.rs
use tauri::{command, AppHandle, Manager};

#[command]
pub async fn get_app_version(app: AppHandle) -> Result<String, String> {
    Ok(app.package_info().version.to_string())
}

#[command]
pub async fn get_platform_info() -> Result<PlatformInfo, String> {
    Ok(PlatformInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        family: std::env::consts::FAMILY.to_string(),
    })
}

#[derive(serde::Serialize)]
pub struct PlatformInfo {
    os: String,
    arch: String,
    family: String,
}
```

---

## 4. App Builder (lib.rs)

```rust
// src-tauri/src/lib.rs
mod commands;
mod events;
mod menu;
mod models;
mod plugins;
mod services;
mod state;

use commands::{auth_commands, db_commands, file_commands, system_commands, window_commands};
use menu::{app_menu, tray};
use services::db_service::DbService;
use state::AppState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_service = DbService::new().expect("Failed to initialize database");

    tauri::Builder::default()
        // Managed state (available in commands via State<>)
        .manage(Mutex::new(AppState::default()))
        .manage(Mutex::new(db_service))

        // Official Tauri v2 plugins
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())

        // Register all IPC commands
        .invoke_handler(tauri::generate_handler![
            // File operations
            file_commands::read_file,
            file_commands::write_file,
            file_commands::list_directory,
            file_commands::delete_path,
            // Database operations
            db_commands::get_users,
            db_commands::create_user,
            db_commands::update_user,
            db_commands::delete_user,
            // System operations
            system_commands::get_app_version,
            system_commands::get_platform_info,
            // Auth operations
            auth_commands::store_token,
            auth_commands::get_token,
            // Window operations
            window_commands::create_settings_window,
        ])

        // Setup hook (runs once on app start)
        .setup(|app| {
            // Create system tray
            tray::create_tray(app)?;

            // Run database migrations
            let db = app.state::<Mutex<DbService>>();
            let db = db.lock().unwrap();
            db.run_migrations()?;

            // Set up menu
            #[cfg(desktop)]
            {
                let menu = app_menu::create_menu(app)?;
                app.set_menu(menu)?;
            }

            Ok(())
        })

        // Handle menu events
        .on_menu_event(|app, event| {
            app_menu::handle_menu_event(app, event);
        })

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Desktop Entry Point

```rust
// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    my_app_lib::run();
}
```

---

## 5. Tauri v2 Security: Capabilities System

### Capability-Based Permissions

```json
// src-tauri/capabilities/main-window.json
{
  "identifier": "main-window-capability",
  "description": "Permissions for the main application window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-close",
    "core:window:allow-set-title",
    "core:window:allow-minimize",
    "core:window:allow-maximize",
    "core:window:allow-unmaximize",
    "core:window:allow-start-dragging",

    "dialog:allow-open",
    "dialog:allow-save",
    "dialog:allow-message",
    "dialog:allow-ask",

    "clipboard-manager:allow-write-text",
    "clipboard-manager:allow-read-text",

    "notification:allow-notify",
    "notification:allow-is-permission-granted",

    "shell:allow-open",

    "updater:default",

    "store:default",

    "log:default",

    "process:allow-exit",
    "process:allow-restart",

    "os:allow-locale",
    "os:allow-platform",
    "os:allow-version",

    {
      "identifier": "fs:allow-read-text-file",
      "allow": [
        { "path": "$DOCUMENT/**" },
        { "path": "$HOME/.config/my-app/**" },
        { "path": "$APPDATA/**" }
      ]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [
        { "path": "$DOCUMENT/**" },
        { "path": "$HOME/.config/my-app/**" },
        { "path": "$APPDATA/**" }
      ]
    },
    {
      "identifier": "http:default",
      "allow": [
        { "url": "https://api.myapp.com/**" },
        { "url": "https://releases.myapp.com/**" }
      ]
    }
  ]
}
```

```json
// src-tauri/capabilities/settings-window.json
{
  "identifier": "settings-window-capability",
  "description": "Limited permissions for settings window",
  "windows": ["settings"],
  "permissions": [
    "core:default",
    "core:window:allow-close",
    "store:default",
    "os:allow-locale"
  ]
}
```

### Security Best Practices ASCII Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                    Tauri v2 Security Model                        │
│                                                                   │
│  ┌─────────────────┐    IPC (invoke)    ┌──────────────────────┐ │
│  │   Web Frontend  │ ───────────────────→│   Rust Backend       │ │
│  │   (Sandboxed)   │ ←───────────────── │   (Full OS access)   │ │
│  │                 │    Result<T, E>     │                      │ │
│  │  - No fs access │                    │  - File system       │ │
│  │  - No process   │                    │  - Database          │ │
│  │  - No network*  │                    │  - Keychain          │ │
│  │  - CSP enforced │                    │  - Child processes   │ │
│  └─────────────────┘                    └──────────────────────┘ │
│         │                                        │               │
│         │ Capabilities                           │               │
│         │ (per-window                            │               │
│         │  permissions)                          │               │
│         v                                        v               │
│  ┌─────────────────┐                    ┌──────────────────────┐ │
│  │ capabilities/   │                    │ Allowed scopes:      │ │
│  │ main-window.json│                    │ - $DOCUMENT/**       │ │
│  │ - fs:read (doc) │                    │ - $APPDATA/**        │ │
│  │ - dialog:open   │                    │ - https://api.x.com  │ │
│  │ - clipboard     │                    │                      │ │
│  └─────────────────┘                    └──────────────────────┘ │
│                                                                   │
│  * Network access requires http plugin + URL scope               │
└──────────────────────────────────────────────────────────────────┘

RULES:
  1. NEVER use wildcard permissions ("fs:default" grants everything)
  2. Scope file access to specific directories ($DOCUMENT, $APPDATA)
  3. Scope HTTP access to specific URLs (your API domain only)
  4. Different windows get different capabilities (least privilege)
  5. CSP header enforced — no inline scripts, no external resources
```

---

## 6. Event System (Rust <-> Frontend Bidirectional)

### Rust Events

```rust
// src-tauri/src/events/app_events.rs
use serde::{Deserialize, Serialize};

// Event names as constants
pub const EVENT_FILE_CHANGED: &str = "file-changed";
pub const EVENT_DOWNLOAD_PROGRESS: &str = "download-progress";
pub const EVENT_APP_ERROR: &str = "app-error";
pub const EVENT_THEME_CHANGED: &str = "theme-changed";

// Event payloads
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileChangedPayload {
    pub path: String,
    pub change_type: String, // "created", "modified", "deleted"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadProgressPayload {
    pub url: String,
    pub downloaded: u64,
    pub total: u64,
    pub percentage: f64,
}

// Emitting events from Rust
use tauri::{AppHandle, Emitter};

pub fn emit_file_changed(app: &AppHandle, payload: FileChangedPayload) {
    app.emit(EVENT_FILE_CHANGED, payload)
        .expect("Failed to emit file-changed event");
}

pub fn emit_download_progress(app: &AppHandle, payload: DownloadProgressPayload) {
    app.emit(EVENT_DOWNLOAD_PROGRESS, payload)
        .expect("Failed to emit download-progress event");
}
```

### Frontend Event Listeners

```typescript
// src/lib/tauri/events.ts
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface FileChangedPayload {
  path: string;
  change_type: "created" | "modified" | "deleted";
}

interface DownloadProgressPayload {
  url: string;
  downloaded: number;
  total: number;
  percentage: number;
}

export function onFileChanged(
  callback: (payload: FileChangedPayload) => void
): Promise<UnlistenFn> {
  return listen<FileChangedPayload>("file-changed", (event) => {
    callback(event.payload);
  });
}

export function onDownloadProgress(
  callback: (payload: DownloadProgressPayload) => void
): Promise<UnlistenFn> {
  return listen<DownloadProgressPayload>("download-progress", (event) => {
    callback(event.payload);
  });
}

// React hook for event listening
import { useEffect } from "react";

export function useFileChanged(callback: (payload: FileChangedPayload) => void) {
  useEffect(() => {
    const unlisten = onFileChanged(callback);
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [callback]);
}
```

---

## 7. Multi-Window Management

```rust
// src-tauri/src/commands/window_commands.rs
use tauri::{command, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[command]
pub async fn create_settings_window(app: AppHandle) -> Result<(), String> {
    // Check if window already exists
    if let Some(window) = app.get_webview_window("settings") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("/settings".into()))
        .title("Settings")
        .inner_size(600.0, 400.0)
        .resizable(false)
        .center()
        .build()
        .map_err(|e| format!("Failed to create settings window: {}", e))?;

    Ok(())
}

#[command]
pub async fn create_about_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("about") {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "about", WebviewUrl::App("/about".into()))
        .title("About")
        .inner_size(400.0, 300.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .center()
        .build()
        .map_err(|e| format!("Failed to create about window: {}", e))?;

    Ok(())
}
```

---

## 8. System Tray

```rust
// src-tauri/src/menu/tray.rs
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Manager,
};

pub fn create_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("My App")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
```

---

## 9. Auto-Updater

```rust
// Updater is configured in tauri.conf.json "plugins.updater"
// Frontend checks for updates:
```

```typescript
// src/features/updates/components/UpdateNotification.tsx
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { useState, useEffect } from "react";

export function UpdateNotification() {
  const [update, setUpdate] = useState<any>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    async function checkForUpdate() {
      try {
        const available = await check();
        if (available) {
          setUpdate(available);
        }
      } catch (error) {
        console.error("Update check failed:", error);
      }
    }
    checkForUpdate();
  }, []);

  async function installUpdate() {
    if (!update) return;
    setDownloading(true);
    try {
      await update.downloadAndInstall((event: any) => {
        if (event.event === "Progress") {
          setProgress(
            Math.round((event.data.chunkLength / event.data.contentLength) * 100)
          );
        }
      });
      await relaunch();
    } catch (error) {
      console.error("Update failed:", error);
      setDownloading(false);
    }
  }

  if (!update) return null;

  return (
    <div className="update-banner">
      <p>Version {update.version} available!</p>
      {downloading ? (
        <progress value={progress} max={100} />
      ) : (
        <button onClick={installUpdate}>Update Now</button>
      )}
    </div>
  );
}
```

---

## 10. Mobile Support (Tauri v2 — iOS & Android)

```
Tauri v2 Mobile Architecture:

┌────────────────────────────────────────────────────────┐
│                   Shared Code                           │
│                                                        │
│  src/              → Frontend (React/Vue/Svelte)       │
│  src-tauri/src/    → Rust business logic + commands     │
│                                                        │
│  SAME codebase for desktop AND mobile                  │
└────────────────────┬───────────────────────────────────┘
                     │
          ┌──────────┼──────────┐
          │          │          │
          v          v          v
    ┌──────────┐ ┌────────┐ ┌────────┐
    │ Desktop  │ │  iOS   │ │Android │
    │          │ │        │ │        │
    │ WebView2 │ │WKWebView│ │WebView │
    │ (Win)    │ │(native)│ │(native)│
    │ WebKit   │ │        │ │        │
    │ (macOS)  │ │Swift   │ │Kotlin  │
    │ WebKitGTK│ │bridge  │ │bridge  │
    │ (Linux)  │ │        │ │        │
    └──────────┘ └────────┘ └────────┘

Mobile Commands:
  tauri ios init        # Initialize iOS project
  tauri android init    # Initialize Android project
  tauri ios dev         # Run on iOS simulator
  tauri android dev     # Run on Android emulator
  tauri ios build       # Build iOS app
  tauri android build   # Build Android APK/AAB
```

### Mobile-Specific Considerations

```rust
// Platform-specific code with cfg attributes
#[command]
pub async fn get_device_info() -> Result<DeviceInfo, String> {
    Ok(DeviceInfo {
        platform: std::env::consts::OS.to_string(),
        #[cfg(target_os = "ios")]
        device_type: "iOS".to_string(),
        #[cfg(target_os = "android")]
        device_type: "Android".to_string(),
        #[cfg(not(any(target_os = "ios", target_os = "android")))]
        device_type: "Desktop".to_string(),
    })
}

#[derive(serde::Serialize)]
pub struct DeviceInfo {
    platform: String,
    device_type: String,
}
```

---

## 11. Cross-Platform Build (CI/CD)

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
          - platform: macos-latest
            target: aarch64-apple-darwin
          - platform: macos-latest
            target: x86_64-apple-darwin
          - platform: windows-latest
            target: x86_64-pc-windows-msvc

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Install Linux dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev

      - name: Install frontend dependencies
        run: npm ci

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: 'v__VERSION__'
          releaseBody: 'See the assets for download links.'
          releaseDraft: true
          prerelease: false
          args: --target ${{ matrix.target }}
```

---

## 12. Tauri v2 Plugin System

### Using Official Plugins

```
Official Tauri v2 Plugins:
  tauri-plugin-dialog       → File open/save dialogs, message boxes
  tauri-plugin-fs           → File system access (scoped)
  tauri-plugin-shell        → Open URLs/files with default app, run shell commands
  tauri-plugin-clipboard    → Read/write clipboard
  tauri-plugin-notification → Native OS notifications
  tauri-plugin-updater      → Auto-update (delta updates, signed)
  tauri-plugin-store        → Key-value persistent storage (like electron-store)
  tauri-plugin-log          → Structured logging to file/console
  tauri-plugin-http         → HTTP client (scoped URLs)
  tauri-plugin-os           → OS information (platform, version, locale)
  tauri-plugin-process      → Exit, restart, PID
  tauri-plugin-window-state → Remember window position and size
  tauri-plugin-sql          → SQLite / MySQL / PostgreSQL
  tauri-plugin-websocket    → WebSocket client
  tauri-plugin-stronghold   → Encrypted storage (Stronghold vault)
  tauri-plugin-biometric    → Fingerprint/Face ID (mobile)
  tauri-plugin-barcode-scanner → Camera barcode scanning (mobile)
  tauri-plugin-deep-link    → URI scheme handling (myapp://...)
  tauri-plugin-global-shortcut → Global keyboard shortcuts
```

### Creating Custom Plugins

```rust
// src-tauri/src/plugins/analytics_plugin.rs
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[tauri::command]
async fn track_event(name: String, properties: serde_json::Value) -> Result<(), String> {
    // Send to analytics service
    log::info!("Analytics event: {} {:?}", name, properties);
    Ok(())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("analytics")
        .invoke_handler(tauri::generate_handler![track_event])
        .setup(|app, _api| {
            log::info!("Analytics plugin initialized");
            Ok(())
        })
        .build()
}

// Usage in lib.rs:
// .plugin(plugins::analytics_plugin::init())
```

---

## 13. Frontend Command Wrapper (Type-Safe)

```typescript
// src/lib/tauri/commands.ts
import { invoke } from "@tauri-apps/api/core";

// Types matching Rust models
export interface FileInfo {
  name: string;
  path: string;
  size: number;
  is_directory: boolean;
  modified: string | null;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface PlatformInfo {
  os: string;
  arch: string;
  family: string;
}

// Type-safe command wrappers
export const commands = {
  // File operations
  readFile: (path: string) =>
    invoke<FileContent>("read_file", { path }),

  writeFile: (path: string, content: string) =>
    invoke<void>("write_file", { path, content }),

  listDirectory: (path: string) =>
    invoke<FileInfo[]>("list_directory", { path }),

  deletePath: (path: string) =>
    invoke<void>("delete_path", { path }),

  // Database operations
  getUsers: () =>
    invoke<User[]>("get_users"),

  createUser: (email: string, fullName: string) =>
    invoke<User>("create_user", { email, fullName }),

  updateUser: (id: string, email?: string, fullName?: string) =>
    invoke<User>("update_user", { id, email, fullName }),

  deleteUser: (id: string) =>
    invoke<void>("delete_user", { id }),

  // System operations
  getAppVersion: () =>
    invoke<string>("get_app_version"),

  getPlatformInfo: () =>
    invoke<PlatformInfo>("get_platform_info"),

  // Window operations
  createSettingsWindow: () =>
    invoke<void>("create_settings_window"),
} as const;
```

---

## 14. Tauri vs Electron Comparison

```
┌─────────────────────────┬──────────────────────┬──────────────────────┐
│ Factor                  │ Tauri v2              │ Electron             │
├─────────────────────────┼──────────────────────┼──────────────────────┤
│ Binary size             │ 2-10 MB              │ 80-200 MB            │
│ Memory usage (idle)     │ 30-80 MB             │ 100-300 MB           │
│ Backend language        │ Rust                 │ Node.js              │
│ Frontend                │ Any web framework    │ Any web framework    │
│ Webview                 │ OS native (WebView2/ │ Chromium (bundled)   │
│                         │ WebKit/WebKitGTK)    │                      │
│ Security model          │ Capability-based     │ Manual (preload      │
│                         │ permissions (v2)     │ scripts, contextBridg│
│ Mobile support          │ iOS + Android (v2)   │ No                   │
│ Cross-platform build    │ GitHub Actions       │ electron-builder     │
│ Auto-updater            │ Built-in plugin      │ electron-updater     │
│ Plugin system           │ Rust plugins (v2)    │ npm packages         │
│ Learning curve          │ Higher (Rust needed) │ Lower (all JS)       │
│ Plugin ecosystem        │ Growing (50+)        │ Mature (1000+)       │
│ Process model           │ Multi-process        │ Main + Renderer      │
│ IPC                     │ Commands (invoke)    │ ipcMain/ipcRenderer  │
│ File system access      │ Scoped (capability)  │ Full (by default)    │
│ Native API access       │ Via Rust FFI         │ Via Node.js native   │
│ Startup time            │ Fast (~500ms)        │ Slow (~1-3s)         │
│ Best for                │ Performance, security│ Rapid dev, full-stack│
│                         │ small binaries, mobile│ JS, Chrome APIs     │
│                         │                      │                      │
│ Used by                 │ 1Password, Cody,     │ VS Code, Slack,      │
│                         │ Spacedrive, Clash    │ Discord, Notion,     │
│                         │ Verge, CrabNebula    │ Figma Desktop        │
└─────────────────────────┴──────────────────────┴──────────────────────┘

CHOOSE TAURI WHEN:
  - Binary size matters (distributing to users who care about disk space)
  - Memory efficiency matters (running alongside other apps)
  - Security is critical (capability-based, Rust memory safety)
  - Need mobile support (iOS/Android from same codebase)
  - Team knows or is willing to learn Rust

CHOOSE ELECTRON WHEN:
  - Team is pure JavaScript/TypeScript (no Rust experience)
  - Need Chrome DevTools Protocol or Chromium-specific features
  - Need access to massive npm ecosystem for backend operations
  - Need consistent rendering across all platforms (Chromium everywhere)
  - Rapid prototyping (faster to get started)
```

---

## 15. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **File I/O in frontend** | `fetch()` to local files, fs module in JS | ALL file ops in Rust commands, invoke from frontend |
| **No error handling** | `unwrap()` in commands — panics crash app | Return `Result<T, String>`, use `thiserror` crate |
| **Monolithic commands** | Single file with 50+ commands | Split into feature-based modules in commands/ |
| **No state management** | Global mutable state without Mutex | `State<Mutex<AppState>>` via Tauri's managed state |
| **Wildcard permissions** | `"permissions": ["fs:default"]` | Declare minimum required capabilities per window |
| **Frontend as backend** | HTTP server in JavaScript, business logic in JS | Business logic in Rust, UI-only in web frontend |
| **Blocking async commands** | CPU-heavy work on main thread | Use `tokio::spawn` for heavy computation |
| **No CSP** | Content Security Policy disabled | Enforce CSP in tauri.conf.json security section |
| **Unscooped file access** | File operations without path scope limits | Scope to specific directories ($DOCUMENT, $APPDATA) |
| **No code signing** | Distributing unsigned binaries | Sign with Apple Developer cert (macOS) + EV cert (Windows) |
| **Single massive Cargo.toml** | Every possible dependency included | Only add dependencies you actually use |
| **Ignoring mobile differences** | Same UI for 27" monitor and 6" phone | Responsive design, platform-specific layouts when needed |

---

## 16. Enforcement Checklist

- [ ] **ALL OS operations in Rust commands** — NEVER in frontend JavaScript
- [ ] **Commands return `Result<T, String>`** — errors handled gracefully in frontend
- [ ] **Tauri v2 capabilities declare minimum permissions per window** — least privilege
- [ ] **Type-safe command wrappers in `lib/tauri/commands.ts`** — no raw invoke() calls
- [ ] **State managed via `tauri::State<Mutex<T>>`** — no unsafe global state
- [ ] **Official plugins used for common operations** — dialog, fs, shell, updater, store
- [ ] **Frontend is framework-agnostic** — clean separation from Rust backend
- [ ] **App icons generated via `tauri icon` command** — all platform sizes
- [ ] **`tauri.conf.json` security settings reviewed** — CSP, asset scope, capability scope
- [ ] **Commands split into feature modules** — not one monolithic file
- [ ] **Custom error types with `thiserror`** — descriptive, not just `String`
- [ ] **Cross-platform CI/CD configured** — GitHub Actions builds for Win/Mac/Linux
- [ ] **Code signing configured** — Apple + Windows certificates for distribution
- [ ] **Auto-updater configured with signed updates** — secure update delivery
- [ ] **Mobile targets tested** — if using mobile, test on real devices
