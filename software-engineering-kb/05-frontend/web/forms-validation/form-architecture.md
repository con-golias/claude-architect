# Form Architecture — Complete Specification

> **AI Plugin Directive:** When a developer asks "how to build forms in React?", "React Hook Form vs Formik?", "controlled vs uncontrolled inputs", "multi-step form wizard", "dynamic form fields", "file upload form", "form performance", "form accessibility", "useForm hook", "field arrays in forms", or any form architecture question, ALWAYS consult this directive. Forms are the primary data collection interface in web applications. ALWAYS use React Hook Form for React projects — it is the fastest, most ergonomic form library. ALWAYS validate on both client AND server. NEVER use controlled inputs for large forms — uncontrolled with `register()` gives 10x better performance. ALWAYS make forms accessible with proper labels, error announcements, and keyboard navigation.

**Core Rule: Use React Hook Form with Zod validation for EVERY form in React applications. Register inputs with `register()` (uncontrolled) — NEVER use `useState` per field as it causes re-renders on every keystroke. Validate with Zod schemas shared between frontend and backend. EVERY form field MUST have a visible `<label>`, error messages MUST be announced to screen readers via `aria-describedby`, and submit buttons MUST show loading state during submission.**

---

## 1. Form Library Landscape

```
  FORM ARCHITECTURE DECISION TREE

  START
    │
    ├── React project?
    │   ├── React Hook Form + Zod (ALWAYS)
    │   │   • Uncontrolled inputs (minimal re-renders)
    │   │   • Zod schema validation
    │   │   • Excellent TypeScript inference
    │   │   • Field arrays for dynamic forms
    │   └── Formik? → NO — legacy, slower, more re-renders
    │
    ├── Vue project?
    │   └── VeeValidate + Zod
    │       • Composition API integration
    │       • useField / useForm composables
    │
    ├── Angular project?
    │   └── Reactive Forms (built-in)
    │       • FormGroup, FormControl, FormArray
    │       • Custom validators
    │
    ├── Svelte project?
    │   └── Superforms + Zod
    │       • SvelteKit form actions integration
    │       • Progressive enhancement
    │
    └── Plain HTML?
        └── Native Constraint Validation API
            • required, pattern, min/max
            • reportValidity(), checkValidity()
```

### 1.1 React Hook Form vs Formik

| Feature | React Hook Form | Formik |
|---|---|---|
| **Re-renders** | Only on submit/error (uncontrolled) | Every keystroke (controlled) |
| **Bundle size** | ~9 KB | ~13 KB |
| **API** | `register()` + `handleSubmit()` | `<Field>` + `<Form>` components |
| **TypeScript** | Excellent (infers from schema) | Good (manual types) |
| **Validation** | Zod, Yup, Joi, custom resolvers | Yup (native), Zod (adapter) |
| **Field arrays** | `useFieldArray` (performant) | `<FieldArray>` (re-renders parent) |
| **Performance (1000 fields)** | ~3ms re-render | ~300ms re-render |
| **Maintenance** | Active, growing | Maintenance mode |

**VERDICT:** React Hook Form for ALL new React projects. Formik only if existing codebase already uses it.

---

## 2. React Hook Form — Core Patterns

### 2.1 Basic Form Setup

```tsx
// ContactForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 1. Define schema
const contactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  subject: z.enum(['general', 'support', 'billing'], {
    errorMap: () => ({ message: 'Please select a subject' }),
  }),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

// 2. Infer TypeScript type from schema
type ContactFormData = z.infer<typeof contactSchema>;

export function ContactForm() {
  const {
    register,           // connect inputs (uncontrolled)
    handleSubmit,       // wraps onSubmit with validation
    formState: {
      errors,           // field-level error messages
      isSubmitting,     // true during async submit
      isValid,          // form passes validation
      isDirty,          // any field changed from default
    },
    reset,              // reset to default values
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      subject: undefined,
      message: '',
    },
    mode: 'onBlur',     // validate on blur (not every keystroke)
  });

  const onSubmit = async (data: ContactFormData) => {
    // data is fully typed and validated
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error('Submission failed');
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label htmlFor="name">Name</label>
        <input
          id="name"
          {...register('name')}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && (
          <p id="name-error" role="alert">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          {...register('email')}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" role="alert">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="subject">Subject</label>
        <select
          id="subject"
          {...register('subject')}
          aria-invalid={!!errors.subject}
          aria-describedby={errors.subject ? 'subject-error' : undefined}
        >
          <option value="">Select a subject...</option>
          <option value="general">General Inquiry</option>
          <option value="support">Technical Support</option>
          <option value="billing">Billing Question</option>
        </select>
        {errors.subject && (
          <p id="subject-error" role="alert">{errors.subject.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          rows={5}
          {...register('message')}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? 'message-error' : undefined}
        />
        {errors.message && (
          <p id="message-error" role="alert">{errors.message.message}</p>
        )}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}
```

