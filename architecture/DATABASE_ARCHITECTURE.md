# Smart City Park — Database Architecture

## Purpose

This document defines the database architecture for the Smart City Park platform.

The database is the operational source of truth for:
- municipalities,
- cities,
- parking zones,
- parking spaces,
- citizens,
- vehicles,
- controllers,
- parking sessions,
- payments,
- violations,
- camera events,
- occupancy events,
- analytics.

---

## Database Engine

The platform will use:

- PostgreSQL

PostgreSQL is selected because it supports:
- relational integrity,
- geospatial extensions,
- JSONB,
- indexes,
- analytics,
- transactional consistency,
- scalability,
- enterprise-grade workloads.

---

## Architecture Principle

The platform will not treat the database as a simple storage layer.

The database is part of the core operational architecture.

It must support:
- multi-city operations,
- realtime occupancy,
- controller workflows,
- citizen parking sessions,
- camera-generated events,
- financial transactions,
- enforcement processes,
- auditability,
- analytics,
- AI-ready historical data.

---

## Multi-Tenant Principle

Every operational entity must support multi-tenancy.

Core identifiers:

- tenant_id
- city_id

This enables the platform to serve multiple municipalities or operators from the same platform foundation.

---

# Core Entity Groups

The database will be organized around the following operational domains.

---

## 1. Tenant & City Management

Responsible for supporting multiple municipalities, operators, and cities.

Core tables:

- tenants
- cities
- city_settings
- operational_rules

Purpose:

- isolate each municipality,
- configure city-specific rules,
- support future multi-city SaaS model.

---

## 2. Parking Inventory

Responsible for managing the physical parking infrastructure.

Core tables:

- zones
- streets
- blocks
- parking_spaces
- parking_space_types
- parking_space_status_history

Purpose:

- define tariffed zones,
- define streets and blocks,
- register each parking space,
- georeference parking assets,
- classify space types.

---

## 3. Users, Roles & Access Control

Responsible for authentication, authorization, and platform security.

Core tables:

- users
- roles
- permissions
- user_roles
- audit_logs

Purpose:

- support administrators,
- municipal operators,
- supervisors,
- controllers,
- analysts,
- citizens,
- system users.

---

## 4. Citizen & Vehicle Management

Responsible for citizen accounts and registered vehicles.

Core tables:

- citizens
- vehicles
- citizen_vehicles

Purpose:

- register citizens,
- associate vehicles,
- support parking activation,
- support payment history,
- support violation history.

---

## 5. Parking Sessions

Responsible for active and historical parking usage.

Core tables:

- parking_sessions
- parking_session_extensions
- parking_session_status_history

Purpose:

- activate parking,
- track start and end time,
- validate payment,
- detect expired sessions,
- support controller verification.

---

## 6. Payments & Revenue

Responsible for financial operations and payment channels.

Core tables:

- payments
- payment_methods
- wallet_transactions
- recharge_transactions
- payment_reconciliations

Purpose:

- track payments,
- support mobile app payments,
- support cards,
- support kiosks,
- support agents,
- support future bank integrations.

---

## 7. Controllers & Field Operations

Responsible for field workforce management.

Core tables:

- controllers
- controller_assignments
- controller_locations
- controller_inspections
- controller_productivity

Purpose:

- assign controllers to zones,
- track inspections,
- record field operations,
- monitor productivity,
- support mobile controller app.

---

## 8. Enforcement, Violations & Fines

Responsible for enforcement workflows.

Core tables:

- enforcement_cases
- violations
- fines
- fine_status_history
- evidence_files

Purpose:

- detect violations,
- generate fines,
- attach evidence,
- manage fine lifecycle,
- support appeals or reversals.

---

## 9. Cameras & IoT

Responsible for smart camera integrations and automated detections.

Core tables:

- cameras
- camera_zones
- camera_events
- occupancy_detections
- device_status_history

Purpose:

