import React, { useState } from 'react';
import type { TraceEntry, WorkflowState } from '../engine/types';

interface ConsoleDockProps {
  traces: TraceEntry[];
  state: WorkflowState;
  onClearTraces: () => void;
}

export function ConsoleDock({ traces, state, onClearTraces }: ConsoleDockProps) {
  const [activeTab, setActiveTab] = useState<'messages' | 'state'>('messages');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const copyLog = () => {
    const text =
      activeTab === 'messages'
        ? traces
            .map(
              (t) =>
                `[${t.time}] [${t.status}] ${t.actor} -> ${t.action}: ${t.detail}`
            )
            .join('\n')
        : JSON.stringify(state, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className={`w-full bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-200 ${
        isExpanded ? 'h-72' : 'h-48'
      }`}
    >
      {/* Console Top Header Bar */}
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('messages')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              activeTab === 'messages'
                ? 'bg-white text-slate-900 border border-slate-200 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Messages &amp; Event Trace ({traces.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('state')}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              activeTab === 'state'
                ? 'bg-white text-slate-900 border border-slate-200 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Authoritative State JSON
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={copyLog}
            className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
          {activeTab === 'messages' && (
            <button
              type="button"
              onClick={onClearTraces}
              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition"
            >
              Clear
            </button>
          )}
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2 py-1 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded font-mono text-[11px] transition"
          >
            {isExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>

      {/* Console Output Area */}
      <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed bg-white">
        {activeTab === 'messages' ? (
          traces.length === 0 ? (
            <div className="text-slate-400 italic py-4 text-center">
              No events recorded yet. Click "Step Forward" to execute the workflow.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {traces.map((trace) => {
                let statusColor = 'text-slate-600 bg-slate-100 border-slate-200';
                if (trace.status === 'OK') statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
                if (trace.status === 'BLOCKED') statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
                if (trace.status === 'TIMEOUT') statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
                if (trace.status === 'RECOVERED') statusColor = 'text-sky-700 bg-sky-50 border-sky-200';

                return (
                  <div
                    key={trace.id}
                    className="flex items-start gap-2.5 py-0.5 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded px-1"
                  >
                    <span className="text-slate-400 tabular-nums shrink-0">{trace.time}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded border text-[10px] font-semibold shrink-0 ${statusColor}`}
                    >
                      {trace.status}
                    </span>
                    <span className="font-semibold text-slate-800 shrink-0">
                      [{trace.actor}]
                    </span>
                    <span className="text-slate-600 font-medium shrink-0">
                      {trace.action}:
                    </span>
                    <span className="text-slate-700 font-sans text-xs break-words">
                      {trace.detail}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <pre className="text-slate-800 text-[11px] font-mono leading-normal">
            {JSON.stringify(state, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
