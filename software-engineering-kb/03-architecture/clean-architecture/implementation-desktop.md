# Clean Architecture: Desktop Implementation — Complete Guide

> **AI Plugin Directive:** When building ANY desktop application (WPF, Electron, Tauri, JavaFX, Qt), follow these patterns. Desktop apps have unique concerns: local-first data, complex UI state, multi-window management, OS integration, undo/redo. Apply clean architecture to keep business logic isolated from platform specifics.

---

## 1. Project Structure for Desktop Apps

### WPF / C# (.NET)

```
Solution/
├── src/
│   ├── Domain/                          # Class library (no WPF/UI references)
│   │   ├── Domain.csproj               # Target: net8.0 (NOT net8.0-windows)
│   │   ├── Entities/
│   │   │   ├── Document.cs
│   │   │   ├── Project.cs
│   │   │   └── WorkItem.cs
│   │   ├── ValueObjects/
│   │   │   ├── DocumentId.cs
│   │   │   ├── FilePath.cs
│   │   │   └── Version.cs
│   │   ├── Events/
│   │   │   ├── DocumentCreatedEvent.cs
│   │   │   └── DocumentModifiedEvent.cs
│   │   ├── Errors/
│   │   │   └── DomainErrors.cs
│   │   └── Ports/
│   │       ├── IDocumentRepository.cs
│   │       ├── IFileStorage.cs
│   │       └── IExportService.cs
│   ├── Application/                     # Class library
│   │   ├── Application.csproj          # References: Domain only
│   │   ├── Commands/
│   │   │   ├── CreateDocument/
│   │   │   ├── SaveDocument/
│   │   │   └── ExportDocument/
│   │   ├── Queries/
│   │   │   ├── GetDocument/
│   │   │   └── SearchDocuments/
│   │   ├── Ports/
│   │   │   ├── IUndoRedoService.cs
│   │   │   ├── IClipboardService.cs
│   │   │   └── IDialogService.cs
│   │   └── Services/
│   │       └── UndoRedoManager.cs
│   ├── Infrastructure/                  # Class library
│   │   ├── Infrastructure.csproj       # References: Domain, Application + NuGet packages
│   │   ├── Persistence/
│   │   │   ├── SqliteDocumentRepository.cs
│   │   │   ├── AppDbContext.cs
│   │   │   └── Migrations/
│   │   ├── FileSystem/
│   │   │   ├── LocalFileStorage.cs
│   │   │   └── RecentFilesService.cs
│   │   ├── Export/
│   │   │   ├── PdfExportService.cs
│   │   │   └── CsvExportService.cs
│   │   └── Platform/
│   │       ├── WindowsRegistryService.cs
│   │       └── NativeDialogService.cs
│   └── Desktop/                         # WPF Application project
│       ├── Desktop.csproj              # References: All projects
│       ├── App.xaml / App.xaml.cs      # Composition root
│       ├── ViewModels/
│       │   ├── MainViewModel.cs
│       │   ├── DocumentViewModel.cs
│       │   ├── ToolbarViewModel.cs
│       │   └── StatusBarViewModel.cs
│       ├── Views/
│       │   ├── MainWindow.xaml
│       │   ├── DocumentView.xaml
│       │   └── Dialogs/
│       │       ├── SaveDialog.xaml
│       │       └── ExportDialog.xaml
│       ├── Converters/
│       │   ├── BoolToVisibilityConverter.cs
│       │   └── StatusToColorConverter.cs
│       ├── Services/
│       │   ├── WpfDialogService.cs
│       │   ├── WpfClipboardService.cs
│       │   └── NavigationService.cs
│       └── Resources/
│           ├── Styles/
│           └── Icons/
└── tests/
    ├── Domain.Tests/
    ├── Application.Tests/
    └── Infrastructure.Tests/
```

### Electron / TypeScript

