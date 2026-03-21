export function calcCurrent(params) {
  const { systemType, power, voltage, powerFactor, phases } = params;

  if (systemType === "dc") {
    return power / voltage;
  }

  if (phases === 1) {
    return power / (voltage * powerFactor);
  }

  return power / (Math.sqrt(3) * voltage * powerFactor);
}

export function calcVoltageDrop(
  current,
  cableLength,
  crossSection,
  conductorMaterial,
  systemType,
  phases
) {
  const rho = conductorMaterial === "copper" ? 0.0225 : 0.036;
  const resistance = (rho * cableLength) / crossSection;

  if (systemType === "dc") {
    return 2 * current * resistance;
  }

  if (phases === 1) {
    return 2 * current * resistance;
  }

  return Math.sqrt(3) * current * resistance;
}

export function calcVoltageDropPct(voltageDrop, systemVoltage) {
  return (voltageDrop / systemVoltage) * 100;
}

export function calcPowerLoss(
  current,
  cableLength,
  crossSection,
  conductorMaterial,
  systemType,
  phases
) {
  const rho = conductorMaterial === "copper" ? 0.0225 : 0.036;
  const resistance = (rho * cableLength) / crossSection;

  if (systemType === "dc" || phases === 1) {
    return 2 * Math.pow(current, 2) * resistance;
  }

  return 3 * Math.pow(current, 2) * resistance;
}

export function calcAnnualEnergyLoss(powerLossW, operatingHours) {
  return (powerLossW * operatingHours) / 1000;
}

export function calcMinCrossSectionVD(
  current,
  cableLength,
  maxVoltageDropPct,
  systemVoltage,
  conductorMaterial,
  systemType,
  phases
) {
  const rho = conductorMaterial === "copper" ? 0.0225 : 0.036;
  const maxVD = systemVoltage * (maxVoltageDropPct / 100);
  const factor = systemType === "dc" || phases === 1 ? 2 : Math.sqrt(3);

  return (factor * rho * cableLength * current) / maxVD;
}

export const STANDARD_SIZES_MM2 = [
  1.5,
  2.5,
  4,
  6,
  10,
  16,
  25,
  35,
  50,
  70,
  95,
  120,
  150,
  185,
  240,
  300,
];

export const AMPACITY_TABLE = {
  1.5: { copper_pvc: 15, copper_xlpe: 17, aluminum_pvc: null, aluminum_xlpe: null },
  2.5: { copper_pvc: 21, copper_xlpe: 23, aluminum_pvc: 16, aluminum_xlpe: 18 },
  4: { copper_pvc: 28, copper_xlpe: 31, aluminum_pvc: 22, aluminum_xlpe: 24 },
  6: { copper_pvc: 36, copper_xlpe: 40, aluminum_pvc: 28, aluminum_xlpe: 31 },
  10: { copper_pvc: 50, copper_xlpe: 54, aluminum_pvc: 39, aluminum_xlpe: 42 },
  16: { copper_pvc: 66, copper_xlpe: 73, aluminum_pvc: 52, aluminum_xlpe: 57 },
  25: { copper_pvc: 84, copper_xlpe: 95, aluminum_pvc: 66, aluminum_xlpe: 75 },
  35: { copper_pvc: 104, copper_xlpe: 117, aluminum_pvc: 80, aluminum_xlpe: 92 },
  50: { copper_pvc: 125, copper_xlpe: 141, aluminum_pvc: 98, aluminum_xlpe: 110 },
  70: { copper_pvc: 160, copper_xlpe: 179, aluminum_pvc: 122, aluminum_xlpe: 136 },
  95: { copper_pvc: 194, copper_xlpe: 216, aluminum_pvc: 149, aluminum_xlpe: 165 },
  120: { copper_pvc: 225, copper_xlpe: 249, aluminum_pvc: 172, aluminum_xlpe: 190 },
  150: { copper_pvc: 260, copper_xlpe: 285, aluminum_pvc: 198, aluminum_xlpe: 218 },
  185: { copper_pvc: 299, copper_xlpe: 328, aluminum_pvc: 227, aluminum_xlpe: 250 },
  240: { copper_pvc: 352, copper_xlpe: 386, aluminum_pvc: 268, aluminum_xlpe: 294 },
  300: { copper_pvc: 406, copper_xlpe: 444, aluminum_pvc: 307, aluminum_xlpe: 337 },
};

export function getTempCorrectionFactor(ambientTemp, insulationType) {
  const factors = {
    pvc: {
      25: 1.03,
      30: 1.0,
      35: 0.94,
      40: 0.87,
      45: 0.79,
      50: 0.71,
      55: 0.61,
    },
    xlpe: {
      25: 1.02,
      30: 1.0,
      35: 0.96,
      40: 0.91,
      45: 0.87,
      50: 0.82,
      55: 0.76,
    },
  };

  return factors[insulationType]?.[ambientTemp] || 1.0;
}

export function getGroupingFactor(numCables) {
  const factors = {
    1: 1.0,
    2: 0.8,
    3: 0.7,
    4: 0.65,
    5: 0.6,
    6: 0.57,
  };

  return factors[Math.min(numCables, 6)] || 0.5;
}

export function findRecommendedSize(
  current,
  conductorMaterial,
  insulationType,
  ambientTemp,
  numCables
) {
  const tempFactor = getTempCorrectionFactor(ambientTemp, insulationType);
  const groupFactor = getGroupingFactor(numCables);
  const deratedCurrent = current / (tempFactor * groupFactor);
  const key = `${conductorMaterial}_${insulationType}`;

  for (const size of STANDARD_SIZES_MM2) {
    const ampacity = AMPACITY_TABLE[size]?.[key];

    if (ampacity && ampacity >= deratedCurrent) {
      return {
        size,
        ampacity,
        deratedAmpacity: Math.round(ampacity * tempFactor * groupFactor),
        tempFactor,
        groupFactor,
      };
    }
  }

  return null;
}

export const VD_LIMITS = {
  pv_dc: 1.0,
  pv_dc_main: 1.5,
  ac_final: 3.0,
  ac_distribution: 1.5,
  motor: 5.0,
};
