export interface Staker {
  wallet: string;
  uiStakingPower: number;
  uiAmount: number;
  startTs: number;
  endTs: number;
  duration: number;
}

export interface StakerSnapshot {
  ts: string;
  totalUIStaked: number;
  totalLockups: number;
  totalUIStakingPower: number;
  stakers: Staker[];
}