```
src/
├── main/                               # Electron main process
│   ├── index.ts                        # Entry point
│   ├── ipc/                            # IPC handlers (bridge to renderer)
│   │   ├── document.ipc.ts
│   │   ├── file-system.ipc.ts
│   │   └── window.ipc.ts
│   ├── services/                       # Main process services
│   │   ├── auto-updater.ts
│   │   ├── tray.ts
│   │   └── native-menu.ts
│   └── windows/
│       ├── main-window.ts
│       └── splash-window.ts
├── renderer/                           # Electron renderer process (React/Vue)
│   ├── features/
│   │   ├── editor/
│   │   │   ├── domain/
│   │   │   │   ├── entities/
│   │   │   │   ├── value-objects/
│   │   │   │   └── ports/
│   │   │   ├── application/
│   │   │   │   ├── commands/
│   │   │   │   └── queries/
│   │   │   ├── infrastructure/
│   │   │   │   └── api/               # IPC calls to main process
│   │   │   └── presentation/
│   │   │       ├── components/
│   │   │       └── hooks/
│   │   ├── file-explorer/
│   │   └── settings/
│   ├── shared/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   │   └── ipc-client.ts          # Type-safe IPC wrapper
│   │   └── presentation/
│   │       ├── components/
│   │       └── layouts/
│   └── main.tsx
├── shared/                             # Shared between main and renderer
│   ├── types/
│   │   └── ipc-channels.ts            # IPC channel type definitions
│   └── constants/
└── preload/
    └── preload.ts                      # Context bridge
```

### Tauri (Rust + TypeScript)

```
src-tauri/                              # Rust backend
├── src/
│   ├── main.rs
│   ├── domain/
│   │   ├── mod.rs
│   │   ├── entities/
│   │   │   └── document.rs
│   │   ├── value_objects/
│   │   │   └── document_id.rs
│   │   └── ports/
│   │       └── document_repository.rs
│   ├── application/
│   │   ├── mod.rs
│   │   └── commands/
│   │       ├── create_document.rs
│   │       └── save_document.rs
│   ├── infrastructure/
│   │   ├── mod.rs
│   │   ├── persistence/
│   │   │   └── sqlite_repository.rs
│   │   └── file_system/
│   │       └── local_storage.rs
│   └── commands/                       # Tauri command handlers (like controllers)
│       ├── document_commands.rs
│       └── file_commands.rs
src/                                    # TypeScript frontend (same as SPA)
├── features/
├── shared/
└── main.tsx
```

---

## 2. Presentation Layer

### MVVM Pattern (WPF / C#)

```csharp
// ViewModels/DocumentViewModel.cs
public partial class DocumentViewModel : ObservableObject
{
    private readonly SaveDocumentCommand _saveCommand;
    private readonly ExportDocumentCommand _exportCommand;
    private readonly IUndoRedoService _undoRedo;
    private readonly IDialogService _dialogs;

    [ObservableProperty]
    private string _title = string.Empty;

    [ObservableProperty]
    private string _content = string.Empty;

    [ObservableProperty]
    private bool _isDirty;

    [ObservableProperty]
    private bool _isSaving;

    [ObservableProperty]
    private DocumentStatus _status = DocumentStatus.Draft;

    // Computed property
    public string WindowTitle => IsDirty ? $"{Title}* — MyApp" : $"{Title} — MyApp";

    // Commands
    [RelayCommand(CanExecute = nameof(CanSave))]
    private async Task SaveAsync()
    {
        IsSaving = true;
        try
        {
            var result = await _saveCommand.ExecuteAsync(new SaveDocumentInput
            {
                DocumentId = _documentId,
                Title = Title,
                Content = Content,
            });

            IsDirty = false;
            Status = DocumentStatus.Saved;
        }
        catch (Exception ex)
        {
            await _dialogs.ShowErrorAsync("Save Failed", ex.Message);
        }
        finally
        {
            IsSaving = false;
        }
    }

    private bool CanSave() => IsDirty && !IsSaving;

    [RelayCommand]
    private async Task ExportAsync()
    {
        var filePath = await _dialogs.ShowSaveDialogAsync(
            "Export Document",
            new[] { new FileFilter("PDF", "*.pdf"), new FileFilter("CSV", "*.csv") }
        );

        if (filePath is null) return; // User cancelled

        await _exportCommand.ExecuteAsync(new ExportDocumentInput
        {
            DocumentId = _documentId,
            OutputPath = filePath,
            Format = Path.GetExtension(filePath) switch
            {
                ".pdf" => ExportFormat.Pdf,
                ".csv" => ExportFormat.Csv,
                _ => throw new UnsupportedFormatException(filePath)
            },
        });

        await _dialogs.ShowInfoAsync("Export Complete", $"Document exported to {filePath}");
    }

    [RelayCommand(CanExecute = nameof(CanUndo))]
    private void Undo() => _undoRedo.Undo();

    [RelayCommand(CanExecute = nameof(CanRedo))]
    private void Redo() => _undoRedo.Redo();

    private bool CanUndo() => _undoRedo.CanUndo;
    private bool CanRedo() => _undoRedo.CanRedo;

    // Track changes for dirty state
    partial void OnContentChanged(string value)
    {
        IsDirty = true;
        _undoRedo.RecordChange(new ContentChange(_documentId, value));
        SaveCommand.NotifyCanExecuteChanged();
    }

    partial void OnTitleChanged(string value)
    {
        IsDirty = true;
        OnPropertyChanged(nameof(WindowTitle));
    }
}
```

