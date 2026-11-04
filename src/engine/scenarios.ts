import type { Harness } from './harness';
import type { TraceEntry, WorkflowEvent, WorkflowState } from './types';
import { initialState } from './workflow';

export interface ScenarioContext {
  harness: Harness;
  state: WorkflowState;
  addTrace: (entry: Omit<TraceEntry, 'id' | 'seq' | 'time'>) => void;
  dispatchEvent: (
    event: WorkflowEvent,
    traces?: Array<Omit<TraceEntry, 'id' | 'seq' | 'time'>>
  ) => Promise<void>;
  setActiveStages: (businessId: string, technicalId: string) => void;
  setNodeStates: (map: Record<string, 'completed' | 'active' | 'blocked' | 'unknown' | 'pending'>) => void;
}

export interface ScenarioStep {
  stepNum: number;
  totalSteps: number;
  title: string;
  executiveHeadline: string;
  businessExplanation: string;
  technicalDetails: string;
  businessStageId: string;
  technicalNodeId: string;
  run: (ctx: ScenarioContext) => Promise<void>;
}

export interface ScenarioDefinition {
  id: string;
  title: string;
  badge: string;
  subtitle: string;
  mode: 'success' | 'commit_timeout_once' | 'commit_timeout_always';
  bindProtocolRevision: boolean;
  steps: ScenarioStep[];
}

