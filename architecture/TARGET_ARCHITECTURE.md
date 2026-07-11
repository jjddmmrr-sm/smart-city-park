# Smart City Platform — Target Architecture

# Purpose

This document defines the target architecture of the Smart City Platform.

The objective is to evolve the current validated prototype into a scalable enterprise operational platform capable of supporting:

- municipalities,
- parking operators,
- citizens,
- controllers,
- smart cameras,
- realtime operations,
- AI-assisted decision making.

---

# Architectural Vision

The platform will become a multi-tenant Smart City Operations Platform.

The system must support:

- multiple municipalities,
- multiple cities,
- multiple parking zones,
- realtime occupancy monitoring,
- controller field operations,
- citizen self-service,
- payment processing,
- smart camera integrations,
- analytics,
- AI-powered operational intelligence.

---

# Architectural Principles

The architecture must prioritize:

- modularity,
- maintainability,
- scalability,
- security,
- observability,
- AI readiness,
- operational reliability.

The platform should evolve progressively without requiring complete rewrites.

---

# High-Level Platform Architecture

The target platform will be composed of several operational layers.

````text
Smart City Platform
│
├── Web Admin Platform
│   └── Municipal dashboard, analytics, configuration and monitoring
│
├── Controller App
│   └── Field operations, inspections, violations and evidence capture
│
├── Citizen App
│   └── Parking activation, payments, vehicles and notifications
│
├── Backend API Platform
│   └── Business logic, security, tenancy, operations and integrations
│
├── Realtime Layer
│   └── Live occupancy, alerts, events and operational updates
│
├── Camera & IoT Layer
│   └── Smart cameras, occupancy detections and device events
│
├── Database Layer
│   └── PostgreSQL operational source of truth
│
├── Automation Layer
│   └── n8n workflows, notifications and operational automation
│
└── AI Intelligence Layer
    └── Predictions, anomaly detection, optimization and insights

---

# Frontend Target Architecture

The current frontend generated from the Lovable prototype will be preserved as the starting point of the platform.

The frontend already provides:

- operational dashboards,
- occupancy visualization,
- maps,
- analytics,
- controller views,
- payment views,
- navigation structure.

The objective is to progressively evolve the frontend rather than rebuild it.

---

# Frontend Technology Stack

The target frontend stack remains:

- React
- TypeScript
- Vite
- TanStack Router
- React Query
- TailwindCSS
- Leaflet
- Recharts

This stack is sufficient for:

- operational dashboards,
- realtime monitoring,
- controller workflows,
- citizen workflows,
- administrative functions.

---

# Frontend Applications

The platform will eventually contain three primary frontend experiences.

## Admin Platform

Purpose:

- municipal administration,
- analytics,
- operational monitoring,
- configuration,
- reporting.

Main users:

- administrators,
- supervisors,
- analysts,
- operators.

---

## Controller Application

Purpose:

- inspections,
- occupancy validation,
- violations,
- evidence capture,
- field operations.

Main users:

- controllers,
- supervisors.

Initially this may be implemented as a responsive web application (PWA).

---

## Citizen Application

Purpose:

- activate parking,
- manage vehicles,
- make payments,
- view history,
- receive notifications.

Main users:

- citizens,
- drivers.

Initially this may share components and services with the main frontend.

---

# Frontend Architectural Principles

The frontend should follow:

- domain-based organization,
- reusable components,
- shared design system,
- API-driven architecture,
- separation of business logic and presentation,
- realtime capability,
- mobile responsiveness.

---

# Progressive Refactoring Strategy

The current frontend should evolve through:

Phase 1:
- remove mock dependencies
- connect backend APIs

Phase 2:
- introduce authentication
- introduce RBAC

Phase 3:
- add realtime updates

Phase 4:
- support controller workflows

Phase 5:
- support citizen workflows

The platform must avoid large-scale rewrites whenever possible.

---

# Backend Target Architecture

The backend will be the operational core of the Smart City Platform.

Its responsibilities include:

- business rules,
- operational workflows,
- security,
- authentication,
- multi-tenancy,
- realtime events,
- integrations,
- analytics processing,
- camera event ingestion.

---

# Backend Technology Stack

The target backend stack is:

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- WebSockets
- JWT Authentication
- Docker

---

# Architectural Style

The backend will follow a Modular Monolith architecture.

Benefits:

- clear domain separation,
- easier maintenance,
- simpler deployment,
- lower operational cost,
- faster development,
- future microservice readiness.

---

# Core Business Modules

## Auth Module

Responsibilities:

- authentication
- JWT tokens
- login
- password management
- session control

---

## Tenant Module

Responsibilities:

- municipalities
- operators
- city configuration
- tenant isolation

---

## User Management Module

Responsibilities:

- users
- roles
- permissions
- RBAC
- auditability

---

## Parking Module

Responsibilities:

- zones
- streets
- parking spaces
- inventory management
- operational status