### Electron with React + Redux/Zustand

```typescript
// renderer/features/editor/presentation/hooks/useDocument.ts
export function useDocument(documentId: string) {
  const document = useDocumentStore(state => state.documents[documentId]);
  const { save, updateContent, undo, redo } = useDocumentActions();

  const isDirty = useMemo(() => document?.isDirty ?? false, [document]);
  const canUndo = useMemo(() => (document?.undoStack.length ?? 0) > 0, [document]);
  const canRedo = useMemo(() => (document?.redoStack.length ?? 0) > 0, [document]);

  const handleSave = useCallback(async () => {
    if (!isDirty) return;
    await save(documentId);
  }, [documentId, isDirty]);

  const handleContentChange = useCallback((newContent: string) => {
    updateContent(documentId, newContent);
  }, [documentId]);

  return {
    document,
    isDirty,
    canUndo,
    canRedo,
    save: handleSave,
    updateContent: handleContentChange,
    undo: () => undo(documentId),
    redo: () => redo(documentId),
  };
}

// renderer/features/editor/presentation/components/Editor.tsx
export function Editor({ documentId }: { documentId: string }) {
  const { document, isDirty, save, updateContent, undo, redo, canUndo, canRedo } =
    useDocument(documentId);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [save, undo, redo]);

  if (!document) return <LoadingSpinner />;

  return (
    <div className="editor">
      <EditorToolbar
        isDirty={isDirty}
        canUndo={canUndo}
        canRedo={canRedo}
        onSave={save}
        onUndo={undo}
        onRedo={redo}
      />
      <EditorContent
        content={document.content}
        onChange={updateContent}
      />
      <StatusBar
        status={isDirty ? 'Modified' : 'Saved'}
        wordCount={document.wordCount}
      />
    </div>
  );
}
```

---

## 3. Domain Layer for Desktop

### Document-Based Workflows

```typescript
// domain/entities/document.ts
export class Document extends AggregateRoot {
  private _title: string;
  private _content: string;
  private _versions: DocumentVersion[];
  private _status: DocumentStatus;
  private _lastSavedAt: Date | null;
  private _createdAt: Date;
  private _modifiedAt: Date;

  static create(id: DocumentId, title: string): Document {
    const doc = new Document({
      id,
      title,
      content: '',
      versions: [],
      status: DocumentStatus.DRAFT,
      lastSavedAt: null,
      createdAt: new Date(),
      modifiedAt: new Date(),
    });
    doc.addDomainEvent(new DocumentCreatedEvent(id, title));
    return doc;
  }

  updateContent(newContent: string): ContentChange {
    const previousContent = this._content;
    this._content = newContent;
    this._modifiedAt = new Date();
    this._status = DocumentStatus.MODIFIED;

    // Return change object for undo/redo
    return new ContentChange(
      this.id,
      previousContent,
      newContent,
      new Date()
    );
  }

  save(): DocumentVersion {
    const version = DocumentVersion.create(
      this._versions.length + 1,
      this._content,
      new Date()
    );
    this._versions.push(version);
    this._lastSavedAt = new Date();
    this._status = DocumentStatus.SAVED;
    this.addDomainEvent(new DocumentSavedEvent(this.id, version.number));
    return version;
  }

  revertToVersion(versionNumber: number): void {
    const version = this._versions.find(v => v.number === versionNumber);
    if (!version) throw new VersionNotFoundError(this.id, versionNumber);
    this._content = version.content;
    this._modifiedAt = new Date();
    this._status = DocumentStatus.MODIFIED;
  }

  get isDirty(): boolean {
    if (!this._lastSavedAt) return this._content.length > 0;
    return this._modifiedAt > this._lastSavedAt;
  }

  get wordCount(): number {
    return this._content.split(/\s+/).filter(w => w.length > 0).length;
  }

  get characterCount(): number {
    return this._content.length;
  }
}
```

### Undo/Redo with Command Pattern

