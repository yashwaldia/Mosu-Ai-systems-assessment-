import React, { useEffect, useRef, useState } from 'react';
import type { WorkflowState } from '../engine/types';

export interface WorkflowNodeDef {
  id: string;
  stepNumber: string;
  title: string;
  role: string;
  kindLabel: string;
  summary: string;
  plainEnglish: string;
  ruleExplained: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// 6-stage business journey strictly aligned with MOSU specification
export const WORKFLOW_NODES: WorkflowNodeDef[] = [
  {
    id: 'protocol',
    stepNumber: 'Step 1',
    title: 'Protocol Setup',
    role: 'Designer',
    kindLabel: 'Setup',
    summary: 'Designer defines required measurements (chest, waist, hip) in cm with revision ID.',
    plainEnglish:
      'The designer defines which measurements are required and their units, such as chest, waist and hip in centimetres.',
    ruleExplained:
      'Version Isolation: Approval given to an older measurement set (like v3) never transfers to a new submission (v4). Each version is evaluated fresh.',
    x: 40,
    y: 40,
    width: 220,
    height: 76,
  },
  {
    id: 'intake',
    stepNumber: 'Step 2',
    title: 'Profile Intake',
    role: 'Measurement Pro',
    kindLabel: 'Intake',
    summary: 'Measurement professional submits customer dimensions with version and provenance.',
    plainEnglish:
      'The measurement professional submits the customer’s profile and its version with capture provenance.',
    ruleExplained:
      'Historical Integrity: Corrections create a new profile version. Earlier versions are preserved rather than overwritten.',
    x: 40,
    y: 190,
    width: 220,
    height: 76,
  },
  {
    id: 'validation',
    stepNumber: 'Step 3',
    title: 'Validation Check',
    role: 'System & AI',
    kindLabel: 'Validation',
    summary: 'System checks measurements and an AI assistant drafts clarification proposal.',
    plainEnglish:
      'The system checks measurements and, if necessary, prepares a clarification message.',
    ruleExplained:
      'AI Boundary: The AI only helps draft polite words. It cannot invent missing numbers or approve its own suggestions.',
    x: 325,
    y: 115,
    width: 220,
    height: 76,
  },
  {
    id: 'designer_gate',
    stepNumber: 'Step 4',
    title: 'Designer Approval',
    role: 'Designer',
    kindLabel: 'Gate',
    summary: 'Human designer checks and approves the exact message before any send can execute.',
    plainEnglish:
      'The designer checks and approves the exact message before it can be sent.',
    ruleExplained:
      'Human-in-the-Loop: Even with AI suggestions, unapproved outgoing actions are strictly blocked (0 messages sent to the provider).',
    x: 610,
    y: 115,
    width: 220,
    height: 76,
  },
  {
    id: 'notification',
    stepNumber: 'Step 5',
    title: 'Notification Delivery',
    role: 'Delivery Tool',
    kindLabel: 'Tool',
    summary: 'Notification tool sends approved clarification with idempotency key to prevent duplicates.',
    plainEnglish:
      'The notification tool sends the approved message and handles receipts, timeouts and retries.',
    ruleExplained:
      'Deduplication: The provider recognizes retry attempts with the same key and returns the confirmation receipt without resending.',
    x: 885,
    y: 40,
    width: 220,
    height: 76,
  },
  {
    id: 'maker_handoff',
    stepNumber: 'Step 6',
    title: 'Maker Handoff',
    role: 'Garment Maker',
    kindLabel: 'Production',
    summary: 'Accepted measurement profile handed off to production team for garment cutting.',
    plainEnglish:
      'Once measurements are validated and the designer separately accepts the profile, it can be handed off for garment cutting.',
    ruleExplained:
      'Safety Guarantee: Fabric is never cut on unverified measurements. Only designer-approved versions enter production.',
    x: 885,
    y: 190,
    width: 220,
    height: 76,
  },
];

interface WorkflowCanvasProps {
  currentStepIndex: number;
  scenarioKey: string;
  state: WorkflowState;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
}

export function WorkflowCanvas({
  currentStepIndex,
  scenarioKey,
  state,
  selectedNodeId,
  onSelectNode,
}: WorkflowCanvasProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom & Pan Controls
  const [scale, setScale] = useState<number>(0.92);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Auto-fit calculation
  const fitToScreen = () => {
    if (containerRef.current) {
      const availableWidth = containerRef.current.clientWidth - 32;
      const targetWidth = 1140;
      const naturalScale = Math.min(1.15, Math.max(0.65, availableWidth / targetWidth));
      setScale(+(naturalScale).toFixed(2));
      setPan({ x: 0, y: 0 });
    }
  };

  useEffect(() => {
    fitToScreen();
    window.addEventListener('resize', fitToScreen);
    return () => window.removeEventListener('resize', fitToScreen);
  }, []);

  const handleZoomIn = () => {
    setScale((s) => Math.min(1.6, +(s + 0.1).toFixed(2)));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(0.4, +(s - 0.1).toFixed(2)));
  };

