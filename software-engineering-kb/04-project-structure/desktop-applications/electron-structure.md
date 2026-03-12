# Electron Project Structure

> **AI Plugin Directive:** When generating an Electron desktop application, ALWAYS use this structure. Apply main/renderer process separation with preload scripts for IPC. This guide covers Electron with electron-vite or Electron Forge, React/Vue/Svelte renderer, and secure IPC patterns.

**Core Rule: NEVER expose Node.js APIs directly to the renderer process. Use contextBridge in preload scripts for ALL main-to-renderer communication. Enable `contextIsolation: true` and `nodeIntegration: false` ALWAYS. Enable `sandbox: true` for all renderer processes.**

---

## 1. Enterprise Project Structure (electron-vite)

```
my-app/
├── electron/                              # Main process code
│   ├── main/
│   │   ├── index.ts                       # Main entry: BrowserWindow, app lifecycle
│   │   ├── ipc/                           # IPC handlers (organized by domain)
│   │   │   ├── index.ts                   # Registers all handlers
│   │   │   ├── file-handlers.ts           # File system operations
│   │   │   ├── store-handlers.ts          # Persistent storage (electron-store)
│   │   │   ├── system-handlers.ts         # OS integration (shell, clipboard)
│   │   │   ├── dialog-handlers.ts         # Native dialogs (open, save, message)
│   │   │   ├── window-handlers.ts         # Window management (minimize, maximize)
│   │   │   ├── auth-handlers.ts           # Auth flows (keychain, OAuth)
│   │   │   └── update-handlers.ts         # Auto-update status/control
│   │   │
│   │   ├── services/                      # Main process services
│   │   │   ├── file-service.ts            # File operations with validation
│   │   │   ├── update-service.ts          # electron-updater lifecycle
│   │   │   ├── tray-service.ts            # System tray icon and menu
│   │   │   ├── notification-service.ts    # Native notifications
│   │   │   ├── protocol-service.ts        # Deep link / custom protocol handler
│   │   │   ├── database-service.ts        # Local DB (better-sqlite3 / leveldb)
│   │   │   ├── logging-service.ts         # electron-log integration
│   │   │   ├── crash-reporter-service.ts  # Crash reporting
│   │   │   └── window-manager.ts          # Multi-window lifecycle
│   │   │
│   │   ├── menu/
│   │   │   ├── app-menu.ts                # Application menu (File, Edit, View, Help)
│   │   │   ├── context-menu.ts            # Right-click context menus
│   │   │   └── dock-menu.ts               # macOS Dock menu
│   │   │
│   │   ├── windows/                       # Window definitions
│   │   │   ├── main-window.ts             # Main app window config
│   │   │   ├── settings-window.ts         # Settings window config
│   │   │   ├── about-window.ts            # About dialog window
│   │   │   └── splash-window.ts           # Splash screen (loading)
│   │   │
│   │   └── utils/
│   │       ├── paths.ts                   # App paths (userData, temp, logs)
│   │       ├── logger.ts                  # Main process logging (electron-log)
│   │       ├── platform.ts                # Platform detection helpers
│   │       ├── security.ts                # URL validation, permission checks
│   │       └── constants.ts               # IPC channel names, app constants
│   │
│   └── preload/
│       ├── index.ts                       # contextBridge exposed API (main window)
│       ├── settings-preload.ts            # Preload for settings window
│       ├── types.ts                       # Shared IPC types (Window augmentation)
│       └── validators.ts                  # Input validation before IPC
│
├── src/                                   # Renderer process (web app)
│   ├── App.tsx                            # Root component
│   ├── main.tsx                           # Renderer entry
│   │
│   ├── features/                          # Feature modules (domain-driven)
│   │   ├── editor/
│   │   │   ├── components/
│   │   │   │   ├── editor-panel.tsx
│   │   │   │   ├── editor-toolbar.tsx
│   │   │   │   └── editor-status-bar.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── use-editor.ts
│   │   │   │   └── use-editor-shortcuts.ts
│   │   │   ├── store/
│   │   │   │   └── editor-store.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── files/
│   │   │   ├── components/
│   │   │   │   ├── file-tree.tsx
│   │   │   │   ├── file-tab.tsx
│   │   │   │   └── file-breadcrumb.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── use-file-system.ts     # Calls preload API (window.api.*)
│   │   │   │   └── use-recent-files.ts
│   │   │   └── store/
│   │   │       └── file-store.ts
│   │   │
│   │   ├── settings/
│   │   │   ├── components/
│   │   │   │   ├── settings-page.tsx
│   │   │   │   ├── general-settings.tsx
│   │   │   │   ├── appearance-settings.tsx
│   │   │   │   └── keybindings-settings.tsx
│   │   │   ├── hooks/
│   │   │   │   └── use-settings.ts
│   │   │   └── store/
│   │   │       └── settings-store.ts
│   │   │
│   │   └── updates/
│   │       ├── components/
│   │       │   └── update-notification.tsx
│   │       └── hooks/
│   │           └── use-auto-update.ts
│   │
│   ├── components/                        # Shared UI components
│   │   ├── ui/                            # Primitives (button, input, dialog)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── tooltip.tsx
│   │   │   └── toast.tsx
│   │   ├── layout/
│   │   │   ├── title-bar.tsx              # Custom frameless title bar
│   │   │   ├── sidebar.tsx
│   │   │   ├── status-bar.tsx
│   │   │   ├── activity-bar.tsx
│   │   │   └── panel.tsx
│   │   └── shared/
│   │       ├── command-palette.tsx         # Ctrl+Shift+P command palette
│   │       ├── loading-spinner.tsx
│   │       └── error-boundary.tsx
│   │
│   ├── lib/
│   │   ├── ipc.ts                         # Type-safe IPC caller wrapper
│   │   ├── utils.ts                       # Renderer-side utilities
│   │   ├── keyboard-shortcuts.ts          # Global keyboard shortcut manager
│   │   └── theme.ts                       # Theme system (dark/light/system)
│   │
│   ├── stores/
│   │   ├── app-store.ts                   # Global app state (zustand/jotai)
│   │   ├── ui-store.ts                    # UI state (sidebar, panels)
│   │   └── workspace-store.ts             # Workspace/project state
│   │
│   ├── hooks/
│   │   ├── use-ipc-event.ts               # Listen to main process events
│   │   ├── use-platform.ts                # Detect OS for conditional UI
│   │   └── use-window-state.ts            # Window maximized/focused state
│   │
│   └── styles/
│       ├── globals.css                    # Global styles + CSS variables
│       ├── titlebar.css                   # Platform-specific titlebar
│       └── themes/
│           ├── dark.css
│           └── light.css
│
├── resources/                             # Static app resources
│   ├── icon.png                           # App icon source (1024x1024)
│   ├── icon.ico                           # Windows icon
│   ├── icon.icns                          # macOS icon
│   ├── tray-icon.png                      # System tray icon (16x16 or 22x22)
│   ├── tray-icon@2x.png                   # Retina tray icon
│   ├── splash.html                        # Splash screen HTML (optional)
│   └── entitlements.mac.plist             # macOS entitlements for signing
│
├── scripts/                               # Build and dev scripts
│   ├── notarize.ts                        # macOS notarization script
│   ├── generate-icons.ts                  # Generate all icon sizes
│   └── check-native-deps.ts              # Verify native module compatibility
│
├── __tests__/                             # Test directory
│   ├── main/                              # Main process tests
│   │   ├── file-service.test.ts
│   │   └── ipc-handlers.test.ts
│   ├── renderer/                          # Renderer component tests
│   │   ├── file-tree.test.tsx
│   │   └── settings-page.test.tsx
│   └── e2e/                               # End-to-end tests (Playwright)
│       ├── playwright.config.ts
│       ├── app-launch.spec.ts
│       ├── file-operations.spec.ts
│       └── fixtures/
│           └── test-files/
│
├── .github/
│   └── workflows/
│       ├── build.yml                      # CI: lint, test, build
│       └── release.yml                    # CD: build, sign, notarize, publish
│
├── electron.vite.config.ts                # electron-vite configuration
├── electron-builder.yml                   # Build/packaging config
├── package.json
├── tsconfig.json                          # Root TS config (references)
├── tsconfig.node.json                     # Main process TS config
├── tsconfig.web.json                      # Renderer TS config
├── .eslintrc.cjs                          # ESLint config
├── .prettierrc                            # Prettier config
├── tailwind.config.ts                     # Tailwind (if used)
├── postcss.config.js
└── .env.example                           # Environment variable template
```