- register smart cameras,
- receive camera events,
- detect occupancy,
- detect no-payment cases,
- monitor camera health.

---

## 10. Occupancy & Realtime State

Responsible for live parking availability.

Core tables:

- occupancy_events
- parking_space_current_state
- occupancy_snapshots

Purpose:

- store occupancy changes,
- support realtime map,
- maintain current state per space,
- support alerts and analytics.

---

## 11. Analytics & Reporting

Responsible for historical operational intelligence.

Core tables:

- daily_zone_metrics
- hourly_occupancy_metrics
- revenue_metrics
- enforcement_metrics
- controller_metrics

Purpose:

- support dashboards,
- support operational reporting,
- support financial reporting,
- support AI forecasting,
- support strategic decision making.

---

---

# Naming Standards

The database will follow clear and consistent naming standards.

## Table Names

- Use lowercase
- Use snake_case
- Use plural nouns

Examples:

- parking_spaces
- parking_sessions
- camera_events
- controller_inspections

## Column Names

- Use lowercase
- Use snake_case
- Be explicit and business-readable

Examples:

- tenant_id
- city_id
- parking_space_id
- created_at
- updated_at

## Primary Keys

All main tables should use:

id UUID PRIMARY KEY

## Foreign Keys

Foreign keys must be explicit:

tenant_id
city_id
zone_id
parking_space_id
vehicle_id
controller_id
camera_id

---

# Standard Base Columns

Most operational tables should include:

id
tenant_id
city_id
created_at
updated_at
deleted_at
created_by
updated_by

## Purpose

These columns support:

- multi-tenancy
- auditability
- soft deletion
- traceability
- future analytics
- compliance
- operational control

---

# Soft Delete Strategy

Instead of deleting critical operational records, the platform should use:

deleted_at

This allows:

- audit trails
- historical recovery
- operational traceability
- legal evidence preservation

---

# Auditability Principle

Critical operational tables must preserve history.

Examples:

- parking_sessions
- payments
- violations
- fines
- camera_events
- controller_inspections

The platform must be able to answer:

- who created the record,
- when it was created,
- who modified it,
- when it changed,
- what operational event caused the change.

---

# Multi-Tenant Strategy

The platform is designed as a multi-tenant smart city operational platform.

This means the same platform foundation must support:

- multiple municipalities,
- multiple operators,
- multiple cities,
- future regional expansion.

---

# Tenant Isolation Principle

Every operational entity must belong to:

- tenant_id
- city_id

Examples:

- parking_spaces
- parking_sessions
- payments
- violations
- controllers
- cameras
- occupancy_events

This guarantees operational isolation between municipalities.

---

# Tenant Examples

Example structure:

Tenant:
- Municipality of Chone

Cities:
- Chone Downtown
- Chone North Sector

Future tenants:
- Municipality of Manta
- Municipality of Portoviejo
- Private Parking Operators

---

# Data Isolation Strategy

The platform must prevent cross-tenant data visibility.

Examples:

- controllers from one city cannot view another city,
- payments are isolated by municipality,
- analytics are isolated per tenant,
- operational dashboards are tenant-scoped.

---

# Multi-City Scalability

The architecture must support:

- adding new cities without changing code,
- centralized platform administration,
- future SaaS deployment,
- regional scaling.

---

# Tenant Configuration

Each tenant may define:

- operational rules,
- parking tariffs,
- enforcement policies,
- operational schedules,
- payment methods,
- fine configurations,
- controller assignments.

---

# Operational Benefits

Multi-tenant architecture enables:

- commercial scalability,
- SaaS business model,
- centralized maintenance,
- operational standardization,
- lower deployment costs,
- easier expansion.

---

# Architectural Principle

The platform must be designed as:

a reusable operational platform,

NOT as:

a hardcoded system for a single municipality.

---

# Realtime Occupancy Architecture

The platform must support realtime parking occupancy visibility.