### 2.2 Controller for Controlled Components

```tsx
// Use Controller for third-party UI libraries (Radix, MUI, etc.)
import { Controller, useForm } from 'react-hook-form';
import { Select } from '@radix-ui/react-select';
import { DatePicker } from './DatePicker';

function BookingForm() {
  const { control, handleSubmit } = useForm<BookingData>({
    resolver: zodResolver(bookingSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Controller wraps controlled components */}
      <Controller
        name="date"
        control={control}
        render={({ field, fieldState: { error } }) => (
          <div>
            <label>Date</label>
            <DatePicker
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
            {error && <p role="alert">{error.message}</p>}
          </div>
        )}
      />

      <Controller
        name="guests"
        control={control}
        render={({ field, fieldState: { error } }) => (
          <div>
            <label>Number of Guests</label>
            <Select
              value={field.value}
              onValueChange={field.onChange}
            >
              {/* ... select items */}
            </Select>
            {error && <p role="alert">{error.message}</p>}
          </div>
        )}
      />
    </form>
  );
}
```

### 2.3 Reusable Form Field Component

```tsx
// FormField.tsx — reusable field wrapper
import { useFormContext } from 'react-hook-form';

interface FormFieldProps {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}

export function FormField({ name, label, type = 'text', placeholder, required }: FormFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  const error = errors[name];
  const errorId = `${name}-error`;

  return (
    <div className="form-field">
      <label htmlFor={name}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={name}
        type={type}
        placeholder={placeholder}
        {...register(name)}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        aria-required={required}
      />
      {error && (
        <p id={errorId} role="alert" className="error-message">
          {error.message as string}
        </p>
      )}
    </div>
  );
}

// Usage with FormProvider
import { FormProvider, useForm } from 'react-hook-form';

function RegistrationForm() {
  const methods = useForm({
    resolver: zodResolver(registrationSchema),
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)}>
        <FormField name="name" label="Full Name" required />
        <FormField name="email" label="Email" type="email" required />
        <FormField name="password" label="Password" type="password" required />
        <button type="submit">Register</button>
      </form>
    </FormProvider>
  );
}
```

---

## 3. Dynamic Forms — Field Arrays

```tsx
// InvoiceForm.tsx — dynamic line items
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const lineItemSchema = z.object({
  description: z.string().min(1, 'Required'),
  quantity: z.number().min(1, 'Min 1'),
  unitPrice: z.number().min(0, 'Min 0'),
});

const invoiceSchema = z.object({
  clientName: z.string().min(1, 'Client name required'),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item required'),
  notes: z.string().optional(),
});

type InvoiceData = z.infer<typeof invoiceSchema>;

export function InvoiceForm() {
  const { register, control, handleSubmit, watch, formState: { errors } } =
    useForm<InvoiceData>({
      resolver: zodResolver(invoiceSchema),
      defaultValues: {
        clientName: '',
        lineItems: [{ description: '', quantity: 1, unitPrice: 0 }],
        notes: '',
      },
    });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'lineItems',
  });

  // Watch for live total calculation
  const lineItems = watch('lineItems');
  const total = lineItems.reduce(
    (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
    0
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="clientName">Client Name</label>
        <input id="clientName" {...register('clientName')} />
        {errors.clientName && <p role="alert">{errors.clientName.message}</p>}
      </div>

      <fieldset>
        <legend>Line Items</legend>

        {fields.map((field, index) => (
          <div key={field.id} className="line-item-row">
            <input
              {...register(`lineItems.${index}.description`)}
              placeholder="Description"
              aria-label={`Item ${index + 1} description`}
            />
            <input
              type="number"
              {...register(`lineItems.${index}.quantity`, { valueAsNumber: true })}
              placeholder="Qty"
              aria-label={`Item ${index + 1} quantity`}
            />
            <input
              type="number"
              step="0.01"
              {...register(`lineItems.${index}.unitPrice`, { valueAsNumber: true })}
              placeholder="Price"
              aria-label={`Item ${index + 1} price`}
            />
            <span aria-label={`Item ${index + 1} subtotal`}>
              ${((lineItems[index]?.quantity || 0) * (lineItems[index]?.unitPrice || 0)).toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label={`Remove item ${index + 1}`}
              disabled={fields.length === 1}
            >
              Remove
            </button>
          </div>
        ))}

        {errors.lineItems?.root && (
          <p role="alert">{errors.lineItems.root.message}</p>
        )}

        <button
          type="button"
          onClick={() => append({ description: '', quantity: 1, unitPrice: 0 })}
        >
          Add Line Item
        </button>
      </fieldset>

      <div className="total">
        <strong>Total: ${total.toFixed(2)}</strong>
      </div>

      <button type="submit">Create Invoice</button>
    </form>
  );
}
```