---

## 2. Electron Forge Project Structure (Alternative)

```
my-app/
├── src/
│   ├── main.ts                            # Main process entry
│   ├── preload.ts                         # Preload script
│   ├── renderer/                          # Renderer entry
│   │   ├── index.html
│   │   ├── index.ts
│   │   └── app/                           # Application code
│   │       ├── App.tsx
│   │       └── ...
│   ├── ipc/                               # IPC handlers
│   └── services/                          # Main process services
│
├── forge.config.ts                        # Electron Forge config
├── package.json
├── tsconfig.json
└── webpack.main.config.ts                 # Webpack config for main
```

```typescript
// forge.config.ts
import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { PublisherGithub } from "@electron-forge/publisher-github";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: "resources/icon",
    appBundleId: "com.mycompany.myapp",
    // macOS code signing
    osxSign: {
      identity: "Developer ID Application: My Company (TEAMID)",
      hardenedRuntime: true,
      entitlements: "resources/entitlements.mac.plist",
      "entitlements-inherit": "resources/entitlements.mac.plist",
    },
    // macOS notarization
    osxNotarize: {
      appleId: process.env.APPLE_ID!,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD!,
      teamId: process.env.APPLE_TEAM_ID!,
    },
  },
  makers: [
    new MakerSquirrel({
      certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
      certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
      setupIcon: "resources/icon.ico",
    }),
    new MakerDMG({ icon: "resources/icon.icns" }),
    new MakerDeb({ options: { icon: "resources/icon.png" } }),
    new MakerRpm({}),
  ],
  publishers: [
    new PublisherGithub({
      repository: { owner: "myorg", name: "myapp" },
      prerelease: false,
    }),
  ],
  plugins: [
    new VitePlugin({
      build: [
        { entry: "src/main.ts", config: "vite.main.config.ts" },
        { entry: "src/preload.ts", config: "vite.preload.config.ts" },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
```

---

## 3. Process Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          MAIN PROCESS                                │
│                    (Node.js -- full OS access)                        │
│                                                                      │
│   ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│   │  IPC Handlers    │  │  Services         │  │  Window Manager  │   │
│   │  (ipcMain)       │  │  (file, DB, net) │  │  (BrowserWindow) │   │
│   └────────┬─────────┘  └──────────────────┘  └──────────────────┘   │
│            │                                                          │
│   ┌────────┴─────────────────────────────────────────────────────┐   │
│   │                    PRELOAD SCRIPTS                            │   │
│   │             (contextBridge.exposeInMainWorld)                 │   │
│   │         Runs in isolated context with limited APIs           │   │
│   └────────┬──────────────────────────────┬──────────────────────┘   │
│            │                              │                           │
│   ┌────────▼─────────────────┐   ┌───────▼──────────────────┐       │
│   │   RENDERER PROCESS #1    │   │   RENDERER PROCESS #2    │       │
│   │   (Chromium -- sandboxed) │   │  (Chromium -- sandboxed) │       │
│   │                          │   │                           │       │
│   │   Main Window            │   │   Settings Window         │       │
│   │   React/Vue/Svelte App   │   │   Separate React app      │       │
│   │   Calls window.api.*     │   │   Calls window.api.*      │       │
│   │   NO Node.js access      │   │   NO Node.js access       │       │
│   │   NO require/import node │   │   Different preload OK     │       │
│   └──────────────────────────┘   └───────────────────────────┘       │
│                                                                       │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │  UTILITY PROCESS (optional)                                   │   │
│   │  utilityProcess.fork() -- Heavy computation, no UI           │   │
│   │  Cannot access Electron APIs directly                         │   │
│   │  Communicates via MessagePort with main process               │   │
│   └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘

IPC Flow:
  Renderer  ──invoke("channel", data)──→  Preload  ──ipcRenderer.invoke──→  Main
  Renderer  ←──return value──────────────  Preload  ←──Promise result─────  Main
  Main      ──webContents.send("event")──→ Preload  ──ipcRenderer.on──→  Renderer
```

---

## 4. Preload Script (Security Bridge) -- Complete Implementation

```typescript
// electron/preload/index.ts
import { contextBridge, ipcRenderer } from "electron";

// SECURITY: Define all allowed IPC channels explicitly
const VALID_INVOKE_CHANNELS = [
  "file:read",
  "file:write",
  "file:select",
  "file:select-directory",
  "file:save-dialog",
  "file:exists",
  "file:watch",
  "file:unwatch",
  "store:get",
  "store:set",
  "store:delete",
  "store:clear",
  "system:version",
  "system:platform",
  "system:open-external",
  "system:clipboard-write",
  "system:clipboard-read",
  "dialog:show-message",
  "dialog:show-error",
  "window:minimize",
  "window:maximize",
  "window:close",
  "window:is-maximized",
  "window:toggle-fullscreen",
  "update:check",
  "update:download",
  "update:install",
  "auth:get-token",
  "auth:set-token",
  "auth:delete-token",
  "db:query",
  "db:execute",
] as const;

const VALID_ON_CHANNELS = [
  "menu:action",
  "update:status",
  "update:progress",
  "window:state-changed",
  "file:changed",
  "deep-link:received",
  "app:before-quit",
  "system:theme-changed",
] as const;

type InvokeChannel = (typeof VALID_INVOKE_CHANNELS)[number];
type OnChannel = (typeof VALID_ON_CHANNELS)[number];

function validateChannel(channel: string, validChannels: readonly string[]): void {
  if (!validChannels.includes(channel)) {
    throw new Error(`IPC channel "${channel}" is not allowed`);
  }
}