Occupancy state can be updated by multiple sources:

- camera detections,
- controller inspections,
- citizen parking sessions,
- payment activations,
- manual backoffice updates,
- system-generated events.

---

# Occupancy Event Model

The platform should store every occupancy-related change as an event.

Core table:

- occupancy_events

Example event types:

- space_available
- space_occupied
- session_started
- session_expired
- payment_validated
- no_payment_detected
- overstay_detected
- controller_verified
- camera_detected_vehicle
- manual_override

---

# Current State Table

For fast realtime dashboards, the platform should maintain a current-state table.

Core table:

- parking_space_current_state

Purpose:

- show current availability,
- power live map,
- reduce expensive historical queries,
- support realtime alerts.

---

# Event History vs Current State

The platform separates:

## Event History

Stores every operational event.

Example:

- occupancy_events
- camera_events
- controller_inspections
- parking_session_status_history

## Current State

Stores the latest known state.

Example:

- parking_space_current_state

This enables both:

- realtime operations,
- historical analytics.

---

# Realtime Update Flow

Example flow:

Camera detects vehicle occupying space.

1. camera_event is received
2. occupancy_event is created
3. parking_space_current_state is updated
4. system validates active payment
5. alert is generated if no valid payment exists
6. dashboard receives realtime update
7. controller app receives task/alert

---

# Realtime Principle

The system must always distinguish between:

- detected occupancy,
- paid parking session,
- validated compliance,
- potential violation.

A space can be:

- occupied and paid,
- occupied without payment,
- occupied with expired session,
- available,
- reserved,
- out of service,
- under maintenance.

---

# Operational Importance

Realtime occupancy is the foundation for:

- live map,
- controller dispatch,
- camera validation,
- citizen availability search,
- revenue optimization,
- enforcement automation,
- AI prediction.

---

# Camera & IoT Data Architecture

The platform must support smart camera and IoT integrations as first-class operational components.

The goal is to automate occupancy validation and reduce revenue leakage.

---

# Camera Integration Model

Each camera must be registered as an operational device.

Core table:

- cameras

Each camera may contain:

- camera identifier
- device serial
- manufacturer
- model
- firmware version
- IP address
- physical location
- associated zone
- operational status

---

# Camera Manufacturers

Initial architecture must support future integrations with:

- Dahua
- Hikvision
- Uniview
- ANPR devices
- AI edge cameras
- IoT sensors

The architecture must remain vendor-agnostic.

---

# Camera Event Ingestion

Camera detections must generate operational events.

Core table:

- camera_events

Examples:

- vehicle_detected
- occupancy_detected
- occupancy_cleared
- plate_detected
- camera_offline
- motion_detected
- device_error

---

# Occupancy Detection Model

Cameras may detect:

- occupied spaces
- available spaces
- unauthorized occupancy
- overstayed sessions
- unpaid occupancy

Core table:

- occupancy_detections

---

# Operational Validation Flow

Example:

1. Camera detects occupied space
2. occupancy_detection event is created
3. system validates active parking session
4. system validates payment status
5. violation risk is calculated
6. realtime alert may be generated
7. controller may receive operational task

---

# Device Health Monitoring

The platform must monitor device operational health.

Core table:

- device_status_history

Examples:

- online
- offline
- degraded
- maintenance_required
- firmware_error

---

# Edge Processing Strategy

Initial architecture may support:

- event ingestion only,
- lightweight camera integrations.

Future architecture may support:

- AI inference at edge,
- ANPR processing,
- occupancy AI models,
- behavior analytics,
- anomaly detection.

---

# Camera Architecture Principle

The platform should NOT tightly couple business logic to specific camera vendors.

All integrations should pass through:

- standardized event ingestion,
- normalized operational events,
- unified occupancy model.

---

# Realtime Operational Impact

Camera events will support:

