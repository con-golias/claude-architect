# File Organization

> **Domain:** Fundamentals > Clean Code > Formatting and Structure
> **Difficulty:** Intermediate
> **Last Updated:** 2026-03-06

## What It Is

File organization is about how code is distributed across files and directories. Clean file organization makes navigation intuitive, reduces merge conflicts, and enforces architectural boundaries.

Key decisions: what goes in each file, how files are named, how they're grouped into directories, and how imports/dependencies flow between them.

## Why It Matters

Poor file organization forces developers to "hunt" for code. Good organization lets them predict where code lives without searching. In large codebases (Google's 2+ billion lines), organization is the difference between productivity and paralysis.

## How It Works

### One Concept Per File

```
BAD:                           GOOD:
models.ts (500 lines)          user.model.ts
  - User                       order.model.ts
  - Order                      product.model.ts
  - Product                    payment.model.ts
  - Payment
```

### Import Ordering Convention

```typescript
// 1. Node/built-in modules
import path from 'path';
import fs from 'fs';

// 2. External packages
import express from 'express';
import { z } from 'zod';

// 3. Internal packages/modules
import { UserService } from '@/services/user.service';
import { logger } from '@/lib/logger';

// 4. Relative imports
import { validateEmail } from './validators';
import type { UserDto } from './types';
```

### Feature-Based vs. Layer-Based Organization

```
LAYER-BASED (traditional):       FEATURE-BASED (modern):
src/                             src/
├── controllers/                 ├── users/
│   ├── user.controller.ts       │   ├── user.controller.ts
│   ├── order.controller.ts      │   ├── user.service.ts
├── services/                    │   ├── user.repository.ts
│   ├── user.service.ts          │   └── user.model.ts
│   ├── order.service.ts         ├── orders/
├── models/                      │   ├── order.controller.ts
│   ├── user.model.ts            │   ├── order.service.ts
│   ├── order.model.ts           │   ├── order.repository.ts
└── repositories/                │   └── order.model.ts
    ├── user.repository.ts       └── shared/
    └── order.repository.ts          ├── middleware/
                                     └── utils/
```

Feature-based is preferred for larger projects because related code is co-located, reducing the number of files you need to touch for a single change.

## Best Practices

1. **Co-locate related code.** Tests next to source, styles next to components, types next to implementations.
2. **One concept per file.** One class, one component, one utility module.
3. **Consistent file naming.** `kebab-case.ts` or `PascalCase.ts` — pick one and enforce it.
4. **Use barrel files sparingly.** `index.ts` re-exports are convenient but can create circular dependencies and slow builds.
5. **Keep file size under 300-400 lines.** If a file grows beyond that, it likely contains multiple concepts.

## Anti-patterns / Common Mistakes

- **Mega-files:** 1000+ line files with multiple classes/functions.
- **Deep nesting:** `src/app/modules/core/services/user/helpers/validation/index.ts` — too many levels.
- **Circular imports:** A imports B, B imports A. Usually indicates a missing abstraction.

## Sources

- Martin, R.C. (2017). *Clean Architecture*. "Screaming Architecture."
- [Vertical Slice vs Clean Architecture (nadirbad.dev)](https://nadirbad.dev/vertical-slice-vs-clean-architecture)