const api = {
  // === Type-safe invoke (renderer -> main, returns Promise) ===
  invoke: <T = unknown>(channel: InvokeChannel, ...args: unknown[]): Promise<T> => {
    validateChannel(channel, VALID_INVOKE_CHANNELS);
    return ipcRenderer.invoke(channel, ...args) as Promise<T>;
  },

  // === File operations ===
  readFile: (path: string) =>
    ipcRenderer.invoke("file:read", path) as Promise<string>,

  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke("file:write", path, content) as Promise<void>,

  selectFile: (filters?: Electron.FileFilter[]) =>
    ipcRenderer.invoke("file:select", filters) as Promise<string | null>,

  selectDirectory: () =>
    ipcRenderer.invoke("file:select-directory") as Promise<string | null>,

  saveDialog: (defaultPath?: string, filters?: Electron.FileFilter[]) =>
    ipcRenderer.invoke("file:save-dialog", defaultPath, filters) as Promise<string | null>,

  fileExists: (path: string) =>
    ipcRenderer.invoke("file:exists", path) as Promise<boolean>,

  watchFile: (path: string) =>
    ipcRenderer.invoke("file:watch", path) as Promise<void>,

  unwatchFile: (path: string) =>
    ipcRenderer.invoke("file:unwatch", path) as Promise<void>,

  // === Store (persistent configuration via electron-store) ===
  getStoreValue: <T = unknown>(key: string) =>
    ipcRenderer.invoke("store:get", key) as Promise<T>,

  setStoreValue: (key: string, value: unknown) =>
    ipcRenderer.invoke("store:set", key, value) as Promise<void>,

  deleteStoreValue: (key: string) =>
    ipcRenderer.invoke("store:delete", key) as Promise<void>,

  // === System ===
  getAppVersion: () =>
    ipcRenderer.invoke("system:version") as Promise<string>,

  getPlatform: () =>
    ipcRenderer.invoke("system:platform") as Promise<NodeJS.Platform>,

  openExternal: (url: string) =>
    ipcRenderer.invoke("system:open-external", url) as Promise<void>,

  clipboardWrite: (text: string) =>
    ipcRenderer.invoke("system:clipboard-write", text) as Promise<void>,

  clipboardRead: () =>
    ipcRenderer.invoke("system:clipboard-read") as Promise<string>,

  // === Dialog ===
  showMessage: (options: { type: string; title: string; message: string; buttons?: string[] }) =>
    ipcRenderer.invoke("dialog:show-message", options) as Promise<number>,

  showError: (title: string, content: string) =>
    ipcRenderer.invoke("dialog:show-error", title, content) as Promise<void>,

  // === Window controls (frameless titlebar) ===
  minimizeWindow: () => ipcRenderer.invoke("window:minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window:maximize"),
  closeWindow: () => ipcRenderer.invoke("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:is-maximized") as Promise<boolean>,
  toggleFullscreen: () => ipcRenderer.invoke("window:toggle-fullscreen"),

  // === Auto-update ===
  checkForUpdates: () =>
    ipcRenderer.invoke("update:check") as Promise<void>,

  downloadUpdate: () =>
    ipcRenderer.invoke("update:download") as Promise<void>,

  installUpdate: () =>
    ipcRenderer.invoke("update:install") as Promise<void>,

  // === Auth (keychain/credential store) ===
  getAuthToken: (service: string) =>
    ipcRenderer.invoke("auth:get-token", service) as Promise<string | null>,

  setAuthToken: (service: string, token: string) =>
    ipcRenderer.invoke("auth:set-token", service, token) as Promise<void>,

  deleteAuthToken: (service: string) =>
    ipcRenderer.invoke("auth:delete-token", service) as Promise<void>,

  // === Database ===
  dbQuery: <T = unknown>(sql: string, params?: unknown[]) =>
    ipcRenderer.invoke("db:query", sql, params) as Promise<T[]>,

  dbExecute: (sql: string, params?: unknown[]) =>
    ipcRenderer.invoke("db:execute", sql, params) as Promise<{ changes: number }>,

  // === Event listeners (main -> renderer, returns unsubscribe function) ===
  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, action: string) => callback(action);
    ipcRenderer.on("menu:action", handler);
    return () => ipcRenderer.removeListener("menu:action", handler);
  },

  onUpdateStatus: (callback: (status: string, info?: unknown) => void) => {
    const handler = (_: Electron.IpcRendererEvent, status: string, info?: unknown) =>
      callback(status, info);
    ipcRenderer.on("update:status", handler);
    return () => ipcRenderer.removeListener("update:status", handler);
  },

  onUpdateProgress: (callback: (percent: number) => void) => {
    const handler = (_: Electron.IpcRendererEvent, percent: number) => callback(percent);
    ipcRenderer.on("update:progress", handler);
    return () => ipcRenderer.removeListener("update:progress", handler);
  },

  onWindowStateChanged: (callback: (state: { isMaximized: boolean; isFullScreen: boolean }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: { isMaximized: boolean; isFullScreen: boolean }) =>
      callback(state);
    ipcRenderer.on("window:state-changed", handler);
    return () => ipcRenderer.removeListener("window:state-changed", handler);
  },

  onFileChanged: (callback: (path: string, event: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, path: string, event: string) =>
      callback(path, event);
    ipcRenderer.on("file:changed", handler);
    return () => ipcRenderer.removeListener("file:changed", handler);
  },

  onDeepLink: (callback: (url: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, url: string) => callback(url);
    ipcRenderer.on("deep-link:received", handler);
    return () => ipcRenderer.removeListener("deep-link:received", handler);
  },

  onThemeChanged: (callback: (theme: "dark" | "light") => void) => {
    const handler = (_: Electron.IpcRendererEvent, theme: "dark" | "light") => callback(theme);
    ipcRenderer.on("system:theme-changed", handler);
    return () => ipcRenderer.removeListener("system:theme-changed", handler);
  },
};

contextBridge.exposeInMainWorld("api", api);

// Export type for renderer usage
export type ElectronAPI = typeof api;
```

```typescript
// electron/preload/types.ts -- Augment Window for renderer TypeScript
export {};

declare global {
  interface Window {
    api: import("./index").ElectronAPI;
  }
}
```

---

## 5. IPC Handlers (Main Process) -- Complete Implementation

```typescript
// electron/main/ipc/index.ts
import { registerFileHandlers } from "./file-handlers";
import { registerStoreHandlers } from "./store-handlers";
import { registerSystemHandlers } from "./system-handlers";
import { registerDialogHandlers } from "./dialog-handlers";
import { registerWindowHandlers } from "./window-handlers";
import { registerAuthHandlers } from "./auth-handlers";
import { registerUpdateHandlers } from "./update-handlers";
import { registerDatabaseHandlers } from "./database-handlers";

