const DOD_MAP = {
  lfp: 0.9,
  nmc: 0.85,
  lead: 0.5,
};

const CYCLE_LIFE_MAP = {
  lfp: "3000-6000 cycles",
  nmc: "1000-2000 cycles",
  lead: "300-500 cycles",
};

export function calculateBatterySizing({ consumption, nightRatio, autonomy, battType, voltage }) {
  const dod = DOD_MAP[battType];
  const cycleLife = CYCLE_LIFE_MAP[battType];

  if (!dod || !cycleLife) {
    throw new Error("Unsupported battery technology.");
  }

  if (!Number.isFinite(consumption) || !Number.isFinite(nightRatio) || !Number.isFinite(autonomy)) {
    throw new Error("Invalid battery sizing inputs.");
  }

  const numericVoltage = Number(voltage);

  if (!Number.isFinite(numericVoltage) || numericVoltage <= 0) {
    throw new Error("Invalid system voltage.");
  }

  const nightLoad = consumption * (nightRatio / 100) * autonomy;
  const usableCapacity = nightLoad * 1.2;
  const nominalCapacity = usableCapacity / dod;
  const batteryCount = Math.ceil((nominalCapacity * 1000) / numericVoltage / 100);

  return {
    nightLoad,
    usableCapacity,
    nominalCapacity,
    batteryCount,
    dod,
    cycleLife,
  };
}
