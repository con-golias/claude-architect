---
mode: auto
paths:
  - "src/**/components/**"
  - "src/**/pages/**"
  - "src/**/views/**"
  - "src/**/hooks/**"
  - "src/**/stores/**"
  - "src/frontend/**"
  - "src/client/**"
  - "app/**"
---
## Frontend Architecture Rules

### Component Architecture
- Presentational vs Container separation:
  - Presentational: receives props, renders UI, no side effects
  - Container: manages state, calls hooks/services, passes data to presentational
- Component file size: max 150 lines — split if larger
- One component per file — named export matching filename
- Co-locate component styles, tests, and types in same directory

### State Management
- Local state first — only lift state when truly needed by siblings/parents
- Server state (API data): use dedicated library (React Query, SWR, Apollo)
- Global client state: use store only for truly global state (auth, theme, locale)
- Never duplicate server state in global store
- Derive computed values — never store what can be calculated

### Data Fetching
- Fetch in container/page components or custom hooks — never in presentational components
- ALL API calls go through a centralized API client/service layer
- Never call fetch/axios directly in components — use the API layer
- Handle loading, error, and empty states for EVERY data fetch
- Implement optimistic updates for better UX where appropriate

### Form Handling
- Use form library (React Hook Form, Formik, VeeValidate) for complex forms
- Validate on both client (UX) and server (security)
- Show inline validation errors next to fields
- Disable submit button during submission — prevent double submit
- Show loading state during submission

### Accessibility (A11y Baseline)
- All images have meaningful alt text (or empty alt="" for decorative)
- All interactive elements are keyboard accessible
- Use semantic HTML elements (button, nav, main, section) over divs
- Form inputs have associated labels
- Color is not the only means of conveying information
- Maintain sufficient color contrast (WCAG AA minimum: 4.5:1)

### Error Boundaries
- Wrap major sections in error boundaries
- Show user-friendly fallback UI on errors
- Log errors to monitoring service
- Never show raw error messages or stack traces to users

### Routing
- Lazy-load route components for code splitting
- Implement route guards for protected pages
- Handle 404 with a proper not-found page
- Use descriptive, SEO-friendly URLs

### CSS/Styling Standards
- Choose ONE approach and be consistent: CSS Modules, Tailwind, styled-components
- Never use inline styles for anything beyond truly dynamic values
- Use design tokens/CSS variables for colors, spacing, typography
- Mobile-first responsive design
- No magic numbers — use spacing/sizing scale