export function registerAllIpcHandlers(): void {
  registerFileHandlers();
  registerStoreHandlers();
  registerSystemHandlers();
  registerDialogHandlers();
  registerWindowHandlers();
  registerAuthHandlers();
  registerUpdateHandlers();
  registerDatabaseHandlers();
}
```

```typescript
// electron/main/ipc/file-handlers.ts
import { ipcMain, dialog, BrowserWindow } from "electron";
import { readFile, writeFile, stat, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { watch, FSWatcher } from "chokidar";
import path from "node:path";
import { logger } from "../utils/logger";

const watchers = new Map<string, FSWatcher>();

export function registerFileHandlers(): void {
  ipcMain.handle("file:read", async (_, filePath: string) => {
    // SECURITY: Validate path -- no path traversal, no system files
    const resolved = path.resolve(filePath);
    logger.info(`Reading file: ${resolved}`);
    return readFile(resolved, "utf-8");
  });

  ipcMain.handle("file:write", async (_, filePath: string, content: string) => {
    const resolved = path.resolve(filePath);
    logger.info(`Writing file: ${resolved}`);
    await writeFile(resolved, content, "utf-8");
  });

  ipcMain.handle("file:exists", async (_, filePath: string) => {
    try {
      await access(path.resolve(filePath), fsConstants.R_OK);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("file:select", async (event, filters?: Electron.FileFilter[]) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;

    const result = await dialog.showOpenDialog(window, {
      properties: ["openFile"],
      filters: filters ?? [{ name: "All Files", extensions: ["*"] }],
    });

    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("file:select-directory", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;

    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory", "createDirectory"],
    });

    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(
    "file:save-dialog",
    async (event, defaultPath?: string, filters?: Electron.FileFilter[]) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) return null;

      const result = await dialog.showSaveDialog(window, {
        defaultPath,
        filters: filters ?? [{ name: "All Files", extensions: ["*"] }],
      });

      return result.canceled ? null : result.filePath;
    }
  );

  ipcMain.handle("file:watch", async (event, filePath: string) => {
    const resolved = path.resolve(filePath);
    if (watchers.has(resolved)) return;

    const watcher = watch(resolved, { persistent: true });
    watcher.on("change", (changedPath) => {
      const window = BrowserWindow.fromWebContents(event.sender);
      window?.webContents.send("file:changed", changedPath, "change");
    });
    watchers.set(resolved, watcher);
  });

  ipcMain.handle("file:unwatch", async (_, filePath: string) => {
    const resolved = path.resolve(filePath);
    const watcher = watchers.get(resolved);
    if (watcher) {
      await watcher.close();
      watchers.delete(resolved);
    }
  });
}
```

```typescript
// electron/main/ipc/store-handlers.ts
import { ipcMain } from "electron";
import Store from "electron-store";

interface AppConfig {
  theme: "light" | "dark" | "system";
  language: string;
  recentFiles: string[];
  windowBounds: { x: number; y: number; width: number; height: number };
  [key: string]: unknown;
}

const store = new Store<AppConfig>({
  defaults: {
    theme: "system",
    language: "en",
    recentFiles: [],
    windowBounds: { x: 0, y: 0, width: 1200, height: 800 },
  },
  // SECURITY: Encrypt sensitive data
  encryptionKey: process.env.STORE_ENCRYPTION_KEY,
});

export function registerStoreHandlers(): void {
  ipcMain.handle("store:get", (_, key: string) => {
    return store.get(key);
  });

  ipcMain.handle("store:set", (_, key: string, value: unknown) => {
    store.set(key, value);
  });

  ipcMain.handle("store:delete", (_, key: string) => {
    store.delete(key as keyof AppConfig);
  });

  ipcMain.handle("store:clear", () => {
    store.clear();
  });
}

export { store };
```

```typescript
// electron/main/ipc/system-handlers.ts
import { ipcMain, app, shell, clipboard } from "electron";
import { URL } from "node:url";

// SECURITY: Whitelist of allowed external URL schemes
const ALLOWED_PROTOCOLS = ["https:", "http:", "mailto:"];

export function registerSystemHandlers(): void {
  ipcMain.handle("system:version", () => app.getVersion());

  ipcMain.handle("system:platform", () => process.platform);

  ipcMain.handle("system:open-external", async (_, url: string) => {
    // SECURITY: Validate URL before opening
    try {
      const parsed = new URL(url);
      if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        throw new Error(`Protocol ${parsed.protocol} is not allowed`);
      }
      await shell.openExternal(url);
    } catch (err) {
      throw new Error(`Cannot open URL: ${(err as Error).message}`);
    }
  });

  ipcMain.handle("system:clipboard-write", (_, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.handle("system:clipboard-read", () => {
    return clipboard.readText();
  });
}
```

```typescript
// electron/main/ipc/window-handlers.ts
import { ipcMain, BrowserWindow } from "electron";

export function registerWindowHandlers(): void {
  ipcMain.handle("window:minimize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });

  ipcMain.handle("window:maximize", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.handle("window:close", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });

  ipcMain.handle("window:is-maximized", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window?.isMaximized() ?? false;
  });

  ipcMain.handle("window:toggle-fullscreen", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    window.setFullScreen(!window.isFullScreen());
  });
}
```

---

## 6. Main Process Entry -- Complete Implementation

```typescript
// electron/main/index.ts
import { app, BrowserWindow, shell, nativeTheme, protocol } from "electron";
import { join } from "node:path";
import { registerAllIpcHandlers } from "./ipc";
import { createAppMenu } from "./menu/app-menu";
import { setupAutoUpdater } from "./services/update-service";
import { setupTray } from "./services/tray-service";
import { setupProtocolHandler } from "./services/protocol-service";
import { WindowManager } from "./services/window-manager";
import { store } from "./ipc/store-handlers";
import { logger } from "./utils/logger";

// Prevent multiple instances (single instance lock)
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    // Handle deep link from second instance (Windows/Linux)
    const deepLink = argv.find((arg) => arg.startsWith("myapp://"));
    if (deepLink) {
      WindowManager.getMainWindow()?.webContents.send("deep-link:received", deepLink);
    }
    // Focus existing window
    const mainWindow = WindowManager.getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Custom protocol handler (deep linking)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("myapp", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("myapp");
}

// macOS deep link handler
app.on("open-url", (_event, url) => {
  WindowManager.getMainWindow()?.webContents.send("deep-link:received", url);
});

function createMainWindow(): BrowserWindow {
  const savedBounds = store.get("windowBounds");

  const mainWindow = new BrowserWindow({
    width: savedBounds.width,
    height: savedBounds.height,
    x: savedBounds.x || undefined,
    y: savedBounds.y || undefined,
    minWidth: 800,
    minHeight: 600,
    show: false,                         // Don't show until ready
    titleBarStyle: "hiddenInset",        // macOS frameless
    trafficLightPosition: { x: 16, y: 16 }, // macOS traffic light position
    frame: process.platform === "darwin" ? true : false, // Frameless on Windows/Linux
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1e1e1e" : "#ffffff",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,            // MANDATORY: true
      nodeIntegration: false,            // MANDATORY: false
      sandbox: true,                     // MANDATORY: true
      webviewTag: false,                 // Disable <webview> tag
      spellcheck: true,                  // Enable spellcheck
      // Content Security Policy
      // Set via meta tag or session headers (see below)
    },
  });

  // Set CSP headers
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: https:; " +
          "font-src 'self' data:; " +
          "connect-src 'self' https://api.myapp.com wss://api.myapp.com; " +
          "object-src 'none'; " +
          "base-uri 'self';"
        ],
      },
    });
  });

  // Show window when ready (prevents flash of white)
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });

  // Save window bounds on move/resize
  const saveBounds = () => {
    if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
      store.set("windowBounds", mainWindow.getBounds());
    }
  };
  mainWindow.on("resized", saveBounds);
  mainWindow.on("moved", saveBounds);

  // Notify renderer of window state changes
  mainWindow.on("maximize", () =>
    mainWindow.webContents.send("window:state-changed", {
      isMaximized: true,
      isFullScreen: false,
    })
  );
  mainWindow.on("unmaximize", () =>
    mainWindow.webContents.send("window:state-changed", {
      isMaximized: false,
      isFullScreen: false,
    })
  );
  mainWindow.on("enter-full-screen", () =>
    mainWindow.webContents.send("window:state-changed", {
      isMaximized: false,
      isFullScreen: true,
    })
  );
  mainWindow.on("leave-full-screen", () =>
    mainWindow.webContents.send("window:state-changed", {
      isMaximized: false,
      isFullScreen: false,
    })
  );

  // SECURITY: Prevent navigation away from app
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const appUrl = process.env.ELECTRON_RENDERER_URL || "file://";
    if (!url.startsWith(appUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // SECURITY: Deny all new window creation; open in external browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  WindowManager.setMainWindow(mainWindow);
  return mainWindow;
}

// ─── Application Lifecycle ─────────────────────────────────────

app.whenReady().then(async () => {
  // Register IPC handlers BEFORE creating windows
  registerAllIpcHandlers();

  // Set up application menu
  createAppMenu();

  // Create main window
  const mainWindow = createMainWindow();

  // Set up system tray (optional, for background apps)
  setupTray(mainWindow);

  // Set up auto-updater (production only)
  if (app.isPackaged) {
    setupAutoUpdater(mainWindow);
  }

  // Set up custom protocol handler
  setupProtocolHandler();

  // Watch system theme changes
  nativeTheme.on("updated", () => {
    mainWindow.webContents.send(
      "system:theme-changed",
      nativeTheme.shouldUseDarkColors ? "dark" : "light"
    );
  });

  logger.info("Application started", { version: app.getVersion() });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

app.on("before-quit", () => {
  WindowManager.getMainWindow()?.webContents.send("app:before-quit");
});

// SECURITY: Disable permission requests from renderer
app.on("web-contents-created", (_event, contents) => {
  contents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    // Only allow specific permissions
    const allowedPermissions = ["clipboard-read", "clipboard-sanitized-write"];
    callback(allowedPermissions.includes(permission));
  });
});
```

---

## 7. Services

### Auto-Updater Service

```typescript
// electron/main/services/update-service.ts
import { autoUpdater, UpdateCheckResult } from "electron-updater";
import { BrowserWindow } from "electron";
import { logger } from "../utils/logger";

export function setupAutoUpdater(mainWindow: BrowserWindow): void {
  // Configure
  autoUpdater.autoDownload = false;         // Don't auto-download; let user decide
  autoUpdater.autoInstallOnAppQuit = true;  // Install pending update on quit
  autoUpdater.logger = logger;

  // Events
  autoUpdater.on("checking-for-update", () => {
    mainWindow.webContents.send("update:status", "checking");
  });

  autoUpdater.on("update-available", (info) => {
    mainWindow.webContents.send("update:status", "available", info);
  });

  autoUpdater.on("update-not-available", () => {
    mainWindow.webContents.send("update:status", "not-available");
  });

  autoUpdater.on("download-progress", (progress) => {
    mainWindow.webContents.send("update:progress", progress.percent);
  });

  autoUpdater.on("update-downloaded", (info) => {
    mainWindow.webContents.send("update:status", "downloaded", info);
  });

  autoUpdater.on("error", (err) => {
    logger.error("Auto-update error:", err);
    mainWindow.webContents.send("update:status", "error", err.message);
  });

  // Check for updates on startup (after 5s delay)
  setTimeout(() => autoUpdater.checkForUpdates(), 5000);

  // Check periodically (every 4 hours)
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
}

// IPC handlers for update control
import { ipcMain } from "electron";

export function registerUpdateHandlers(): void {
  ipcMain.handle("update:check", async () => {
    await autoUpdater.checkForUpdates();
  });

  ipcMain.handle("update:download", async () => {
    await autoUpdater.downloadUpdate();
  });

  ipcMain.handle("update:install", () => {
    autoUpdater.quitAndInstall(false, true);
  });
}
```

### System Tray Service

```typescript
// electron/main/services/tray-service.ts
import { Tray, Menu, nativeImage, BrowserWindow, app } from "electron";
import { join } from "node:path";

let tray: Tray | null = null;

export function setupTray(mainWindow: BrowserWindow): void {
  const iconPath = join(
    __dirname,
    "../../resources",
    process.platform === "darwin" ? "tray-icon.png" : "tray-icon.png"
  );

  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show App",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: "separator" },
    {
      label: "Check for Updates",
      click: () => mainWindow.webContents.send("menu:action", "check-updates"),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip("My App");
  tray.setContextMenu(contextMenu);

  // Click to show window (Windows/Linux)
  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
```

### Window Manager Service

```typescript
// electron/main/services/window-manager.ts
import { BrowserWindow } from "electron";
import { join } from "node:path";

export class WindowManager {
  private static mainWindow: BrowserWindow | null = null;
  private static childWindows = new Map<string, BrowserWindow>();

  static getMainWindow(): BrowserWindow | null {
    return this.mainWindow;
  }

  static setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    window.on("closed", () => {
      this.mainWindow = null;
    });
  }

  static createChildWindow(
    id: string,
    options: {
      width?: number;
      height?: number;
      preload?: string;
      url?: string;
      filePath?: string;
      parent?: boolean;
      modal?: boolean;
    }
  ): BrowserWindow {
    // Close existing child window with same ID
    const existing = this.childWindows.get(id);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return existing;
    }

    const childWindow = new BrowserWindow({
      width: options.width ?? 600,
      height: options.height ?? 400,
      parent: options.parent ? this.mainWindow ?? undefined : undefined,
      modal: options.modal ?? false,
      show: false,
      webPreferences: {
        preload: options.preload ?? join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    childWindow.on("ready-to-show", () => childWindow.show());
    childWindow.on("closed", () => this.childWindows.delete(id));

    if (options.url) {
      childWindow.loadURL(options.url);
    } else if (options.filePath) {
      childWindow.loadFile(options.filePath);
    }

    this.childWindows.set(id, childWindow);
    return childWindow;
  }

  static closeAllChildWindows(): void {
    this.childWindows.forEach((window) => {
      if (!window.isDestroyed()) window.close();
    });
    this.childWindows.clear();
  }
}
```

### Deep Link / Protocol Handler

```typescript
// electron/main/services/protocol-service.ts
import { app, protocol } from "electron";
import { WindowManager } from "./window-manager";
import { logger } from "../utils/logger";

export function setupProtocolHandler(): void {
  // Handle custom protocol (myapp://)
  // Register on macOS via Info.plist CFBundleURLTypes
  // Register on Windows via registry (electron-builder handles this)

  app.on("open-url", (_event, url) => {
    logger.info("Deep link received:", url);
    handleDeepLink(url);
  });

  // Handle file associations
  app.on("open-file", (_event, filePath) => {
    logger.info("File open request:", filePath);
    const mainWindow = WindowManager.getMainWindow();
    mainWindow?.webContents.send("file:open-request", filePath);
  });
}

function handleDeepLink(url: string): void {
  try {
    const parsed = new URL(url);
    const mainWindow = WindowManager.getMainWindow();

    if (!mainWindow) {
      // Store deep link to process after window is created
      app.once("browser-window-created", () => {
        setTimeout(() => {
          WindowManager.getMainWindow()?.webContents.send("deep-link:received", url);
        }, 1000);
      });
      return;
    }

    mainWindow.webContents.send("deep-link:received", url);

    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  } catch (err) {
    logger.error("Invalid deep link URL:", url, err);
  }
}
```

---

## 8. Application Menu

```typescript
// electron/main/menu/app-menu.ts
import { Menu, MenuItemConstructorOptions, app, BrowserWindow, shell } from "electron";
import { WindowManager } from "../services/window-manager";

export function createAppMenu(): void {
  const isMac = process.platform === "darwin";

  const template: MenuItemConstructorOptions[] = [
    // macOS app menu
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { type: "separator" as const },
              {
                label: "Preferences...",
                accelerator: "CmdOrCtrl+,",
                click: () => sendMenuAction("open-settings"),
              },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          } as MenuItemConstructorOptions,
        ]
      : []),
    // File
    {
      label: "File",
      submenu: [
        {
          label: "New File",
          accelerator: "CmdOrCtrl+N",
          click: () => sendMenuAction("new-file"),
        },
        {
          label: "Open File...",
          accelerator: "CmdOrCtrl+O",
          click: () => sendMenuAction("open-file"),
        },
        {
          label: "Open Folder...",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => sendMenuAction("open-folder"),
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => sendMenuAction("save"),
        },
        {
          label: "Save As...",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => sendMenuAction("save-as"),
        },
        { type: "separator" },
        ...(isMac ? [] : [{ role: "quit" as const }]),
      ],
    },
    // Edit
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
        { type: "separator" },
        {
          label: "Find...",
          accelerator: "CmdOrCtrl+F",
          click: () => sendMenuAction("find"),
        },
        {
          label: "Replace...",
          accelerator: "CmdOrCtrl+H",
          click: () => sendMenuAction("replace"),
        },
      ],
    },
    // View
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        {
          label: "Toggle Sidebar",
          accelerator: "CmdOrCtrl+B",
          click: () => sendMenuAction("toggle-sidebar"),
        },
        {
          label: "Toggle Panel",
          accelerator: "CmdOrCtrl+J",
          click: () => sendMenuAction("toggle-panel"),
        },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    // Help
    {
      label: "Help",
      submenu: [
        {
          label: "Documentation",
          click: () => shell.openExternal("https://docs.myapp.com"),
        },
        {
          label: "Report Issue",
          click: () => shell.openExternal("https://github.com/myorg/myapp/issues"),
        },
        { type: "separator" },
        {
          label: "Check for Updates...",
          click: () => sendMenuAction("check-updates"),
        },
        ...(isMac ? [] : [{ type: "separator" as const }, { role: "about" as const }]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function sendMenuAction(action: string): void {
  const mainWindow = WindowManager.getMainWindow();
  mainWindow?.webContents.send("menu:action", action);
}
```

---

## 9. Configuration Files

### electron-vite Configuration

```typescript
// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "electron/main/index.ts") },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "electron/preload/index.ts"),
          settings: resolve(__dirname, "electron/preload/settings-preload.ts"),
        },
      },
    },
  },
  renderer: {
    root: "src",
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, "src/index.html") },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src"),
      },
    },
  },
});
```

### electron-builder Configuration

```yaml
# electron-builder.yml
appId: com.mycompany.myapp
productName: My App
copyright: Copyright (c) 2025 My Company

