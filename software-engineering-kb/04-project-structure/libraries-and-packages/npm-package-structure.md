# npm Package Structure (TypeScript 2025+)

> **AI Plugin Directive:** When generating an npm package (library published to npm), ALWAYS use this structure. Apply dual ESM/CJS output with tsup, proper `exports` field with conditional exports, TypeScript declarations, and modern bundling. This guide covers TypeScript libraries built with tsup for npm publication, Vitest for testing, Changesets for versioning, and provenance for supply chain security. NEVER ship raw TypeScript. ALWAYS use the `exports` field. ALWAYS generate `.d.ts` declarations.

**Core Rule: Use the `exports` field in package.json for all entry points. Ship both ESM and CJS. Generate `.d.ts` declarations. Mark `"sideEffects": false` for tree-shaking. Use `peerDependencies` for framework deps. NEVER ship raw TypeScript -- always compile to JavaScript.**

---

## 1. Enterprise Package Structure (60+ files)

```
my-package/
├── src/                                   # Source code (TypeScript)
│   ├── index.ts                           # Main entry point (public API)
│   ├── client.ts                          # Subpath entry: @pkg/client
│   ├── server.ts                          # Subpath entry: @pkg/server
│   ├── react.ts                           # Subpath entry: @pkg/react
│   │
│   ├── core/                              # Core functionality
│   │   ├── client.ts                      # Core client class
│   │   ├── config.ts                      # Configuration types + defaults
│   │   ├── errors.ts                      # Custom error classes
│   │   ├── logger.ts                      # Logger interface
│   │   ├── types.ts                       # Core type definitions
│   │   └── constants.ts                   # Constants
│   │
│   ├── http/                              # HTTP layer
│   │   ├── fetch-client.ts                # Fetch-based HTTP client
│   │   ├── request.ts                     # Request builder
│   │   ├── response.ts                    # Response parser
│   │   ├── interceptors.ts                # Request/response interceptors
│   │   ├── retry.ts                       # Retry logic
│   │   └── types.ts                       # HTTP types
│   │
│   ├── resources/                         # API resources
│   │   ├── users.ts                       # Users resource
│   │   ├── posts.ts                       # Posts resource
│   │   ├── comments.ts                    # Comments resource
│   │   └── index.ts                       # Re-exports
│   │
│   ├── react/                             # React integration (optional)
│   │   ├── provider.tsx                   # Context provider
│   │   ├── hooks/
│   │   │   ├── use-client.ts
│   │   │   ├── use-query.ts
│   │   │   └── use-mutation.ts
│   │   ├── components/
│   │   │   └── error-boundary.tsx
│   │   └── index.ts
│   │
│   ├── utils/                             # Utility functions
│   │   ├── format.ts
│   │   ├── validate.ts
│   │   ├── retry.ts
│   │   ├── hash.ts
│   │   └── index.ts
│   │
│   └── __tests__/                         # Co-located unit tests
│       ├── core/
│       │   ├── client.test.ts
│       │   └── errors.test.ts
│       ├── http/
│       │   ├── fetch-client.test.ts
│       │   └── retry.test.ts
│       ├── resources/
│       │   ├── users.test.ts
│       │   └── posts.test.ts
│       ├── react/
│       │   └── hooks/
│       │       └── use-client.test.tsx
│       └── utils/
│           ├── format.test.ts
│           └── validate.test.ts
│
├── dist/                                  # Built output (gitignored, npm published)
│   ├── index.mjs                          # ESM main entry
│   ├── index.cjs                          # CJS main entry
│   ├── index.d.ts                         # CJS type declarations
│   ├── index.d.mts                        # ESM type declarations
│   ├── client.mjs                         # ESM subpath entry
│   ├── client.cjs                         # CJS subpath entry
│   ├── client.d.ts
│   ├── client.d.mts
│   ├── server.mjs
│   ├── server.cjs
│   ├── server.d.ts
│   ├── server.d.mts
│   ├── react.mjs
│   ├── react.cjs
│   ├── react.d.ts
│   ├── react.d.mts
│   └── chunk-*.mjs                        # Shared chunks (code splitting)
│
├── docs/                                  # Documentation source
│   ├── getting-started.md
│   ├── configuration.md
│   ├── api-reference.md
│   ├── migration-guide.md
│   └── examples/
│       ├── basic-usage.ts
│       ├── react-integration.tsx
│       └── error-handling.ts
│
├── examples/                              # Runnable examples
│   ├── basic/
│   │   ├── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── with-react/
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── .changeset/                            # Changeset config
│   └── config.json
│
├── .github/
│   └── workflows/
│       ├── ci.yml                         # Test + lint on PR
│       ├── release.yml                    # Publish on merge to main
│       └── canary.yml                     # Publish canary on push to dev
│
├── package.json                           # Package configuration
├── tsconfig.json                          # TypeScript config (type checking)
├── tsconfig.build.json                    # TypeScript config (build declarations)
├── tsup.config.ts                         # Build configuration
├── vitest.config.ts                       # Test configuration
├── eslint.config.js                       # ESLint flat config
├── .prettierrc                            # Prettier config
├── .npmrc                                 # npm config (provenance)
├── .gitignore
├── CHANGELOG.md                           # Auto-generated by Changesets
├── LICENSE
└── README.md
```

---

## 2. package.json (Complete Configuration)

