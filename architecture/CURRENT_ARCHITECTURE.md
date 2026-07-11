# Smart City Park — Current Architecture

# Application Type

Frontend-only smart parking operations platform.

---

# Current Stack

## Frontend

- React 19
- TypeScript
- Vite

## Routing

- TanStack Router

## State / Data

- React Query
- Local mock JSON datasets

## UI System

- TailwindCSS v4
- Radix UI
- Custom UI components

## Maps & Geospatial

- Leaflet
- React Leaflet
- leaflet.heat

## Charts & Analytics

- Recharts

## Validation & Forms

- React Hook Form
- Zod

## Infrastructure / Tooling

- Docker
- Ubuntu Cloud Server
- VS Code Remote SSH
- GitHub
- npm

---

# Current Folder Structure

```text
src/
├── assets
├── components
├── data
├── hooks
├── lib
├── routes
├── router.tsx
└── styles.css
```

---

# Components Structure

## components/

Contains:

- UI components
- Layout components
- Map components
- Navigation components

## components/ui/

Generated reusable UI components based on Radix UI and Tailwind.

---

# Data Layer

Current data source:

```text
src/data/*.json
```

Datasets currently include:

- vehicles
- spaces
- zones
- payments
- enforcement
- fines
- analytics
- operational metrics

---

# Current Architecture Characteristics

## Positive Aspects

- Modern frontend stack
- Modular route structure
- Component-based architecture
- Strong UI foundation
- Fast development workflow
- Cloud-ready deployment

## Current Limitations

- No backend API layer
- No authentication
- No PostgreSQL integration
- Mock/static datasets only
- No real-time backend services
- No role-based access control
- No centralized business logic

---

# Technical Risks

## React Compatibility

Current project uses:

- React 19
- react-leaflet 4.2.1

Potential compatibility issues may require:

- downgrading React
  OR
- upgrading map libraries

---

# Infrastructure Status

## Current Infrastructure Available

- Ubuntu cloud server
- Docker installed
- PostgreSQL container running
- n8n container running
- GitHub integration configured
- SSH remote development configured

---

# Planned Technical Evolution

## Phase 1 — Stabilization

- Audit current frontend
- Organize documentation
- Improve architecture visibility
- Stabilize dependencies

## Phase 2 — Backend Foundation

- Create backend service
- Design APIs
- Configure PostgreSQL schema
- Implement data layer

## Phase 3 — Data Migration

- Import Excel datasets
- Normalize operational data
- Replace mock JSON datasets

## Phase 4 — Enterprise Features

- Authentication
- RBAC
- Audit logs
- Monitoring
- Observability

## Phase 5 — AI & Automation

- AI operational insights
- Predictive analytics
- n8n automation workflows
- AI agents
- Smart alerts

---

# Architectural Principles

- Modular architecture
- Progressive refactoring
- AI-first development
- Enterprise scalability
- Clean separation of concerns
- Infrastructure as foundation
- Context Engineering driven development
