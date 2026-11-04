export interface MeasurementEntry {
  value: number | null;
  unit?: string;
}

export interface Profile {
  id: string;
  version: number;
  protocolId: string;
  recipient: string;
  measurements: Record<string, MeasurementEntry | null>;
}

export interface Protocol {
  id: string;
  revision: string;
  requiredFields: string[];
  requiredUnit: string;
  note: string;
}

export interface ClarificationAction {
  kind: 'SEND_CLARIFICATION';
  profileId: string;
  profileVersion: number;
  recipient: string;
  text: string;
  id: string;
  protocolRevision?: string;
}

export interface DeliveryState {
  status: 'not_sent' | 'unknown' | 'sent';
  attempts: number;
  receiptId: string | null;
}

export type ReviewStatus = 'unreviewed' | 'needs_clarification' | 'ready_for_review' | 'approved';

export interface WorkflowState {
  currentProfile: Profile | null;
  currentProtocol: Protocol | null;
  issues: string[];
  reviewStatus: ReviewStatus;
  pendingAction: ClarificationAction | null;
  approvedActionId: string | null;
  delivery: DeliveryState;
  outcome: string;
}

export type WorkflowEvent =
  | { type: 'LOAD_PROFILE'; profile: Profile }
  | { type: 'APPROVE_ACTION'; actionId: string }
  | { type: 'SEND' };

export interface ToolAdapter {
  readProtocol: (protocolId: string) => Promise<Protocol>;
  draftClarification: (params: { profileId: string; profileVersion: number; issues: string[] }) => Promise<string>;
  notify: (params: { idempotencyKey: string; recipient: string; text: string }) => Promise<{ receiptId: string }>;
}

export type TraceStatus = 'OK' | 'BLOCKED' | 'TIMEOUT' | 'RECOVERED' | 'SIMULATED' | 'ESCALATED';

export interface TraceEntry {
  id: string;
  seq: number;
  time: string;
  actor: string;
  action: string;
  detail: string;
  status: TraceStatus;
}

export interface ProviderInspect {
  calls: Array<{ idempotencyKey: string; recipient: string; text: string }>;
  deliveries: Array<{ idempotencyKey: string; recipient: string; text: string; receiptId: string }>;
  toolCalls: Array<Record<string, unknown>>;
  idempotentHits: number;
}

export type StageKind = 'implemented' | 'simulated_ai' | 'conceptual';

export interface BusinessStage {
  id: string;
  stepNumber: string;
  name: string;
  role: string;
  roleType: 'designer' | 'pro' | 'system' | 'ai' | 'customer' | 'maker';
  kind: StageKind;
  shortDesc: string;
  // Answers to the 7 critical questions:
  whatIsHappening: string;
  whyIsHappening: string;
  informationUsed: string;
  responsibleComponent: string;
  decisionRequired: string;
  expectedNextStep: string;
  failureMode: string;
}

export interface TechnicalNode {
  id: string;
  num: string;
  title: string;
  role: string;
  kind: StageKind;
  description: string;
}
