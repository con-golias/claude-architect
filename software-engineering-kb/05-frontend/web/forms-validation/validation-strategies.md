# Validation Strategies — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to validate forms?", "Zod vs Yup?", "client-side validation", "server-side validation", "async validation", "cross-field validation", "error message patterns", "schema validation", "validation timing", "shared validation schemas", or any validation strategy question, ALWAYS consult this directive. Validation ensures data integrity at every boundary — client, server, and database. ALWAYS validate on BOTH client AND server — client validation is a UX convenience, server validation is a security requirement. ALWAYS use Zod as the validation library — it has the best TypeScript inference, is schema-first, and can be shared between frontend and backend.

**Core Rule: EVERY piece of user input MUST be validated on the server — client-side validation is for UX only, NEVER for security. Use Zod for ALL validation schemas — it provides TypeScript type inference, composable schemas, and works on both frontend and backend. Validate on `onBlur` by default (not `onChange`) — showing errors while the user is still typing is hostile UX. ALWAYS show specific, actionable error messages — "Invalid input" is NEVER acceptable.**

---

## 1. Validation Architecture

```
  VALIDATION LAYERS — DEFENSE IN DEPTH

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  LAYER 1: CLIENT-SIDE (UX)                           │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Zod schema in browser                        │  │
  │  │  Immediate feedback (no network round-trip)   │  │
  │  │  Can be bypassed (DevTools, curl)             │  │
  │  │  PURPOSE: Fast UX, not security               │  │
  │  └────────────────────────────────────────────────┘  │
  │                          │                           │
  │                          ▼                           │
  │  LAYER 2: SERVER-SIDE (Security)                     │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Same Zod schema on server                    │  │
  │  │  CANNOT be bypassed by client                 │  │
  │  │  Returns structured errors to client          │  │
  │  │  PURPOSE: Data integrity, security            │  │
  │  └────────────────────────────────────────────────┘  │
  │                          │                           │
  │                          ▼                           │
  │  LAYER 3: DATABASE (Constraints)                     │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  NOT NULL, UNIQUE, CHECK constraints          │  │
  │  │  Foreign key references                       │  │
  │  │  Last line of defense                         │  │
  │  │  PURPOSE: Prevent corrupted data              │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RULE: Layers 2+3 are MANDATORY. Layer 1 is UX.     │
  └──────────────────────────────────────────────────────┘
```

---

## 2. Zod — The Validation Standard

### 2.1 Zod vs Yup Comparison

| Feature | Zod | Yup |
|---|---|---|
| **TypeScript inference** | `z.infer<typeof schema>` — perfect types | `InferType<typeof schema>` — less precise |
| **API style** | Functional chaining | Fluent chaining |
| **Bundle size** | ~14 KB | ~13 KB |
| **Transforms** | Built-in (coerce, transform) | Built-in (cast) |
| **Refinements** | `.refine()`, `.superRefine()` | `.test()` |
| **Async validation** | Native (refinements can be async) | Native |
| **Error messages** | Structured ZodError with path/message | Similar structure |
| **tRPC integration** | Native (tRPC uses Zod) | Requires adapter |
| **Active development** | Very active (2024+) | Maintenance mode |

**VERDICT:** Zod for ALL new projects. Yup only for legacy codebases.

### 2.2 Core Zod Patterns

```typescript
import { z } from 'zod';

// Primitives
const nameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be under 100 characters')
  .trim();                                        // auto-trim whitespace

const emailSchema = z.string()
  .email('Please enter a valid email address')
  .toLowerCase();                                 // auto-lowercase

const ageSchema = z.number()
  .int('Age must be a whole number')
  .min(0, 'Age cannot be negative')
  .max(150, 'Please enter a valid age');

// Enums
const roleSchema = z.enum(['admin', 'editor', 'viewer'], {
  errorMap: () => ({ message: 'Please select a valid role' }),
});

// Objects
const userSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  age: ageSchema.optional(),                      // age is optional
  role: roleSchema.default('viewer'),             // default if not provided
  bio: z.string().max(500).nullable(),            // can be null
});

// Type inference — no manual interface needed
type User = z.infer<typeof userSchema>;
// { name: string; email: string; age?: number; role: "admin" | "editor" | "viewer"; bio: string | null }

// Arrays
const tagsSchema = z.array(z.string().min(1))
  .min(1, 'At least one tag required')
  .max(10, 'Maximum 10 tags');

// Discriminated unions
const notificationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('email'), email: z.string().email() }),
  z.object({ type: z.literal('sms'), phone: z.string().regex(/^\+\d{10,15}$/) }),
  z.object({ type: z.literal('push'), deviceId: z.string().uuid() }),
]);
```

