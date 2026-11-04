import type { BusinessStage, TechnicalNode } from './types';

export const PRIMARY_BUSINESS_STAGES: BusinessStage[] = [
  {
    id: 'stage_submitted',
    stepNumber: '1',
    name: 'Measurement Submitted',
    role: 'Measurement Pro & Customer',
    roleType: 'pro',
    kind: 'implemented',
    shortDesc: 'Customer measurement profile is captured and submitted to MOSU.',
    whatIsHappening:
      'A customer profile snapshot containing physical garment measurements (chest, waist, hip) is submitted to the workflow.',
    whyIsHappening:
      'Remote custom garment tailoring requires accurate client dimensions before any cloth can be patterned or cut.',
    informationUsed:
      'Customer profile ID (e.g. profile-017), version number (v4), recipient email, and measurement key-value pairs with units.',
    responsibleComponent:
      'Measurement Professional Mobile / Web Intake Interface (dispatches LOAD_PROFILE event).',
    decisionRequired:
      'System records the new version snapshot. Prior approvals on earlier versions (v3) are immediately quarantined and cleared.',
    expectedNextStep:
      'The automated validator receives the submitted snapshot to check against the active designer protocol.',
    failureMode:
      'If the intake payload is corrupted or missing schema attributes, the event is rejected before state mutation.',
  },
  {
    id: 'stage_validation',
    stepNumber: '2',
    name: 'Deterministic Validation',
    role: 'Validation Engine',
    roleType: 'system',
    kind: 'implemented',
    shortDesc: 'Automated rules verify required fields, positive numbers, and correct units.',
    whatIsHappening:
      'Deterministic code evaluates all required measurements against the Designer protocol requirements (e.g. standard-fit in cm).',
    whyIsHappening:
      'To prevent tailoring garments with missing numbers (e.g. waist = null) or incorrect unit conversions (e.g. inches instead of cm).',
    informationUsed:
      'Protocol required fields (["chest", "waist", "hip"]), required unit ("cm"), and submitted measurement objects.',
    responsibleComponent:
      'Deterministic Validation Module (validateMeasurements in workflow.mjs). No AI is permitted to invent numbers or alter rules.',
    decisionRequired:
      'Does the profile have 0 issues? If yes, advance to "ready_for_review". If issues exist, mark "needs_clarification".',
    expectedNextStep:
      'If valid, designer directly reviews for production handoff. If invalid, simulated AI drafts clarification copy.',
    failureMode:
      'Identified issues are deterministically sorted lexicographically (e.g. ["missing:waist", "unit:hip:in"]) to preserve repeatability.',
  },
  {
    id: 'stage_ai_draft',
    stepNumber: '3',
    name: 'Clarification Prepared',
    role: 'Simulated AI Drafter',
    roleType: 'ai',
    kind: 'simulated_ai',
    shortDesc: 'LLM drafts a polite, human-friendly clarification message from structured issues.',
    whatIsHappening:
      'A simulated AI assistant reads the structured validation issue codes and generates clear, polite request copy for the customer.',
    whyIsHappening:
      'Raw machine codes (like missing:waist or unit:hip:in) are confusing to end customers; friendly guidance ensures high response rates.',
    informationUsed:
      'Read-only Model Context: profileId, profileVersion, and validated issues list. The AI does NOT have access to tool execution keys or approval authority.',
    responsibleComponent:
      'Simulated AI Drafter (tools.draftClarification). Bound by strict prompt constraints; cannot override deterministic validation.',
    decisionRequired:
      'The generated draft is wrapped into a candidate action (SEND_CLARIFICATION) and bound to a canonical SHA-256 action.id.',
    expectedNextStep:
      'The pending action is submitted to the Designer Approval Gate. Outgoing sending remains strictly blocked.',
    failureMode:
      'If AI generation produces hallucinated text, the human Designer catches it during mandatory approval.',
  },
  {
    id: 'stage_designer_gate',
    stepNumber: '4',
    name: 'Designer Review & Approval',
    role: 'Lead Fashion Designer',
    roleType: 'designer',
    kind: 'implemented',
    shortDesc: 'Human designer inspects the draft and explicitly authorizes the exact action ID.',
    whatIsHappening:
      'The Designer inspects the flagged validation issues and drafted customer message, then approves the exact action ID.',
    whyIsHappening:
      'CRITICAL BOUNDARY: AI models and automated systems must never contact customers autonomously without human sign-off.',
    informationUsed:
      'The pending action object, canonical action.id, recipient email, drafted text, and customer profile history.',
    responsibleComponent:
      'Designer Operations Portal (dispatches APPROVE_ACTION with the exact action.id).',
    decisionRequired:
      'Designer approves or rejects the exact candidate action. Note: Approving the message NEVER approves the customer measurements!',
    expectedNextStep:
      'Once approvedActionId === pendingAction.id, the SEND transition is unlocked.',
    failureMode:
      'If approval is attempted with a mismatched ID or unapproved SEND is clicked, execution is blocked (0 provider calls).',
  },
  {
    id: 'stage_delivery',
    stepNumber: '5',
    name: 'Notification Delivery',
    role: 'Tool Adapter / Provider',
    roleType: 'system',
    kind: 'implemented',
    shortDesc: 'Message dispatched through tool adapter with deterministic idempotency key.',
    whatIsHappening:
      'The workflow invokes tools.notify() passing the action.id as the idempotencyKey, recipient, and message text.',
    whyIsHappening:
      'Isolates side-effects from the core state reducer and guarantees that duplicate network dispatches are caught at the provider gateway.',
    informationUsed:
      'Idempotency key (action.id), customer contact address, and approved text copy.',
    responsibleComponent:
      'Notification Tool Adapter / Mock Provider (simulates external SMS/email gateway).',
    decisionRequired:
      'Tool adapter verifies schema and authorization, dispatches to provider, and awaits delivery receipt.',
    expectedNextStep:
      'Provider processes the request and returns a unique receipt ID (receipt-1).',
    failureMode:
      'Network timeouts or dropped connections are trapped by the workflow and recorded honestly as status="unknown".',
  },
  {
    id: 'stage_recovery',
    stepNumber: '6',
    name: 'Confirmation & Safe Recovery',
    role: 'Bounded Retry Engine',
    roleType: 'system',
    kind: 'implemented',
    shortDesc: 'Honest outcome tracking: confirmed receipt vs. idempotent retry or human escalation.',
    whatIsHappening:
      'The application checks whether a confirmed receipt was returned. If timed out, it permits up to 2 bounded retries reusing the exact same idempotency key.',
    whyIsHappening:
      'In distributed systems, a timeout does NOT mean the message failed—the provider may have delivered it. Reusing the key prevents duplicate delivery.',
    informationUsed:
      'Authoritative delivery state: status ("sent" vs "unknown"), attempt counter (<= 2), receipt ID, and deduplication map.',
    responsibleComponent:
      'Bounded Agent Retry Loop (MAX_ATTEMPTS = 2 in workflow.mjs).',
    decisionRequired:
      'If uncertain after attempt 1, retry once with the identical key. If still uncertain after attempt 2, halt and set outcome = "needs_reconciliation".',
    expectedNextStep:
      'Customer receives the clarification request and submits updated measurements (e.g. profile v5).',
    failureMode:
      'If 2 attempts fail/timeout, automated execution ceases permanently and alerts operations for human reconciliation.',
  },
  {
    id: 'stage_handoff',
    stepNumber: '7',
    name: 'Measurement Acceptance & Handoff',
    role: 'Designer & Garment Maker',
    roleType: 'maker',
    kind: 'conceptual',
    shortDesc: 'Corrected profile passes validation and is accepted by Designer for production.',
    whatIsHappening:
      'The Measurement Professional submits corrected measurements (v5). When validation passes (0 issues), the Designer formally accepts the measurements for production.',
    whyIsHappening:
      'Garment pattern makers and cutters require 100% verified and human-accepted dimensions before cutting fabric.',
    informationUsed:
      'Final validated profile snapshot (v5) with all measurements in required units (chest 92cm, waist 76cm, hip 96.5cm).',
    responsibleComponent:
      'Production Order Management & Workshop Handoff System (conceptual business boundary).',
    decisionRequired:
      'Designer formally accepts the measurement version. This is the ONLY step that authorizes cutting cloth.',
    expectedNextStep:
      'The verified measurement profile is locked and transmitted to the atelier / manufacturing workshop.',
    failureMode:
      'Garments are never sent to production while reviewStatus is unreviewed or needs_clarification.',
  },
];