directories:
  output: dist
  buildResources: resources

files:
  - "out/**/*"
  - "!**/*.map"
  - "!**/node_modules/**/{CHANGELOG,README,readme,test,__tests__}*"

asar: true
compression: maximum

# ─── Windows ───
win:
  target:
    - target: nsis
      arch: [x64, arm64]
    - target: portable
      arch: [x64]
  icon: resources/icon.ico
  signingHashAlgorithms: [sha256]
  certificateFile: ${env.WINDOWS_CERT_FILE}
  certificatePassword: ${env.WINDOWS_CERT_PASSWORD}

nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  deleteAppDataOnUninstall: false
  createDesktopShortcut: true
  createStartMenuShortcut: true
  menuCategory: true
  installerIcon: resources/icon.ico
  uninstallerIcon: resources/icon.ico
  installerSidebar: resources/installerSidebar.bmp
  license: LICENSE

# ─── macOS ───
mac:
  target:
    - target: dmg
      arch: [x64, arm64, universal]
    - target: zip
      arch: [x64, arm64, universal]
  icon: resources/icon.icns
  category: public.app-category.developer-tools
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: resources/entitlements.mac.plist
  entitlementsInherit: resources/entitlements.mac.plist
  darkModeSupport: true
  extendInfo:
    CFBundleURLTypes:
      - CFBundleURLName: myapp
        CFBundleURLSchemes: [myapp]
    NSDocumentsFolderUsageDescription: "Access documents for editing"