---

## Occupancy Module

Responsibilities:

- occupancy events
- current occupancy state
- realtime availability
- occupancy validation

---

## Parking Session Module

Responsibilities:

- parking activation
- parking extension
- session lifecycle
- expiration management

---

## Citizen Module

Responsibilities:

- citizen profiles
- registered vehicles
- parking history
- user preferences

---

## Payment Module

Responsibilities:

- payments
- payment methods
- reconciliation
- transaction history

---

## Controller Module

Responsibilities:

- controller management
- assignments
- productivity
- inspections

---

## Enforcement Module

Responsibilities:

- violations
- fines
- evidence
- enforcement workflows

---

## Camera Module

Responsibilities:

- camera registry
- event ingestion
- occupancy detections
- device monitoring

---

## Notification Module

Responsibilities:

- alerts
- reminders
- operational notifications
- citizen notifications

---

## Analytics Module

Responsibilities:

- KPIs
- reports
- metrics
- operational dashboards

---

# Backend Design Principles

The backend must enforce:

- business consistency,
- auditability,
- traceability,
- security,
- tenant isolation,
- operational reliability.

No frontend application should bypass backend business rules.

---

# Database Target Architecture

The database is the operational source of truth of the platform.

All business operations must be persisted through PostgreSQL.

The database supports:

- operational transactions,
- occupancy management,
- citizen services,
- payments,
- controller operations,
- camera integrations,
- analytics,
- auditability.

---

# Database Technology Stack

The platform database stack consists of:

- PostgreSQL
- Prisma ORM
- Migration-based schema management
- Docker deployment

---

# Data Ownership Model

The database must be organized by business domains.

Main domains include:

- tenancy
- cities
- parking operations
- citizens
- payments
- controllers
- enforcement
- cameras
- analytics
- security

---

# Operational Source of Truth

The database becomes the single source of truth for:

- parking spaces
- occupancy state
- active parking sessions
- payments
- violations
- controller activities
- camera detections
- municipal operations

Mock JSON datasets must eventually be retired.

---

# Historical vs Realtime Data

The platform maintains:

## Historical Data

Stores:

- occupancy history
- payments history
- controller activity
- enforcement history
- camera events

Purpose:

- reporting
- auditing
- AI analytics
- forecasting

---

## Current State Data

Stores:

- current occupancy
- active sessions
- active violations
- active devices

Purpose:

- realtime dashboards
- live maps
- operational monitoring
- alert generation

---

# Prisma Strategy

Prisma will be used for:

- schema definition
- migrations
- data access
- validation
- type-safe development

Benefits:

- faster development
- strong typing
- safer refactoring
- better Claude productivity

---

# Data Architecture Principles

The database must support:

- tenant isolation
- auditability
- scalability
- operational consistency
- realtime operations
- future AI workloads

The database is considered a strategic platform asset and must evolve under controlled governance.

---

# Realtime Architecture

The platform must provide realtime operational visibility.

Operational users should not need to refresh pages manually.

The system should automatically propagate relevant operational events.

---

# Realtime Objectives

Provide live visibility of:

- parking occupancy
- active parking sessions
- violations
- controller activity
- camera detections
- device health
- operational alerts

---

# Realtime Technology

The platform will use:

- WebSockets
- NestJS Gateway
- Event-driven updates

This enables bidirectional communication between backend services and frontend clients.

---

# Operational Event Types

Examples include:

- parking_session_started
- parking_session_extended
- parking_session_expired
- occupancy_detected
- occupancy_released
- violation_detected
- fine_created
- payment_confirmed
- controller_checkin
- controller_inspection_completed
- camera_online
- camera_offline

---

# Realtime Update Flow

Example:

Citizen activates parking.

1. Session created
2. Payment validated
3. Occupancy updated
4. Realtime event generated
5. Dashboard updated
6. Controller app updated
7. Analytics updated

---

# Occupancy Synchronization

Occupancy updates may originate from:

- citizen actions
- controller actions
- camera detections
- administrative actions
- automated workflows

All occupancy changes must pass through backend validation.

---

# Alerting Model

The platform should generate realtime alerts for:

- unpaid occupancy
- expired sessions
- device failures
- camera outages
- controller inactivity
- operational anomalies

---

# Operational Benefits

Realtime architecture enables:

- live occupancy maps
- operational monitoring
- faster enforcement
- improved revenue capture
- better citizen experience
- AI-assisted operations

---

# Architectural Principle

Realtime services must complement operational transactions.

The database remains the source of truth.

Realtime channels distribute state changes and operational events.

---

# Deployment Architecture

The platform will be deployed using a containerized architecture.

All core services will run inside Docker containers.

This provides:

- portability
- isolation
- easier maintenance
- reproducible environments
- controlled deployments

---

# Infrastructure Foundation

Current infrastructure:

- Ubuntu Server
- Docker
- PostgreSQL
- n8n
- GitHub
- VS Code Remote SSH