```json
{
  "name": "@myorg/my-package",
  "version": "1.0.0",
  "description": "A production-grade TypeScript SDK for the Example API",
  "license": "MIT",
  "author": {
    "name": "My Org",
    "email": "oss@myorg.com",
    "url": "https://myorg.com"
  },

  "type": "module",

  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./client": {
      "import": {
        "types": "./dist/client.d.mts",
        "default": "./dist/client.mjs"
      },
      "require": {
        "types": "./dist/client.d.ts",
        "default": "./dist/client.cjs"
      }
    },
    "./server": {
      "import": {
        "types": "./dist/server.d.mts",
        "default": "./dist/server.mjs"
      },
      "require": {
        "types": "./dist/server.d.ts",
        "default": "./dist/server.cjs"
      }
    },
    "./react": {
      "import": {
        "types": "./dist/react.d.mts",
        "default": "./dist/react.mjs"
      },
      "require": {
        "types": "./dist/react.d.ts",
        "default": "./dist/react.cjs"
      }
    },
    "./package.json": "./package.json"
  },

  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",

  "files": [
    "dist",
    "README.md",
    "LICENSE",
    "CHANGELOG.md"
  ],

  "sideEffects": false,

  "engines": {
    "node": ">=18"
  },

  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx}\"",
    "typecheck": "tsc --noEmit",
    "typecheck:build": "tsc -p tsconfig.build.json --noEmit",
    "prepublishOnly": "npm run build",
    "prerelease": "npm run lint && npm run typecheck && npm run test:run && npm run build",
    "release": "changeset publish",
    "release:canary": "changeset publish --tag canary",
    "version": "changeset version",
    "docs": "typedoc --out docs-site src/index.ts",
    "size": "size-limit",
    "clean": "rm -rf dist",
    "pack:check": "npm pack --dry-run",
    "attw": "attw --pack .",
    "publint": "publint"
  },

  "keywords": [
    "typescript",
    "sdk",
    "api-client",
    "react"
  ],

  "repository": {
    "type": "git",
    "url": "https://github.com/myorg/my-package"
  },

  "bugs": {
    "url": "https://github.com/myorg/my-package/issues"
  },

  "homepage": "https://github.com/myorg/my-package#readme",

  "publishConfig": {
    "access": "public",
    "provenance": true,
    "registry": "https://registry.npmjs.org"
  },

  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },

  "peerDependenciesMeta": {
    "react": {
      "optional": true
    },
    "react-dom": {
      "optional": true
    }
  },

  "dependencies": {},

  "devDependencies": {
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@vitest/coverage-v8": "^2.1.0",
    "eslint": "^9.14.0",
    "@eslint/js": "^9.14.0",
    "typescript-eslint": "^8.14.0",
    "prettier": "^3.4.0",
    "@changesets/cli": "^2.27.0",
    "@changesets/changelog-github": "^0.5.0",
    "typedoc": "^0.26.0",
    "size-limit": "^11.0.0",
    "@size-limit/preset-small-lib": "^11.0.0",
    "@arethetypeswrong/cli": "^0.17.0",
    "publint": "^0.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@types/react": "^18.3.0",
    "@testing-library/react": "^16.0.0",
    "happy-dom": "^15.0.0"
  },

  "size-limit": [
    {
      "path": "dist/index.mjs",
      "limit": "10 KB"
    },
    {
      "path": "dist/react.mjs",
      "limit": "5 KB"
    }
  ]
}
```

---

## 3. exports Field Deep Dive

### 3.1 Conditional Exports

```
EXPORTS RESOLUTION ORDER (Node.js + bundlers):

1. "types"   -> TypeScript declaration file (.d.ts / .d.mts)
2. "import"  -> ESM consumers (import from "@myorg/pkg")
3. "require" -> CJS consumers (const pkg = require("@myorg/pkg"))
4. "default" -> Fallback (should always be present)

RULE: "types" MUST come FIRST in each condition block.
      TypeScript resolves conditions top-to-bottom.

SUBPATH EXPORTS:
"./client" -> import { Client } from "@myorg/pkg/client"
"./server" -> import { Server } from "@myorg/pkg/server"
"./react"  -> import { Provider } from "@myorg/pkg/react"

WILDCARD EXPORTS (for many subpaths):
"./*": {
  "import": {
    "types": "./dist/*.d.mts",
    "default": "./dist/*.mjs"
  },
  "require": {
    "types": "./dist/*.d.ts",
    "default": "./dist/*.cjs"
  }
}

RESTRICTING INTERNAL IMPORTS:
When you define "exports", ONLY listed paths are importable.
import { internal } from "@myorg/pkg/core/internal" -> ERROR
This prevents consumers from depending on internal APIs.
```

### 3.2 Package.json Exports vs Legacy Fields

```
FIELD PRIORITY (modern tooling):

1. "exports"  -> Used by Node.js 12.7+, modern bundlers (Vite, esbuild, webpack 5+)
2. "module"   -> Used by legacy bundlers (webpack 4, Rollup) for ESM
3. "main"     -> Used by Node.js <12.7, legacy require()
4. "types"    -> Used by TypeScript when "exports" has no "types" condition

RECOMMENDATION: Always include ALL four fields for maximum compatibility.
"exports" is authoritative; "main"/"module"/"types" are fallbacks.
```

### 3.3 Advanced Conditional Exports

```json
{
  "exports": {
    ".": {
      "node": {
        "import": {
          "types": "./dist/index.d.mts",
          "default": "./dist/index.node.mjs"
        },
        "require": {
          "types": "./dist/index.d.ts",
          "default": "./dist/index.node.cjs"
        }
      },
      "browser": {
        "import": {
          "types": "./dist/index.d.mts",
          "default": "./dist/index.browser.mjs"
        }
      },
      "react-native": {
        "import": {
          "types": "./dist/index.d.mts",
          "default": "./dist/index.rn.mjs"
        }
      },
      "edge-light": {
        "import": {
          "types": "./dist/index.d.mts",
          "default": "./dist/index.edge.mjs"
        }
      },
      "worker": {
        "import": {
          "types": "./dist/index.d.mts",
          "default": "./dist/index.worker.mjs"
        }
      },
      "default": {
        "import": {
          "types": "./dist/index.d.mts",
          "default": "./dist/index.mjs"
        },
        "require": {
          "types": "./dist/index.d.ts",
          "default": "./dist/index.cjs"
        }
      }
    }
  }
}
```