---

## 4. Multi-Step Form Wizard

```
  MULTI-STEP FORM ARCHITECTURE

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  APPROACH 1: Single form, multiple sections          │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  One useForm instance                         │  │
  │  │  Show/hide sections based on step             │  │
  │  │  Validate per-step with trigger()             │  │
  │  │  PRO: Simple state management                 │  │
  │  │  CON: All fields mounted (hidden)             │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  APPROACH 2: Multiple forms, shared state            │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  One useForm per step                         │  │
  │  │  Merge data into parent state on step submit  │  │
  │  │  PRO: Each step unmounts cleanly              │  │
  │  │  CON: More complex state management           │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  RECOMMENDED: Single form with trigger() per step    │
  └──────────────────────────────────────────────────────┘
```

```tsx
// MultiStepForm.tsx
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';

// Step schemas
const personalSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
});

const addressSchema = z.object({
  street: z.string().min(1, 'Required'),
  city: z.string().min(1, 'Required'),
  state: z.string().min(2, 'Required'),
  zip: z.string().regex(/^\d{5}$/, 'Invalid ZIP'),
});

const paymentSchema = z.object({
  cardNumber: z.string().regex(/^\d{16}$/, 'Invalid card number'),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/, 'MM/YY format'),
  cvv: z.string().regex(/^\d{3,4}$/, 'Invalid CVV'),
});

// Combined schema
const checkoutSchema = personalSchema.merge(addressSchema).merge(paymentSchema);
type CheckoutData = z.infer<typeof checkoutSchema>;

// Step configuration
const steps = [
  { title: 'Personal Info', fields: ['firstName', 'lastName', 'email'] as const },
  { title: 'Address', fields: ['street', 'city', 'state', 'zip'] as const },
  { title: 'Payment', fields: ['cardNumber', 'expiry', 'cvv'] as const },
];

export function CheckoutWizard() {
  const [currentStep, setCurrentStep] = useState(0);

  const methods = useForm<CheckoutData>({
    resolver: zodResolver(checkoutSchema),
    mode: 'onBlur',
  });

  const { trigger, handleSubmit } = methods;

  const goToNext = async () => {
    // Validate ONLY current step fields
    const fieldsToValidate = steps[currentStep].fields;
    const isValid = await trigger(fieldsToValidate as any);

    if (isValid) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const goToPrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const onSubmit = async (data: CheckoutData) => {
    await fetch('/api/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Progress indicator */}
        <nav aria-label="Checkout progress">
          <ol>
            {steps.map((step, i) => (
              <li key={i} aria-current={i === currentStep ? 'step' : undefined}>
                {step.title}
              </li>
            ))}
          </ol>
        </nav>

        {/* Step content */}
        <div role="group" aria-label={steps[currentStep].title}>
          {currentStep === 0 && <PersonalInfoStep />}
          {currentStep === 1 && <AddressStep />}
          {currentStep === 2 && <PaymentStep />}
        </div>

        {/* Navigation */}
        <div>
          {currentStep > 0 && (
            <button type="button" onClick={goToPrev}>Back</button>
          )}
          {currentStep < steps.length - 1 ? (
            <button type="button" onClick={goToNext}>Next</button>
          ) : (
            <button type="submit">Place Order</button>
          )}
        </div>
      </form>
    </FormProvider>
  );
}
```