```typescript
// application/services/undo-redo.ts
export interface UndoableCommand {
  execute(): void;
  undo(): void;
  readonly description: string;
}

export class UndoRedoManager {
  private undoStack: UndoableCommand[] = [];
  private redoStack: UndoableCommand[] = [];
  private maxStackSize = 100;

  execute(command: UndoableCommand): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack on new action
    if (this.undoStack.length > this.maxStackSize) {
      this.undoStack.shift(); // Remove oldest
    }
  }

  undo(): UndoableCommand | null {
    const command = this.undoStack.pop();
    if (!command) return null;
    command.undo();
    this.redoStack.push(command);
    return command;
  }

  redo(): UndoableCommand | null {
    const command = this.redoStack.pop();
    if (!command) return null;
    command.execute();
    this.undoStack.push(command);
    return command;
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }

  get undoDescription(): string | null {
    return this.undoStack.at(-1)?.description ?? null;
  }

  get redoDescription(): string | null {
    return this.redoStack.at(-1)?.description ?? null;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}

// Concrete commands
export class ContentChangeCommand implements UndoableCommand {
  constructor(
    private readonly document: Document,
    private readonly previousContent: string,
    private readonly newContent: string,
  ) {}

  get description() { return 'Content change'; }

  execute(): void {
    this.document.updateContent(this.newContent);
  }

  undo(): void {
    this.document.updateContent(this.previousContent);
  }
}

export class TitleChangeCommand implements UndoableCommand {
  constructor(
    private readonly document: Document,
    private readonly previousTitle: string,
    private readonly newTitle: string,
  ) {}

  get description() { return `Rename to "${this.newTitle}"`; }

  execute(): void { this.document.updateTitle(this.newTitle); }
  undo(): void { this.document.updateTitle(this.previousTitle); }
}

// Compound command for grouping multiple changes
export class CompoundCommand implements UndoableCommand {
  constructor(
    private readonly commands: UndoableCommand[],
    public readonly description: string,
  ) {}

  execute(): void {
    for (const cmd of this.commands) cmd.execute();
  }

  undo(): void {
    for (const cmd of [...this.commands].reverse()) cmd.undo();
  }
}
```

### Complex Form Validation

```typescript
// domain/entities/project-settings.ts
export class ProjectSettings {
  private constructor(
    private _name: ProjectName,
    private _description: string,
    private _budget: Money,
    private _deadline: Date,
    private _teamSize: number,
    private _priority: Priority,
    private _tags: Tag[],
  ) {}

  static create(props: ProjectSettingsProps): Result<ProjectSettings, ValidationError[]> {
    const errors: ValidationError[] = [];

    const name = ProjectName.create(props.name);
    if (name.isErr) errors.push(name.error);

    if (props.description.length > 5000) {
      errors.push(new ValidationError('description', 'Description must be under 5000 characters'));
    }

    if (props.budget.isNegative()) {
      errors.push(new ValidationError('budget', 'Budget cannot be negative'));
    }

    if (props.deadline < new Date()) {
      errors.push(new ValidationError('deadline', 'Deadline must be in the future'));
    }

    if (props.teamSize < 1 || props.teamSize > 1000) {
      errors.push(new ValidationError('teamSize', 'Team size must be between 1 and 1000'));
    }

    if (props.tags.length > 20) {
      errors.push(new ValidationError('tags', 'Maximum 20 tags allowed'));
    }

    if (errors.length > 0) return Result.err(errors);

    return Result.ok(new ProjectSettings(
      name.value,
      props.description,
      props.budget,
      props.deadline,
      props.teamSize,
      props.priority,
      props.tags,
    ));
  }
}
```

---

## 4. Infrastructure Layer for Desktop

### Local Database (SQLite)