```
CONDITION NAMES AND RESOLUTION:

Standard conditions (Node.js built-in):
  "node"       -> Node.js runtime
  "import"     -> ESM import
  "require"    -> CJS require
  "default"    -> Universal fallback (MUST be last)
  "types"      -> TypeScript declarations (MUST be first)

Community conditions (recognized by bundlers):
  "browser"      -> Browser bundlers (webpack, Vite, esbuild)
  "react-native" -> React Native bundler (Metro)
  "edge-light"   -> Edge runtimes (Vercel Edge, Cloudflare Workers)
  "worker"       -> Web Worker / Service Worker
  "deno"         -> Deno runtime
  "bun"          -> Bun runtime
  "production"   -> NODE_ENV=production (webpack)
  "development"  -> NODE_ENV=development (webpack)
  "react-server" -> React Server Components (Next.js)

RESOLUTION ORDER: First match wins.
Conditions are tested left-to-right, top-to-bottom.
"default" must always be the LAST condition.
```

### 3.4 imports Field (Package Private Imports)

```json
{
  "imports": {
    "#internal/*": {
      "import": "./src/internal/*.mjs",
      "require": "./src/internal/*.cjs"
    },
    "#polyfills/*": {
      "node": "./polyfills/node/*.mjs",
      "browser": "./polyfills/browser/*.mjs"
    }
  }
}
```

```
The "imports" field enables package-private import specifiers:
- Prefix: MUST start with "#"
- Only usable WITHIN the package itself
- Allows platform-specific internal implementations
- Used by libraries like undici, got, node-fetch
```

---

## 4. Build Configuration

### 4.1 tsup (Recommended)

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  // Entry points (each becomes a separate output)
  entry: {
    index: "src/index.ts",
    client: "src/client.ts",
    server: "src/server.ts",
    react: "src/react.ts",
  },

  // Output formats
  format: ["esm", "cjs"],

  // Generate .d.ts and .d.mts declaration files
  dts: true,

  // Code splitting for shared chunks between entry points
  splitting: true,

  // Source maps for debugging
  sourcemap: true,

  // Clean dist/ before building
  clean: true,

  // Tree-shaking for smaller output
  treeshake: true,

  // Do NOT bundle these (consumer provides them)
  external: ["react", "react-dom"],

  // Do NOT minify (let consumer's bundler handle it)
  minify: false,

  // Target environment
  target: "es2022",

  // Banner for ESM/CJS interop (if needed)
  // banner: { js: '"use client";' }, // For React Server Components

  // Output file naming
  outExtension({ format }) {
    return {
      js: format === "esm" ? ".mjs" : ".cjs",
    };
  },

  // Environment variables to inline
  define: {
    "process.env.PKG_VERSION": JSON.stringify(
      require("./package.json").version
    ),
  },

  // esbuild options
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
});
```

### 4.2 unbuild (Alternative)

```typescript
// build.config.ts (using unbuild)
import { defineBuildConfig } from "unbuild";

export default defineBuildConfig({
  entries: [
    "src/index",
    "src/client",
    "src/server",
    "src/react",
  ],
  declaration: true,
  clean: true,
  rollup: {
    emitCJS: true,
    esbuild: {
      target: "es2022",
    },
  },
  externals: ["react", "react-dom"],
});
```

### 4.3 Bundler Comparison

| Feature | tsup | unbuild | Rollup | esbuild (direct) | rolldown |
|---------|------|---------|--------|-------------------|----------|
| Config simplicity | Excellent | Excellent | Verbose | Minimal | Good |
| TypeScript DTS | Built-in | Built-in | Plugin required | Plugin required | Planned |
| Dual ESM/CJS | Built-in | Built-in | Config required | Config required | Built-in |
| Code splitting | Yes | Yes | Yes | Limited | Yes |
| Tree-shaking | esbuild-based | Rollup-based | Excellent | Good | Excellent |
| Build speed | Very fast | Fast | Slow | Fastest | Very fast |
| CSS support | Yes | Limited | Plugin | Limited | Yes |
| Watch mode | Yes | Yes | Yes | Yes | Yes |
| Rollup plugin compat | No | Yes | Native | No | Yes |
| Best for | Most packages | Nuxt ecosystem | Complex bundles | Speed-critical | Future default |
| Recommendation | **Default choice** | Good alternative | Complex libs | Extreme speed | Watch (Vite 7+) |

### 4.4 tsup Advanced Configuration Patterns

```typescript
// tsup.config.ts -- Multi-platform library
import { defineConfig } from "tsup";

export default defineConfig([
  // Main bundle
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    target: "es2022",
    outExtension: ({ format }) => ({
      js: format === "esm" ? ".mjs" : ".cjs",
    }),
  },
  // Browser-specific bundle (no Node.js APIs)
  {
    entry: { "index.browser": "src/index.browser.ts" },
    format: ["esm"],
    dts: true,
    platform: "browser",
    target: ["chrome91", "firefox90", "safari15", "edge91"],
    outExtension: () => ({ js: ".mjs" }),
    esbuildOptions(options) {
      options.conditions = ["browser"];
    },
  },
  // React Server Components bundle
  {
    entry: { "react-server": "src/react-server.ts" },
    format: ["esm"],
    dts: true,
    banner: { js: '"use server";' },
    external: ["react", "react-dom", "react/jsx-runtime"],
    outExtension: () => ({ js: ".mjs" }),
  },
]);
```

---

## 5. TypeScript Configuration

```json
// tsconfig.json (type checking and IDE support)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": false,
    "forceConsistentCasingInFileNames": true,

    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,

    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,

    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "dist", "**/*.test.ts", "**/*.test.tsx"]
}
```

```json
// tsconfig.build.json (for declaration-only builds if needed)
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "declaration": true,
    "emitDeclarationOnly": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**"]
}
```

### 5.1 moduleResolution Explained

```
moduleResolution options for libraries:

