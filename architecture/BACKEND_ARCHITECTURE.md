# Smart City Platform — Backend Architecture

# Purpose

This document defines the target backend architecture of the Smart City Platform.

The backend is responsible for:

- business rules,
- operational workflows,
- security,
- tenancy,
- realtime operations,
- integrations,
- analytics processing,
- camera event ingestion.

The backend acts as the operational core of the platform.

---

# Architectural Style

The backend follows a Modular Monolith architecture.

The system is deployed as a single backend application while maintaining clear internal domain boundaries.

Benefits:

- simpler deployment
- lower infrastructure complexity
- faster development
- easier debugging
- stronger consistency
- future microservice readiness

---

# Technology Stack

Backend framework:

- NestJS

Language:

- TypeScript

Database:

- PostgreSQL

ORM:

- Prisma

Authentication:

- JWT
- Refresh Tokens

Realtime:

- WebSockets

Infrastructure:

- Docker

Automation:

- n8n integrations

---

# Architectural Principles

The backend must enforce:

- business consistency
- tenant isolation
- security
- auditability
- traceability
- operational reliability

All business rules must reside in the backend.

Frontend applications must never bypass backend validation.

---

# Backend Module Structure

The backend is organized into business domains.

Each domain is implemented as an independent NestJS module.

This structure promotes:

- maintainability
- scalability
- domain separation
- testability
- future service extraction

---

# Core Platform Modules

## Auth Module

Purpose:

Manage authentication and access control.

Responsibilities:

- login
- logout
- token generation
- refresh tokens
- password recovery
- session validation

Main entities:

- users
- sessions

---

## User Management Module

Purpose:

Manage platform users.

Responsibilities:

- user creation
- user administration
- profile management
- role assignment

Main entities:

- users
- roles
- permissions

---

## Tenant Module

Purpose:

Support multi-tenant operation.

Responsibilities:

- municipalities
- operators
- city assignment
- tenant configuration

Main entities:

- tenants
- cities
- operational_rules

---

# Parking Operations Modules

## Parking Module

Purpose:

Manage parking inventory.

Responsibilities:

- zones
- streets
- parking spaces
- parking classifications
- operational status

Main entities:

- zones
- streets
- parking_spaces

---

## Occupancy Module

Purpose:

Manage occupancy state.

Responsibilities:

- occupancy events
- occupancy validation
- availability calculation
- realtime state updates

Main entities:

- occupancy_events
- parking_space_current_state

---

## Parking Session Module

Purpose:

Manage parking usage lifecycle.

Responsibilities:

- session activation
- session extension
- expiration processing
- validation

Main entities:

- parking_sessions
- parking_session_extensions

---

# Citizen Services Modules

## Citizen Module

Purpose:

Manage citizen accounts and vehicles.

Responsibilities:

- citizen profiles
- vehicle registration
- account preferences
- parking history

Main entities:

- citizens
- vehicles

---

## Payment Module

Purpose:

Manage financial transactions.

Responsibilities:

- payments
- payment methods
- transaction history
- reconciliation

Main entities:

- payments
- payment_methods

---

# Enforcement Modules

## Controller Module

Purpose:

Manage field personnel.

Responsibilities:

- controller registration
- assignments
- inspections
- productivity tracking

Main entities:

- controllers
- controller_assignments
- controller_inspections

---

## Enforcement Module

Purpose:

Manage violations and fines.

Responsibilities:

- violation generation
- evidence management
- fine lifecycle
- enforcement workflows

Main entities:

- violations
- fines
- evidence_files

---

# Smart City Modules

## Camera Module

Purpose:

Manage camera integrations.

Responsibilities:

- device registry
- event ingestion
- occupancy detections
- health monitoring

Main entities:

- cameras
- camera_events
- occupancy_detections

---

## Notification Module

Purpose:

Deliver operational notifications.

Responsibilities:

- alerts
- reminders
- notifications
- messaging

---

## Analytics Module

Purpose:

Provide operational intelligence.

Responsibilities:

- KPI generation
- reporting
- dashboard metrics
- historical analysis

Main entities:

- analytics_snapshots
- operational_metrics

---

# Shared Modules

## Common Module

Purpose:

Provide reusable platform functionality.

Examples:

- utilities
- validation
- helpers
- constants
- shared DTOs

---

## Infrastructure Module

Purpose:

Provide technical integrations.

Examples:

- database access
- external APIs
- storage services
- event publishing
- configuration services

