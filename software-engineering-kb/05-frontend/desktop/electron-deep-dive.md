# Electron Deep Dive — Complete Specification

> **AI Plugin Directive:** When a developer asks "Electron architecture", "Electron vs Tauri", "Electron security", "Electron IPC", "Electron auto-update", "Electron performance", "Electron packaging", "main process vs renderer", "contextBridge", "Electron preload script", "electron-builder", or any Electron question, ALWAYS consult this directive. Electron enables building cross-platform desktop apps with web technologies (HTML/CSS/JavaScript). ALWAYS use contextBridge for secure IPC — NEVER enable nodeIntegration in renderer. ALWAYS use electron-builder or electron-forge for packaging. ALWAYS implement auto-update with electron-updater. Consider Tauri as a lighter alternative for new projects.

**Core Rule: Electron bundles Chromium + Node.js into a desktop app. The main process (Node.js) has full OS access; renderer processes (Chromium) run web content. NEVER enable nodeIntegration in renderer — it creates critical security vulnerabilities. ALWAYS use contextBridge + preload scripts for IPC between main and renderer. ALWAYS use context isolation (enabled by default). For NEW projects, evaluate Tauri first — it produces 10-50x smaller binaries and uses native webviews.**

---

## 1. Electron Architecture

```
  ELECTRON PROCESS MODEL

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  MAIN PROCESS (Node.js — single instance)            │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  • Full Node.js access (fs, child_process)     │  │
  │  │  • Native OS APIs (menus, tray, dialogs)       │  │
  │  │  • Window management (BrowserWindow)            │  │
  │  │  • IPC handler (ipcMain)                       │  │
  │  │  • Auto-update (electron-updater)              │  │
  │  │  • App lifecycle (app.on('ready'))             │  │
  │  └─────────────────┬──────────────────────────────┘  │
  │                    │ IPC (contextBridge)              │
  │      ┌─────────────┴──────────────┐                  │
  │      │                            │                  │
  │  ┌───▼────────────────┐  ┌───────▼──────────────┐   │
  │  │  RENDERER 1         │  │  RENDERER 2          │   │
  │  │  (Chromium)         │  │  (Chromium)          │   │
  │  │  ┌────────────────┐ │  │  ┌────────────────┐  │   │
  │  │  │ Your React/Vue │ │  │  │ Another window │  │   │
  │  │  │ web app        │ │  │  │ (settings, etc)│  │   │
  │  │  │ NO Node.js     │ │  │  │ NO Node.js     │  │   │
  │  │  │ access         │ │  │  │ access         │  │   │
  │  │  └────────────────┘ │  │  └────────────────┘  │   │
  │  │  PRELOAD SCRIPT:    │  │  PRELOAD SCRIPT:     │   │
  │  │  contextBridge      │  │  contextBridge       │   │
  │  │  exposes safe APIs  │  │  exposes safe APIs   │   │
  │  └────────────────────┘  └───────────────────────┘   │
  │                                                      │
  │  KEY SECURITY RULE:                                  │
  │  Renderer CANNOT access Node.js directly.            │
  │  ALL communication through contextBridge + IPC.      │
  └──────────────────────────────────────────────────────┘
```

### 1.1 Secure IPC Setup

```typescript
// preload.ts — bridges main and renderer
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File system
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, data: string) => ipcRenderer.invoke('fs:writeFile', path, data),
  selectFile: () => ipcRenderer.invoke('dialog:openFile'),

  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Events from main → renderer
  onUpdateAvailable: (callback: () => void) =>
    ipcRenderer.on('update:available', callback),
  onDeepLink: (callback: (url: string) => void) =>
    ipcRenderer.on('deep-link', (_, url) => callback(url)),
});

// main.ts — handle IPC
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { readFile, writeFile } from 'fs/promises';

ipcMain.handle('fs:readFile', async (_, path: string) => {
  return readFile(path, 'utf-8');
});

ipcMain.handle('fs:writeFile', async (_, path: string, data: string) => {
  await writeFile(path, data, 'utf-8');
});

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Documents', extensions: ['txt', 'md', 'json'] }],
  });
  return result.filePaths[0] ?? null;
});

ipcMain.handle('app:getVersion', () => app.getVersion());

// renderer (React) — use exposed API
function App() {
  const handleOpen = async () => {
    const path = await window.electronAPI.selectFile();
    if (path) {
      const content = await window.electronAPI.readFile(path);
      setFileContent(content);
    }
  };
}
```

