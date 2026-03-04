# Ubiquitous Language — Domain Glossary

> This document defines all domain-specific terms used in the codebase.
> NEVER rename a domain concept in code without updating this glossary and getting approval.

## Terms

| Term | Definition | Code Name | Example |
|------|-----------|-----------|---------|
| User | A registered person who can log in | `User` | John Doe with email john@example.com |
| Tenant | An organization/company account | `Tenant` | Acme Corp |
| Order | A purchase request from a user | `Order` | Order #12345 containing 3 items |

## Relationships
- A **Tenant** has many **Users**
- A **User** belongs to one **Tenant**
- A **User** can create many **Orders**

## Rules
1. Every term used in code MUST appear in this glossary
2. If business and code use different words for the same concept, document the mapping
3. New domain concepts require glossary entry BEFORE implementation
4. Deprecated terms should be marked and migration path documented