```typescript
// infrastructure/persistence/sqlite-document.repository.ts
export class SqliteDocumentRepository implements DocumentRepository {
  constructor(private readonly db: BetterSqlite3.Database) {}

  async save(document: Document): Promise<void> {
    const data = DocumentMapper.toPersistence(document);

    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO documents (id, title, content, status, created_at, modified_at, last_saved_at)
        VALUES (@id, @title, @content, @status, @createdAt, @modifiedAt, @lastSavedAt)
        ON CONFLICT(id) DO UPDATE SET
          title = @title,
          content = @content,
          status = @status,
          modified_at = @modifiedAt,
          last_saved_at = @lastSavedAt
      `).run(data);

      // Save versions
      for (const version of data.versions) {
        this.db.prepare(`
          INSERT OR IGNORE INTO document_versions (document_id, version_number, content, created_at)
          VALUES (@documentId, @versionNumber, @content, @createdAt)
        `).run(version);
      }
    })();
  }

  async findById(id: DocumentId): Promise<Document | null> {
    const row = this.db.prepare('SELECT * FROM documents WHERE id = ?').get(id.value);
    if (!row) return null;

    const versions = this.db.prepare(
      'SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_number'
    ).all(id.value);

    return DocumentMapper.toDomain(row, versions);
  }

  async findRecent(limit: number): Promise<Document[]> {
    const rows = this.db.prepare(
      'SELECT * FROM documents ORDER BY modified_at DESC LIMIT ?'
    ).all(limit);

    return Promise.all(rows.map(async row => {
      const versions = this.db.prepare(
        'SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_number'
      ).all(row.id);
      return DocumentMapper.toDomain(row, versions);
    }));
  }

  async search(query: string): Promise<Document[]> {
    const rows = this.db.prepare(`
      SELECT * FROM documents
      WHERE title LIKE @query OR content LIKE @query
      ORDER BY modified_at DESC
      LIMIT 50
    `).all({ query: `%${query}%` });

    return rows.map(row => DocumentMapper.toDomain(row, []));
  }

  async delete(id: DocumentId): Promise<void> {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM document_versions WHERE document_id = ?').run(id.value);
      this.db.prepare('DELETE FROM documents WHERE id = ?').run(id.value);
    })();
  }
}
```

### File System Operations

```typescript
// domain/ports/file-storage.ts
export interface LocalFileStorage {
  readFile(path: FilePath): Promise<FileContent>;
  writeFile(path: FilePath, content: FileContent): Promise<void>;
  deleteFile(path: FilePath): Promise<void>;
  exists(path: FilePath): Promise<boolean>;
  listDirectory(path: DirectoryPath): Promise<FileSystemEntry[]>;
  watch(path: FilePath, callback: (event: FileChangeEvent) => void): Disposable;
  showOpenDialog(options: OpenDialogOptions): Promise<FilePath | null>;
  showSaveDialog(options: SaveDialogOptions): Promise<FilePath | null>;
}

// infrastructure/file-system/node-file-storage.ts (Electron)
export class NodeFileStorage implements LocalFileStorage {
  async readFile(path: FilePath): Promise<FileContent> {
    const buffer = await fs.readFile(path.value);
    const encoding = this.detectEncoding(buffer);
    return FileContent.create(buffer.toString(encoding), encoding);
  }

  async writeFile(path: FilePath, content: FileContent): Promise<void> {
    // Create backup before overwriting
    if (await this.exists(path)) {
      const backupPath = FilePath.from(`${path.value}.bak`);
      await fs.copyFile(path.value, backupPath.value);
    }

    await fs.writeFile(path.value, content.toString(), { encoding: content.encoding });
  }

  watch(path: FilePath, callback: (event: FileChangeEvent) => void): Disposable {
    const watcher = chokidar.watch(path.value, { persistent: true });
    watcher.on('change', () => callback({ type: 'modified', path }));
    watcher.on('unlink', () => callback({ type: 'deleted', path }));
    return { dispose: () => watcher.close() };
  }

  async showOpenDialog(options: OpenDialogOptions): Promise<FilePath | null> {
    const result = await dialog.showOpenDialog({
      title: options.title,
      filters: options.filters.map(f => ({ name: f.name, extensions: f.extensions })),
      properties: ['openFile'],
      defaultPath: options.defaultPath?.value,
    });
    return result.canceled ? null : FilePath.from(result.filePaths[0]);
  }

  async showSaveDialog(options: SaveDialogOptions): Promise<FilePath | null> {
    const result = await dialog.showSaveDialog({
      title: options.title,
      filters: options.filters.map(f => ({ name: f.name, extensions: f.extensions })),
      defaultPath: options.defaultPath?.value,
    });
    return result.canceled ? null : FilePath.from(result.filePath!);
  }
}
```

### System Preferences/Settings

```typescript
// domain/ports/settings.ts
export interface SettingsStore {
  get<T>(key: string, defaultValue: T): Promise<T>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  observe<T>(key: string): Observable<T>;
}

// infrastructure/settings/electron-store-settings.ts
export class ElectronStoreSettings implements SettingsStore {
  private store: ElectronStore;