### 2.3 Transforms and Coercion

```typescript
// Coerce — convert string from form input to correct type
const formSchema = z.object({
  // HTML inputs always give strings — coerce to numbers
  price: z.coerce.number().min(0, 'Price must be positive'),
  quantity: z.coerce.number().int().min(1),
  active: z.coerce.boolean(),                     // "true" → true
  createdAt: z.coerce.date(),                     // "2024-01-01" → Date
});

// Transform — modify value during parsing
const slugSchema = z.string()
  .min(3)
  .transform((val) => val.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));

slugSchema.parse('My Blog Post');  // → "my-blog-post"

// Preprocess — modify BEFORE validation
const trimmedString = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim() : val),
  z.string().min(1, 'Required')
);

trimmedString.parse('  hello  ');  // → "hello"
trimmedString.parse('   ');        // throws: Required
```

### 2.4 Refinements and Cross-Field Validation

```typescript
// Simple refinement
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .refine(
    (val) => /[A-Z]/.test(val),
    'Must contain at least one uppercase letter'
  )
  .refine(
    (val) => /[0-9]/.test(val),
    'Must contain at least one number'
  )
  .refine(
    (val) => /[!@#$%^&*]/.test(val),
    'Must contain at least one special character'
  );

// Cross-field validation with superRefine
const registrationSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).superRefine((data, ctx) => {
  // Password confirmation
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Passwords do not match',
      path: ['confirmPassword'],               // attach error to specific field
    });
  }

  // Date range validation
  if (data.endDate <= data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date must be after start date',
      path: ['endDate'],
    });
  }
});
```

---

## 3. Validation Timing

```
  VALIDATION TIMING — WHEN TO VALIDATE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  onChange (every keystroke):                          │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ✗ AVOID — shows errors while user is typing  │  │
  │  │  Exception: search/filter inputs               │  │
  │  │  Exception: character count display            │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  onBlur (when leaving field):                        │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ✓ RECOMMENDED DEFAULT                        │  │
  │  │  User finishes input → sees error             │  │
  │  │  Not intrusive during typing                  │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  onSubmit (form submission):                         │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ✓ ALWAYS (even if also validating on blur)   │  │
  │  │  Shows all errors at once                     │  │
  │  │  Focuses first error field                    │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  BEST PRACTICE: onBlur + onSubmit + onChange-after-  │
  │  error (once an error is shown, clear it live as     │
  │  the user fixes it).                                 │
  │                                                      │
  │  React Hook Form modes:                              │
  │  mode: 'onBlur'          → validate on blur          │
  │  reValidateMode: 'onChange' → re-check on change     │
  │                              (after first error)     │
  └──────────────────────────────────────────────────────┘
```

```typescript
// Optimal React Hook Form configuration
const form = useForm({
  resolver: zodResolver(schema),
  mode: 'onBlur',                // first validation on blur
  reValidateMode: 'onChange',    // after first error, re-validate on change
  defaultValues: { ... },
});
```

---

## 4. Async Validation

```typescript
// Email uniqueness check
const emailSchema = z.string()
  .email('Invalid email')
  .refine(
    async (email) => {
      // This runs during form validation — debounce at form level
      const response = await fetch(`/api/check-email?email=${encodeURIComponent(email)}`);
      const { available } = await response.json();
      return available;
    },
    'This email is already registered'
  );

// With React Hook Form — inline async validation
<input
  {...register('username', {
    validate: {
      // Sync validations run first
      minLength: (v) => v.length >= 3 || 'Min 3 characters',
      pattern: (v) => /^[a-z0-9_]+$/.test(v) || 'Only lowercase letters, numbers, and underscores',
      // Async runs only if sync passes
      unique: async (v) => {
        const res = await fetch(`/api/check-username?username=${v}`);
        const { available } = await res.json();
        return available || 'Username is taken';
      },
    },
  })}
/>
```