export const SCENARIO_DEFINITIONS: Record<string, ScenarioDefinition> = {
  normal: {
    id: 'normal',
    title: 'Scenario A: Normal Clarification Flow',
    badge: 'Baseline Execution',
    subtitle: 'Missing Measurement Flagged → Unapproved Send Blocked → Human Approval → Single Delivery',
    mode: 'success',
    bindProtocolRevision: false,
    steps: [
      {
        stepNum: 1,
        totalSteps: 6,
        title: 'Initial Historical Context',
        executiveHeadline: 'Profile v3 was approved in past order; new order starts fresh.',
        businessExplanation:
          'In customer tailoring, a client might have had an approved profile months ago (v3). However, physical body measurements change over time. When a new order begins, MOSU enforces strict Version Isolation: historical approval never carries over to a new measurement submission.',
        technicalDetails:
          'Seeding state with currentProfile v3 (approved), reviewStatus="approved", approvedActionId="old-action-v3". Verifies Stage 1 Invariant #1.',
        businessStageId: 'stage_submitted',
        technicalNodeId: 'protocol_defined',
        run: async (ctx) => {
          const old = initialState();
          old.currentProfile = {
            id: 'profile-017',
            version: 3,
            protocolId: 'standard-fit',
            recipient: 'customer-017@example.test',
            measurements: {
              chest: { value: 91, unit: 'cm' },
              waist: { value: 75, unit: 'cm' },
              hip: { value: 96, unit: 'cm' },
            },
          };
          old.reviewStatus = 'approved';
          old.approvedActionId = 'old-action-v3';
          old.outcome = 'v3_historical';
          ctx.state = old;
          ctx.setActiveStages('stage_submitted', 'protocol_defined');
          ctx.setNodeStates({ protocol_defined: 'completed' });
          ctx.addTrace({
            actor: 'System Harness',
            action: 'LOAD_HISTORICAL_RECORD (Profile v3)',
            detail: 'Seeded historical v3 state (approvedActionId="old-action-v3"). Ready to test version isolation.',
            status: 'OK',
          });
        },
      },
      {
        stepNum: 2,
        totalSteps: 6,
        title: 'Measurement Pro Submits Profile v4',
        executiveHeadline: 'Validator catches missing waist & wrong hip unit; AI drafts clarification.',
        businessExplanation:
          'Measurement Pro submits profile v4. The deterministic engine immediately flags 2 errors: waist is null (missing), and hip was entered in inches instead of cm. Historical approval from v3 is instantly wiped. Simulated AI drafts a polite request to the customer.',
        technicalDetails:
          'Event: LOAD_PROFILE(v4). validateMeasurements() produces sorted issues: ["missing:waist", "unit:hip:in"]. AI drafts text, hashes action ID action-29137615fc4816ccefba3746, and resets approvedActionId to null.',
        businessStageId: 'stage_validation',
        technicalNodeId: 'clarification_decision',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'LOAD_PROFILE', profile: ctx.harness.profileV4 }, [
            {
              actor: 'Measurement Pro',
              action: 'SUBMIT_PROFILE (profile-017 v4)',
              detail: 'Submitted v4 measurements: chest=92 cm, waist=null, hip=38 in.',
              status: 'OK',
            },
            {
              actor: 'Validation Engine',
              action: 'validateMeasurements()',
              detail: 'Flagged 2 sorted issues: ["missing:waist", "unit:hip:in"]. Cleared historical v3 approval.',
              status: 'OK',
            },
            {
              actor: 'Simulated AI Drafter',
              action: 'tools.draftClarification()',
              detail: 'Drafted: "Please clarify profile-017 version 4: missing:waist, unit:hip:in." Bound to action-29137615fc4816ccefba3746.',
              status: 'SIMULATED',
            },
          ]);
          ctx.setActiveStages('stage_ai_draft', 'clarification_decision');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'active',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'active',
            designer_approval: 'pending',
          });
        },
      },
      {
        stepNum: 3,
        totalSteps: 6,
        title: 'Safety Enforcement: Unapproved Send Blocked',
        executiveHeadline: 'System blocks sending before human Designer approves (0 provider calls).',
        businessExplanation:
          'Before contacting a customer, MOSU mandates human approval. Here we deliberately attempt to trigger SEND before the designer has reviewed the message. The system gate catches this instantly, halts execution, and makes ZERO calls to the notification provider.',
        technicalDetails:
          'Event: SEND. State guard checks state.approvedActionId !== state.pendingAction.id. Execution blocked, delivery.attempts unchanged (0), 0 network requests.',
        businessStageId: 'stage_designer_gate',
        technicalNodeId: 'designer_approval',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'SEND' }, [
            {
              actor: 'Human Approval Gate',
              action: 'SEND_ATTEMPT (Pre-Approval Guard)',
              detail: 'BLOCKED! approvedActionId is null while pendingAction.id is action-29137615fc4816ccefba3746. Zero provider calls made; 0 attempts consumed.',
              status: 'BLOCKED',
            },
          ]);
          ctx.setActiveStages('stage_designer_gate', 'designer_approval');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'completed',
            stage_designer_gate: 'blocked',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'completed',
            designer_approval: 'blocked',
            mcp_tool_execution: 'blocked',
          });
        },
      },
      {
        stepNum: 4,
        totalSteps: 6,
        title: 'Designer Approves Exact Clarification Action',
        executiveHeadline: 'Designer signs off on message. (Note: Measurements remain unaccepted!)',
        businessExplanation:
          'The designer reviews the flagged issues and approves the clarification action. Crucial business distinction: Approving this message authorizes sending it to the client, but does NOT approve the customer measurements. The order status remains "needs_clarification".',
        technicalDetails:
          'Event: APPROVE_ACTION(action-29137615fc4816ccefba3746). Exact match sets state.approvedActionId. reviewStatus remains "needs_clarification".',
        businessStageId: 'stage_designer_gate',
        technicalNodeId: 'designer_approval',
        run: async (ctx) => {
          const id = ctx.state.pendingAction?.id || '';
          await ctx.dispatchEvent({ type: 'APPROVE_ACTION', actionId: id }, [
            {
              actor: 'Lead Designer',
              action: 'APPROVE_ACTION (Human Sign-off)',
              detail: `Approved exact action ID ${id}. Outgoing clarification authorized. Measurements remain unapproved.`,
              status: 'OK',
            },
          ]);
          ctx.setActiveStages('stage_designer_gate', 'designer_approval');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'completed',
            stage_designer_gate: 'completed',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'completed',
            designer_approval: 'completed',
            mcp_tool_execution: 'pending',
          });
        },
      },
      {
        stepNum: 5,
        totalSteps: 6,
        title: 'Notification Tool Executes & Returns Receipt',
        executiveHeadline: 'Message dispatched with idempotency key; provider returns receipt-1.',
        businessExplanation:
          'With valid approval in place, SEND executes. The tool adapter passes the exact action ID as the idempotency key to prevent accidental duplicate dispatches. The mock provider delivers the notification and returns "receipt-1". Delivery status updates to "sent".',
        technicalDetails:
          'Event: SEND. tools.notify({ idempotencyKey, recipient, text }). Delivery recorded: status="sent", attempts=1, receiptId="receipt-1".',
        businessStageId: 'stage_delivery',
        technicalNodeId: 'authoritative_state_updated',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'SEND' }, [
            {
              actor: 'Tool Adapter / MCP',
              action: 'tools.notify() Dispatched',
              detail: 'Sent with idempotencyKey = action-29137615fc4816ccefba3746 to customer-017@example.test.',
              status: 'OK',
            },
            {
              actor: 'Notification Provider',
              action: '200 OK -> receipt-1',
              detail: 'Provider recorded delivery #1 and issued confirmed receipt-1. Authoritative state updated to "sent".',
              status: 'OK',
            },
          ]);
          ctx.setActiveStages('stage_delivery', 'authoritative_state_updated');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'completed',
            stage_designer_gate: 'completed',
            stage_delivery: 'completed',
            stage_recovery: 'completed',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'completed',
            designer_approval: 'completed',
            mcp_tool_execution: 'completed',
            tool_result_returned: 'completed',
            authoritative_state_updated: 'completed',
          });
        },
      },
      {
        stepNum: 6,
        totalSteps: 6,
        title: 'Replay Protection: SEND Safe No-Op',
        executiveHeadline: 'Replaying SEND makes 0 additional calls; awaiting customer correction.',
        businessExplanation:
          'If a user or background process accidentally triggers SEND again on an already completed action, MOSU detects that delivery.status is already "sent" and short-circuits safely. No second message is delivered to the customer. The workflow waits for the corrected profile v5.',
        technicalDetails:
          'Event: SEND. Guard checks delivery.status === "sent" -> outcome="already sent". Provider inspect calls count remains 1, deliveries remain 1.',
        businessStageId: 'stage_recovery',
        technicalNodeId: 'authoritative_state_updated',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'SEND' }, [
            {
              actor: 'Workflow Engine',
              action: 'SEND (Replay Guard)',
              detail: 'Short-circuited! Message was already delivered. 0 provider calls made. receipt-1 preserved.',
              status: 'OK',
            },
          ]);
          ctx.setActiveStages('stage_recovery', 'authoritative_state_updated');
        },
      },
    ],
  },

  timeout_recover: {
    id: 'timeout_recover',
    title: 'Scenario B: Provider Timeout & Idempotent Recovery',
    badge: 'Distributed Safety',
    subtitle: 'Provider Delivers but Network Times Out → Honest Unknown State → Safe Retry with Identical Key',
    mode: 'commit_timeout_once',
    bindProtocolRevision: false,
    steps: [
      {
        stepNum: 1,
        totalSteps: 6,
        title: 'Load Profile v4 with Validation Issues',
        executiveHeadline: 'Profile v4 loaded; validation flags missing:waist and unit:hip:in.',
        businessExplanation:
          'Measurement Pro submits v4. The system validates the measurements, flags the waist and hip issues, and prepares a clarification proposal.',
        technicalDetails:
          'Event: LOAD_PROFILE(v4). Deterministic issues identified; pending action created with action.id = action-29137615fc4816ccefba3746.',
        businessStageId: 'stage_validation',
        technicalNodeId: 'clarification_decision',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'LOAD_PROFILE', profile: ctx.harness.profileV4 }, [
            {
              actor: 'Measurement Pro',
              action: 'LOAD_PROFILE(v4)',
              detail: 'Loaded profile-017 v4; flagged missing:waist, unit:hip:in.',
              status: 'OK',
            },
          ]);
          ctx.setActiveStages('stage_validation', 'clarification_decision');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'active',
            designer_approval: 'pending',
          });
        },
      },
      {
        stepNum: 2,
        totalSteps: 6,
        title: 'Designer Approves Clarification Action',
        executiveHeadline: 'Designer signs off on the clarification copy before external transmission.',
        businessExplanation:
          'The designer reviews the draft and approves the exact action ID. The system unlocks the SEND action.',
        technicalDetails:
          'Event: APPROVE_ACTION. approvedActionId matches pendingAction.id.',
        businessStageId: 'stage_designer_gate',
        technicalNodeId: 'designer_approval',
        run: async (ctx) => {
          const id = ctx.state.pendingAction?.id || '';
          await ctx.dispatchEvent({ type: 'APPROVE_ACTION', actionId: id }, [
            {
              actor: 'Lead Designer',
              action: 'APPROVE_ACTION',
              detail: `Approved action ${id}. Ready for tool execution.`,
              status: 'OK',
            },
          ]);
          ctx.setActiveStages('stage_designer_gate', 'designer_approval');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'completed',
            stage_designer_gate: 'completed',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'completed',
            designer_approval: 'completed',
          });
        },
      },
      {
        stepNum: 3,
        totalSteps: 6,
        title: 'SEND Attempt #1: Provider Delivers, But Response Times Out!',
        executiveHeadline: 'Application records "unknown" delivery; provider internally committed receipt-1.',
        businessExplanation:
          'This simulates a classic real-world network failure: the messaging provider actually delivered the SMS/email, but the return HTTP connection timed out. Look at the Dual Perspective Monitor: the Application honestly reports status="unknown" (it received no receipt), while the Provider Debug view shows 1 actual delivery committed. MOSU never falsely claims "failed" or "delivered".',
        technicalDetails:
          'Event: SEND. Provider commits receipt-1 internally, then throws Error("TIMEOUT"). Workflow catches timeout: delivery.status="unknown", delivery.attempts=1, receiptId=null.',
        businessStageId: 'stage_recovery',
        technicalNodeId: 'retry_reconciliation_loop',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'SEND' }, [
            {
              actor: 'Notification Tool',
              action: 'tools.notify() Attempt #1',
              detail: 'Sent request to provider with key action-29137615fc4816ccefba3746.',
              status: 'OK',
            },
            {
              actor: 'Mock Provider',
              action: 'DELIVERED INTERNALLY + TIMEOUT',
              detail: 'Provider delivered message (receipt-1 committed), but network connection dropped before response arrived.',
              status: 'TIMEOUT',
            },
            {
              actor: 'Workflow Engine',
              action: 'Honest Delivery Status: UNKNOWN',
              detail: 'Application records delivery.status="unknown", receiptId=null, attempts=1. Preserves action ID for safe retry.',
              status: 'TIMEOUT',
            },
          ]);
          ctx.setActiveStages('stage_recovery', 'retry_reconciliation_loop');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'completed',
            stage_designer_gate: 'completed',
            stage_delivery: 'active',
            stage_recovery: 'unknown',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'completed',
            designer_approval: 'completed',
            mcp_tool_execution: 'completed',
            tool_result_returned: 'unknown',
            authoritative_state_updated: 'unknown',
            retry_reconciliation_loop: 'active',
          });
        },
      },
      {
        stepNum: 4,
        totalSteps: 6,
        title: 'Identical Snapshot Reload Continuity',
        executiveHeadline: 'Reloading the profile preserves status="unknown" and attempt count (1).',
        businessExplanation:
          'If a background worker or user refreshes the page or reloads the profile snapshot, MOSU must not forget that an attempt was made. Because the action ID is identical, the system preserves status="unknown", attempts=1, and the existing designer approval.',
        technicalDetails:
          'Event: LOAD_PROFILE(v4). Detects previous.pendingAction.id === action.id. Preserves delivery state and approval without resetting attempts to 0.',
        businessStageId: 'stage_recovery',
        technicalNodeId: 'retry_reconciliation_loop',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'LOAD_PROFILE', profile: ctx.harness.profileV4 }, [
            {
              actor: 'Workflow Engine',
              action: 'RELOAD_PROFILE (Snapshot Continuity)',
              detail: 'Identical action ID detected: preserved status="unknown", attempts=1, and approvedActionId.',
              status: 'OK',
            },
          ]);
          ctx.setActiveStages('stage_recovery', 'retry_reconciliation_loop');
        },
      },
      {
        stepNum: 5,
        totalSteps: 6,
        title: 'Safe Idempotent Retry (SEND Attempt #2)',
        executiveHeadline: 'Retry reuses the exact same key. Provider deduplicates: 1 actual delivery!',
        businessExplanation:
          'The bounded retry loop triggers Attempt #2, reusing the EXACT SAME action ID as the idempotency key. The provider looks up the key, recognizes it as a retry, and returns the original receipt-1 WITHOUT delivering a duplicate message! Customer receives only 1 notification; MOSU updates to status="sent".',
        technicalDetails:
          'Event: SEND. Provider inspect shows: Requests Received = 2, Actual Deliveries = 1, Idempotent Hits = 1. Workflow records receiptId="receipt-1", delivery.status="sent", attempts=2.',
        businessStageId: 'stage_recovery',
        technicalNodeId: 'authoritative_state_updated',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'SEND' }, [
            {
              actor: 'Bounded Retry Loop',
              action: 'tools.notify() Attempt #2 (Same Key)',
              detail: 'Reused idempotencyKey = action-29137615fc4816ccefba3746 with identical payload.',
              status: 'OK',
            },
            {
              actor: 'Notification Provider',
              action: 'IDEMPOTENT CACHE HIT',
              detail: 'Provider deduplicated retry! Returned original receipt-1 without sending another message (Deliveries: 1).',
              status: 'RECOVERED',
            },
            {
              actor: 'Authoritative State',
              action: 'Delivery Reconciled -> SENT',
              detail: 'Updated delivery.status="sent", receiptId="receipt-1", attempts=2.',
              status: 'OK',
            },
          ]);
          ctx.setActiveStages('stage_recovery', 'authoritative_state_updated');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'completed',
            stage_designer_gate: 'completed',
            stage_delivery: 'completed',
            stage_recovery: 'completed',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'completed',
            designer_approval: 'completed',
            mcp_tool_execution: 'completed',
            tool_result_returned: 'completed',
            authoritative_state_updated: 'completed',
            retry_reconciliation_loop: 'completed',
          });
        },
      },
      {
        stepNum: 6,
        totalSteps: 6,
        title: 'Customer Submits Corrected Profile v5',
        executiveHeadline: 'Updated profile passes validation (0 issues). Ready for Maker handoff!',
        businessExplanation:
          'Having received the clarification, the customer provides corrected measurements: chest 92 cm, waist 76 cm, hip 96.5 cm (all in cm). The validator finds 0 issues. The order status updates to "ready_for_review". The designer can now inspect and accept the profile for pattern making!',
        technicalDetails:
          'Event: LOAD_PROFILE(v5 clean). 0 validation issues -> reviewStatus="ready_for_review", pendingAction=null, delivery.status="not_sent". Ready for production acceptance.',
        businessStageId: 'stage_handoff',
        technicalNodeId: 'final_maker_handoff',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'LOAD_PROFILE', profile: ctx.harness.profileV5Clean }, [
            {
              actor: 'Measurement Pro',
              action: 'SUBMIT_CORRECTED_PROFILE (v5)',
              detail: 'Submitted v5: chest=92 cm, waist=76 cm, hip=96.5 cm.',
              status: 'OK',
            },
            {
              actor: 'Validation Engine',
              action: 'validateMeasurements(v5)',
              detail: 'Zero issues found! reviewStatus transitioned to "ready_for_review". Pending clarification cleared.',
              status: 'OK',
            },
          ]);
          ctx.setActiveStages('stage_handoff', 'final_maker_handoff');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'completed',
            stage_designer_gate: 'completed',
            stage_delivery: 'completed',
            stage_recovery: 'completed',
            stage_handoff: 'active',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'completed',
            designer_approval: 'completed',
            mcp_tool_execution: 'completed',
            tool_result_returned: 'completed',
            authoritative_state_updated: 'completed',
            retry_reconciliation_loop: 'completed',
            final_maker_handoff: 'active',
          });
        },
      },
    ],
  },

  timeout_limit: {
    id: 'timeout_limit',
    title: 'Scenario B (Limit Variant): Retry Cap & Human Escalation',
    badge: 'Human Escalation',
    subtitle: 'Two Consecutive Timeouts Reach Maximum Attempt Cap (MAX_ATTEMPTS = 2) → Stop & Needs Reconciliation',
    mode: 'commit_timeout_always',
    bindProtocolRevision: false,
    steps: [
      {
        stepNum: 1,
        totalSteps: 5,
        title: 'Load Profile v4 and Approve Clarification',
        executiveHeadline: 'Profile v4 loaded and designer signs off on clarification action.',
        businessExplanation:
          'Measurement Pro loads profile v4. Issues are flagged and the designer approves action-29137615fc4816ccefba3746.',
        technicalDetails:
          'LOAD_PROFILE followed by APPROVE_ACTION. approvedActionId matches pendingAction.id.',
        businessStageId: 'stage_designer_gate',
        technicalNodeId: 'designer_approval',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'LOAD_PROFILE', profile: ctx.harness.profileV4 }, [
            {
              actor: 'Measurement Pro',
              action: 'LOAD_PROFILE(v4)',
              detail: 'Loaded v4 with issues ["missing:waist", "unit:hip:in"].',
              status: 'OK',
            },
          ]);
          await ctx.dispatchEvent({ type: 'APPROVE_ACTION', actionId: ctx.state.pendingAction?.id || '' }, [
            {
              actor: 'Designer',
              action: 'APPROVE_ACTION',
              detail: 'Approved clarification action.',
              status: 'OK',
            },
          ]);
          ctx.setActiveStages('stage_designer_gate', 'designer_approval');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'completed',
            stage_designer_gate: 'completed',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'completed',
            designer_approval: 'completed',
          });
        },
      },
      {
        stepNum: 2,
        totalSteps: 5,
        title: 'SEND Attempt #1 Times Out',
        executiveHeadline: 'First attempt times out. Outcome is "delivery unknown", attempts = 1.',
        businessExplanation:
          'Provider response times out. Status is recorded as "unknown", attempts = 1. A second retry is permitted by policy.',
        technicalDetails:
          'Event: SEND. Catches TIMEOUT -> delivery.status="unknown", delivery.attempts=1.',
        businessStageId: 'stage_recovery',
        technicalNodeId: 'retry_reconciliation_loop',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'SEND' }, [
            {
              actor: 'Notification Tool',
              action: 'SEND Attempt #1 -> TIMEOUT',
              detail: 'First request timed out. Status recorded as "unknown", attempts=1.',
              status: 'TIMEOUT',
            },
          ]);
          ctx.setActiveStages('stage_recovery', 'retry_reconciliation_loop');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'completed',
            stage_designer_gate: 'completed',
            stage_recovery: 'unknown',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'completed',
            designer_approval: 'completed',
            tool_result_returned: 'unknown',
            retry_reconciliation_loop: 'active',
          });
        },
      },
      {
        stepNum: 3,
        totalSteps: 5,
        title: 'SEND Attempt #2 Times Out: Maximum Attempts Reached',
        executiveHeadline: 'Second timeout hits MAX_ATTEMPTS (2) → Halts and escalates to human reconciliation.',
        businessExplanation:
          'Automated retry algorithms must never loop endlessly. After 2 uncertain attempts, MOSU automatically halts further automated sending and elevates the state to "needs_reconciliation". A human operations agent is notified to investigate provider logs.',
        technicalDetails:
          'Event: SEND (Attempt #2). Attempts reaches MAX_ATTEMPTS (2). Outcome transitions deterministically to "needs_reconciliation".',
        businessStageId: 'stage_recovery',
        technicalNodeId: 'retry_reconciliation_loop',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'SEND' }, [
            {
              actor: 'Bounded Retry Loop',
              action: 'SEND Attempt #2 -> TIMEOUT',
              detail: 'Second timeout reached MAX_ATTEMPTS (2). Automated retry terminated. Outcome = "needs_reconciliation".',
              status: 'ESCALATED',
            },
          ]);
          ctx.setActiveStages('stage_recovery', 'retry_reconciliation_loop');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'completed',
            stage_designer_gate: 'completed',
            stage_recovery: 'blocked',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'completed',
            designer_approval: 'completed',
            tool_result_returned: 'unknown',
            authoritative_state_updated: 'unknown',
            retry_reconciliation_loop: 'blocked',
          });
        },
      },
      {
        stepNum: 4,
        totalSteps: 5,
        title: 'Reload Profile Replay Preserves Escalation',
        executiveHeadline: 'Reloading the profile does not reset attempt counter or erase escalation.',
        businessExplanation:
          'Even if a user reloads the profile, the system remembers that 2 attempts were exhausted. The status remains "needs_reconciliation".',
        technicalDetails:
          'Event: LOAD_PROFILE(v4). Preserves attempts=2 and outcome="needs_reconciliation".',
        businessStageId: 'stage_recovery',
        technicalNodeId: 'retry_reconciliation_loop',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'LOAD_PROFILE', profile: ctx.harness.profileV4 }, [
            {
              actor: 'Workflow Engine',
              action: 'LOAD_PROFILE Replay',
              detail: 'Preserved attempts=2, status="unknown", outcome="needs_reconciliation".',
              status: 'OK',
            },
          ]);
          ctx.setActiveStages('stage_recovery', 'retry_reconciliation_loop');
        },
      },
      {
        stepNum: 5,
        totalSteps: 5,
        title: 'Third SEND Attempt Strictly Blocked by Retry Cap',
        executiveHeadline: 'Any further automated send is rejected (0 additional calls). Human action required.',
        businessExplanation:
          'Clicking SEND a 3rd time is strictly rejected by the retry cap. Total provider requests remain 2. The system protects both the client from duplicate contact and the business from billing runaway.',
        technicalDetails:
          'Event: SEND. Blocked because attempts (2) >= MAX_ATTEMPTS. Provider calls remain 2, actual deliveries remain 1.',
        businessStageId: 'stage_recovery',
        technicalNodeId: 'retry_reconciliation_loop',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'SEND' }, [
            {
              actor: 'Harness / Retry Cap',
              action: 'SEND (3rd Attempt Blocked)',
              detail: 'Blocked by retry cap. 0 provider calls made. Outcome remains "needs_reconciliation".',
              status: 'BLOCKED',
            },
          ]);
          ctx.setActiveStages('stage_recovery', 'retry_reconciliation_loop');
        },
      },
    ],
  },

  stale_change: {
    id: 'stale_change',
    title: 'Scenario C (Changed Condition): Protocol Revision Invalidation',
    badge: 'TOCTOU Safety',
    subtitle: 'Protocol Changes from r1 to r2 After Approval → Recomputed Action ID Automatically Invalidates Stale Approval',
    mode: 'success',
    bindProtocolRevision: true,
    steps: [
      {
        stepNum: 1,
        totalSteps: 4,
        title: 'Load Profile v4 under Protocol Revision r1',
        executiveHeadline: 'Action ID cryptographically binds the protocol revision (r1).',
        businessExplanation:
          'To prevent Time-of-Check to Time-of-Use (TOCTOU) race conditions, MOSU hashes the active protocol revision directly into the action identity: makeActionId([kind, profileId, v4, recipient, text, "r1"]).',
        technicalDetails:
          'LOAD_PROFILE with protocol revision r1 creates action-ebb9080e67b931542f2baa11.',
        businessStageId: 'stage_ai_draft',
        technicalNodeId: 'clarification_decision',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'LOAD_PROFILE', profile: ctx.harness.profileV4 }, [
            {
              actor: 'System',
              action: 'LOAD_PROFILE (Protocol rev r1)',
              detail: 'Pending action bound to protocol revision r1: action-ebb9080e67b931542f2baa11.',
              status: 'OK',
            },
          ]);
          ctx.setActiveStages('stage_ai_draft', 'clarification_decision');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'active',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'active',
            designer_approval: 'pending',
          });
        },
      },
      {
        stepNum: 2,
        totalSteps: 4,
        title: 'Designer Approves Action for Protocol r1',
        executiveHeadline: 'Designer signs off on the clarification under protocol revision r1.',
        businessExplanation:
          'The designer reviews and approves action-ebb9080e67b931542f2baa11. Approval is stored in state.',
        technicalDetails:
          'APPROVE_ACTION(action-ebb9080e67b931542f2baa11). approvedActionId = action-ebb9080e67b931542f2baa11.',
        businessStageId: 'stage_designer_gate',
        technicalNodeId: 'designer_approval',
        run: async (ctx) => {
          const id = ctx.state.pendingAction?.id || '';
          await ctx.dispatchEvent({ type: 'APPROVE_ACTION', actionId: id }, [
            {
              actor: 'Designer',
              action: `APPROVE_ACTION (${id})`,
              detail: 'Approval recorded for protocol revision r1.',
              status: 'OK',
            },
          ]);
          ctx.setActiveStages('stage_designer_gate', 'designer_approval');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'completed',
            stage_designer_gate: 'completed',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'completed',
            designer_approval: 'completed',
          });
        },
      },
      {
        stepNum: 3,
        totalSteps: 4,
        title: 'Protocol Updates (r1 → r2) Before Send!',
        executiveHeadline: 'Protocol revision changes to r2: Action ID recalculates, wiping the stale approval.',
        businessExplanation:
          'Suppose the designer updates the tailoring protocol to revision r2 (e.g. changing instructions or measurement tolerances). Sending the old r1 clarification would now be inaccurate! When the profile is re-evaluated, makeActionId produces a NEW ID (action-07dd1e083953185afd95b0a3). Because new ID != old approved ID, approvedActionId is deterministically reset to null!',
        technicalDetails:
          'setProtocolRevision("r2") + LOAD_PROFILE. New action.id (action-07dd1e08...) !== previous.pendingAction.id (action-ebb9080e...). State reducer sets approvedActionId = null.',
        businessStageId: 'stage_designer_gate',
        technicalNodeId: 'designer_approval',
        run: async (ctx) => {
          const oldId = ctx.state.pendingAction?.id;
          ctx.harness.setProtocolRevision('r2');
          await ctx.dispatchEvent({ type: 'LOAD_PROFILE', profile: ctx.harness.profileV4 }, [
            {
              actor: 'Designer / Protocol Admin',
              action: 'UPDATE_PROTOCOL (r1 -> r2)',
              detail: `Protocol revision changed to r2 before SEND. New action ID (${ctx.state.pendingAction?.id}) != old approved ID (${oldId}). Stale approval automatically invalidated to null!`,
              status: 'BLOCKED',
            },
          ]);
          ctx.setActiveStages('stage_designer_gate', 'designer_approval');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'completed',
            stage_designer_gate: 'blocked',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'completed',
            designer_approval: 'blocked',
            mcp_tool_execution: 'blocked',
          });
        },
      },
      {
        stepNum: 4,
        totalSteps: 4,
        title: 'Attempt SEND with Stale Approval: Strictly Blocked',
        executiveHeadline: 'Execution blocked! Stale approval cannot authorize sending under the new protocol.',
        businessExplanation:
          'Attempting to execute SEND now is completely blocked. Zero notification calls leave the boundary. The designer must review and approve the new r2 proposal before customer contact is permitted. Complete safety guaranteed without human error.',
        technicalDetails:
          'Event: SEND. Guard checks approvedActionId === null !== pendingAction.id. Blocked with 0 provider calls.',
        businessStageId: 'stage_designer_gate',
        technicalNodeId: 'mcp_tool_execution',
        run: async (ctx) => {
          await ctx.dispatchEvent({ type: 'SEND' }, [
            {
              actor: 'Approval Freshness Guard',
              action: 'SEND (Blocked by Stale Approval Guard)',
              detail: 'Prevented sending outdated clarification! Zero notification calls made. Outgoing gate locked.',
              status: 'BLOCKED',
            },
          ]);
          ctx.setActiveStages('stage_designer_gate', 'mcp_tool_execution');
          ctx.setNodeStates({
            stage_submitted: 'completed',
            stage_validation: 'completed',
            stage_ai_draft: 'completed',
            stage_designer_gate: 'blocked',
            protocol_defined: 'completed',
            profile_submitted: 'completed',
            deterministic_validation: 'completed',
            ai_reasoning: 'completed',
            clarification_decision: 'completed',
            designer_approval: 'blocked',
            mcp_tool_execution: 'blocked',
          });
        },
      },
    ],
  },
};