  const handleResetZoom = () => {
    setScale(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setScale((s) => Math.min(1.6, Math.max(0.4, +(s + delta).toFixed(2))));
    }
  };

  // Panning handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.workflow-node')) return;
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Compute node status based on state
  const getNodeStatus = (
    nodeId: string
  ): { label: string; tone: 'completed' | 'active' | 'blocked' | 'waiting' | 'idle' } => {
    if (currentStepIndex === 0) {
      if (nodeId === 'protocol') return { label: 'Active', tone: 'completed' };
      return { label: 'Ready', tone: 'idle' };
    }

    if (nodeId === 'protocol') {
      return { label: 'Active (r1)', tone: 'completed' };
    }

    if (nodeId === 'intake') {
      if (currentStepIndex < 2) return { label: 'Ready', tone: 'idle' };
      const v = state.currentProfile?.version;
      return { label: v ? `Submitted (v${v})` : 'Submitted', tone: 'completed' };
    }

    if (nodeId === 'validation') {
      if (currentStepIndex < 3) return { label: 'Ready', tone: 'idle' };
      if (state.issues.length > 0) {
        return { label: `${state.issues.length} Issues Flagged`, tone: 'completed' };
      }
      if (state.currentProfile && state.issues.length === 0) {
        return { label: 'Verified', tone: 'completed' };
      }
      return { label: 'Ready', tone: 'idle' };
    }

    if (nodeId === 'designer_gate') {
      if (currentStepIndex < 4) return { label: 'Ready', tone: 'idle' };
      const isApproved = Boolean(
        state.pendingAction && state.approvedActionId === state.pendingAction.id
      );

      if (isApproved) {
        return { label: 'Approved', tone: 'completed' };
      }
      if (state.pendingAction) {
        return { label: 'Awaiting Sign-off', tone: 'active' };
      }
      return { label: 'Ready', tone: 'idle' };
    }

    if (nodeId === 'notification') {
      if (currentStepIndex < 5) return { label: 'Ready', tone: 'idle' };
      if (state.delivery.status === 'sent') {
        return { label: 'Delivered', tone: 'completed' };
      }
      if (state.delivery.status === 'unknown') {
        return { label: 'Unknown (Timeout)', tone: 'blocked' };
      }
      if (state.delivery.attempts > 0) {
        return { label: `Attempt #${state.delivery.attempts}`, tone: 'active' };
      }
      return { label: 'Ready', tone: 'idle' };
    }

    if (nodeId === 'maker_handoff') {
      if (currentStepIndex < 6) return { label: 'Ready', tone: 'idle' };
      if (state.currentProfile?.version === 5 && state.issues.length === 0) {
        return { label: 'Ready for Cutting', tone: 'completed' };
      }
      return { label: 'Ready', tone: 'idle' };
    }

    return { label: 'Ready', tone: 'idle' };
  };

  const activeNode =
    WORKFLOW_NODES.find((n) => n.id === hoveredNodeId) ||
    WORKFLOW_NODES.find((n) => n.id === selectedNodeId) ||
    WORKFLOW_NODES[0];

  // SVG curved wire generator
  const drawWire = (x1: number, y1: number, x2: number, y2: number, isActive = false) => {
    const dx = Math.abs(x2 - x1) * 0.52;
    const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    return (
      <path
        d={path}
        fill="none"
        stroke={isActive ? '#0f172a' : '#94a3b8'}
        strokeWidth={isActive ? '2.5' : '1.75'}
        strokeDasharray={isActive ? undefined : '5 4'}
        className="transition-all duration-300"
      />
    );
  };

