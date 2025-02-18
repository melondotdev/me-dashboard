import { StakerSnapshot } from './types';

export const mockData: StakerSnapshot = {
  "ts": "2024-03-20T15:30:00.000Z",
  "totalUIStaked": 13791417.12,
  "totalLockups": 40812,
  "totalUIStakingPower": 52270945.73,
  "stakers": [
    {
      "wallet": "AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUu",
      "uiStakingPower": 400,
      "uiAmount": 100,
      "startTs": 1710945600,
      "endTs": 1742481600,
      "duration": 31536000
    },
    {
      "wallet": "VvWwXxYyZz11223344556677889900AaBbCcDdEe",
      "uiStakingPower": 20000.01,
      "uiAmount": 10000.00,
      "startTs": 1710945600,
      "endTs": 1726617600,
      "duration": 15672000
    }
  ]
};