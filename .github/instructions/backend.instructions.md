---
applyTo: "**/apps/api/**/*.ts"
---

- Keep controllers thin.
- Put application and domain logic in services.
- Validate DTO input.
- Enforce authorization and tenant scope in backend operations.
- Use dependency injection.
- Avoid direct persistence logic in controllers.
- Preserve auditability for privileged operations.
