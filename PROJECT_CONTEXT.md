# Project Context — Smart City Park

## Mission

Build an enterprise-grade, multi-tenant Smart City operational platform for
municipalities, parking operators and enforcement teams.

## Business capabilities

- Tenant and city management
- Parking operations
- Realtime occupancy
- Controllers and enforcement
- Fines and violations
- Payment methods and revenue
- Users, roles and permissions
- Auditability and operational traceability
- Camera and IoT integration
- Analytics and reporting

## Primary users

- Platform administrators
- Municipality administrators
- Parking operators
- Enforcement controllers
- Operational supervisors
- Analytics and management teams

## Current architecture

Frontend:

- React
- TypeScript
- Vite
- TanStack Router
- TailwindCSS
- Leaflet
- Recharts

Backend:

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- Modular monolith

Infrastructure:

- Ubuntu on DigitalOcean
- Docker and Docker Compose
- PostgreSQL container
- n8n
- GitHub
- VS Code Remote SSH

## Architecture principles

- Multi-tenant by design
- Tenant and city isolation
- Backend-enforced authorization
- RBAC and permission-based access
- Auditability for privileged operations
- Modular domain boundaries
- Vendor-neutral IoT architecture
- Incremental evolution from the validated frontend

## Current branch context

The active implementation includes substantial work related to:

- authentication;
- RBAC;
- permissions;
- audit services;
- parking scope;
- users and roles;
- administrative catalogs;
- frontend route guards.

## Current technical risks

- React 19 conflicts with the peer requirements of React Leaflet 4.2.1.
- A clean `npm install` currently fails due to peer dependency resolution.
- Existing `node_modules` allows development and production builds.
- Backup source files must remain excluded from Git and builds.
- Prisma changes require explicit review before migrations.

## Required validation

Frontend:

- `npm run build`
- lint when configured

Backend:

- NestJS build
- tests when available
- Prisma schema validation
- no migrations without explicit approval

## AI operating model

Claude Code is the primary repository-level engineering assistant.

GitHub Copilot supports:

- autocompletion;
- small changes;
- inline explanations;
- focused tests.

Both tools must follow:

1. `AGENTS.md`
2. this file;
3. architecture documentation;
4. existing source-code patterns.