### 4.1 Debounced Async Validation

```tsx
// Debounce async validation to avoid API spam
import { useCallback, useRef } from 'react';

function useAsyncValidation(
  checkFn: (value: string) => Promise<boolean>,
  delay = 500
) {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    (value: string) => {
      return new Promise<string | true>((resolve) => {
        clearTimeout(timeoutRef.current);

        timeoutRef.current = setTimeout(async () => {
          try {
            const isValid = await checkFn(value);
            resolve(isValid || 'Value is not available');
          } catch {
            resolve('Validation check failed');
          }
        }, delay);
      });
    },
    [checkFn, delay]
  );
}

// Usage
function RegistrationForm() {
  const validateUsername = useAsyncValidation(
    async (username) => {
      const res = await fetch(`/api/check-username?u=${username}`);
      return (await res.json()).available;
    },
    500
  );

  const { register } = useForm();

  return (
    <input
      {...register('username', {
        validate: { unique: validateUsername },
      })}
    />
  );
}
```

---

## 5. Error Message Patterns

```
  ERROR MESSAGE DISPLAY STRATEGIES

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  STRATEGY 1: Inline (below field)                    │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  Email: [_________________________]           │  │
  │  │  ❌ Please enter a valid email address         │  │
  │  │                                                │  │
  │  │  BEST FOR: Most forms (clear, contextual)     │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  STRATEGY 2: Summary (top of form)                   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ┌─────────────────────────────────────────┐  │  │
  │  │  │ ❌ Please fix the following errors:      │  │  │
  │  │  │ • Name is required                      │  │  │
  │  │  │ • Email is invalid                      │  │  │
  │  │  │ • Password is too short                 │  │  │
  │  │  └─────────────────────────────────────────┘  │  │
  │  │                                                │  │
  │  │  BEST FOR: Long forms, server-side errors     │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  STRATEGY 3: Toast notification                      │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ┌─────────────────────────┐                   │  │
  │  │  │ ❌ Submission failed    │ ← top-right toast │  │
  │  │  └─────────────────────────┘                   │  │
  │  │                                                │  │
  │  │  BEST FOR: Server errors only (not field errors)│  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RECOMMENDED: Inline for field errors + Summary      │
  │  for server errors + Toast for network errors.       │
  └──────────────────────────────────────────────────────┘
```

### 5.1 Error Message Quality

```typescript
// BAD error messages
const badSchema = z.object({
  email: z.string().email(),           // "Invalid" — not helpful
  age: z.number().min(18),             // "Number must be >= 18" — robotic
  name: z.string().min(1),             // "String must contain at least 1 character(s)" — awful
});

// GOOD error messages — specific, actionable, human
const goodSchema = z.object({
  email: z.string().email('Please enter a valid email address (e.g., name@example.com)'),
  age: z.number().min(18, 'You must be at least 18 years old to register'),
  name: z.string().min(1, 'Please enter your name'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
});

// RULE: Error messages should:
// 1. Tell the user WHAT is wrong
// 2. Tell the user HOW to fix it
// 3. Be written in natural language (not technical jargon)
```

---

## 6. Shared Schemas — Frontend + Backend

```
  SHARED ZOD SCHEMA ARCHITECTURE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  packages/shared/schemas/user.ts                     │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  export const createUserSchema = z.object({   │  │
  │  │    name: z.string().min(2).max(100),          │  │
  │  │    email: z.string().email(),                 │  │
  │  │    password: z.string().min(8),               │  │
  │  │  });                                          │  │
  │  │                                                │  │
  │  │  export type CreateUserInput =                │  │
  │  │    z.infer<typeof createUserSchema>;          │  │
  │  └────────────────────────────────────────────────┘  │
  │                      │                               │
  │         ┌────────────┼────────────┐                  │
  │         ▼            ▼            ▼                  │
  │    Frontend      API Route     tRPC                  │
  │    (RHF)        (Express)     (Procedure)            │
  │    zodResolver   .safeParse   .input()               │
  └──────────────────────────────────────────────────────┘
```

