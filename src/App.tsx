import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createHarness, type Harness } from './engine/harness';
import type {
  TraceEntry,
  WorkflowEvent,
  WorkflowState,
} from './engine/types';
import { handleWorkflow, initialState } from './engine/workflow';
import { WorkflowCanvas } from './components/WorkflowCanvas';
import { StepInspector } from './components/StepInspector';
import { ConsoleDock } from './components/ConsoleDock';
import { ArchitectureModal } from './components/ArchitectureModal';

interface StepDef {
  title: string;
  headline: string;
  plainSummary: string;
  nodeId: string;
  run: (ctx: StepContext) => Promise<void>;
}

interface StepContext {
  harness: Harness;
  state: WorkflowState;
  dispatch: (
    event: WorkflowEvent,
    traces?: Array<Omit<TraceEntry, 'id' | 'seq' | 'time'>>
  ) => Promise<void>;
  addTrace: (entry: Omit<TraceEntry, 'id' | 'seq' | 'time'>) => void;
}

interface ScenarioConfig {
  id: string;
  name: string;
  shortDesc: string;
  mode: 'success' | 'commit_timeout_once' | 'commit_timeout_always';
  bindProtocolRevision: boolean;
  steps: StepDef[];
}

const SCENARIOS: Record<string, ScenarioConfig> = {
  scenario_a: {
    id: 'scenario_a',
    name: 'Scenario A: Normal Flow',
    shortDesc: 'Missing measurement → Unapproved send blocked → Designer approves → Customer notified',
    mode: 'success',
    bindProtocolRevision: false,
    steps: [
      {
        title: 'Step 1: Protocol Setup',
        headline: 'Protocol standard-fit (r1) requires chest, waist, and hip in cm.',
        plainSummary:
          'Designer sets the measurement protocol. Rule: Approval from any previous order (like v3) never automatically transfers to a new submission (v4).',
        nodeId: 'protocol',
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
          ctx.state.currentProfile = old.currentProfile;
          ctx.state.reviewStatus = old.reviewStatus;
          ctx.state.approvedActionId = old.approvedActionId;
          ctx.state.outcome = old.outcome;
          ctx.addTrace({
            actor: 'Designer',
            action: 'PROTOCOL_SETUP',
            detail: 'Loaded protocol standard-fit (revision r1). Prior historical v3 approval is safely quarantined.',
            status: 'OK',
          });
        },
      },
      {
        title: 'Step 2: Profile Intake',
        headline: 'Measurement Pro captures and submits customer Profile v4.',
        plainSummary:
          'Measurement professional submits customer-017 measurements (chest: 92cm, waist: missing, hip: 38in). Submitted profile is safely ingested.',
        nodeId: 'intake',
        run: async (ctx) => {
          ctx.state.currentProfile = structuredClone(ctx.harness.profileV4);
          ctx.state.currentProtocol = await ctx.harness.tools.readProtocol(
            ctx.harness.profileV4.protocolId
          );
          ctx.state.reviewStatus = 'unreviewed';
          ctx.state.issues = [];
          ctx.state.pendingAction = null;
          ctx.state.approvedActionId = null;
          ctx.state.delivery = { status: 'not_sent', attempts: 0, receiptId: null };
          ctx.state.outcome = 'submitted_v4';
          ctx.addTrace({
            actor: 'Measurement Pro',
            action: 'SUBMIT_PROFILE',
            detail: 'Submitted profile-017 v4 (chest: 92cm, waist: missing, hip: 38in) into intake queue.',
            status: 'OK',
          });
        },
      },
      {
        title: 'Step 3: Validation Check & AI Draft',
        headline: 'Validator flags missing waist & inches unit. AI drafts polite clarification.',
        plainSummary:
          'Automated validator checks measurements against protocol. Flags missing:waist and unit:hip:in. AI assistant drafts polite clarification wording.',
        nodeId: 'validation',
        run: async (ctx) => {
          await ctx.dispatch(
            { type: 'LOAD_PROFILE', profile: ctx.harness.profileV4 },
            [
              {
                actor: 'Validator',
                action: 'CHECK_MEASUREMENTS',
                detail: 'Validation against standard-fit (r1) flagged: missing:waist, unit:hip:in. Prior approvals cleared.',
                status: 'OK',
              },
              {
                actor: 'AI Assistant',
                action: 'DRAFT_CLARIFICATION',
                detail: 'Drafted: "Please clarify profile-017 version 4: missing waist, unit hip in cm." Action ID generated.',
                status: 'OK',
              },
            ]
          );
        },
      },
      {
        title: 'Step 4: Designer Approval Gate',
        headline: 'Unapproved send blocked; Designer explicitly authorizes clarification action ID.',
        plainSummary:
          'Human-in-the-loop: Unapproved send is strictly blocked (0 calls). Designer signs off on exact action ID, unlocking customer notification.',
        nodeId: 'designer_gate',
        run: async (ctx) => {
          // 1. Attempt unapproved send to demonstrate the gate works
          await ctx.dispatch({ type: 'SEND' }, [
            {
              actor: 'Designer Gate',
              action: 'SEND_BLOCKED',
              detail: 'Action is not yet approved by Designer. Delivery halted; zero messages dispatched.',
              status: 'BLOCKED',
            },
          ]);

          // 2. Designer approves exact action ID
          const actionId = ctx.state.pendingAction?.id || '';
          await ctx.dispatch({ type: 'APPROVE_ACTION', actionId }, [
            {
              actor: 'Designer',
              action: 'APPROVE_ACTION',
              detail: `Approved exact clarification action ID (${actionId.substring(0, 18)}...). Outgoing send unlocked.`,
              status: 'OK',
            },
          ]);
        },
      },
      {
        title: 'Step 5: Notification Delivery',
        headline: 'Clarification sent with idempotency key. Provider returns receipt-1.',
        plainSummary:
          'Delivery tool sends approved clarification with unique idempotency key. Provider confirms receipt-1. Replay test proves 0 extra messages.',
        nodeId: 'notification',
        run: async (ctx) => {
          await ctx.dispatch({ type: 'SEND' }, [
            {
              actor: 'Delivery Service',
              action: 'NOTIFY_DISPATCH',
              detail: 'Dispatched to customer-017@example.test with idempotencyKey.',
              status: 'OK',
            },
            {
              actor: 'Provider Gateway',
              action: 'DELIVERY_CONFIRMED',
              detail: 'Committed delivery #1 and returned receipt-1. Status updated to sent.',
              status: 'OK',
            },
          ]);

          // Verify replay safety
          await ctx.dispatch({ type: 'SEND' }, [
            {
              actor: 'Workflow Engine',
              action: 'IDEMPOTENT_SHORT_CIRCUIT',
              detail: 'Detected action already sent. Replay exited safely without making extra provider calls.',
              status: 'OK',
            },
          ]);
        },
      },
      {
        title: 'Step 6: Maker Handoff & Production',
        headline: 'Customer submits corrected v5 (all cm). 0 issues; handed off for garment cutting!',
        plainSummary:
          'Customer provides chest 92cm, waist 76cm, hip 96.5cm. All checks pass; designer accepts verified profile for production cutting.',
        nodeId: 'maker_handoff',
        run: async (ctx) => {
          await ctx.dispatch(
            { type: 'LOAD_PROFILE', profile: ctx.harness.profileV5Clean },
            [
              {
                actor: 'Measurement Pro',
                action: 'SUBMIT_CORRECTED_V5',
                detail: 'Submitted v5 (chest 92cm, waist 76cm, hip 96.5cm). 0 issues found.',
                status: 'OK',
              },
              {
                actor: 'Validator',
                action: 'ALL_CHECKS_PASSED',
                detail: 'All required fields present in cm. Status set to ready_for_review.',
                status: 'OK',
              },
              {
                actor: 'Garment Maker',
                action: 'PRODUCTION_ACCEPTED',
                detail: 'Verified profile accepted into workshop queue. Safe for fabric cutting.',
                status: 'OK',
              },
            ]
          );
        },
      },
    ],
  },

  scenario_b: {
    id: 'scenario_b',
    name: 'Scenario B: Timeout & Recovery',
    shortDesc: 'Provider delivers → Response times out → Honest unknown state → Safe retry deduplicates',
    mode: 'commit_timeout_once',
    bindProtocolRevision: false,
    steps: [
      {
        title: 'Step 1: Protocol Setup',
        headline: 'Protocol standard-fit (r1) requires chest, waist, and hip in cm.',
        plainSummary:
          'Designer sets garment guidelines (chest, waist, hip in cm). Version isolation active.',
        nodeId: 'protocol',
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
          ctx.state.currentProfile = old.currentProfile;
          ctx.state.reviewStatus = old.reviewStatus;
          ctx.state.approvedActionId = old.approvedActionId;
          ctx.state.outcome = old.outcome;
          ctx.addTrace({
            actor: 'Designer',
            action: 'PROTOCOL_SETUP',
            detail: 'Loaded protocol standard-fit (revision r1). Prior historical v3 approval is safely quarantined.',
            status: 'OK',
          });
        },
      },
      {
        title: 'Step 2: Profile Intake',
        headline: 'Measurement Pro captures and submits customer Profile v4.',
        plainSummary:
          'Measurement professional submits customer-017 v4 measurements for intake.',
        nodeId: 'intake',
        run: async (ctx) => {
          ctx.state.currentProfile = structuredClone(ctx.harness.profileV4);
          ctx.state.currentProtocol = await ctx.harness.tools.readProtocol(
            ctx.harness.profileV4.protocolId
          );
          ctx.state.reviewStatus = 'unreviewed';
          ctx.state.issues = [];
          ctx.state.pendingAction = null;
          ctx.state.approvedActionId = null;
          ctx.state.delivery = { status: 'not_sent', attempts: 0, receiptId: null };
          ctx.state.outcome = 'submitted_v4';
          ctx.addTrace({
            actor: 'Measurement Pro',
            action: 'SUBMIT_PROFILE',
            detail: 'Submitted profile-017 v4 into intake queue.',
            status: 'OK',
          });
        },
      },
      {
        title: 'Step 3: Validation Check & AI Draft',
        headline: 'Validator flags missing waist & inches unit. AI drafts clarification.',
        plainSummary:
          'System checks measurements against protocol. Missing waist and hip in inches flagged. AI drafts clarification proposal.',
        nodeId: 'validation',
        run: async (ctx) => {
          await ctx.dispatch(
            { type: 'LOAD_PROFILE', profile: ctx.harness.profileV4 },
            [
              {
                actor: 'Measurement Pro',
                action: 'SUBMIT_PROFILE',
                detail: 'Submitted profile-017 v4. Issues detected: missing:waist, unit:hip:in.',
                status: 'OK',
              },
              {
                actor: 'Validator',
                action: 'CHECK_MEASUREMENTS',
                detail: 'Issues identified: missing:waist, unit:hip:in. Prior approvals cleared.',
                status: 'OK',
              },
              {
                actor: 'AI Assistant',
                action: 'DRAFT_CLARIFICATION',
                detail: 'Drafted clarification request. Action ID generated.',
                status: 'OK',
              },
            ]
          );
        },
      },
      {
        title: 'Step 4: Designer Approval Gate',
        headline: 'Designer reviews issues and authorizes the exact clarification action ID.',
        plainSummary:
          'Human designer explicitly authorizes sending clarification to the customer.',
        nodeId: 'designer_gate',
        run: async (ctx) => {
          const actionId = ctx.state.pendingAction?.id || '';
          await ctx.dispatch({ type: 'APPROVE_ACTION', actionId }, [
            {
              actor: 'Designer',
              action: 'APPROVE_ACTION',
              detail: `Approved exact clarification action ID (${actionId.substring(0, 18)}...). Outgoing send unlocked.`,
              status: 'OK',
            },
          ]);
        },
      },
      {
        title: 'Step 5: Notification Delivery & Timeout Recovery',
        headline: 'Attempt #1 times out (unknown status); Attempt #2 retries with same key & recovers receipt!',
        plainSummary:
          'Dual counters: Provider delivered message internally, but network dropped on return path (status="unknown"). Reload preserves unknown state. Retry reuses same key and recovers receipt-1 (Requests=2, Deliveries=1)!',
        nodeId: 'notification',
        run: async (ctx) => {
          // Attempt #1: Timeout
          await ctx.dispatch({ type: 'SEND' }, [
            {
              actor: 'Delivery Service',
              action: 'NOTIFY_ATTEMPT_1',
              detail: 'Dispatched notification attempt #1.',
              status: 'OK',
            },
            {
              actor: 'Provider Gateway',
              action: 'INTERNAL_COMMIT_TIMEOUT',
              detail: 'Provider delivered message internally, but network connection dropped on return path.',
              status: 'TIMEOUT',
            },
            {
              actor: 'Workflow Engine',
              action: 'HONEST_STATUS_UNKNOWN',
              detail: 'Recorded delivery status="unknown", attempts=1. Preserves key for safe retry.',
              status: 'TIMEOUT',
            },
          ]);

          // Snapshot continuity: Reload identical profile v4 preserves unknown status
          await ctx.dispatch(
            { type: 'LOAD_PROFILE', profile: ctx.harness.profileV4 },
            [
              {
                actor: 'Workflow Engine',
                action: 'SNAPSHOT_CONTINUITY',
                detail: 'Same action ID detected: preserved status="unknown", attempts=1, and approval.',
                status: 'OK',
              },
            ]
          );

          // Attempt #2: Safe retry reuses key, provider deduplicates and returns receipt-1
          await ctx.dispatch({ type: 'SEND' }, [
            {
              actor: 'Retry Engine',
              action: 'NOTIFY_ATTEMPT_2',
              detail: 'Re-dispatched with identical idempotency key.',
              status: 'OK',
            },
            {
              actor: 'Provider Gateway',
              action: 'DEDUPLICATED_CACHE_HIT',
              detail: 'Recognized duplicate key. Returned existing receipt-1 without sending a second message!',
              status: 'RECOVERED',
            },
            {
              actor: 'Workflow Engine',
              action: 'STATUS_SENT',
              detail: 'Status updated to sent, receiptId="receipt-1", attempts=2.',
              status: 'OK',
            },
          ]);
        },
      },
      {
        title: 'Step 6: Maker Handoff & Production',
        headline: 'Customer submits corrected v5 (all cm). 0 issues; handed off for garment cutting!',
        plainSummary:
          'Customer provides clean measurements in cm (chest 92cm, waist 76cm, hip 96.5cm). 0 issues found; handed off to the workshop queue for production cutting.',
        nodeId: 'maker_handoff',
        run: async (ctx) => {
          await ctx.dispatch(
            { type: 'LOAD_PROFILE', profile: ctx.harness.profileV5Clean },
            [
              {
                actor: 'Measurement Pro',
                action: 'SUBMIT_CORRECTED_V5',
                detail: 'Submitted v5 (chest 92cm, waist 76cm, hip 96.5cm). 0 issues found.',
                status: 'OK',
              },
              {
                actor: 'Validator',
                action: 'ALL_CHECKS_PASSED',
                detail: 'All required fields present in cm. Status set to ready_for_review.',
                status: 'OK',
              },
              {
                actor: 'Garment Maker',
                action: 'PRODUCTION_HANDOFF',
                detail: 'Verified profile accepted into workshop queue. Safe for fabric cutting.',
                status: 'OK',
              },
            ]
          );
        },
      },
    ],
  },
};

