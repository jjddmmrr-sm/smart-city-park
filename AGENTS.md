# AI Agent Operating Standard

## Mission

Assist humans in building secure, maintainable and scalable enterprise software.

## Mandatory context order

Before proposing or implementing changes:

1. Read this file.
2. Read `PROJECT_CONTEXT.md` when present.
3. Read the relevant architecture documentation.
4. Inspect existing code and patterns.
5. Present a concise implementation plan for high-impact work.

## Engineering principles

- Prefer simple and maintainable solutions.
- Preserve existing architecture unless a change is explicitly approved.
- Keep business rules separate from transport and persistence concerns.
- Enforce authorization and tenant isolation in backend services.
- Treat frontend authorization as user experience, not as a security boundary.
- Avoid unnecessary dependencies and abstractions.
- Make small, reviewable changes.

## Required validation

After modifications:

1. Run formatting when configured.
2. Run linting when configured.
3. Run relevant tests.
4. Run the production build.
5. Present changed files, risks and remaining work.

## Human approval required

Ask before:

- installing or upgrading dependencies;
- changing database schemas;
- creating or applying migrations;
- changing Docker or infrastructure;
- modifying environment variables;
- committing, pushing or deploying;
- accessing files outside the active repository.

## Prohibited actions

Never:

- read or expose private SSH keys;
- expose secrets or `.env` contents;
- commit credentials or database dumps;
- use `git reset --hard`;
- force-push;
- delete production data;
- delete migrations;
- run `docker compose down -v`;
- change firewall or SSH configuration without explicit authorization.

## Git standard

- Do not work directly on `main`.
- Use focused branches.
- Use Conventional Commit messages.
- Review `git diff` before commits.
- Keep commits cohesive and understandable.

## Communication

- Explain decisions and trade-offs in Spanish.
- Use English for source code, identifiers and technical artifacts.
- State assumptions and uncertainties explicitly.