---

## 5. File Upload Forms

```tsx
// FileUpload.tsx
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState } from 'react';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const uploadSchema = z.object({
  title: z.string().min(1, 'Title required'),
  files: z
    .array(z.instanceof(File))
    .min(1, 'At least one file required')
    .max(5, 'Maximum 5 files')
    .refine(
      (files) => files.every((f) => f.size <= MAX_FILE_SIZE),
      'Each file must be under 5MB'
    )
    .refine(
      (files) => files.every((f) => ACCEPTED_TYPES.includes(f.type)),
      'Only JPEG, PNG, WebP, and PDF files accepted'
    ),
});

type UploadData = z.infer<typeof uploadSchema>;

export function FileUploadForm() {
  const { register, control, handleSubmit, formState: { errors } } =
    useForm<UploadData>({
      resolver: zodResolver(uploadSchema),
      defaultValues: { title: '', files: [] },
    });

  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles: File[], onChange: (files: File[]) => void) => {
    onChange(acceptedFiles);

    // Generate previews
    const urls = acceptedFiles
      .filter((f) => f.type.startsWith('image/'))
      .map((f) => URL.createObjectURL(f));
    setPreviews(urls);
  }, []);

  const onSubmit = async (data: UploadData) => {
    const formData = new FormData();
    formData.append('title', data.title);
    data.files.forEach((file) => formData.append('files', file));

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    // Use fetch for simple uploads
    await fetch('/api/upload', { method: 'POST', body: formData });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="title">Title</label>
        <input id="title" {...register('title')} />
        {errors.title && <p role="alert">{errors.title.message}</p>}
      </div>

      <Controller
        name="files"
        control={control}
        render={({ field: { onChange, value } }) => (
          <div
            onDrop={(e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files);
              onDrop(files, onChange);
            }}
            onDragOver={(e) => e.preventDefault()}
            role="button"
            tabIndex={0}
            aria-label="Drop files here or click to browse"
          >
            <input
              type="file"
              multiple
              accept={ACCEPTED_TYPES.join(',')}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                onDrop(files, onChange);
              }}
            />
            <p>Drag files here or click to browse</p>
            <p>JPEG, PNG, WebP, PDF up to 5MB each</p>
          </div>
        )}
      />
      {errors.files && <p role="alert">{errors.files.message}</p>}

      {/* Previews */}
      {previews.length > 0 && (
        <div className="previews" role="list" aria-label="File previews">
          {previews.map((url, i) => (
            <img key={i} src={url} alt={`Preview ${i + 1}`} width={100} height={100} />
          ))}
        </div>
      )}

      {/* Progress */}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <progress value={uploadProgress} max={100} aria-label="Upload progress">
          {uploadProgress}%
        </progress>
      )}

      <button type="submit">Upload</button>
    </form>
  );
}
```

---

## 6. Form Performance Optimization

```
  FORM RE-RENDER COMPARISON

  CONTROLLED (useState per field):
  ┌──────────────────────────────────────────┐
  │  User types "H" → ALL fields re-render   │
  │  User types "e" → ALL fields re-render   │
  │  User types "l" → ALL fields re-render   │
  │  ...                                     │
  │  10 fields × 5 chars each = 50 renders   │
  └──────────────────────────────────────────┘

  UNCONTROLLED (React Hook Form):
  ┌──────────────────────────────────────────┐
  │  User types "Hello" → 0 re-renders       │
  │  User blurs field → 1 re-render (if err) │
  │  User submits → 1 re-render              │
  │  ...                                     │
  │  10 fields × submit = 1-2 renders        │
  └──────────────────────────────────────────┘

  RULE: Use register() (uncontrolled) by default.
  Use Controller ONLY for controlled third-party components.
```

### 6.1 Performance Patterns