  constructor() {
    this.store = new ElectronStore({
      defaults: {
        theme: 'system',
        fontSize: 14,
        autoSave: true,
        autoSaveIntervalMs: 30000,
        recentFiles: [],
        windowBounds: { width: 1200, height: 800 },
      },
      schema: {
        theme: { type: 'string', enum: ['light', 'dark', 'system'] },
        fontSize: { type: 'number', minimum: 8, maximum: 72 },
        autoSave: { type: 'boolean' },
      },
    });
  }

  async get<T>(key: string, defaultValue: T): Promise<T> {
    return this.store.get(key, defaultValue) as T;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  observe<T>(key: string): Observable<T> {
    return new Observable(subscriber => {
      const unsubscribe = this.store.onDidChange(key, (newValue) => {
        subscriber.next(newValue as T);
      });
      return () => unsubscribe();
    });
  }
}
```

### Inter-Process Communication (Electron)

```typescript
// shared/types/ipc-channels.ts — Type-safe IPC channel definitions
export interface IpcChannels {
  'document:create': { input: CreateDocumentInput; output: DocumentResult };
  'document:save': { input: SaveDocumentInput; output: DocumentResult };
  'document:load': { input: { id: string }; output: DocumentDetailResult };
  'document:list': { input: ListDocumentsInput; output: DocumentListResult };
  'document:export': { input: ExportDocumentInput; output: void };
  'file:open-dialog': { input: OpenDialogOptions; output: string | null };
  'file:save-dialog': { input: SaveDialogOptions; output: string | null };
  'file:read': { input: { path: string }; output: string };
  'file:write': { input: { path: string; content: string }; output: void };
  'app:get-settings': { input: void; output: AppSettings };
  'app:set-settings': { input: Partial<AppSettings>; output: void };
}

// main/ipc/document.ipc.ts — Main process handlers
export function registerDocumentHandlers(
  ipcMain: IpcMain,
  createDocument: CreateDocumentHandler,
  saveDocument: SaveDocumentHandler,
  loadDocument: GetDocumentHandler,
) {
  ipcMain.handle('document:create', async (_event, input: CreateDocumentInput) => {
    return createDocument.execute(input);
  });

  ipcMain.handle('document:save', async (_event, input: SaveDocumentInput) => {
    return saveDocument.execute(input);
  });

  ipcMain.handle('document:load', async (_event, input: { id: string }) => {
    return loadDocument.execute({ documentId: input.id });
  });
}

// renderer/shared/infrastructure/ipc-client.ts — Type-safe renderer-side client
export class IpcClient {
  async invoke<K extends keyof IpcChannels>(
    channel: K,
    input: IpcChannels[K]['input']
  ): Promise<IpcChannels[K]['output']> {
    return window.electron.ipcRenderer.invoke(channel, input);
  }
}

// Usage in renderer
const ipc = new IpcClient();
const result = await ipc.invoke('document:create', { title: 'New Doc' });
// TypeScript knows result is DocumentResult
```

---

## 5. Desktop-Specific Patterns

### Multi-Window Architecture

```typescript
// application/ports/window-manager.ts
export interface WindowManager {
  openWindow(config: WindowConfig): Promise<WindowId>;
  closeWindow(id: WindowId): Promise<void>;
  focusWindow(id: WindowId): Promise<void>;
  getAllWindows(): WindowInfo[];
  getActiveWindow(): WindowInfo | null;
  onWindowClosed(callback: (id: WindowId) => void): Disposable;
}

export interface WindowConfig {
  type: 'document' | 'settings' | 'about' | 'search';
  title: string;
  width: number;
  height: number;
  data?: unknown;
}

// infrastructure/electron/electron-window-manager.ts
export class ElectronWindowManager implements WindowManager {
  private windows = new Map<string, BrowserWindow>();