This infrastructure becomes the foundation of the platform.

---

# Initial Deployment Topology

```text
Internet
    │
    ▼
Reverse Proxy
    │
 ┌──┼───────────────────────────┐
 │  │                           │
 ▼  ▼                           ▼

Frontend App                API Backend
React/Vite                  NestJS

         │
         ▼

     PostgreSQL

         │
         ▼

        n8n

         │
         ▼

Camera Integrations
External Services
Notifications

---

# Security & RBAC Architecture

The platform must implement security as a foundational capability.

Security is required to protect:

- citizens,
- vehicles,
- payments,
- violations,
- municipal operations,
- camera integrations,
- operational analytics.

---

# Authentication Strategy

The platform will use:

- JWT Authentication
- Refresh Tokens
- Role-Based Access Control (RBAC)

Authentication responsibilities:

- login
- logout
- token validation
- password recovery
- session management

---

# Role-Based Access Control

The platform must support multiple operational roles.

---

## Super Admin

Responsibilities:

- platform governance
- tenant management
- platform configuration
- global monitoring

Scope:

- all tenants
- all cities

---

## Tenant Administrator

Responsibilities:

- municipality administration
- operational configuration
- user administration
- reporting

Scope:

- assigned tenant only

---

## City Administrator

Responsibilities:

- local operations
- controller supervision
- zone management
- enforcement supervision

Scope:

- assigned city only

---

## Supervisor

Responsibilities:

- controller monitoring
- productivity tracking
- operational review
- escalation management

Scope:

- assigned operational areas

---

## Controller

Responsibilities:

- occupancy verification
- inspections
- violation generation
- evidence capture

Scope:

- assigned zones

---

## Analyst

Responsibilities:

- dashboards
- analytics
- operational reporting
- KPI monitoring

Scope:

- reporting access only

---

## Citizen

Responsibilities:

- parking activation
- payment management
- vehicle management
- personal history

Scope:

- own account only

---

## Integration Service

Responsibilities:

- camera integrations
- automation workflows
- external systems

Scope:

- machine-to-machine operations

---

# Authorization Principles

Users must only access:

- authorized tenants
- authorized cities
- authorized modules
- authorized data

No cross-tenant visibility is allowed.

---

# Auditability Requirements

Critical actions must generate audit records.

Examples:

- login
- role changes
- payment updates
- tariff changes
- fine creation
- fine cancellation
- camera configuration updates

---

# Security Principles

The platform must enforce:

- least privilege access
- tenant isolation
- secure authentication
- auditability
- traceability
- operational accountability

Security must be built into the architecture from the beginning.

---

# Future Evolution & Scalability Architecture

The platform is designed to evolve beyond parking management into a broader Smart City Operations Platform.

The initial parking domain becomes the foundation for future urban operational services.

---

# AI Operational Intelligence

Future AI capabilities include:

- occupancy forecasting
- revenue forecasting
- violation prediction
- controller productivity optimization
- anomaly detection
- operational recommendations
- demand forecasting

The objective is to transform operational data into actionable intelligence.

---

# Computer Vision Evolution

Future integrations may include:

- Automatic Number Plate Recognition (ANPR)
- vehicle classification
- occupancy AI models
- parking behavior analytics
- enforcement automation
- fraud detection

The platform should remain compatible with future AI inference services.

---

# Dynamic Operations Optimization

Future optimization services may include:

- dynamic parking pricing
- demand-based tariffs
- controller route optimization
- hotspot identification
- congestion prediction
- parking demand balancing

---

# Smart City Expansion

The platform architecture should support future domains such as:

- traffic monitoring
- public safety integrations
- mobility analytics
- urban telemetry
- environmental sensors
- municipal operations monitoring

Parking becomes one operational domain inside a broader Smart City ecosystem.

---

# Multi-City SaaS Evolution

The platform must support:

- multiple municipalities
- regional operators
- private parking operators
- centralized administration
- SaaS deployment models

The onboarding of a new city should require configuration rather than software modification.

---

# Integration Ecosystem

Future integrations may include:

- banking services
- payment gateways
- municipal ERP systems
- GIS platforms
- camera vendors
- IoT platforms
- notification providers
- government platforms

The architecture should remain API-first.

---

# Scalability Strategy

The initial architecture uses a Modular Monolith.

As operational complexity increases, selected modules may be extracted into independent services.

Potential future candidates:

- analytics
- notifications
- camera processing
- AI services

Microservices should only be introduced when justified by operational requirements.

---

# Long-Term Vision

The platform should evolve into:

A multi-tenant, AI-powered, realtime Smart City Operations Platform capable of supporting municipalities, operators, citizens, and connected urban infrastructure.

The architecture must prioritize:

- maintainability
- scalability
- operational reliability
- security
- extensibility
- AI readiness

Technology choices should support long-term product evolution rather than short-term implementation convenience.
````
