import { makeActionId } from './crypto';
import type {
  ClarificationAction,
  Profile,
  Protocol,
  ToolAdapter,
  WorkflowEvent,
  WorkflowState,
} from './types';

export const MAX_ATTEMPTS = 2;

export function initialState(): WorkflowState {
  return {
    currentProfile: null,
    currentProtocol: null,
    issues: [],
    reviewStatus: 'unreviewed',
    pendingAction: null,
    approvedActionId: null,
    delivery: { status: 'not_sent', attempts: 0, receiptId: null },
    outcome: 'initial',
  };
}

export function validateMeasurements(profile: Profile | null, protocol: Protocol | null): string[] {
  const issues: string[] = [];
  const measurements = profile?.measurements ?? {};
  const requiredFields = protocol?.requiredFields ?? [];
  const requiredUnit = protocol?.requiredUnit ?? 'cm';

  for (const field of requiredFields) {
    const entry = measurements[field];
    if (entry === null || entry === undefined) {
      issues.push(`missing:${field}`);
      continue;
    }
    if (typeof entry.value !== 'number' || !Number.isFinite(entry.value) || entry.value <= 0) {
      issues.push(`value:${field}`);
    }
    if (entry.unit !== requiredUnit) {
      const actualUnit =
        typeof entry.unit === 'string' && entry.unit.length > 0 ? entry.unit : 'missing';
      issues.push(`unit:${field}:${actualUnit}`);
    }
  }

  return issues.sort();
}

export async function handleWorkflow(
  previous: WorkflowState | null,
  event: WorkflowEvent,
  tools: ToolAdapter,
  options: { bindProtocolRevision?: boolean } = {}
): Promise<WorkflowState> {
  const state: WorkflowState = structuredClone(previous ?? initialState());

  if (event.type === 'LOAD_PROFILE') {
    const profile = event.profile;
    const protocol = await tools.readProtocol(profile.protocolId);
    state.currentProfile = structuredClone(profile);
    state.currentProtocol = protocol;
    state.issues = validateMeasurements(profile, protocol);

    if (state.issues.length === 0) {
      state.reviewStatus = 'ready_for_review';
      state.pendingAction = null;
      state.approvedActionId = null;
      state.delivery = { status: 'not_sent', attempts: 0, receiptId: null };
      state.outcome = 'ready_for_review';
      return state;
    }

    state.reviewStatus = 'needs_clarification';
    const text = await tools.draftClarification({
      profileId: profile.id,
      profileVersion: profile.version,
      issues: state.issues,
    });

    const action: ClarificationAction = {
      kind: 'SEND_CLARIFICATION',
      profileId: profile.id,
      profileVersion: profile.version,
      recipient: profile.recipient,
      text,
      id: '',
    };

    if (options.bindProtocolRevision && protocol?.revision) {
      action.protocolRevision = protocol.revision;
    }

    action.id = makeActionId(action);

    const isSameAction = previous?.pendingAction?.id === action.id;
    state.pendingAction = action;

    if (isSameAction) {
      state.approvedActionId = previous.approvedActionId === action.id ? action.id : null;
      state.delivery = structuredClone(
        previous.delivery ?? { status: 'not_sent', attempts: 0, receiptId: null }
      );
      state.outcome =
        state.delivery.status === 'unknown' && state.delivery.attempts >= MAX_ATTEMPTS
          ? 'needs_reconciliation'
          : 'loaded';
    } else {
      state.approvedActionId = null;
      state.delivery = { status: 'not_sent', attempts: 0, receiptId: null };
      state.outcome = 'loaded';
    }

    return state;
  }

  if (event.type === 'APPROVE_ACTION') {
    const isReconciling =
      state.delivery?.status === 'unknown' && state.delivery?.attempts >= MAX_ATTEMPTS;
    const currentActionId = state.pendingAction?.id ?? null;

    if (currentActionId && event.actionId === currentActionId) {
      state.approvedActionId = currentActionId;
      state.outcome = isReconciling ? 'needs_reconciliation' : 'approval accepted';
    } else {
      if (state.approvedActionId !== currentActionId) {
        state.approvedActionId = null;
      }
      state.outcome = isReconciling ? 'needs_reconciliation' : 'approval rejected';
    }
    return state;
  }

  if (event.type === 'SEND') {
    const action = state.pendingAction;
    if (!action || state.approvedActionId !== action.id) {
      state.outcome = 'blocked';
      return state;
    }

    if (state.delivery.status === 'sent') {
      state.outcome = 'already sent';
      return state;
    }

    if (state.delivery.attempts >= MAX_ATTEMPTS) {
      state.delivery.status = 'unknown';
      state.delivery.receiptId = null;
      state.outcome = 'needs_reconciliation';
      return state;
    }

    state.delivery.attempts += 1;
    try {
      const result = await tools.notify({
        idempotencyKey: action.id,
        recipient: action.recipient,
        text: action.text,
      });
      state.delivery.status = 'sent';
      state.delivery.receiptId = result.receiptId;
      state.outcome = 'sent';
    } catch {
      state.delivery.status = 'unknown';
      state.delivery.receiptId = null;
      state.outcome =
        state.delivery.attempts >= MAX_ATTEMPTS ? 'needs_reconciliation' : 'delivery unknown';
    }
    return state;
  }

  throw new Error(`Unknown event: ${(event as { type: string }).type}`);
}