"bundler"
  - Best for: Libraries bundled with tsup/unbuild/rollup
  - Resolves: package.json "exports" field
  - Supports: conditional exports, subpath imports
  - RECOMMENDED for new libraries

"node16" / "nodenext"
  - Best for: Libraries consumed directly by Node.js (no bundler)
  - REQUIRES file extensions in imports: import { foo } from "./foo.js"
  - Resolves: package.json "exports" field
  - Use when: Publishing a CLI tool or Node.js-only package

"node"
  - LEGACY: Do NOT use for new projects
  - Does NOT resolve "exports" field
  - Only resolves "main" and "types"

RECOMMENDATION:
  Library bundled by tsup    -> "bundler"
  Node.js CLI tool           -> "nodenext"
  Library consumed by Node   -> "node16"
```

---

## 6. Testing (Vitest)

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",            // For React testing
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/**/types.ts",
        "src/**/index.ts",               // Re-exports only
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    setupFiles: ["./src/__tests__/setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});


// src/__tests__/setup.ts
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Auto-cleanup React renders after each test
afterEach(() => {
  cleanup();
});
```

### 6.1 Unit Test Examples

```typescript
// src/__tests__/core/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Client } from "@/core/client";
import { ClientError, NetworkError } from "@/core/errors";

describe("Client", () => {
  let client: Client;

  beforeEach(() => {
    client = new Client({
      apiKey: "test-key",
      baseUrl: "https://api.example.com",
    });
  });

  it("creates client with default config", () => {
    const c = new Client({ apiKey: "key" });
    expect(c.config.baseUrl).toBe("https://api.example.com");
    expect(c.config.timeout).toBe(30_000);
  });

  it("throws on missing API key", () => {
    expect(() => new Client({ apiKey: "" })).toThrow(ClientError);
  });

  it("attaches auth header to requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await client.users.get("1");

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      })
    );
  });

  it("retries on 5xx errors", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const result = await client.users.get("1");
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.id).toBe("1");
  });

  it("throws NetworkError after max retries", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(client.users.get("1")).rejects.toThrow(NetworkError);
  });
});


// src/__tests__/react/hooks/use-client.test.tsx
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useClient } from "@/react/hooks/use-client";
import { ClientProvider } from "@/react/provider";
import { Client } from "@/core/client";
import type { ReactNode } from "react";

const client = new Client({ apiKey: "test" });

function wrapper({ children }: { children: ReactNode }) {
  return <ClientProvider client={client}>{children}</ClientProvider>;
}

describe("useClient", () => {
  it("returns client from context", () => {
    const { result } = renderHook(() => useClient(), { wrapper });
    expect(result.current).toBe(client);
  });

  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useClient());
    }).toThrow("useClient must be used within a ClientProvider");
  });
});
```

---

## 7. Documentation Generation (TypeDoc)

```json
// typedoc.json
{
  "entryPoints": ["src/index.ts", "src/client.ts", "src/server.ts", "src/react.ts"],
  "out": "docs-site",
  "plugin": ["typedoc-plugin-markdown"],
  "readme": "README.md",
  "excludePrivate": true,
  "excludeProtected": true,
  "excludeInternal": true,
  "categoryOrder": ["Core", "HTTP", "Resources", "React", "Utilities"],
  "navigationLinks": {
    "GitHub": "https://github.com/myorg/my-package",
    "npm": "https://www.npmjs.com/package/@myorg/my-package"
  }
}
```

---

## 8. Semantic Versioning with Changesets

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "myorg/my-package" }],
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

```
CHANGESET WORKFLOW:

1. Developer makes changes:
   $ npx changeset
   -> Select affected packages
   -> Choose bump type (major/minor/patch)
   -> Write change description

2. Changeset file created:
   .changeset/fuzzy-bees-dance.md
   ---
   "@myorg/my-package": minor
   ---
   Added retry logic to HTTP client with configurable max attempts.

3. PR merged to main

4. Changesets bot creates "Version Packages" PR:
   -> Updates version in package.json
   -> Updates CHANGELOG.md
   -> Collects all changeset descriptions

5. Merge version PR -> triggers publish:
   $ npm run release
   -> changeset publish
   -> Publishes to npm with provenance

VERSIONING RULES:
  MAJOR: Breaking API changes (removed methods, changed signatures)
  MINOR: New features (added methods, new options)
  PATCH: Bug fixes, internal refactors, docs

CHANGESET CLI COMMANDS:
  npx changeset                    # Interactive: create a new changeset
  npx changeset add               # Same as above
  npx changeset version           # Consume changesets, bump versions, update changelogs
  npx changeset publish           # Publish changed packages to npm
  npx changeset status            # Show pending changesets
  npx changeset pre enter beta    # Enter pre-release mode
  npx changeset pre exit          # Exit pre-release mode
  npx changeset tag               # Create git tags for published versions
```

### 8.1 Changeset for Monorepo with Linked Versions

```json
// .changeset/config.json (monorepo)
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": ["@changesets/changelog-github", { "repo": "myorg/platform" }],
  "commit": false,
  "fixed": [],
  "linked": [
    ["@myorg/core", "@myorg/react", "@myorg/vue"]
  ],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": ["@myorg/docs", "@myorg/playground"],
  "snapshot": {
    "useCalculatedVersion": true,
    "prereleaseTemplate": "{tag}-{datetime}-{commit}"
  }
}
```