---

## 2. Window Management

```typescript
// main.ts — BrowserWindow configuration
function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // macOS frameless with traffic lights
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,    // MUST be true
      nodeIntegration: false,     // MUST be false
      sandbox: true,              // additional security
    },
  });

  // Load your web app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Window state persistence
  mainWindow.on('close', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });

  return mainWindow;
}

// Restore window position
const savedBounds = store.get('windowBounds');
if (savedBounds) {
  mainWindow.setBounds(savedBounds);
}
```

---

## 3. Auto-Update

```typescript
// Auto-update with electron-updater
import { autoUpdater } from 'electron-updater';

function setupAutoUpdate(mainWindow: BrowserWindow) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    mainWindow.webContents.send('update:available');
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('update:downloaded');
    // Show dialog to restart
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'A new version has been downloaded. Restart to apply.',
      buttons: ['Restart', 'Later'],
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.checkForUpdatesAndNotify();
}
```

---

## 4. Native Menus & System Tray

```typescript
// Native menu (macOS/Windows/Linux)
import { Menu, Tray, nativeImage } from 'electron';

function createMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => createNewFile() },
        { label: 'Open', accelerator: 'CmdOrCtrl+O', click: () => openFile() },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => saveFile() },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// System tray
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'tray-icon.png'));
  const tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open App', click: () => mainWindow.show() },
    { label: 'Status: Running', enabled: false },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setToolTip('My App');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow.show());
}
```

---

## 5. Packaging & Distribution

```
  PACKAGING OPTIONS

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  electron-builder (RECOMMENDED):                     │
  │  • macOS: .dmg, .pkg, Mac App Store                  │
  │  • Windows: .exe (NSIS), .msi, Microsoft Store       │
  │  • Linux: .deb, .rpm, .AppImage, .snap               │
  │  • Auto-update support built-in                      │
  │  • Code signing support                              │
  │                                                      │
  │  electron-forge:                                     │
  │  • Official Electron toolchain                       │
  │  • Webpack/Vite integration                          │
  │  • Plugin-based architecture                         │
  │                                                      │
  │  APP SIZE (typical):                                 │
  │  • Minimum: ~80-120MB (Chromium + Node.js)           │
  │  • With app code: ~120-200MB                         │
  │  • This is Electron's BIGGEST drawback               │
  └──────────────────────────────────────────────────────┘
```

---

## 5. Performance

```
  ELECTRON PERFORMANCE RULES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  RULE 1: Minimize main process work                  │
  │  → Main process is single-threaded                   │
  │  → Heavy computation blocks ALL windows              │
  │  → Use worker threads or child processes              │
  │                                                      │
  │  RULE 2: Lazy-load windows                           │
  │  → Don't create all BrowserWindows at startup        │
  │  → Create on demand, destroy when closed             │
  │                                                      │
  │  RULE 3: Use V8 snapshots for startup                │
  │  → electron-builder supports custom V8 snapshots     │
  │  → Pre-compiles JS for faster cold start             │
  │                                                      │
  │  RULE 4: Memory management                           │
  │  → Each BrowserWindow is a separate process          │
  │  → Close unused windows to free memory               │
  │  → Monitor with app.getAppMetrics()                  │
  │                                                      │
  │  RULE 5: Use web workers for CPU tasks               │
  │  → Heavy computation in renderer → use Web Worker    │
  │  → Keeps UI responsive                               │
  └──────────────────────────────────────────────────────┘
```

