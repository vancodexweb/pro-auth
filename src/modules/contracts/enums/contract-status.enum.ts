export enum ContractStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  TERMINATED = 'TERMINATED',
}

/** ACTIVE can go to CLOSED (fulfilled) or TERMINATED (cancelled early); nothing leaves those two. */
export const ALLOWED_CONTRACT_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  [ContractStatus.DRAFT]: [ContractStatus.ACTIVE, ContractStatus.TERMINATED],
  [ContractStatus.ACTIVE]: [ContractStatus.CLOSED, ContractStatus.TERMINATED],
  [ContractStatus.CLOSED]: [],
  [ContractStatus.TERMINATED]: [],
};