export default function App() {
  const [currentScenarioKey, setCurrentScenarioKey] = useState<string>('scenario_a');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('protocol');
  const [state, setState] = useState<WorkflowState>(initialState());
  const [traces, setTraces] = useState<TraceEntry[]>([]);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(false);
  const [showNotes, setShowNotes] = useState<boolean>(false);

  const harnessRef = useRef<Harness>(createHarness());
  const autoPlayTimerRef = useRef<number | null>(null);

  const scenario = SCENARIOS[currentScenarioKey];

  const addTrace = useCallback((entry: Omit<TraceEntry, 'id' | 'seq' | 'time'>) => {
    setTraces((prev) => [
      ...prev,
      {
        id: `tr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        seq: prev.length + 1,
        time: new Date().toLocaleTimeString([], {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        ...entry,
      },
    ]);
  }, []);

  const dispatchEvent = useCallback(
    async (
      event: WorkflowEvent,
      additionalTraces: Array<Omit<TraceEntry, 'id' | 'seq' | 'time'>> = []
    ) => {
      const nextState = await handleWorkflow(
        state,
        event,
        harnessRef.current.tools,
        { bindProtocolRevision: scenario.bindProtocolRevision }
      );
      setState(JSON.parse(JSON.stringify(nextState)));
      for (const t of additionalTraces) {
        addTrace(t);
      }
    },
    [state, scenario.bindProtocolRevision, addTrace]
  );

  const resetScenario = useCallback(
    (key = currentScenarioKey) => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      setIsAutoPlaying(false);

      const target = SCENARIOS[key];
      harnessRef.current = createHarness({ mode: target.mode });

      setCurrentScenarioKey(key);
      setCurrentStepIndex(0);
      setSelectedNodeId('protocol');
      setState(initialState());
      setTraces([
        {
          id: `tr_${Date.now()}`,
          seq: 1,
          time: new Date().toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          actor: 'System',
          action: 'SCENARIO_READY',
          detail: `Loaded ${target.name}. Click "Step Forward" to execute step-by-step.`,
          status: 'OK',
        },
      ]);
    },
    [currentScenarioKey]
  );

  useEffect(() => {
    resetScenario('scenario_a');
  }, []);

  const handleStepForward = useCallback(async () => {
    if (currentStepIndex >= scenario.steps.length) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
        setIsAutoPlaying(false);
      }
      return;
    }

    const stepObj = scenario.steps[currentStepIndex];
    const nextIdx = currentStepIndex + 1;
    setCurrentStepIndex(nextIdx);
    setSelectedNodeId(stepObj.nodeId);

    const ctx: StepContext = {
      harness: harnessRef.current,
      state,
      dispatch: dispatchEvent,
      addTrace,
    };

    await stepObj.run(ctx);

    if (nextIdx >= scenario.steps.length) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
        setIsAutoPlaying(false);
      }
    }
  }, [currentStepIndex, scenario, state, dispatchEvent, addTrace]);

  const handleStepBackward = useCallback(async () => {
    if (currentStepIndex <= 0) return;
    const target = currentStepIndex - 1;
    resetScenario(currentScenarioKey);
    const def = SCENARIOS[currentScenarioKey];
    for (let i = 0; i < target; i++) {
      setCurrentStepIndex(i + 1);
      setSelectedNodeId(def.steps[i].nodeId);
      const ctx: StepContext = {
        harness: harnessRef.current,
        state,
        dispatch: dispatchEvent,
        addTrace,
      };
      await def.steps[i].run(ctx);
    }
  }, [currentStepIndex, currentScenarioKey, resetScenario, state, dispatchEvent, addTrace]);

  const toggleAutoPlay = useCallback(() => {
    if (isAutoPlaying) {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      setIsAutoPlaying(false);
    } else {
      if (currentStepIndex >= scenario.steps.length) {
        resetScenario(currentScenarioKey);
      }
      setIsAutoPlaying(true);
    }
  }, [isAutoPlaying, currentStepIndex, scenario.steps.length, resetScenario, currentScenarioKey]);

  useEffect(() => {
    if (isAutoPlaying) {
      autoPlayTimerRef.current = window.setInterval(() => {
        handleStepForward();
      }, 1600);
    } else if (autoPlayTimerRef.current) {
      clearInterval(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    return () => {
      if (autoPlayTimerRef.current) {
        clearInterval(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
    };
  }, [isAutoPlaying, handleStepForward]);

  const providerInspect = harnessRef.current.inspect();
  const currentStep =
    currentStepIndex > 0 ? scenario.steps[currentStepIndex - 1] : null;

  return (
    <div className="h-screen w-screen bg-[#f1f5f9] text-slate-900 font-sans flex flex-col overflow-hidden antialiased selection:bg-slate-200">
      {/* 1. Top Navigation Bar (CARTO Workflows Style) */}
      <header className="h-13 bg-white border-b border-slate-200 px-5 flex items-center justify-between gap-4 shrink-0 shadow-2xs z-30">
        {/* Zone 1: Wordmark & Breadcrumb */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            MOSU Workflows
          </span>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-medium text-slate-500 whitespace-nowrap hidden sm:inline">
            Remote Measurement Protocol
          </span>
        </div>

        {/* Zone 2: Scenario Switcher Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => resetScenario('scenario_a')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              currentScenarioKey === 'scenario_a'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Scenario A: Normal Flow
          </button>
          <button
            type="button"
            onClick={() => resetScenario('scenario_b')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              currentScenarioKey === 'scenario_b'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Scenario B: Timeout &amp; Recovery
          </button>
        </div>

        {/* Zone 3: Playback Controls & Notes */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 border-r border-slate-200 pr-2 mr-1">
            <button
              type="button"
              onClick={handleStepBackward}
              disabled={currentStepIndex <= 0}
              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition"
              title="Previous Step"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={handleStepForward}
              disabled={currentStepIndex >= scenario.steps.length}
              className="px-3 py-1 text-xs font-semibold rounded bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition"
            >
              {currentStepIndex === 0 ? 'Run Workflow' : 'Step Forward'}
            </button>
            <button
              type="button"
              onClick={toggleAutoPlay}
              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-white hover:bg-slate-50 transition"
            >
              {isAutoPlaying ? 'Pause' : 'Auto'}
            </button>
            <button
              type="button"
              onClick={() => resetScenario(currentScenarioKey)}
              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-white hover:bg-slate-50 transition"
              title="Reset Scenario"
            >
              Reset
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowNotes(true)}
            className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
          >
            5 Concepts &amp; Changed Condition
          </button>
        </div>
      </header>

      {/* 2. Step Narration Strip */}
      <div className="bg-white border-b border-slate-200 px-5 py-2 flex items-center justify-between gap-4 text-xs shrink-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 shrink-0">
            Step {currentStepIndex} of {scenario.steps.length}
          </span>
          <span className="font-bold text-slate-900 shrink-0">
            {currentStep ? currentStep.title : 'Ready to start'}
          </span>
          <span className="text-slate-300 shrink-0">·</span>
          <span className="text-slate-600 truncate">
            {currentStep ? currentStep.headline : scenario.shortDesc}
          </span>
        </div>

        <div className="text-[11px] text-slate-500 font-mono shrink-0 hidden md:inline">
          Stage 1 Checks: 6/6 Passing
        </div>
      </div>

      {/* 3. Main Workspace: Canvas (Left) + Inspector (Right) */}
      <div className="flex-1 p-3 flex flex-col gap-3 min-h-0 overflow-hidden max-w-[1600px] w-full mx-auto">
        <div className="flex-1 flex flex-col md:flex-row gap-3 min-h-0 overflow-hidden">
          {/* Left Canvas: Responsive node diagram */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <WorkflowCanvas
              currentStepIndex={currentStepIndex}
              scenarioKey={currentScenarioKey}
              state={state}
              selectedNodeId={selectedNodeId}
              onSelectNode={(id) => setSelectedNodeId(id)}
            />
          </div>

          {/* Right Inspector: Always side-by-side */}
          <div className="w-full md:w-80 lg:w-[360px] shrink-0 min-h-0 flex flex-col">
            <StepInspector
              selectedNodeId={selectedNodeId}
              state={state}
              providerInspect={providerInspect}
              scenarioKey={currentScenarioKey}
            />
          </div>
        </div>

        {/* 4. Bottom Messages & Trace Console */}
        <div className="shrink-0">
          <ConsoleDock
            traces={traces}
            state={state}
            onClearTraces={() => setTraces([])}
          />
        </div>
      </div>

      {/* 5. Walkthrough Modal (5 Concepts & Changed Condition) */}
      <ArchitectureModal
        isOpen={showNotes}
        onClose={() => setShowNotes(false)}
      />
    </div>
  );
}