- live occupancy maps,
- automated enforcement,
- controller dispatch,
- revenue optimization,
- fraud reduction,
- operational intelligence.

---

# Long-Term Vision

The camera architecture should evolve into:

- Smart City IoT Layer
- Urban Telemetry Layer
- AI-assisted operational monitoring platform

---

# Security, Audit & Compliance Architecture

The platform must be designed with strong security, traceability, and operational auditability.

This is critical because the system manages:

- citizens,
- vehicles,
- payments,
- fines,
- controller actions,
- camera evidence,
- municipal operations.

---

# Authentication Model

The platform must support secure authentication for:

- platform administrators,
- municipal administrators,
- supervisors,
- controllers,
- analysts,
- citizens,
- system integrations.

Core tables:

- users
- roles
- permissions
- user_roles
- sessions

---

# Role-Based Access Control

The platform must support RBAC from the beginning.

Initial roles:

- super_admin
- tenant_admin
- city_admin
- supervisor
- controller
- analyst
- citizen
- integration_service

Each role must have explicit permissions.

---

# Audit Logs

Critical operations must generate audit logs.

Core table:

- audit_logs

Events to audit:

- user login
- user creation
- role changes
- tariff changes
- parking space updates
- fine creation
- fine reversal
- payment updates
- manual occupancy overrides
- camera configuration changes

---

# Evidence Preservation

Evidence related to violations must be preserved.

Evidence may include:

- photos,
- camera snapshots,
- plate recognition images,
- controller notes,
- geolocation,
- timestamps,
- device identifiers.

Core table:

- evidence_files

---

# Legal Traceability

The platform must support traceability for enforcement and municipal accountability.

The system should be able to answer:

- who detected the violation,
- how it was detected,
- when it was detected,
- what evidence supports it,
- whether payment existed,
- which controller validated it,
- what action was taken.

---

# Data Protection Principle

Citizen and vehicle data must be protected.

Sensitive data must not be exposed directly in frontend responses unless required by role.

---

# Operational Integrity

The platform must prevent unauthorized:

- fine deletion,
- payment manipulation,
- occupancy override,
- camera event modification,
- role escalation,
- historical record tampering.

---

# Security Principle

Security must be implemented as part of the platform architecture, not as an afterthought.

---

# Database Implementation Roadmap

The database should be implemented progressively.

---

## Phase 1 — Core Foundation

Create the foundational tables:

- tenants
- cities
- users
- roles
- permissions
- zones
- parking_spaces
- vehicles
- controllers

Goal:

Establish the base operational model.

---

## Phase 2 — Parking Operations

Create operational parking tables:

- parking_sessions
- parking_session_extensions
- parking_session_status_history
- parking_space_current_state
- occupancy_events

Goal:

Support real parking activation and occupancy state.

---

## Phase 3 — Payments & Revenue

Create financial operation tables:

- payments
- payment_methods
- wallet_transactions
- recharge_transactions
- payment_reconciliations

Goal:

Support monetization, payments, and revenue tracking.

---

## Phase 4 — Enforcement

Create enforcement tables:

- enforcement_cases
- violations
- fines
- fine_status_history
- evidence_files

Goal:

Support controller validation, violations, fines, and legal evidence.

---

## Phase 5 — Cameras & IoT

Create camera and device tables:

- cameras
- camera_events
- occupancy_detections
- device_status_history

Goal:

Support smart camera integration and automated occupancy validation.

---

## Phase 6 — Analytics

Create analytics and reporting tables:

- daily_zone_metrics
- hourly_occupancy_metrics
- revenue_metrics
- enforcement_metrics
- controller_metrics

Goal:

Support dashboards, reporting, forecasting, and AI analytics.

---

# Final Database Principle

The database must be designed as the operational backbone of the platform.

It must support:

- realtime operations,
- financial traceability,
- municipal accountability,
- AI-ready analytics,
- multi-city scalability,
- camera integrations,
- long-term platform evolution.