```
MONOREPO CHANGESET STRATEGIES:

"fixed": [["@myorg/core", "@myorg/react"]]
  -> All packages in group ALWAYS have the SAME version
  -> One bump affects all packages in group
  -> Example: @myorg/core@2.1.0 and @myorg/react@2.1.0

"linked": [["@myorg/core", "@myorg/react"]]
  -> Packages CAN have different versions
  -> But when one bumps major, all linked packages bump major too
  -> Example: @myorg/core@2.0.0 (changed) and @myorg/react@2.0.0 (linked bump)
  -> Use for: packages that have implicit compatibility assumptions

No grouping:
  -> Each package versions independently
  -> Default and RECOMMENDED for most cases
```

---

## 9. npm Publishing Workflow

### 9.1 GitHub Actions CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: "npm"

      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test:run
      - run: npm run build

      - name: Check bundle size
        run: npx size-limit

      - name: Verify package exports
        run: npx attw --pack .

      - name: Lint package.json
        run: npx publint
```

### 9.2 Release Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}

permissions:
  contents: write
  pull-requests: write
  id-token: write    # Required for npm provenance

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
          registry-url: "https://registry.npmjs.org"

      - run: npm ci
      - run: npm run build

      - name: Create Release Pull Request or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: npm run release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 9.3 Canary Releases

```yaml
# .github/workflows/canary.yml
name: Canary Release

on:
  push:
    branches: [dev]

permissions:
  id-token: write

jobs:
  canary:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: "https://registry.npmjs.org"

      - run: npm ci
      - run: npm run build

      - name: Publish canary
        run: |
          npx changeset version --snapshot canary
          npx changeset publish --tag canary
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 10. npm Provenance

```
PROVENANCE (Supply Chain Security):

What: Cryptographically signed proof that a package was built from
      a specific Git commit via a specific CI pipeline.

Why:  Prevents supply chain attacks where npm tokens are stolen
      and malicious packages are published.

How:  npm publish --provenance (or publishConfig.provenance: true)

Requirements:
  - Package published from GitHub Actions (or GitLab CI, etc.)
  - id-token: write permission in workflow
  - publishConfig.provenance: true in package.json
  - Uses the official npm registry

Verification:
$ npm audit signatures
$ npm view @myorg/my-package --json | jq '.dist.attestations'

Users see a "Provenance" badge on npm package page.

SIGSTORE INTEGRATION:
  Provenance uses Sigstore for keyless signing.
  The OIDC token from the CI provider proves build origin.
  No need to manage signing keys.
  Attestation stored on Rekor transparency log.
```

---

## 11. Monorepo Package Publishing

```
MONOREPO STRUCTURE (pnpm + Changesets):

my-monorepo/
├── packages/
│   ├── core/              # @myorg/core
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsup.config.ts
│   │
│   ├── react/             # @myorg/react (depends on @myorg/core)
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsup.config.ts
│   │
│   └── utils/             # @myorg/utils
│       ├── src/
│       ├── package.json
│       └── tsup.config.ts
│
├── apps/                  # Not published
│   ├── docs/
│   └── playground/
│
├── .changeset/
│   └── config.json
├── pnpm-workspace.yaml
├── turbo.json
└── package.json

CHANGESET CONFIG FOR MONOREPO:
{
  "fixed": [],
  "linked": [["@myorg/core", "@myorg/react"]],  // Version together
  "access": "public",
  "baseBranch": "main"
}

WORKSPACE PROTOCOL:
// packages/react/package.json
{
  "dependencies": {
    "@myorg/core": "workspace:^"    // Resolved at publish time
  }
}

pnpm-workspace.yaml:
packages:
  - "packages/*"
  - "apps/*"

TURBO CONFIG:
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],      // Build deps first
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {}
  }
}
```

### 11.1 Workspace Protocol Resolution

```
When publishing with pnpm or Changesets:

"workspace:*"   -> resolves to exact version: "1.2.3"
"workspace:^"   -> resolves to caret range:   "^1.2.3"
"workspace:~"   -> resolves to tilde range:   "~1.2.3"
"workspace:^1"  -> keeps as-is:               "^1"

IMPORTANT: workspace: protocol is ONLY valid inside the monorepo.
pnpm publish / changeset publish automatically resolves these
to real version numbers before publishing to npm.
```

---

## 12. Code Examples

### 12.1 Source Code Structure

```typescript
// src/index.ts -- Main public API
export { Client } from "./core/client";
export { ClientError, NetworkError, ValidationError } from "./core/errors";
export type { ClientConfig, ClientOptions } from "./core/config";
export type { User, Post, Comment } from "./resources";

// Re-export utils that consumers might need
export { formatDate, formatCurrency } from "./utils";


// src/client.ts -- Subpath entry for @myorg/pkg/client
export { Client } from "./core/client";
export type { ClientConfig, ClientOptions } from "./core/config";


// src/react.ts -- Subpath entry for @myorg/pkg/react
export { ClientProvider } from "./react/provider";
export { useClient } from "./react/hooks/use-client";
export { useQuery } from "./react/hooks/use-query";
export { useMutation } from "./react/hooks/use-mutation";
export { ErrorBoundary } from "./react/components/error-boundary";


// src/core/client.ts
import type { ClientConfig } from "./config";
import { ClientError } from "./errors";
import { FetchClient } from "../http/fetch-client";
import { UsersResource } from "../resources/users";
import { PostsResource } from "../resources/posts";

export class Client {
  readonly config: Required<ClientConfig>;
  readonly users: UsersResource;
  readonly posts: PostsResource;

  private readonly http: FetchClient;

  constructor(config: ClientConfig) {
    if (!config.apiKey) {
      throw new ClientError("API key is required");
    }

    this.config = {
      baseUrl: config.baseUrl ?? "https://api.example.com",
      apiKey: config.apiKey,
      timeout: config.timeout ?? 30_000,
      maxRetries: config.maxRetries ?? 3,
    };

    this.http = new FetchClient(this.config);
    this.users = new UsersResource(this.http);
    this.posts = new PostsResource(this.http);
  }
}


// src/core/errors.ts
export class ClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientError";
  }
}

export class NetworkError extends ClientError {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "NetworkError";
    this.statusCode = statusCode;
  }
}

export class ValidationError extends ClientError {
  readonly field: string;

  constructor(field: string, message: string) {
    super(`Validation error on '${field}': ${message}`);
    this.name = "ValidationError";
    this.field = field;
  }
}
```

