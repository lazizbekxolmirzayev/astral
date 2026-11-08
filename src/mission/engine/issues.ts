import type { Localized } from '../i18n';
import type { ResourceKey } from '../models/resources';

export const ENGINE_ISSUE_CODES = [
  'mass-over-launcher-capacity',
  'payload-over-bus-limit',
  'power-deficit',
  'battery-too-small',
  'no-power-source',
  'no-flight-computer',
  'no-attitude-control',
  'no-radio',
  'link-cannot-close',
  'link-below-hardware-rate',
  'data-storage-overflow',
  'data-backlog-at-end',
  'pointing-insufficient',
  'delta-v-insufficient',
  'low-thrust-cannot-insert',
  'departure-energy-insufficient',
  'exceeds-design-life',
  'requirement-not-met',
  'no-instruments',
  'mass-margin-tight',
  'power-margin-tight',
  'battery-margin-tight',
  'delta-v-margin-tight',
  'time-margin-tight',
] as const;
export type EngineIssueCode = (typeof ENGINE_ISSUE_CODES)[number];

export type IssueSubject = ResourceKey | 'delta-v' | 'design' | 'requirements';

/**
 * A problem the engine found. `error` means the design cannot work as chosen;
 * `warning` means it works with little margin or a reduced result. Nothing is
 * filtered out: the evaluation lists every issue, and `feasible` is false while
 * any error remains. `values` hold the numbers behind the message (SI units).
 */
export type EngineIssue = {
  code: EngineIssueCode;
  severity: 'error' | 'warning';
  subject: IssueSubject;
  message: Localized;
  values: Readonly<Record<string, number | string>>;
};
