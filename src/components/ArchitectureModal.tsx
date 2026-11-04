import React, { useState } from 'react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ArchitectureModal({ isOpen, onClose }: ArchitectureModalProps) {
  const [activeTab, setActiveTab] = useState<'concepts' | 'stale' | 'state' | 'idempotency'>('concepts');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              MOSU Systems Architecture &amp; Governance Model
            </h2>
            <p className="text-xs text-slate-500">
              Clear principles for remote measurement validation, human-in-the-loop gates, and idempotent recovery
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg font-bold p-1 rounded hover:bg-slate-200 transition"
          >
            ✕
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 text-xs font-medium px-4 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('concepts')}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'concepts'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            5 Core Walkthrough Concepts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stale')}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'stale'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Changed Condition (Stale Approval)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('state')}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'state'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            State vs. AI Context
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('idempotency')}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'idempotency'
                ? 'border-slate-900 text-slate-900 font-semibold bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Idempotent Retry &amp; Deduplication
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 text-xs leading-relaxed flex flex-col gap-4">
          {activeTab === 'concepts' && (
            <div className="flex flex-col gap-4">
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <span className="font-bold text-slate-900 block mb-1">
                  1. Version Isolation (Rule 1)
                </span>
                <p className="text-slate-600">
                  A new profile submission (v4) never inherits approval from an older version (v3). Every incoming version must undergo its own independent validation and review.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <span className="font-bold text-slate-900 block mb-1">
                  2. AI Suggestions Are Never Treated as Facts (Rule 2)
                </span>
                <p className="text-slate-600">
                  AI components may draft polite wording for customer clarification requests, but are strictly prohibited from inventing missing numbers or self-approving outgoing actions.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <span className="font-bold text-slate-900 block mb-1">
                  3. Exact Action ID Sign-Off (Rule 3)
                </span>
                <p className="text-slate-600">
                  The human designer approves the specific hashed action ID. A general approval button or mismatched ID will be rejected, keeping outgoing customer contact under full human control.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <span className="font-bold text-slate-900 block mb-1">
                  4. Idempotent Delivery Guarantee (Rule 4)
                </span>
                <p className="text-slate-600">
                  The action ID serves directly as the idempotency key for delivery tools. Re-sending an already executed action is a safe no-op that makes zero extra provider calls.
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <span className="font-bold text-slate-900 block mb-1">
                  5. Honest Unknown State on Network Drops (Rule 5)
                </span>
                <p className="text-slate-600">
                  When a network timeout occurs, the system records delivery as "unknown" rather than falsely assuming failure or success. A bounded retry reuses the same key, enabling the provider to deduplicate without spamming.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'stale' && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-slate-900">
                The Changed Condition: Preventing Stale Approvals (TOCTOU)
              </h3>
              <p className="text-slate-600">
                In real-world fashion operations, conditions can change between the moment a designer reviews a request and the moment the notification executes.
              </p>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
                <strong className="block mb-1">The Problem:</strong>
                Suppose a designer approves sending a clarification based on Protocol Revision <code>r1</code>. While the message is queued, the designer updates the measurement protocol to <code>r2</code> (e.g., adding an inseam measurement).
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700">
                <strong className="block mb-1 text-slate-900">The Solution:</strong>
                MOSU binds the protocol revision directly into the action hash. When execution runs, the engine checks that the current protocol matches the approved revision. If the protocol changed, the approval is recognized as stale, blocked, and cleared for re-review.
              </div>
            </div>
          )}

          {activeTab === 'state' && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-slate-900">
                Authoritative State vs. Model Context vs. Provider State
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">Authoritative State</span>
                  <p className="text-slate-600">
                    The source of truth stored in the database. Tracks exact version numbers, review decisions, and confirmed receipt IDs.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">Model Context (AI)</span>
                  <p className="text-slate-600">
                    Transient prompt text given to LLMs. Has zero execution authority and cannot mutate state directly.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded border border-slate-200">
                  <span className="font-bold text-slate-900 block mb-1">Provider State</span>
                  <p className="text-slate-600">
                    External messaging gateway. Maintains an idempotency table to deduplicate requests sharing the same key.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'idempotency' && (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-slate-900">
                How MOSU Solves the Network Timeout Dilemma
              </h3>
              <p className="text-slate-600">
                In distributed networks, when a timeout occurs, there are two possibilities: the message never reached the provider, or it reached the provider and was sent, but the confirmation response dropped on the return path.
              </p>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <ol className="list-decimal list-inside space-y-1 text-slate-700">
                  <li><strong>Attempt #1:</strong> Dispatched with key <code>action-2913...</code>. Response times out. App marks status = "unknown".</li>
                  <li><strong>Recovery Attempt #2:</strong> Dispatched with the <em>exact same key</em>.</li>
                  <li><strong>Provider Deduplication:</strong> Provider detects the key in its registry and returns <code>receipt-1</code> without sending a second SMS/email.</li>
                  <li><strong>Result:</strong> 2 Application requests &rarr; Exactly 1 customer delivery.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 transition"
          >
            Close Notes
          </button>
        </div>
      </div>
    </div>
  );
}