  async openWindow(config: WindowConfig): Promise<WindowId> {
    const id = WindowId.generate();
    const win = new BrowserWindow({
      width: config.width,
      height: config.height,
      title: config.title,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.windows.set(id.value, win);

    win.loadURL(`${BASE_URL}#/${config.type}?data=${encodeURIComponent(JSON.stringify(config.data))}`);

    win.on('closed', () => {
      this.windows.delete(id.value);
    });

    return id;
  }

  async closeWindow(id: WindowId): Promise<void> {
    const win = this.windows.get(id.value);
    if (win) win.close();
  }
}
```

### Drag and Drop as Infrastructure

```typescript
// domain/ports/drag-drop.ts
export interface DragDropService {
  onFilesDropped(callback: (files: DroppedFile[]) => void): Disposable;
  onItemDragged(callback: (item: DragItem, target: DropTarget) => void): Disposable;
}

export interface DroppedFile {
  path: string;
  name: string;
  size: number;
  mimeType: string;
}

// infrastructure/browser/html-drag-drop.service.ts
export class HtmlDragDropService implements DragDropService {
  constructor(private readonly element: HTMLElement) {}

  onFilesDropped(callback: (files: DroppedFile[]) => void): Disposable {
    const handler = (e: DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []).map(f => ({
        path: (f as any).path, // Electron provides path
        name: f.name,
        size: f.size,
        mimeType: f.type,
      }));
      if (files.length > 0) callback(files);
    };

    this.element.addEventListener('drop', handler);
    this.element.addEventListener('dragover', (e) => e.preventDefault());

    return { dispose: () => this.element.removeEventListener('drop', handler) };
  }
}
```

### Clipboard Integration

```typescript
// domain/ports/clipboard.ts
export interface ClipboardService {
  copyText(text: string): Promise<void>;
  pasteText(): Promise<string>;
  copyImage(image: ImageData): Promise<void>;
  hasText(): Promise<boolean>;
  hasImage(): Promise<boolean>;
  onClipboardChange(callback: () => void): Disposable;
}

// infrastructure/electron/electron-clipboard.service.ts
export class ElectronClipboardService implements ClipboardService {
  async copyText(text: string): Promise<void> {
    clipboard.writeText(text);
  }

  async pasteText(): Promise<string> {
    return clipboard.readText();
  }

  async copyImage(image: ImageData): Promise<void> {
    const nativeImage = nativeImage.createFromBuffer(Buffer.from(image.data));
    clipboard.writeImage(nativeImage);
  }

  async hasText(): Promise<boolean> {
    return clipboard.readText().length > 0;
  }
}
```

---

## 6. Dependency Injection for Desktop

### WPF with Microsoft.Extensions.DI

```csharp
// App.xaml.cs — Composition Root
public partial class App : Application
{
    private readonly IHost _host;

    public App()
    {
        _host = Host.CreateDefaultBuilder()
            .ConfigureServices((context, services) =>
            {
                // Infrastructure
                services.AddSingleton<AppDbContext>();
                services.AddSingleton<ISettingsStore, JsonSettingsStore>();

                // Repositories
                services.AddScoped<IDocumentRepository, SqliteDocumentRepository>();

                // Services
                services.AddSingleton<IFileStorage, LocalFileStorage>();
                services.AddSingleton<IExportService, PdfExportService>();
                services.AddSingleton<IClipboardService, WpfClipboardService>();
                services.AddSingleton<IDialogService, WpfDialogService>();

                // Use Cases
                services.AddTransient<CreateDocumentHandler>();
                services.AddTransient<SaveDocumentHandler>();
                services.AddTransient<ExportDocumentHandler>();

                // ViewModels
                services.AddTransient<MainViewModel>();
                services.AddTransient<DocumentViewModel>();
                services.AddTransient<SettingsViewModel>();

                // Views
                services.AddTransient<MainWindow>();
            })
            .Build();
    }

    protected override async void OnStartup(StartupEventArgs e)
    {
        await _host.StartAsync();
        var mainWindow = _host.Services.GetRequiredService<MainWindow>();
        mainWindow.Show();
        base.OnStartup(e);
    }

    protected override async void OnExit(ExitEventArgs e)
    {
        await _host.StopAsync();
        _host.Dispose();
        base.OnExit(e);
    }
}
```

### Electron with InversifyJS

```typescript
// main/composition-root.ts
const container = new Container();

// Infrastructure
container.bind<Database>(TYPES.Database).toDynamicValue(() => {
  return new Database(path.join(app.getPath('userData'), 'app.db'));
}).inSingletonScope();

container.bind<SettingsStore>(TYPES.SettingsStore)
  .to(ElectronStoreSettings).inSingletonScope();

container.bind<LocalFileStorage>(TYPES.FileStorage)
  .to(NodeFileStorage).inSingletonScope();

// Repositories
container.bind<DocumentRepository>(TYPES.DocumentRepository)
  .to(SqliteDocumentRepository).inSingletonScope();

// Use Cases
container.bind<CreateDocumentHandler>(TYPES.CreateDocument)
  .to(CreateDocumentHandler).inTransientScope();
container.bind<SaveDocumentHandler>(TYPES.SaveDocument)
  .to(SaveDocumentHandler).inTransientScope();

// Window Manager
container.bind<WindowManager>(TYPES.WindowManager)
  .to(ElectronWindowManager).inSingletonScope();

export { container };
```

---

## 7. Testing Strategy for Desktop

### ViewModel Unit Tests

```csharp
// Desktop.Tests/ViewModels/DocumentViewModelTests.cs
public class DocumentViewModelTests
{
    private readonly Mock<ISaveDocumentCommand> _saveCommand = new();
    private readonly Mock<IDialogService> _dialogs = new();
    private readonly Mock<IUndoRedoService> _undoRedo = new();