dmg:
  sign: false
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications

# ─── Linux ───
linux:
  target:
    - target: AppImage
      arch: [x64, arm64]
    - target: deb
      arch: [x64]
    - target: rpm
      arch: [x64]
    - target: snap
      arch: [x64]
  icon: resources/icons
  category: Development
  maintainer: team@mycompany.com
  mimeTypes:
    - x-scheme-handler/myapp
  desktop:
    MimeType: x-scheme-handler/myapp;

deb:
  depends:
    - gconf2
    - gconf-service
    - libnotify4
    - libappindicator1
    - libxtst6
    - libnss3

# ─── Auto-update (electron-updater) ───
publish:
  provider: github
  owner: myorg
  repo: myapp
  releaseType: release

# ─── Native module rebuild ───
npmRebuild: true
nodeGypRebuild: false
buildDependenciesFromSource: false

afterSign: scripts/notarize.ts
```

### macOS Entitlements

```xml
<!-- resources/entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
</dict>
</plist>
```

### macOS Notarization Script

```typescript
// scripts/notarize.ts
import { notarize } from "@electron/notarize";
import { AfterPackContext } from "electron-builder";

export default async function notarizing(context: AfterPackContext): Promise<void> {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;

  console.log(`Notarizing ${appName}...`);

  await notarize({
    appBundleId: "com.mycompany.myapp",
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLE_ID!,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD!,
    teamId: process.env.APPLE_TEAM_ID!,
  });

  console.log("Notarization complete.");
}
```

### package.json

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "description": "My Electron Application",
  "main": "out/main/index.js",
  "homepage": "https://myapp.com",
  "author": {
    "name": "My Company",
    "email": "team@mycompany.com"
  },
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "start": "electron-vite preview",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write .",
    "typecheck:main": "tsc --noEmit -p tsconfig.node.json",
    "typecheck:renderer": "tsc --noEmit -p tsconfig.web.json",
    "typecheck": "npm run typecheck:main && npm run typecheck:renderer",
    "test": "vitest",
    "test:e2e": "playwright test",
    "postinstall": "electron-builder install-app-deps",
    "pack": "electron-vite build && electron-builder --dir",
    "dist": "electron-vite build && electron-builder",
    "dist:win": "electron-vite build && electron-builder --win",
    "dist:mac": "electron-vite build && electron-builder --mac",
    "dist:linux": "electron-vite build && electron-builder --linux",
    "release": "electron-vite build && electron-builder --publish always"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "chokidar": "^3.6.0",
    "electron-log": "^5.1.0",
    "electron-store": "^8.2.0",
    "electron-updater": "^6.2.0"
  },
  "devDependencies": {
    "@electron-toolkit/tsconfig": "^1.0.1",
    "@playwright/test": "^1.44.0",
    "@types/better-sqlite3": "^7.6.8",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^32.0.0",
    "electron-builder": "^25.0.0",
    "electron-vite": "^2.3.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0",
    "zustand": "^4.5.0"
  },
  "optionalDependencies": {
    "electron-rebuild": "^3.2.0"
  }
}
```