---

## 13. ESM/CJS Compatibility Checklist

```
DUAL FORMAT CHECKLIST:

[ ] "type": "module" in package.json (ESM by default)
[ ] .mjs extension for ESM output
[ ] .cjs extension for CJS output
[ ] .d.mts for ESM declarations
[ ] .d.ts for CJS declarations (also serves as fallback)
[ ] No __dirname or __filename (ESM doesn't have these)
    Use: import.meta.url + new URL() instead
[ ] No require() in source code (use import)
[ ] Dynamic import() for conditional loading
[ ] No .js extension in import paths (let tsup resolve)
[ ] "exports" field defines all entry points
[ ] "main" field as CJS fallback
[ ] "module" field as ESM fallback for legacy bundlers

COMMON CJS/ESM PITFALLS:
  Using require() in ESM files       -> Use import
  Using __dirname in ESM             -> Use import.meta.url
  Missing file extensions in exports -> Specify .mjs/.cjs
  Forgetting "types" condition       -> TS can't resolve
  "types" not FIRST in condition     -> TS reads top-to-bottom
  Shipping only ESM                  -> Breaks older Node.js/CJS consumers
  JSON imports without assertion     -> Use: import pkg from "./pkg.json" with { type: "json" }
```

---

## 14. npm pack Verification

```
PRE-PUBLISH VERIFICATION COMMANDS:

1. npm pack --dry-run
   Shows what files will be included in the tarball.
   Verify: only dist/, README.md, LICENSE, CHANGELOG.md are included.
   Red flag: src/, tests/, .env, node_modules/ appearing here.

2. npm pack
   Creates the actual .tgz file. Inspect contents:
   $ tar -tzf myorg-my-package-1.0.0.tgz

3. npx publint
   Checks package.json for common publishing mistakes:
   - Missing "exports" field
   - Wrong file paths in "main"/"module"/"types"
   - "types" not first in conditional exports
   - Files referenced but not in "files" field

4. npx @arethetypeswrong/cli --pack .  (attw)
   Checks that TypeScript types resolve correctly for ALL
   resolution modes:
   - node10 (legacy require)
   - node16-cjs (Node 16+ CJS)
   - node16-esm (Node 16+ ESM)
   - bundler (Vite, webpack 5+)
   Red flag: "FalseESM", "FalseCJS", "Missing" resolution

5. npx size-limit
   Checks bundle size against configured limits.
   Fails CI if package exceeds size budget.

6. Test the built package locally:
   $ npm pack
   $ cd /tmp/test-project
   $ npm init -y
   $ npm install ../path/to/myorg-my-package-1.0.0.tgz
   $ node -e "import('@myorg/my-package').then(m => console.log(Object.keys(m)))"

RECOMMENDED CI PIPELINE ORDER:
  lint -> typecheck -> test -> build -> publint -> attw -> size-limit -> pack --dry-run
```

---

## 15. .npmignore vs files Field

```
TWO APPROACHES (use "files" field, NEVER .npmignore):

"files" field (ALLOWLIST -- RECOMMENDED):
{
  "files": ["dist", "README.md", "LICENSE", "CHANGELOG.md"]
}
  Only listed paths are included in the npm tarball.
  Everything else is excluded automatically.
  package.json is ALWAYS included (cannot be excluded).

.npmignore (DENYLIST -- NOT RECOMMENDED):
  Similar to .gitignore: lists files to EXCLUDE.
  Everything not listed is included.
  Easy to accidentally publish sensitive files.
  If .npmignore exists, .gitignore is NOT used for npm.

WHY "files" IS BETTER:
  New files are excluded by default (safe).
  With .npmignore, new files are INCLUDED by default (dangerous).
  Cannot accidentally publish .env, secrets, test fixtures.

ALWAYS INCLUDED (regardless of "files"):
  package.json
  README (any case/extension)
  LICENSE (any case/extension)
  CHANGELOG (any case/extension)

ALWAYS EXCLUDED (regardless of settings):
  .git/
  node_modules/
  .npmrc (with secrets)
  package-lock.json (unless explicitly listed)
```

---

## 16. Scoped Packages

```
SCOPED PACKAGE NAMING: @scope/package-name

Organization scopes:
  @vercel/analytics
  @stripe/stripe-js
  @aws-sdk/client-s3
  @tanstack/react-query

Setup:
  1. npm login --scope=@myorg
  2. In package.json: "name": "@myorg/my-package"
  3. For public: "publishConfig": { "access": "public" }
     Scoped packages are PRIVATE by default on npm.

Private registries:
  // .npmrc
  @myorg:registry=https://npm.pkg.github.com
  //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}

  // Or for Artifactory/Verdaccio:
  @myorg:registry=https://registry.myorg.com

Publishing:
  $ npm publish                    # Private (default for scoped)
  $ npm publish --access public    # Public
  $ npm publish --tag beta         # Tagged release

NAMING CONVENTIONS:
  @myorg/core          # Core package
  @myorg/react         # Framework-specific
  @myorg/cli           # CLI tool
  @myorg/types         # Type-only package
  @myorg/eslint-config # Shared ESLint config
  @myorg/tsconfig      # Shared TSConfig
```

