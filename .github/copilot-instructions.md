# GitHub Copilot Repository Instructions

Follow `AGENTS.md` as the primary engineering standard.

Before generating code:

- Inspect surrounding code and reuse existing patterns.
- Respect project architecture and module boundaries.
- Prefer typed, readable and testable implementations.
- Avoid introducing dependencies unless explicitly requested.
- Never generate hard-coded credentials or secrets.
- Never weaken authentication, authorization, tenant isolation or validation.

When suggesting changes:

- Keep the scope small.
- Include error handling.
- Preserve backward compatibility unless the task says otherwise.
- Add or update tests when behavior changes.
- Use English for code and technical identifiers.