    [Fact]
    public async Task Save_WhenDirty_ShouldCallSaveCommand()
    {
        var vm = CreateViewModel();
        vm.Content = "new content"; // Triggers dirty

        await vm.SaveCommand.ExecuteAsync(null);

        _saveCommand.Verify(x => x.ExecuteAsync(It.Is<SaveDocumentInput>(
            input => input.Content == "new content"
        )), Times.Once);
    }

    [Fact]
    public void Content_WhenChanged_ShouldSetDirtyFlag()
    {
        var vm = CreateViewModel();
        Assert.False(vm.IsDirty);

        vm.Content = "modified";

        Assert.True(vm.IsDirty);
    }

    [Fact]
    public async Task Save_WhenSuccessful_ShouldClearDirtyFlag()
    {
        _saveCommand.Setup(x => x.ExecuteAsync(It.IsAny<SaveDocumentInput>()))
            .ReturnsAsync(SaveResult.Success);

        var vm = CreateViewModel();
        vm.Content = "new content";
        Assert.True(vm.IsDirty);

        await vm.SaveCommand.ExecuteAsync(null);

        Assert.False(vm.IsDirty);
    }

    [Fact]
    public void WindowTitle_WhenDirty_ShouldShowAsterisk()
    {
        var vm = CreateViewModel();
        vm.Title = "MyDoc";

        vm.Content = "changed";

        Assert.Equal("MyDoc* — MyApp", vm.WindowTitle);
    }

    private DocumentViewModel CreateViewModel() => new(
        _saveCommand.Object,
        new Mock<IExportDocumentCommand>().Object,
        _undoRedo.Object,
        _dialogs.Object
    );
}
```

### Use Case Tests

```typescript
// application/commands/__tests__/save-document.handler.spec.ts
describe('SaveDocumentHandler', () => {
  let handler: SaveDocumentHandler;
  let documentRepo: jest.Mocked<DocumentRepository>;

  beforeEach(() => {
    documentRepo = {
      findById: jest.fn(),
      save: jest.fn(),
      findRecent: jest.fn(),
    };
    handler = new SaveDocumentHandler(documentRepo);
  });

  it('should save document and create version', async () => {
    const doc = Document.create(DocumentId.from('doc-1'), 'Test');
    doc.updateContent('Hello world');
    documentRepo.findById.mockResolvedValue(doc);

    const result = await handler.execute({
      documentId: 'doc-1',
      title: 'Test',
      content: 'Hello world',
    });

    expect(documentRepo.save).toHaveBeenCalled();
    expect(result.versionNumber).toBe(1);
    expect(result.isDirty).toBe(false);
  });

  it('should throw when document not found', async () => {
    documentRepo.findById.mockResolvedValue(null);

    await expect(handler.execute({
      documentId: 'nonexistent',
      title: 'Test',
      content: 'Content',
    })).rejects.toThrow(DocumentNotFoundError);
  });
});
```

---

## Summary: Desktop Clean Architecture Rules

| Rule | Description |
|------|-------------|
| **Domain = pure logic** | Domain module has ZERO platform dependencies (no WPF, no Electron, no Qt) |
| **ViewModel = adapter** | ViewModels bridge use cases and UI, contain NO business logic |
| **File operations = infrastructure** | All file I/O goes through port interfaces |
| **Dialog/modal = infrastructure** | Dialogs are an external concern, abstracted behind ports |
| **Undo/redo = application** | Command pattern in application layer, not UI layer |
| **Settings = infrastructure** | OS-specific settings storage behind SettingsStore port |
| **IPC = infrastructure** | Inter-process communication is an external concern |
| **Keyboard shortcuts = presentation** | Shortcuts map to ViewModel commands, not domain logic |
| **Multi-window = infrastructure** | Window management is platform-specific, behind WindowManager port |
| **Auto-save = application** | Auto-save timer lives in application layer, uses FileStorage port |