---

## 17. Tree-Shaking and Side Effects

```
TREE-SHAKING: Bundlers remove unused exports from the final bundle.

Requirements for tree-shakeable packages:
1. "sideEffects": false in package.json
2. ESM output (import/export syntax)
3. No module-level side effects in source code
4. Named exports (not default exports of objects)

"sideEffects" field:
  false                         -> No side effects, fully tree-shakeable
  true                          -> Has side effects, cannot tree-shake
  ["./dist/styles.css"]         -> Only these files have side effects
  ["**/*.css", "./dist/init.js"] -> Glob patterns supported

WHAT IS A SIDE EFFECT?
  Code that runs at module import time and affects global state.

  SIDE EFFECT (prevents tree-shaking):
    // This runs when imported, even if nothing is used
    window.myGlobal = {};
    Array.prototype.myMethod = function() {};
    import "./polyfill.js";  // polyfills run immediately
    CSS imports: import "./styles.css";

  NOT A SIDE EFFECT (tree-shakeable):
    export function add(a, b) { return a + b; }
    export class Client { ... }
    export const DEFAULT_TIMEOUT = 5000;

BARREL FILE IMPACT ON TREE-SHAKING:
  // src/index.ts (barrel file)
  export * from "./utils";    // Exports EVERYTHING from utils
  export * from "./client";
  export * from "./react";

  PROBLEM: If consumer imports only { Client }, bundler may still
  include code from utils and react due to potential side effects.

  FIX: Use subpath exports:
  import { Client } from "@myorg/pkg/client"  // Only client code
  import { useQuery } from "@myorg/pkg/react"  // Only react code

  Or use explicit named re-exports:
  export { Client } from "./client";  // Only Client is accessible
  export { useQuery } from "./react";
```

---

## 18. Anti-Patterns

| Anti-Pattern | Symptom | Impact | Fix |
|-------------|---------|--------|-----|
| No `exports` field | Consumers import from internal paths | Breaking changes when refactoring internals | Define `exports` with all public entry points |
| Shipping raw TypeScript | `"main": "src/index.ts"` | Consumers need matching TS config | Build to JS + generate `.d.ts` declarations |
| Bundling React/Vue | Framework included in output | Duplicate framework in consumer's bundle, bugs | Use `peerDependencies` + `external` in bundler |
| No `sideEffects: false` | Bundlers can't tree-shake unused exports | Larger consumer bundles | Add `"sideEffects": false` to package.json |
| Missing type declarations | No `.d.ts` files in dist | Consumers get `any` types, no IntelliSense | Enable `dts: true` in tsup config |
| Publishing `node_modules` | Huge package size on npm | Slow installs, wasted bandwidth | Use `"files"` field to whitelist dist/ only |
| No `prepublishOnly` | Publishing stale/missing dist/ | Consumers get broken package | Add `"prepublishOnly": "npm run build"` |
| Version pinning in library | `"react": "18.2.0"` in dependencies | Conflicts with consumer's React version | Use `peerDependencies` with ranges: `">=18"` |
| No provenance | Package unsigned | Supply chain attack vector | Enable `publishConfig.provenance: true` |
| Barrel file re-export everything | `export * from "./internal"` | Larger bundles, broken tree-shaking | Explicit named exports in index.ts |
| No size budget | Bundle grows unchecked | Consumers' apps bloat | Use size-limit with CI checks |
| CJS-only output | ESM consumers can't tree-shake | Larger bundles for modern apps | Ship dual ESM + CJS |
| Mutable default export | `export default { config }` | Singleton mutation bugs | Export factory functions or classes |
| No changelog | Users don't know what changed | Upgrade anxiety, support burden | Use Changesets for auto-generated CHANGELOG |
| Testing against source, not dist | Tests pass but published package broken | "Works on my machine" | Test the built artifacts in CI |
| No attw / publint check | Types resolve in dev but break for consumers | TypeScript errors in consuming projects | Add `npx attw --pack .` and `npx publint` to CI |
| .npmignore instead of files | Accidentally publish secrets, tests, configs | Security risk, bloated package | Use `"files"` allowlist field |
| Using `"type": "commonjs"` | ESM requires `.mjs` extension | Confusing to consumers | Use `"type": "module"` + explicit extensions |
| No `engines` field | Package used on unsupported Node.js | Runtime errors, unhelpful bug reports | Set `"engines": { "node": ">=18" }` |
| `postinstall` scripts | Security risk, slow installs, breaks CI | npm audit warnings, corporate policy blocks | Build before publish, never on install |

---

## 19. Real-World Examples

```
NOTABLE OPEN SOURCE PACKAGES AND THEIR PATTERNS:

@tanstack/react-query (TanStack):
  - Monorepo with pnpm workspaces
  - tsup for building, Vitest for testing
  - Changesets for versioning
  - Multiple subpath exports: /core, /react, /vue, /svelte
  - Framework adapters as separate packages

zod:
  - Single package, dual ESM/CJS
  - rollup for building
  - Subpath exports: zod, zod/locales
  - "sideEffects": false
  - TypeScript-first design

tRPC:
  - Monorepo with pnpm + turborepo
  - Multiple packages: @trpc/server, @trpc/client, @trpc/react-query
  - tsup for building
  - Changesets for versioning
  - Extensive conditional exports

@vercel/analytics:
  - tsup build
  - Framework-specific subpath exports
  - "react-server" condition for RSC
  - Provenance enabled

openai (OpenAI Node SDK):
  - stainless-api generated SDK
  - Dual ESM/CJS with shims
  - Multiple subpath exports per resource
  - Streaming support via subpath
  - "node" and "browser" conditions

stripe:
  - CJS and ESM dual output
  - TypeScript declarations included
  - Extensive subpath exports for resource types
  - Webhook signature verification

@aws-sdk/* (AWS SDK v3):
  - One package per service (400+ packages)
  - smithy-typescript generated
  - Middleware stack architecture
  - TypeScript-first
  - Tree-shakeable individual service clients
```