```tsx
// GOOD: Isolate watched fields to avoid parent re-renders
function TotalDisplay() {
  // Only this component re-renders when quantity/price change
  const quantity = useWatch({ name: 'quantity' });
  const price = useWatch({ name: 'price' });

  return <p>Total: ${(quantity * price).toFixed(2)}</p>;
}

// GOOD: Debounce expensive operations triggered by form values
import { useWatch, useForm } from 'react-hook-form';
import { useDebouncedCallback } from 'use-debounce';

function SearchForm() {
  const { register, control } = useForm();

  const searchTerm = useWatch({ name: 'search', control });

  const debouncedSearch = useDebouncedCallback((term: string) => {
    fetchResults(term);
  }, 300);

  useEffect(() => {
    if (searchTerm) debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  return (
    <form>
      <input {...register('search')} placeholder="Search..." />
    </form>
  );
}

// GOOD: Field-level validation (no full form validation on each blur)
<input
  {...register('email', {
    validate: {
      unique: async (value) => {
        const exists = await checkEmailExists(value);
        return !exists || 'Email already registered';
      },
    },
  })}
/>
```

---

## 7. Form Accessibility Requirements

```
  FORM ACCESSIBILITY CHECKLIST

  ┌──────────────────────────────────────────────────────┐
  │                                                      │
  │  EVERY FIELD MUST HAVE:                              │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ✓ <label htmlFor="fieldId">             │  │
  │  │  ✓ aria-invalid={!!error}                     │  │
  │  │  ✓ aria-describedby="fieldId-error"           │  │
  │  │  ✓ aria-required={true} (if required)         │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  ERROR MESSAGES MUST:                                │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ✓ Have role="alert" (announces to SR)        │  │
  │  │  ✓ Be connected via aria-describedby          │  │
  │  │  ✓ Be visible (not just color-based)          │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  FORM GROUPS MUST:                                   │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ✓ Use <fieldset> + <legend> for groups       │  │
  │  │  ✓ Radio groups wrapped in fieldset            │  │
  │  │  ✓ Related checkboxes wrapped in fieldset      │  │
  │  └────────────────────────────────────────────────┘  │
  │                                                      │
  │  SUBMIT MUST:                                        │
  │  ┌────────────────────────────────────────────────┐  │
  │  │  ✓ Show loading state (spinner + text)        │  │
  │  │  ✓ Disable button during submission           │  │
  │  │  ✓ Announce success/failure to SR             │  │
  │  │  ✓ Focus first error field after failed submit│  │
  │  └────────────────────────────────────────────────┘  │
  └──────────────────────────────────────────────────────┘
```

### 7.1 Error Focus Management

```tsx
// Focus first error field after failed submit
function FormWithErrorFocus() {
  const { handleSubmit, formState: { errors }, setFocus } = useForm();

  useEffect(() => {
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      setFocus(firstError as any);
    }
  }, [errors, setFocus]);

  return <form onSubmit={handleSubmit(onSubmit)}>...</form>;
}
```

---

## 8. Framework-Specific Form Patterns

### 8.1 Vue — VeeValidate + Zod

```vue
<!-- ContactForm.vue -->
<script setup lang="ts">
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { z } from 'zod';

const schema = toTypedSchema(
  z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email'),
    message: z.string().min(10, 'Message too short'),
  })
);

const { handleSubmit, defineField, errors } = useForm({
  validationSchema: schema,
});

const [name, nameProps] = defineField('name');
const [email, emailProps] = defineField('email');
const [message, messageProps] = defineField('message');

const onSubmit = handleSubmit(async (values) => {
  await fetch('/api/contact', {
    method: 'POST',
    body: JSON.stringify(values),
  });
});
</script>

<template>
  <form @submit="onSubmit">
    <div>
      <label for="name">Name</label>
      <input id="name" v-model="name" v-bind="nameProps" />
      <p v-if="errors.name" role="alert">{{ errors.name }}</p>
    </div>
    <div>
      <label for="email">Email</label>
      <input id="email" v-model="email" v-bind="emailProps" />
      <p v-if="errors.email" role="alert">{{ errors.email }}</p>
    </div>
    <div>
      <label for="message">Message</label>
      <textarea id="message" v-model="message" v-bind="messageProps" />
      <p v-if="errors.message" role="alert">{{ errors.message }}</p>
    </div>
    <button type="submit">Send</button>
  </form>
</template>
```

### 8.2 SvelteKit — Superforms

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import { zodClient } from 'sveltekit-superforms/adapters';
  import { contactSchema } from './schema';

  let { data } = $props();

  const { form, errors, enhance, submitting } = superForm(data.form, {
    validators: zodClient(contactSchema),
  });
</script>

