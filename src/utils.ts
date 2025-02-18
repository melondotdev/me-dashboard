import { Staker } from './types';

export function calcVotingPower(
  lockupAmt: number,
  lockupStartTs: number,
  lockupEndTs: number,
  lockupMinDuration: number,
  lockupMaxSaturation: number,
  lockupTargetVotingPct: number,
  now: number,
): number {
  if (now > lockupEndTs) {
    return 0;
  }
  if (lockupEndTs <= lockupStartTs) {
    return 0;
  }

  const duration = lockupEndTs - lockupStartTs;
  const maxVotingPower = (lockupAmt * lockupTargetVotingPct) / 100;
  const lockupDurationRange = lockupMaxSaturation - lockupMinDuration;
  
  if (duration <= lockupMinDuration) {
    return lockupAmt;
  }
  if (duration >= lockupMaxSaturation) {
    return maxVotingPower;
  }
  if (lockupDurationRange <= 0) {
    return 0;
  }
  
  return (
    lockupAmt +
    ((maxVotingPower - lockupAmt) * (duration - lockupMinDuration)) /
      (lockupMaxSaturation - lockupMinDuration)
  );
}

export function getPercentileThresholds(stakers: Staker[]) {
  const sortedPowers = [...stakers]
    .sort((a, b) => b.uiStakingPower - a.uiStakingPower);

  const top1Index = Math.floor(stakers.length * 0.01);
  const top10Index = Math.floor(stakers.length * 0.1);

  return {
    top1: sortedPowers[top1Index]?.uiStakingPower || 0,
    top10: sortedPowers[top10Index]?.uiStakingPower || 0,
  };
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(num);
}