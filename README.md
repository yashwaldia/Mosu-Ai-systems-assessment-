# MOSU — Visual Systems Demonstrator

A visual workflow demonstrating remote measurement validation, human approval, and safe notification delivery for custom fashion tailoring.

## 1. Overview

The project models a six-stage workflow:

1. Protocol Setup
2. Profile Intake
3. Measurement Validation & AI Draft
4. Designer Approval
5. Notification Delivery
6. Maker Handoff

The main focus is ensuring that measurement issues are identified, clarification messages are approved by a human before sending, and uncertain notification outcomes can be recovered safely.

## 2. Scenarios Demonstrated

**Scenario A — Normal Workflow**
- Detects a missing waist measurement and an incorrect hip unit.
- Generates a clarification message.
- Blocks sending until the designer approves the exact message.
- Demonstrates successful notification and duplicate-send prevention.
- Shows a corrected profile passing validation and being accepted by the designer.

**Scenario B — Delivery Timeout & Recovery**
- Simulates a notification being delivered while its confirmation is lost.
- Records the delivery status as `unknown`.
- Retries using the same idempotency key.
- Demonstrates two notification requests resulting in one actual delivery.

## 3. Implementation Scope

**Implemented**
- Deterministic measurement and unit validation.
- Workflow state transitions and version-aware approvals.
- Exact-action approval checks before sending.
- Idempotency handling and bounded retries (maximum two attempts).
- Delivery status tracking and request-versus-delivery counters.
- Interactive six-stage workflow visualization and event log.

**Simulated or Conceptual**
- AI clarification drafting uses a deterministic template, not a live AI model.
- Email/SMS delivery uses an in-memory mock provider, not a real notification service.
- Maker handoff is represented as a workflow outcome, not a live production-system integration.

## 4. Key Design Decision & Trade-off

The workflow uses a synchronous, deterministic state reducer with injected tool adapters instead of a distributed event-processing system.

This keeps the demonstrator simple, predictable, and easy to test. The trade-off is that it does not provide the persistence or asynchronous coordination expected in a production environment.

## 5. Limitations

- Workflow state is held in memory and resets when the page is refreshed.
- Notifications are simulated; no real email or SMS is sent.
- AI drafting is template-based; no live LLM integration is connected.
- Maker handoff is conceptual; no external workshop system is connected.

## 6. AI Tool Used

**Google Gemini only.**

Used as a development assistant for UI scaffolding, layout refinement, and implementation support. I reviewed and tested the resulting workflow behaviour myself.

## 7. Time Spent

- Project implementation, testing, and documentation: approximately **105–110 minutes**.
- Video recording: approximately **15–20 minutes**.
- Total including recording: approximately **120–130 minutes**.