---

## 6. Security Best Practices

```
  ELECTRON SECURITY CHECKLIST

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  CRITICAL (must have):                               │
  │  ✅ nodeIntegration: false                            │
  │  ✅ contextIsolation: true                            │
  │  ✅ sandbox: true                                     │
  │  ✅ webSecurity: true (never disable)                 │
  │  ✅ contextBridge for ALL IPC                         │
  │                                                      │
  │  IMPORTANT:                                          │
  │  ✅ CSP headers in renderer HTML                      │
  │  ✅ Validate ALL IPC inputs in main process           │
  │  ✅ Never use shell.openExternal with user input      │
  │     without URL validation                           │
  │  ✅ Restrict navigation (webContents.on('will-navigate'))│
  │  ✅ Disable new window creation from renderer         │
  │                                                      │
  │  CODE SIGNING:                                       │
  │  macOS: Apple Developer Certificate + notarization   │
  │  Windows: Microsoft Authenticode (EV recommended)    │
  │  → Without signing: OS blocks or warns users         │
  └──────────────────────────────────────────────────────┘
```

```typescript
// Security hardening
const mainWindow = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webviewTag: false,           // disable <webview>
    allowRunningInsecureContent: false,
  },
});

// Restrict navigation
mainWindow.webContents.on('will-navigate', (event, url) => {
  const parsedUrl = new URL(url);
  if (parsedUrl.origin !== 'http://localhost:5173') {
    event.preventDefault(); // block external navigation
  }
});

// Restrict new window creation
mainWindow.webContents.setWindowOpenHandler(({ url }) => {
  // Open external links in default browser
  if (url.startsWith('https://')) {
    shell.openExternal(url);
  }
  return { action: 'deny' }; // never open new Electron windows from renderer
});
```

---

## 7. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **nodeIntegration: true** | Renderer has full Node.js access — any XSS = full system compromise | `nodeIntegration: false` + `contextIsolation: true` + preload |
| **No contextBridge** | Using `remote` module (deprecated) or direct IPC | contextBridge.exposeInMainWorld with specific, typed APIs |
| **Loading remote URLs without restrictions** | Renderer loads arbitrary web content — phishing, XSS | Validate URLs, set CSP, use `ses.webRequest` to filter |
| **Bundling unnecessary node_modules** | 500MB+ app size | Use electron-builder with proper `files` config, prune devDeps |
| **No auto-update** | Users stuck on old versions with bugs | electron-updater with GitHub Releases or S3 |
| **Blocking main process** | All windows freeze during file I/O or computation | Use worker_threads, child_process, or async APIs |
| **No code signing** | macOS Gatekeeper blocks app, Windows SmartScreen warning | Sign with Apple Developer / Microsoft Authenticode certificate |
| **Using Electron for simple apps** | 120MB download for a basic utility | Consider Tauri (5-10MB) or PWA for simple apps |

---

## 7. Enforcement Checklist

### Security
- [ ] `nodeIntegration: false` on ALL BrowserWindows
- [ ] `contextIsolation: true` on ALL BrowserWindows
- [ ] `sandbox: true` enabled
- [ ] contextBridge used for ALL main↔renderer communication
- [ ] CSP headers set for renderer content
- [ ] Remote content loading restricted
- [ ] Code signed for macOS and Windows

### Distribution
- [ ] electron-builder or electron-forge configured
- [ ] Auto-update with electron-updater
- [ ] Platform-specific installers (DMG, NSIS, AppImage)
- [ ] App size optimized (<200MB target)
- [ ] Crash reporting integrated (Sentry)

### Performance
- [ ] Main process handles only IPC and OS APIs
- [ ] Heavy computation in worker threads
- [ ] Window creation lazy-loaded
- [ ] Memory usage monitored
- [ ] Startup time optimized (<3 seconds)