---

## 20. Prepublish Scripts & Lifecycle

```
npm LIFECYCLE SCRIPTS (execution order):

$ npm publish:
  1. prepublishOnly      -> Runs ONLY before npm publish
  2. prepack             -> Runs before npm pack AND npm publish
  3. (creates tarball)
  4. postpack            -> Runs after tarball created
  5. publish             -> Runs after package is published
  6. postpublish         -> Runs after publish

RECOMMENDED CONFIGURATION:
{
  "scripts": {
    "prepublishOnly": "npm run build",
    "prepack": "npm run build",
    "postpack": "echo 'Package created successfully'"
  }
}

AVOID "prepare":
  "prepare" runs on npm install too (for git dependencies).
  This causes issues when consumers install from GitHub.
  Use "prepublishOnly" instead.

AVOID "postinstall":
  Runs in consumer's project after npm install.
  Security risk: arbitrary code execution.
  Breaks CI environments with restricted network.
  Corporate security policies often block postinstall scripts.
  Exception: native addons (node-gyp) that need compilation.
```

---

## 21. ESLint Flat Config for Libraries

```javascript
// eslint.config.js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      // Library-specific rules
      "no-console": "error",              // Use logger instead
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": ["error", {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      }],
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
      }],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
  {
    ignores: ["dist/", "node_modules/", "coverage/", "*.config.*"],
  },
);
```

---

## 22. .npmrc Configuration

```ini
# .npmrc (committed to repo -- NO secrets)

# Enable provenance for SLSA supply chain security
provenance=true

# Use exact versions in package-lock.json
save-exact=true

# Set engine-strict to enforce engines field
engine-strict=true

# Monorepo: hoist node_modules to root (pnpm)
# shamefully-hoist=true  # Only if needed for compatibility

# Scoped registry for private packages
@myorg:registry=https://npm.pkg.github.com

# Legacy peer deps resolution (avoid if possible)
# legacy-peer-deps=true
```

---

## 23. Version Compatibility Matrix

```
NODE.JS VERSION SUPPORT MATRIX:

Node.js Version | ESM "exports" | "type": "module" | import.meta | Status
14.x            | Partial       | Yes              | Yes         | EOL Apr 2023
16.x            | Yes           | Yes              | Yes         | EOL Sep 2023
18.x            | Yes           | Yes              | Yes         | Maintenance LTS
20.x            | Yes           | Yes              | Yes         | Active LTS
22.x            | Yes           | Yes              | Yes         | Current

RECOMMENDATION: Target Node.js >= 18 (LTS baseline)

TYPESCRIPT VERSION COMPATIBILITY:

TypeScript | "exports" in package.json | "moduleResolution": "bundler" | verbatimModuleSyntax
4.7+       | Yes (node16/nodenext)     | No                             | No
5.0+       | Yes                       | Yes                            | Yes
5.5+       | Yes                       | Yes (improved)                 | Yes

RECOMMENDATION: Require TypeScript >= 5.0 for library consumers.
Set { "moduleResolution": "bundler" } in library's tsconfig.

BUNDLER SUPPORT FOR "exports":

Bundler        | "exports" support | Condition matching | Status
webpack 5+     | Full              | Full               | Stable
Vite 3+        | Full              | Full               | Stable
esbuild 0.14+  | Full              | Full               | Stable
Rollup 3+      | Full              | Full               | Stable
Parcel 2+      | Full              | Partial            | Stable
webpack 4      | None              | None               | Legacy (use "module" fallback)
Metro (RN)     | Partial           | "react-native"     | Improving
```

---

## 24. Enforcement Checklist

- [ ] `"type": "module"` in package.json
- [ ] `exports` field defines ALL public entry points with types, ESM, CJS conditions
- [ ] `types` condition listed FIRST in every exports block
- [ ] Dual format output -- both `.mjs` (ESM) and `.cjs` (CJS)
- [ ] Type declarations generated -- `.d.ts` and `.d.mts` for every entry point
- [ ] `"sideEffects": false` for tree-shaking
- [ ] `"files"` field whitelists only `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md`
- [ ] `peerDependencies` for framework dependencies (React, Vue, etc.)
- [ ] `peerDependenciesMeta` marks optional peer deps
- [ ] `"engines": { "node": ">=18" }` set to minimum supported version
- [ ] `prepublishOnly` script runs full build
- [ ] Changesets configured for semantic versioning and changelog generation
- [ ] Provenance enabled (`publishConfig.provenance: true`)
- [ ] size-limit configured with bundle size budgets
- [ ] Vitest with coverage thresholds (80%+ branches, functions, lines)
- [ ] ESLint flat config + Prettier configured and enforced in CI
- [ ] TypeScript strict mode enabled (`strict: true`)
- [ ] `verbatimModuleSyntax: true` for correct import/export handling
- [ ] GitHub Actions: CI (test on Node 18/20/22) + Release (changesets publish)
- [ ] No internal paths importable (exports field restricts access)
- [ ] README with installation, usage, API examples, and TypeScript types
- [ ] `main` + `module` + `types` legacy fallback fields present
- [ ] External dependencies not bundled (react, react-dom, etc.)
- [ ] `npx publint` passes in CI (package.json correctness)
- [ ] `npx attw --pack .` passes in CI (type resolution correctness)
- [ ] `npm pack --dry-run` verified (correct files included)
- [ ] `.npmrc` committed with provenance enabled (no secrets)
- [ ] No `postinstall` script (security and compatibility)
