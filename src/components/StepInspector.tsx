import React, { useState } from 'react';
import type { WorkflowState, ProviderInspect } from '../engine/types';
import { WORKFLOW_NODES } from './WorkflowCanvas';

interface StepInspectorProps {
  selectedNodeId: string;
  state: WorkflowState;
  providerInspect: ProviderInspect;
  scenarioKey: string;
}

export function StepInspector({
  selectedNodeId,
  state,
  providerInspect,
  scenarioKey,
}: StepInspectorProps) {
  const [activeTab, setActiveTab] = useState<'description' | 'parameters'>('description');

  const node = WORKFLOW_NODES.find((n) => n.id === selectedNodeId) || WORKFLOW_NODES[0];

  const hasPendingAction = Boolean(state.pendingAction);
  const isApproved = Boolean(
    state.pendingAction && state.approvedActionId === state.pendingAction.id
  );

  return (
    <div className="w-full h-full bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden text-slate-800 shadow-2xs">
      {/* Top Header */}
      <div className="p-3.5 border-b border-slate-200 flex flex-col gap-1 shrink-0">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold text-slate-800">{node.stepNumber}</span>
          <span className="text-[11px] text-slate-500">{node.role} ({node.kindLabel})</span>
        </div>
        <div className="text-sm font-bold text-slate-900 tracking-tight">
          {node.title}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 text-xs font-medium shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('description')}
          className={`flex-1 py-2 text-center transition-colors border-b-2 ${
            activeTab === 'description'
              ? 'border-slate-900 text-slate-900 font-semibold bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Overview &amp; Rules
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('parameters')}
          className={`flex-1 py-2 text-center transition-colors border-b-2 ${
            activeTab === 'parameters'
              ? 'border-slate-900 text-slate-900 font-semibold bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Current Values
        </button>
      </div>

      {/* Tab Body */}
      <div className="p-3.5 flex-1 overflow-y-auto flex flex-col gap-3 text-xs">
        {activeTab === 'description' ? (
          <div className="flex flex-col gap-3 leading-relaxed">
            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                Summary
              </div>
              <p className="text-slate-700">{node.summary}</p>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                What Happens Here
              </div>
              <p className="text-slate-700">{node.plainEnglish}</p>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                Key Business Rule
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-700 leading-normal">
                {node.ruleExplained}
              </div>
            </div>

            {node.id === 'designer_gate' && (
              <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-amber-900 text-[11px]">
                <strong className="font-semibold block mb-0.5">Important Distinction:</strong>
                Approving this notification allows the clarification email to be sent. It does <em>not</em> accept the unverified customer measurements.
              </div>
            )}

            {node.id === 'notification' && (
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-slate-700 text-[11px]">
                <strong className="font-semibold block mb-0.5">Duplicate Protection:</strong>
                Even if network disconnects or timeouts occur, re-sending with the same key guarantees the customer only receives 1 message.
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {/* Profile Info */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Customer Measurements</span>
              <span className="font-mono text-slate-900 font-medium text-[11px]">
                {state.currentProfile ? `${state.currentProfile.id} (v${state.currentProfile.version})` : 'None'}
              </span>
            </div>

            {/* Protocol */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Garment Guidelines</span>
              <span className="font-mono text-slate-900 font-medium text-[11px]">
                standard-fit (r1)
              </span>
            </div>

            {/* Validation Issues */}
            <div className="flex flex-col gap-1 py-1 border-b border-slate-100">
              <span className="text-slate-500">Measurement Checks</span>
              {state.issues.length === 0 ? (
                <span className="text-emerald-700 font-medium">All measurements valid (cm)</span>
              ) : (
                <div className="flex flex-col gap-1 mt-0.5">
                  {state.issues.map((iss) => (
                    <span key={iss} className="font-mono text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {iss === 'missing:waist' ? 'Missing waist measurement' : iss === 'unit:hip:in' ? 'Hip captured in inches (needs cm)' : iss}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Action ID */}
            <div className="flex flex-col gap-0.5 py-1 border-b border-slate-100">
              <span className="text-slate-500">Clarification Message ID</span>
              <span className="font-mono text-[10px] text-slate-800 break-all bg-slate-50 p-1.5 rounded border border-slate-200">
                {state.pendingAction?.id || 'None'}
              </span>
            </div>

            {/* Approval Gate */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Designer Approval</span>
              <span className={`font-semibold text-[11px] ${isApproved ? 'text-emerald-700' : 'text-slate-500'}`}>
                {isApproved ? 'Approved by Designer' : 'Pending Designer Sign-off'}
              </span>
            </div>

            {/* Delivery State */}
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Notification Delivery</span>
              <span className="font-mono uppercase font-semibold text-slate-900 text-[11px]">
                {state.delivery.status === 'not_sent' ? 'Not Sent' : state.delivery.status === 'unknown' ? 'Unknown (Timed out)' : 'Sent (Confirmed)'}
              </span>
            </div>
          </div>
        )}

        {/* Dual Delivery Counters: Core Verification */}
        <div className="mt-auto pt-2.5 border-t border-slate-200 flex flex-col gap-2">
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Delivery Accountability (MOSU Core Metric)
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 bg-slate-50 rounded border border-slate-200 flex flex-col">
              <span className="text-[9.5px] text-slate-500">Notification Requests</span>
              <span className="text-base font-bold font-mono text-slate-900 tabular-nums">
                {state.delivery.attempts}
              </span>
              <span className="text-[9.5px] text-slate-400">Application View</span>
            </div>
            <div className="p-2 bg-slate-50 rounded border border-slate-200 flex flex-col">
              <span className="text-[9.5px] text-slate-500">Actual Deliveries</span>
              <span className="text-base font-bold font-mono text-emerald-700 tabular-nums">
                {providerInspect.deliveries.length}
              </span>
              <span className="text-[9.5px] text-slate-400">Customer Received</span>
            </div>
          </div>
          {providerInspect.idempotentHits > 0 && (
            <div className="text-[9.5px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 text-center">
              ✓ Duplicate attempt deduplicated! Zero customer spam.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
