# Smart City Park — MVP Scope

# Purpose

This document defines the first executable MVP scope for the Smart City Park platform.

The objective is to transform the current prototype into an operational pilot system that can be tested with real municipal parking workflows.

---

# MVP Goal

Build the first operational version of the platform capable of supporting:

- municipal monitoring,
- parking space management,
- controller operations,
- parking sessions,
- basic enforcement,
- occupancy visualization,
- operational dashboards.

The MVP must validate the core business model before adding advanced AI, camera automation, and large-scale integrations.

---

# MVP Philosophy

The MVP should be:

- operationally useful,
- technically solid,
- simple enough to build quickly,
- extensible for future phases,
- aligned with the enterprise architecture.

The MVP should NOT attempt to implement every long-term feature at once.

---

# MVP Users & Roles

The MVP focuses on the operational users required for a successful field pilot.

---

## Municipal Administrator

Purpose:

Manage the parking operation.

Responsibilities:

- configure operational parameters
- manage parking zones
- manage parking spaces
- review operational dashboards
- monitor revenue
- monitor occupancy
- manage controllers

Key MVP capabilities:

- access dashboard
- manage zones
- manage parking inventory
- view reports
- view violations

---

## Controller

Purpose:

Perform field parking enforcement activities.

Responsibilities:

- inspect parked vehicles
- validate active parking sessions
- identify violations
- create enforcement records
- capture evidence

Key MVP capabilities:

- login
- view assigned zones
- search vehicles
- validate parking sessions
- create violations
- upload evidence

---

## Citizen

Purpose:

Use the parking service.

Responsibilities:

- register vehicles
- activate parking sessions
- pay for parking
- review parking history

Key MVP capabilities:

- register account
- register vehicles
- start parking session
- extend parking session
- review active sessions
- review payment history

---

# MVP Scope Limitation

The MVP intentionally limits the number of user profiles.

Included:

- Municipal Administrator
- Controller
- Citizen

Deferred to future phases:

- Regional Administrator
- External Auditor
- Operations Manager
- AI Supervisor
- Third-Party Integrations

---

# MVP Functional Scope

The MVP must validate the complete parking operation lifecycle.

The goal is to support real operational testing with municipalities, controllers, and citizens.

---

# Included Functionalities

## Parking Inventory Management

Capabilities:

- create parking zones
- manage streets
- manage parking spaces
- classify parking spaces
- activate/deactivate spaces

Purpose:

Provide the operational parking inventory.

---

## Citizen Management

Capabilities:

- citizen registration
- citizen profile management
- vehicle registration
- vehicle administration

Purpose:

Enable parking activation and user tracking.

---

## Parking Session Management

Capabilities:

- start parking session
- extend parking session
- end parking session
- view active sessions
- view historical sessions

Purpose:

Support real parking usage.

---

## Basic Payment Management

Capabilities:

- register payment
- validate payment
- payment history
- payment status

Purpose:

Support revenue validation.

Note:

Initial MVP may use simulated or simplified payment integrations.

---

## Controller Operations

Capabilities:

- controller login
- assigned zones
- vehicle verification
- parking session validation
- occupancy validation

Purpose:

Support field operations.

---

## Violation Management

Capabilities:

- create violation
- attach evidence
- view violations
- track violation status

Purpose:

Support enforcement operations.

---

## Operational Dashboard

Capabilities:

- occupancy overview
- active sessions
- revenue overview
- violations summary
- controller activity

Purpose:

Provide operational visibility.

---

## Basic Occupancy Visualization

Capabilities:

- map visualization
- occupancy indicators
- parking status visibility

Purpose:

Support operational monitoring.

---

# MVP Exclusions

The following capabilities are intentionally excluded from the first pilot.

---

## Camera Automation

Excluded:

- automatic occupancy validation
- automatic violation generation
- ANPR processing
- AI vision models

Reason:

Will be implemented after operational validation.

---

## Artificial Intelligence

Excluded:

- occupancy forecasting
- revenue prediction
- anomaly detection
- controller optimization

Reason:

Requires operational data collection first.

---

## Dynamic Pricing

Excluded:

- adaptive tariffs
- demand-based pricing

Reason:

Not required for initial pilot.

---

## Advanced Integrations

Excluded:

- municipal ERP integration
- banking integrations
- GIS integrations
- government platforms

Reason:

Can be added progressively.

---

# MVP Success Criteria

The MVP is considered successful if it can:

- manage parking inventory
- register citizens and vehicles
- activate parking sessions
- validate payments
- support controller inspections
- generate violations
- display operational dashboards
- support real pilot operations

---

# MVP Guiding Principle

The MVP must prove operational viability.

The objective is not feature completeness.

The objective is validating the business model, operational workflows, and platform foundation.

---

# MVP User Journeys

The MVP must support the complete operational flow for citizens, controllers, and municipal administrators.

---

# Citizen Journey

Objective:

Activate and manage parking legally and efficiently.

Flow:

1. Citizen registers account
2. Citizen registers vehicle
3. Citizen selects parking zone
4. Citizen starts parking session
5. System validates payment
6. Session becomes active
7. Citizen may extend session
8. Session expires or ends
9. Session history is stored

Expected Outcome:

The citizen can legally occupy a parking space and pay for usage.

---

# Controller Journey

Objective:

Validate parking compliance and enforce regulations.

Flow:

1. Controller logs into system
2. Controller views assigned zone
3. Controller identifies vehicle
4. Controller searches vehicle plate
5. System validates active parking session
6. Controller verifies occupancy
7. If compliant:
   - inspection recorded

8. If non-compliant:
   - violation created
   - evidence attached
   - enforcement case recorded

Expected Outcome:

The controller can efficiently validate parking compliance and issue violations when necessary.

---

# Municipal Administrator Journey

Objective:

Monitor and manage parking operations.

Flow:

1. Administrator logs in
2. Reviews operational dashboard
3. Reviews occupancy indicators
4. Reviews active sessions
5. Reviews controller productivity
6. Reviews violations
7. Reviews revenue metrics
8. Updates operational configuration when required

Expected Outcome:

The municipality gains operational visibility and control.

---

# Parking Session Lifecycle

Flow:

1. Session Created
2. Payment Validated
3. Session Active
4. Session Extended (optional)
5. Session Expired
6. Session Closed

Possible States:

- pending
- active
- extended
- expired
- closed

---

# Violation Lifecycle

Flow:

1. Violation Detected
2. Evidence Captured
3. Violation Recorded
4. Review (optional)
5. Fine Generated
6. Resolution

Possible States:

- detected
- pending_review
- confirmed
- fined
- resolved
- cancelled

---

# Occupancy Validation Workflow

Initial MVP:

Occupancy validation is performed manually by controllers.

Flow:

1. Vehicle observed
2. Controller validates plate
3. System searches active session
4. Compliance result returned
5. Controller records outcome

Future versions may automate this process using camera detections.

---

# MVP Validation Objective

The MVP is successful when all three operational journeys can be completed end-to-end using the platform:

- Citizen Journey
- Controller Journey
- Municipal Administrator Journey

This validates the operational model before introducing advanced automation and AI capabilities.