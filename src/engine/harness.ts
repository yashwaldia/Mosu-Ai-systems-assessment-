import type { Profile, Protocol, ProviderInspect, ToolAdapter } from './types';

export interface HarnessOptions {
  mode?: 'success' | 'commit_timeout_once' | 'commit_timeout_always';
  variant?: boolean;
  note?: string;
}

export function createHarness(options: HarnessOptions = {}) {
  const { mode = 'success', variant = false, note = 'Reference information only.' } = options;

  const profileV4: Profile = variant
    ? {
        id: 'profile-862',
        version: 9,
        protocolId: 'standard-fit',
        recipient: 'customer-862@example.test',
        measurements: {
          chest: null,
          waist: { value: 34, unit: 'in' },
          hip: { value: 97, unit: 'cm' },
        },
      }
    : {
        id: 'profile-017',
        version: 4,
        protocolId: 'standard-fit',
        recipient: 'customer-017@example.test',
        measurements: {
          chest: { value: 92, unit: 'cm' },
          waist: null,
          hip: { value: 38, unit: 'in' },
        },
      };

  const profileV5Clean: Profile = {
    id: 'profile-017',
    version: 5,
    protocolId: 'standard-fit',
    recipient: 'customer-017@example.test',
    measurements: {
      chest: { value: 92, unit: 'cm' },
      waist: { value: 76, unit: 'cm' },
      hip: { value: 96.5, unit: 'cm' },
    },
  };

  let protocol: Protocol = {
    id: 'standard-fit',
    revision: 'r1',
    requiredFields: ['chest', 'waist', 'hip'],
    requiredUnit: 'cm',
    note,
  };

  const calls: Array<{ idempotencyKey: string; recipient: string; text: string }> = [];
  const deliveries = new Map<
    string,
    { idempotencyKey: string; recipient: string; text: string; receiptId: string }
  >();
  const toolCalls: Array<Record<string, unknown>> = [];
  let idempotentHits = 0;

  const tools: ToolAdapter = Object.freeze({
    async readProtocol(protocolId: string): Promise<Protocol> {
      toolCalls.push({ tool: 'readProtocol', protocolId });
      if (protocolId !== protocol.id) {
        throw new Error('Unknown protocol: ' + protocolId);
      }
      return structuredClone(protocol);
    },

    async draftClarification(params: {
      profileId: string;
      profileVersion: number;
      issues: string[];
    }): Promise<string> {
      const { profileId, profileVersion, issues } = params;
      toolCalls.push({
        tool: 'draftClarification',
        profileId,
        profileVersion,
        issues: structuredClone(issues),
      });
      if (
        typeof profileId !== 'string' ||
        !Number.isInteger(profileVersion) ||
        !Array.isArray(issues) ||
        !issues.every((x) => typeof x === 'string')
      ) {
        throw new Error('Invalid drafting input');
      }
      return `Please clarify ${profileId} version ${profileVersion}: ${issues.join(', ')}.`;
    },

    async notify(input: {
      idempotencyKey: string;
      recipient: string;
      text: string;
    }): Promise<{ receiptId: string }> {
      const { idempotencyKey, recipient, text } = input ?? {};
      const payload = { idempotencyKey, recipient, text };

      calls.push(structuredClone(payload));
      toolCalls.push({ tool: 'notify', ...structuredClone(payload) });

      if (![idempotencyKey, recipient, text].every((x) => typeof x === 'string' && x.length > 0)) {
        throw new Error('Invalid notification input');
      }

      let delivery = deliveries.get(idempotencyKey);
      if (delivery && (delivery.recipient !== recipient || delivery.text !== text)) {
        throw new Error('Idempotency key reused with a different payload');
      }

      if (delivery) {
        idempotentHits += 1;
      } else {
        delivery = { ...payload, receiptId: `receipt-${deliveries.size + 1}` };
        deliveries.set(idempotencyKey, delivery);
      }

      if (
        mode === 'commit_timeout_always' ||
        (mode === 'commit_timeout_once' && calls.length === 1)
      ) {
        const error = new Error('Response timed out; delivery outcome is uncertain');
        (error as unknown as { code: string }).code = 'TIMEOUT';
        throw error;
      }

      return { receiptId: delivery.receiptId };
    },
  });

  return {
    profileV4: structuredClone(profileV4),
    profileV5Clean: structuredClone(profileV5Clean),
    expectedIssues: variant ? ['missing:chest', 'unit:waist:in'] : ['missing:waist', 'unit:hip:in'],
    tools,
    getMode: () => mode,
    getProtocol: () => structuredClone(protocol),
    setProtocolRevision: (revision: string, requiredFields?: string[]) => {
      protocol = {
        ...protocol,
        revision,
        requiredFields: requiredFields || protocol.requiredFields,
      };
    },
    inspect: (): ProviderInspect => {
      return structuredClone({
        calls,
        deliveries: Array.from(deliveries.values()),
        toolCalls,
        idempotentHits,
      });
    },
  };
}

export type Harness = ReturnType<typeof createHarness>;