<form method="POST" use:enhance>
  <label for="name">Name</label>
  <input id="name" name="name" bind:value={$form.name} />
  {#if $errors.name}<p role="alert">{$errors.name}</p>{/if}

  <label for="email">Email</label>
  <input id="email" name="email" type="email" bind:value={$form.email} />
  {#if $errors.email}<p role="alert">{$errors.email}</p>{/if}

  <button type="submit" disabled={$submitting}>
    {$submitting ? 'Sending...' : 'Send'}
  </button>
</form>
```

---

## 9. Server Actions & Form Integration

```tsx
// Next.js Server Actions + React Hook Form
// app/contact/action.ts
'use server';

import { contactSchema } from './schema';

export async function submitContact(formData: FormData) {
  const parsed = contactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await db.contact.create({ data: parsed.data });
  return { success: true };
}
```

```tsx
// app/contact/page.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { contactSchema, type ContactData } from './schema';
import { submitContact } from './action';

export default function ContactPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<ContactData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactData) => {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => formData.append(key, value));

    const result = await submitContact(formData);

    if (result.errors) {
      // Set server-side errors
      Object.entries(result.errors).forEach(([field, messages]) => {
        setError(field as any, { message: messages?.[0] });
      });
    }
  };

  return <form onSubmit={handleSubmit(onSubmit)}>...</form>;
}
```

---

## 10. Anti-Patterns

| Anti-Pattern | Symptom | Fix |
|---|---|---|
| **useState per field** | 10 fields = 10 state vars + 10 onChange handlers; form re-renders on every keystroke | Use React Hook Form `register()` — uncontrolled, zero re-renders |
| **No server-side validation** | Client disables JS or modifies requests — invalid data enters DB | ALWAYS validate on server with same Zod schema |
| **Validation on every keystroke** | `mode: 'onChange'` with async validation — API called 20 times while typing email | Use `mode: 'onBlur'` — validate when user leaves field |
| **No loading state on submit** | User clicks submit, nothing happens for 3 seconds, clicks again → duplicate submission | Disable button + show spinner during `isSubmitting` |
| **Color-only error indication** | Red border but no text message — colorblind users cannot see errors | ALWAYS include text error message with `role="alert"` |
| **No label on inputs** | Placeholder used as label — disappears on focus, invisible to screen readers | ALWAYS use `<label htmlFor="id">` — placeholder is supplementary only |
| **Form inside form** | Nested `<form>` elements — invalid HTML, unpredictable behavior | Use one form per page section; use fieldsets for grouping |
| **Not resetting after submit** | Form retains old values after successful submit — confusing | Call `reset()` after successful submission |
| **Giant single form** | 50 fields on one page — overwhelming and slow | Break into multi-step wizard with per-step validation |
| **No dirty check on navigation** | User fills half a form, navigates away — data lost silently | Use `isDirty` + `beforeunload` to warn before navigation |

---

## 11. Enforcement Checklist

### Form Setup
- [ ] React Hook Form with Zod resolver installed and configured
- [ ] Schema defined with Zod, shared between frontend and backend
- [ ] `mode: 'onBlur'` set as default validation trigger
- [ ] `defaultValues` provided for all fields
- [ ] `noValidate` on `<form>` element (disable browser validation — use custom)

### Accessibility
- [ ] Every input has a visible `<label>` with matching `htmlFor`/`id`
- [ ] Error messages have `role="alert"` for screen reader announcement
- [ ] `aria-invalid` set on fields with errors
- [ ] `aria-describedby` links fields to their error messages
- [ ] Required fields have `aria-required="true"`
- [ ] First error field receives focus after failed submission
- [ ] Submit button shows loading state and is disabled during submission

### Performance
- [ ] Inputs use `register()` (uncontrolled) — NOT `useState` per field
- [ ] `Controller` used ONLY for third-party controlled components
- [ ] `useWatch` isolated in separate components for computed displays
- [ ] Async validation debounced (not on every keystroke)

### Validation
- [ ] Client-side validation matches server-side validation (same Zod schema)
- [ ] Per-step validation in multi-step forms (via `trigger()`)
- [ ] Cross-field validation handled (password confirmation, date ranges)
- [ ] File upload validation (size, type, count) in Zod schema
- [ ] Error messages are user-friendly (not technical Zod output)