  const p = (node: WorkflowNodeDef, side: 'in' | 'out') => ({
    x: side === 'out' ? node.x + node.width : node.x,
    y: node.y + node.height / 2,
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#f8fafc] rounded-xl border border-slate-200 overflow-hidden flex flex-col select-none shadow-2xs"
    >
      {/* 1. Canvas Top Toolbar */}
      <div className="px-4 py-2 border-b border-slate-200 bg-white flex items-center justify-between text-xs text-slate-600 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">Workflow Diagram</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-500 hidden sm:inline">
            Click any step to inspect · Drag background to pan
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-6 h-6 flex items-center justify-center font-bold text-slate-700 hover:bg-white rounded transition text-xs"
            title="Zoom Out (-)"
          >
            −
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="px-2 h-6 flex items-center justify-center font-mono font-semibold text-xs text-slate-700 hover:bg-white rounded transition"
            title="Reset Zoom to 100%"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-6 h-6 flex items-center justify-center font-bold text-slate-700 hover:bg-white rounded transition text-xs"
            title="Zoom In (+)"
          >
            +
          </button>
          <button
            type="button"
            onClick={fitToScreen}
            className="px-2 h-6 flex items-center justify-center text-xs font-semibold text-slate-600 hover:bg-white rounded transition"
            title="Fit to Screen"
          >
            Fit
          </button>
        </div>
      </div>

      {/* 2. Interactive SVG & Node Canvas Viewport */}
      <div
        className={`relative flex-1 w-full h-full overflow-hidden flex items-center justify-center ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            width: '1140px',
            height: '315px',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: 'center center',
          }}
          className="relative transition-transform duration-75 pointer-events-auto shrink-0"
        >
          {/* SVG Connector Lines Layer */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <pattern id="dot-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.2" fill="#cbd5e1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dot-grid)" />

            {/* Wire 1: Step 1 (Protocol) -> Step 3 (Validation Check) */}
            {drawWire(
              p(WORKFLOW_NODES[0], 'out').x,
              p(WORKFLOW_NODES[0], 'out').y,
              p(WORKFLOW_NODES[2], 'in').x,
              p(WORKFLOW_NODES[2], 'in').y - 14,
              currentStepIndex >= 1
            )}

            {/* Wire 2: Step 2 (Intake) -> Step 3 (Validation Check) */}
            {drawWire(
              p(WORKFLOW_NODES[1], 'out').x,
              p(WORKFLOW_NODES[1], 'out').y,
              p(WORKFLOW_NODES[2], 'in').x,
              p(WORKFLOW_NODES[2], 'in').y + 14,
              currentStepIndex >= 2
            )}

            {/* Wire 3: Step 3 (Validation Check) -> Step 4 (Designer Approval) */}
            {drawWire(
              p(WORKFLOW_NODES[2], 'out').x,
              p(WORKFLOW_NODES[2], 'out').y,
              p(WORKFLOW_NODES[3], 'in').x,
              p(WORKFLOW_NODES[3], 'in').y,
              currentStepIndex >= 3
            )}

            {/* Wire 4: Step 4 (Designer Approval) -> Step 5 (Notification Delivery) */}
            {drawWire(
              p(WORKFLOW_NODES[3], 'out').x,
              p(WORKFLOW_NODES[3], 'out').y,
              p(WORKFLOW_NODES[4], 'in').x,
              p(WORKFLOW_NODES[4], 'in').y,
              currentStepIndex >= 4
            )}

            {/* Wire 5: Step 4 (Designer Approval) -> Step 6 (Maker Handoff) */}
            {drawWire(
              p(WORKFLOW_NODES[3], 'out').x,
              p(WORKFLOW_NODES[3], 'out').y,
              p(WORKFLOW_NODES[5], 'in').x,
              p(WORKFLOW_NODES[5], 'in').y,
              currentStepIndex >= 6
            )}
          </svg>

          {/* Clean, Uniform Cards (Consistent text size, zero icons, 2 clean lines) */}
          {WORKFLOW_NODES.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const status = getNodeStatus(node.id);

            let statusBadge = 'bg-slate-100 text-slate-700 border-slate-200';
            if (status.tone === 'completed') {
              statusBadge = 'bg-slate-900 text-white border-slate-900';
            } else if (status.tone === 'blocked') {
              statusBadge = 'bg-rose-50 text-rose-700 border-rose-200';
            } else if (status.tone === 'active') {
              statusBadge = 'bg-sky-50 text-sky-800 border-sky-200';
            }

            return (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: `${node.width}px`,
                  height: `${node.height}px`,
                }}
                className={`workflow-node group cursor-pointer rounded-xl border bg-white px-3.5 py-3 shadow-xs transition-all duration-150 flex flex-col justify-between ${
                  isSelected
                    ? 'border-slate-900 ring-2 ring-slate-900/15 shadow-sm'
                    : isHovered
                    ? 'border-slate-500 shadow-sm'
                    : 'border-slate-200 hover:border-slate-400'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectNode(node.id);
                }}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {/* Left input port circle */}
                <div
                  className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-400 group-hover:border-slate-800"
                  title="Input Port"
                />

                {/* Right output port circle */}
                <div
                  className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-slate-400 group-hover:border-slate-800"
                  title="Output Port"
                />

                {/* Line 1: Step Number and Title in one clean line */}
                <div className="flex items-center justify-between text-xs font-semibold text-slate-900 leading-none">
                  <span className="truncate">{node.stepNumber} · {node.title}</span>
                </div>

                {/* Line 2: Role on left, Status on right in one clean line */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 leading-none">
                  <span className="font-medium text-slate-600 truncate">{node.role}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusBadge} shrink-0`}>
                    {status.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Persistent, Fully Readable Step Explanation Banner (Zero Overlapping Floating Cards) */}
      <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-col gap-1.5 text-xs shrink-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-xs">
              {activeNode.stepNumber}: {activeNode.title}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              Role: {activeNode.role}
            </span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            {hoveredNodeId ? 'Hovering preview' : 'Selected step details'}
          </span>
        </div>

        <p className="text-slate-700 leading-relaxed text-xs max-w-4xl">
          {activeNode.plainEnglish}
        </p>

        <div className="text-xs text-slate-600 flex items-center gap-1.5">
          <span className="font-semibold text-slate-800">Governing Rule:</span>
          <span>{activeNode.ruleExplained}</span>
        </div>
      </div>
    </div>
  );
}