```typescript
// packages/shared/schemas/user.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name too short').max(100),
  email: z.string().email('Invalid email').toLowerCase(),
  password: z.string().min(8, 'Password too short'),
});

export const updateUserSchema = createUserSchema.partial().extend({
  id: z.string().uuid(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
```

```tsx
// Frontend: React Hook Form
import { createUserSchema, type CreateUserInput } from '@shared/schemas/user';

function RegisterForm() {
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
  });
  // ...
}
```

```typescript
// Backend: Express route
import { createUserSchema } from '@shared/schemas/user';

app.post('/api/users', async (req, res) => {
  const result = createUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      errors: result.error.flatten().fieldErrors,
    });
  }

  const user = await db.user.create({ data: result.data });
  res.status(201).json(user);
});
```

```typescript
// Backend: tRPC procedure
import { createUserSchema } from '@shared/schemas/user';

export const userRouter = router({
  create: publicProcedure
    .input(createUserSchema)               // Zod validates automatically
    .mutation(async ({ input }) => {
      return db.user.create({ data: input });
    }),
});
```

---

## 7. Conditional and Dependent Validation

```typescript
// Conditional fields — schema changes based on other field values
const paymentSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('credit_card'),
    cardNumber: z.string().regex(/^\d{16}$/, 'Invalid card number'),
    expiry: z.string().regex(/^\d{2}\/\d{2}$/, 'Use MM/YY format'),
    cvv: z.string().regex(/^\d{3,4}$/, 'Invalid CVV'),
  }),
  z.object({
    method: z.literal('bank_transfer'),
    bankName: z.string().min(1, 'Bank name required'),
    accountNumber: z.string().min(8, 'Account number too short'),
    routingNumber: z.string().regex(/^\d{9}$/, 'Invalid routing number'),
  }),
  z.object({
    method: z.literal('paypal'),
    paypalEmail: z.string().email('Invalid PayPal email'),
  }),
]);

// In React Hook Form — watch field to conditionally render
function PaymentForm() {
  const { register, watch, control } = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: { method: 'credit_card' },
  });

  const method = watch('method');

  return (
    <form>
      <select {...register('method')}>
        <option value="credit_card">Credit Card</option>
        <option value="bank_transfer">Bank Transfer</option>
        <option value="paypal">PayPal</option>
      </select>

      {method === 'credit_card' && (
        <>
          <input {...register('cardNumber')} placeholder="Card number" />
          <input {...register('expiry')} placeholder="MM/YY" />
          <input {...register('cvv')} placeholder="CVV" />
        </>
      )}

      {method === 'bank_transfer' && (
        <>
          <input {...register('bankName')} placeholder="Bank name" />
          <input {...register('accountNumber')} placeholder="Account #" />
          <input {...register('routingNumber')} placeholder="Routing #" />
        </>
      )}

      {method === 'paypal' && (
        <input {...register('paypalEmail')} placeholder="PayPal email" />
      )}
    </form>
  );
}
```

---

## 8. Internationalized Error Messages

```typescript
// i18n-aware Zod schemas
import { z } from 'zod';
import { t } from './i18n';                       // translation function

// Option 1: Custom error map
const customErrorMap: z.ZodErrorMap = (issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.too_small:
      if (issue.type === 'string') {
        return { message: t('validation.string_too_short', { min: issue.minimum }) };
      }
      if (issue.type === 'number') {
        return { message: t('validation.number_too_small', { min: issue.minimum }) };
      }
      break;
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === 'email') {
        return { message: t('validation.invalid_email') };
      }
      break;
  }
  return { message: ctx.defaultError };
};

z.setErrorMap(customErrorMap);                    // global custom error map

// Option 2: Schema factory with translations
function createUserSchema(t: TranslationFn) {
  return z.object({
    name: z.string().min(2, t('validation.name_min', { min: 2 })),
    email: z.string().email(t('validation.email_invalid')),
    password: z.string().min(8, t('validation.password_min', { min: 8 })),
  });
}

// Translation keys
// en.json: { "validation": { "name_min": "Name must be at least {{min}} characters" } }
// de.json: { "validation": { "name_min": "Name muss mindestens {{min}} Zeichen lang sein" } }
```