---

## 10. Native Module Handling

```typescript
// Handling native modules (better-sqlite3, keytar, node-gyp modules)

// Option 1: prebuild-install (preferred -- no compile at install)
// In package.json, native modules with prebuild support "just work"
// electron-builder handles rebuild automatically via "postinstall"

// Option 2: electron-rebuild (manual)
// npx electron-rebuild -f -w better-sqlite3

// Option 3: In electron-builder.yml
// npmRebuild: true  <-- rebuilds native modules for Electron's Node version

// IMPORTANT: electron.vite.config.ts must externalize native modules:
// The externalizeDepsPlugin() handles this automatically
```

```typescript
// electron/main/services/database-service.ts
// Example with better-sqlite3 (native module)
import Database from "better-sqlite3";
import { app } from "electron";
import { join } from "node:path";
import { logger } from "../utils/logger";

let db: Database.Database | null = null;

export function initDatabase(): Database.Database {
  const dbPath = join(app.getPath("userData"), "app-data.db");
  logger.info(`Initializing database at: ${dbPath}`);

  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === "development" ? console.log : undefined,
  });

  // Enable WAL mode for better concurrent access
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Run migrations
  runMigrations(db);

  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
}

export function closeDatabase(): void {
  db?.close();
  db = null;
}
```

---

## 11. Testing with Playwright

```typescript
// __tests__/e2e/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  retries: 1,
  use: {
    trace: "on-first-retry",
  },
});
```

```typescript
// __tests__/e2e/app-launch.spec.ts
import { test, expect, _electron as electron, ElectronApplication, Page } from "@playwright/test";
import path from "node:path";

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  app = await electron.launch({
    args: [path.join(__dirname, "../../out/main/index.js")],
    env: {
      ...process.env,
      NODE_ENV: "test",
    },
  });

  page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
});

test.afterAll(async () => {
  await app.close();
});

test("app window opens with correct title", async () => {
  const title = await page.title();
  expect(title).toBe("My App");
});

test("window has correct minimum size", async () => {
  const windowSize = await page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  expect(windowSize.width).toBeGreaterThanOrEqual(800);
  expect(windowSize.height).toBeGreaterThanOrEqual(600);
});

test("preload API is exposed on window", async () => {
  const hasApi = await page.evaluate(() => typeof window.api !== "undefined");
  expect(hasApi).toBe(true);
});

test("can get app version via IPC", async () => {
  const version = await page.evaluate(() => window.api.getAppVersion());
  expect(version).toMatch(/^\d+\.\d+\.\d+/);
});

test("main process is running", async () => {
  const isRunning = await app.evaluate(async ({ app }) => {
    return app.isReady();
  });
  expect(isRunning).toBe(true);
});

test("context isolation is enabled", async () => {
  const hasRequire = await page.evaluate(() => typeof require !== "undefined");
  expect(hasRequire).toBe(false);

  const hasProcess = await page.evaluate(() => typeof process !== "undefined");
  expect(hasProcess).toBe(false);
});
```

---

## 12. CI/CD Workflow (GitHub Actions)

```yaml
# .github/workflows/release.yml
name: Build and Release

on:
  push:
    tags: ["v*"]

jobs:
  build:
    strategy:
      matrix:
        include:
          - os: windows-latest
            platform: win
          - os: macos-latest
            platform: mac
          - os: ubuntu-latest
            platform: linux

    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint and typecheck
        run: |
          npm run lint
          npm run typecheck

      - name: Run tests
        run: npm test

      - name: Build and publish
        run: npm run release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # macOS signing
          CSC_LINK: ${{ secrets.MAC_CERTS }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTS_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          # Windows signing
          WINDOWS_CERT_FILE: ${{ secrets.WINDOWS_CERT_FILE }}
          WINDOWS_CERT_PASSWORD: ${{ secrets.WINDOWS_CERT_PASSWORD }}
```

---

## 13. Renderer-Side Utilities

```typescript
// src/hooks/use-ipc-event.ts
import { useEffect } from "react";

/**
 * Hook to listen for IPC events from the main process.
 * Returns unsubscribe function automatically on unmount.
 */
export function useIpcEvent<T extends (...args: any[]) => void>(
  subscribe: (callback: T) => () => void,
  callback: T,
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    const unsubscribe = subscribe(callback);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Usage in a component:
// useIpcEvent(window.api.onMenuAction, (action) => {
//   if (action === "save") handleSave();
// });
```

```typescript
// src/hooks/use-platform.ts
import { useEffect, useState } from "react";

export function usePlatform() {
  const [platform, setPlatform] = useState<NodeJS.Platform>("win32");

  useEffect(() => {
    window.api.getPlatform().then(setPlatform);
  }, []);

  return {
    platform,
    isMac: platform === "darwin",
    isWindows: platform === "win32",
    isLinux: platform === "linux",
    // Modifier key helper
    modKey: platform === "darwin" ? "Cmd" : "Ctrl",
  };
}
```

```typescript
// src/components/layout/title-bar.tsx
import { useState } from "react";
import { useIpcEvent } from "@/hooks/use-ipc-event";
import { usePlatform } from "@/hooks/use-platform";

export function TitleBar() {
  const { isMac, isWindows } = usePlatform();
  const [isMaximized, setIsMaximized] = useState(false);

  useIpcEvent(window.api.onWindowStateChanged, (state) => {
    setIsMaximized(state.isMaximized);
  });

  // macOS uses native traffic lights (no custom buttons needed)
  if (isMac) {
    return (
      <div
        className="h-8 flex items-center justify-center select-none"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <span className="text-xs font-medium opacity-60">My App</span>
      </div>
    );
  }

  // Windows/Linux custom title bar
  return (
    <div
      className="h-8 flex items-center bg-gray-900 select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex-1 px-4">
        <span className="text-xs font-medium text-gray-300">My App</span>
      </div>

      <div
        className="flex h-full"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <button
          onClick={() => window.api.minimizeWindow()}
          className="h-full px-4 hover:bg-gray-700 text-gray-300"
          aria-label="Minimize"
        >
          &#x2500;
        </button>
        <button
          onClick={() => window.api.maximizeWindow()}
          className="h-full px-4 hover:bg-gray-700 text-gray-300"
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? "\u29C9" : "\u25A1"}
        </button>
        <button
          onClick={() => window.api.closeWindow()}
          className="h-full px-4 hover:bg-red-600 text-gray-300"
          aria-label="Close"
        >
          &#x2715;
        </button>
      </div>
    </div>
  );
}
```