export const TECHNICAL_PIPELINE_NODES: TechnicalNode[] = [
  { id: 'protocol_defined', num: '01', title: 'Protocol Defined', role: 'Designer', kind: 'conceptual', description: 'Defines required fields (chest, waist, hip in cm) & revision r1' },
  { id: 'profile_submitted', num: '02', title: 'Profile Submitted', role: 'Measurement Pro', kind: 'implemented', description: 'Intake snapshot (profile-017 v4) loaded into state reducer' },
  { id: 'deterministic_validation', num: '03', title: 'Deterministic Validation', role: 'Validator Engine', kind: 'implemented', description: 'Flags missing:waist & unit:hip:in; clears inherited approval' },
  { id: 'ai_reasoning', num: '04', title: 'AI Draft Suggestion', role: 'Simulated AI Drafter', kind: 'simulated_ai', description: 'tools.draftClarification() produces polite clarification copy' },
  { id: 'clarification_decision', num: '05', title: 'Clarification Action', role: 'Workflow Engine', kind: 'implemented', description: 'Hashes [kind, profileId, v4, recipient, text] into SHA-256 action.id' },
  { id: 'designer_approval', num: '06', title: 'Designer Approval Gate', role: 'Designer', kind: 'implemented', description: 'Guards SEND: checks approvedActionId === pendingAction.id' },
  { id: 'mcp_tool_execution', num: '07', title: 'Tool / MCP Execution', role: 'Tool Adapter', kind: 'implemented', description: 'Dispatches tools.notify() with idempotencyKey = action.id' },
  { id: 'tool_result_returned', num: '08', title: 'Provider Response', role: 'Mock Provider', kind: 'implemented', description: 'Returns 200 { receiptId } or raises network TIMEOUT' },
  { id: 'authoritative_state_updated', num: '09', title: 'State Updated', role: 'State Store', kind: 'implemented', description: 'Records delivery.status="sent" or "unknown"; increments attempts' },
  { id: 'retry_reconciliation_loop', num: '10', title: 'Retry / Reconciliation', role: 'Bounded Loop', kind: 'implemented', description: 'Loops only if unknown and attempts < 2; escalates at cap' },
  { id: 'final_maker_handoff', num: '11', title: 'Approved Handoff', role: 'Maker / Production', kind: 'conceptual', description: 'Authorized only when clean v5 profile is accepted by Designer' },
];