---

## 9. Server-Side Error Handling

```typescript
// Return structured errors from server
interface ServerValidationResponse {
  success: false;
  errors: {
    fieldErrors: Record<string, string[]>;
    formErrors: string[];
  };
}

// Frontend: Set server errors on form
async function onSubmit(data: FormData) {
  const response = await fetch('/api/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const result: ServerValidationResponse = await response.json();

    // Set field-level errors from server
    if (result.errors.fieldErrors) {
      Object.entries(result.errors.fieldErrors).forEach(([field, messages]) => {
        form.setError(field as any, {
          type: 'server',
          message: messages[0],
        });
      });
    }

    // Set form-level errors
    if (result.errors.formErrors?.length) {
      form.setError('root.serverError', {
        type: 'server',
        message: result.errors.formErrors[0],
      });
    }

    return;
  }

  // Success handling
}

// Display root errors
{form.formState.errors.root?.serverError && (
  <div role="alert" className="form-error">
    {form.formState.errors.root.serverError.message}
  </div>
)}
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **Client-only validation** | User disables JS or uses curl — invalid data in database | ALWAYS validate on server with same Zod schema |
| **Validate on every keystroke** | `mode: 'onChange'` — errors flash while user types email | Use `mode: 'onBlur'`, `reValidateMode: 'onChange'` |
| **Generic error messages** | "Invalid input", "Error", "Validation failed" — user cannot fix | Write specific messages: "Password must be at least 8 characters" |
| **No error message for required fields** | Red border but no text — user does not know what is required | Every field error needs visible text with `role="alert"` |
| **Different validation client vs server** | Client allows value, server rejects — confusing UX | Share Zod schema between frontend and backend |
| **No async validation debounce** | Username check fires 10 API calls while typing "johndoe" | Debounce async validation by 300-500ms |
| **Validating too strictly** | Phone number regex rejects valid international formats | Use libraries for complex validation (libphonenumber, email-validator) |
| **Manual type checking** | `if (typeof value === 'string' && value.length > 0)` repeated everywhere | Use Zod schema — single source of truth for validation |
| **Yup in new projects** | Using Yup when Zod has better TypeScript support and tRPC integration | Migrate to Zod — better inference, smaller bundle, active development |
| **No cross-field validation** | Password and confirm password can differ without error | Use `.superRefine()` or `.refine()` at object level |

---

## 11. Enforcement Checklist

### Schema Definition
- [ ] Zod used as the validation library (not Yup, not manual)
- [ ] Schemas defined in shared package (imported by frontend AND backend)
- [ ] `z.infer<typeof schema>` used for TypeScript types (no manual interfaces)
- [ ] Error messages written in natural language (not Zod defaults)
- [ ] Complex types use discriminated unions (not `z.union`)

### Validation Timing
- [ ] `mode: 'onBlur'` set as default (validate when user leaves field)
- [ ] `reValidateMode: 'onChange'` set (clear errors live after first validation)
- [ ] Async validation debounced (300-500ms)
- [ ] Form submission always triggers full validation

### Error Display
- [ ] Inline errors shown below each field
- [ ] Error messages have `role="alert"` for screen reader announcement
- [ ] Server errors set via `setError()` on the correct field
- [ ] Form-level errors displayed via `errors.root`
- [ ] First error field focused after failed submission

### Security
- [ ] Server-side validation runs the SAME Zod schema as client
- [ ] Server returns 400 with structured `fieldErrors` on validation failure
- [ ] Database constraints exist as final safety net (NOT NULL, UNIQUE, CHECK)
- [ ] Input is sanitized for XSS AFTER validation (DOMPurify for rich text)