---

## 14. electron-vite vs Electron Forge vs electron-builder

| Factor | electron-vite | Electron Forge | electron-builder (standalone) |
|--------|-------------|---------------|-------------------------------|
| Build tool | Vite (all three processes) | Webpack or Vite (plugin) | N/A (packaging only) |
| Config files | `electron.vite.config.ts` | `forge.config.ts` | `electron-builder.yml` |
| HMR support | Main + preload + renderer | Renderer only (usually) | N/A |
| Packaging | Uses electron-builder under the hood | Built-in makers (Squirrel, DMG, etc.) | Standalone |
| Makers/targets | All electron-builder targets | Squirrel, DMG, deb, rpm, snap, flatpak | NSIS, DMG, AppImage, deb, snap, etc. |
| Template | `create-electron-vite` | `create-electron-app` | Manual setup |
| Fuses support | Manual | Built-in FusesPlugin | Manual |
| Best for | Fast dev experience, modern tooling | Full-featured scaffold, publishing | Existing projects, custom build |
| Community | Growing rapidly | Officially recommended by Electron | Largest install base |

**Recommendation:** Use **electron-vite** for new projects (fastest DX). Use **Electron Forge** if you want the officially-supported full scaffold with publishing. Use **electron-builder** alone if adding Electron to an existing project.

---

## 15. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| `nodeIntegration: true` | `require('fs')` in renderer -- critical security vulnerability | `contextBridge` + preload, `nodeIntegration: false` ALWAYS |
| `contextIsolation: false` | Renderer has direct access to Electron APIs | `contextIsolation: true` + `exposeInMainWorld` |
| `sandbox: false` | Renderer can spawn child processes | `sandbox: true` for all renderer processes |
| No CSP headers | XSS attacks can execute arbitrary scripts | Set `Content-Security-Policy` headers via session |
| All code in main process | Slow UI, blocked event loop | Split: main (Node.js) vs renderer (web app) |
| Direct `ipcRenderer.send` | Untyped, fire-and-forget, no response | Use `ipcRenderer.invoke` + `ipcMain.handle` for request/response |
| `ipcRenderer.on("*")` wildcard | Listens to all channels -- security risk | Whitelist allowed channels in preload |
| Fat preload script | Business logic, database calls in preload | Preload is a THIN bridge only -- logic in main process services |
| No channel validation | Renderer can invoke arbitrary IPC channels | Validate channel names against a whitelist in preload |
| No URL validation in `openExternal` | Renderer can open `file://` or custom protocol URLs | Whitelist protocols (https, http, mailto only) |
| No single instance lock | Multiple app instances cause data corruption | `app.requestSingleInstanceLock()` |
| Massive app size (200MB+) | Including dev dependencies, uncompressed asar | Exclude dev deps, `asar: true`, `compression: maximum` |
| No code signing | macOS Gatekeeper blocks, Windows SmartScreen warns | Sign with Apple Developer ID + Windows EV certificate |
| No notarization (macOS) | macOS refuses to open app, shows "damaged" message | Notarize with `@electron/notarize` in afterSign hook |
| No auto-updater | Users manually download updates, stuck on old versions | `electron-updater` with GitHub/S3 releases |
| Hardcoded file paths | App breaks on different OS, user directories | Use `app.getPath('userData')`, `app.getPath('documents')` |
| No error handling in IPC | Unhandled promise rejections crash main process | try/catch in all `ipcMain.handle` callbacks |
| `webviewTag: true` | Embeddable webview with potential security issues | `webviewTag: false` (use `BrowserView` or `<iframe>` with CSP) |
| No window state persistence | Window opens at random position each launch | Save/restore bounds with `electron-store` |
| Inline `<script>` in HTML | Violates CSP, XSS vector | All scripts bundled, `script-src 'self'` in CSP |
| `remote` module usage | Deprecated, synchronous IPC, security risk | Remove `@electron/remote`, use async IPC exclusively |
| Running Node.js code in renderer via `contextBridge` | Exposing raw `fs.readFile` or `child_process` | Expose high-level operations only ("file:read" not "fs:readFile") |

---

## 16. Enforcement Checklist

### Security (MANDATORY)
- [ ] `contextIsolation: true` -- ALWAYS, no exceptions
- [ ] `nodeIntegration: false` -- ALWAYS, no exceptions
- [ ] `sandbox: true` -- ALWAYS for production
- [ ] `webviewTag: false` -- unless explicitly needed
- [ ] CSP headers configured -- `script-src 'self'`, no `unsafe-eval`
- [ ] IPC channels whitelisted in preload -- no wildcard listeners
- [ ] URL validation before `shell.openExternal()` -- whitelist protocols
- [ ] `setWindowOpenHandler` returns `{ action: "deny" }` -- open in external browser
- [ ] `will-navigate` handler prevents navigation to external URLs
- [ ] Permission request handler denies unnecessary permissions
- [ ] No `@electron/remote` module usage
- [ ] Electron Fuses configured (disable `RunAsNode`, enable `OnlyLoadAppFromAsar`)

### Architecture
- [ ] ALL main-to-renderer communication via `contextBridge` + IPC
- [ ] Preload script exposes typed API -- renderer uses `window.api.*`
- [ ] Main process handles: file system, OS APIs, native menus, database, auto-update
- [ ] Renderer process is a standard web app (React/Vue/Svelte) -- zero Node.js
- [ ] Services layer in main process -- business logic separated from IPC handlers
- [ ] Multi-window support via `WindowManager` class

### Build and Distribution
- [ ] electron-builder or Electron Forge configured for packaging
- [ ] Auto-updater configured with `electron-updater` for production releases
- [ ] App icons for all platforms (`.icns`, `.ico`, `.png`)
- [ ] Code signing configured for macOS (Developer ID) and Windows (EV/OV certificate)
- [ ] macOS notarization configured in afterSign hook
- [ ] Deep linking / custom protocol registered
- [ ] Single instance lock enabled (`requestSingleInstanceLock`)
- [ ] Window state persisted (position, size, maximized)

### Development Experience
- [ ] electron-vite or Electron Forge with Vite plugin
- [ ] HMR working for renderer (and main process restart on change)
- [ ] Separate `tsconfig` for main and renderer processes
- [ ] ESLint + Prettier configured
- [ ] Playwright E2E tests for critical flows
- [ ] Unit tests for main process services (vitest)
- [ ] CI/CD pipeline builds for all platforms
