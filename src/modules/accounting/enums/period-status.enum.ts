export enum PeriodStatus {
  OPEN = 'OPEN',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED',
}

export const ALLOWED_PERIOD_TRANSITIONS: Record<PeriodStatus, PeriodStatus[]> = {
  [PeriodStatus.OPEN]: [PeriodStatus.CLOSING],
  [PeriodStatus.CLOSING]: [PeriodStatus.OPEN, PeriodStatus.CLOSED],
  [PeriodStatus.CLOSED]: [],
};
