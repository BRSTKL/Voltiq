export const MODULE_PRESETS = {
  "Generic 400W Mono-Si": {
    pMax: 400,
    voc: 41.2,
    vmp: 33.8,
    isc: 10.2,
    imp: 9.8,
    tempCoeffVoc: -0.27,
    tempCoeffPmax: -0.35,
  },
  "Generic 540W TOPCon": {
    pMax: 540,
    voc: 49.8,
    vmp: 41.6,
    isc: 13.8,
    imp: 13.1,
    tempCoeffVoc: -0.25,
    tempCoeffPmax: -0.3,
  },
  "Generic 670W Bifacial": {
    pMax: 670,
    voc: 54.2,
    vmp: 45.1,
    isc: 15.2,
    imp: 14.9,
    tempCoeffVoc: -0.24,
    tempCoeffPmax: -0.29,
  },
  Custom: null,
};

export const INVERTER_PRESETS = {
  "Generic 5kW String": {
    ratedPowerAC: 5000,
    maxDCPower: 6500,
    mpptMin: 200,
    mpptMax: 800,
    maxVdc: 1000,
    maxIdc: 22,
    numMPPT: 2,
    maxStringsPerMPPT: 1,
    efficiency: 97.5,
  },
  "Generic 20kW String": {
    ratedPowerAC: 20000,
    maxDCPower: 26000,
    mpptMin: 200,
    mpptMax: 800,
    maxVdc: 1000,
    maxIdc: 52,
    numMPPT: 4,
    maxStringsPerMPPT: 2,
    efficiency: 98.0,
  },
  "Generic 100kW Central": {
    ratedPowerAC: 100000,
    maxDCPower: 130000,
    mpptMin: 450,
    mpptMax: 850,
    maxVdc: 1100,
    maxIdc: 200,
    numMPPT: 8,
    maxStringsPerMPPT: 8,
    efficiency: 98.5,
  },
  Custom: null,
};

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function calcModuleVoltageAtTemp(voc, vmp, tempCoeffVoc, temp) {
  const safeVoc = toFiniteNumber(voc);
  const safeVmp = toFiniteNumber(vmp);
  const safeTempCoeffVoc = toFiniteNumber(tempCoeffVoc);
  const safeTemp = toFiniteNumber(temp, 25);
  const deltaT = safeTemp - 25;
  const vocAtTemp = safeVoc * (1 + (safeTempCoeffVoc / 100) * deltaT);
  const vmpAtTemp = safeVmp * (1 + (safeTempCoeffVoc / 100) * deltaT);

  return { vocAtTemp, vmpAtTemp };
}

export function calcStringConfig(params) {
  const {
    modulesPerString,
    numStrings,
    module,
    inverter,
    hotTemp,
    coldTemp,
  } = params ?? {};

  const safeModulesPerString = Math.max(0, toFiniteNumber(modulesPerString));
  const safeNumStrings = Math.max(0, toFiniteNumber(numStrings));
  const safeModule = module ?? {};
  const safeInverter = inverter ?? {};

  const hotVoltage = calcModuleVoltageAtTemp(
    safeModule.voc,
    safeModule.vmp,
    safeModule.tempCoeffVoc,
    hotTemp
  );
  const coldVoltage = calcModuleVoltageAtTemp(
    safeModule.voc,
    safeModule.vmp,
    safeModule.tempCoeffVoc,
    coldTemp
  );

  const stringVmpHot = hotVoltage.vmpAtTemp * safeModulesPerString;
  const stringVocCold = coldVoltage.vocAtTemp * safeModulesPerString;

  const checks = {
    mpptMinOk: stringVmpHot >= toFiniteNumber(safeInverter.mpptMin),
    mpptMaxOk: stringVmpHot <= toFiniteNumber(safeInverter.mpptMax, Number.POSITIVE_INFINITY),
    maxVdcOk:
      stringVocCold <= toFiniteNumber(safeInverter.maxVdc, Number.POSITIVE_INFINITY) * 0.98,
    currentOk:
      toFiniteNumber(safeModule.isc) * safeNumStrings <=
      toFiniteNumber(safeInverter.maxIdc, Number.POSITIVE_INFINITY),
  };

  return {
    stringVmpHot,
    stringVocCold,
    checks,
    allOk: Object.values(checks).every(Boolean),
  };
}

export function calcDCACRatio(systemKwp, inverterKwAC) {
  const safeSystemKwp = toFiniteNumber(systemKwp);
  const safeInverterKwAC = toFiniteNumber(inverterKwAC);

  if (safeInverterKwAC <= 0) {
    return 0;
  }

  return safeSystemKwp / safeInverterKwAC;
}

export function estimateClippingLoss(dcAcRatio, capacityFactor) {
  const safeRatio = toFiniteNumber(dcAcRatio);
  void toFiniteNumber(capacityFactor);

  if (safeRatio <= 1.0) return 0;
  if (safeRatio <= 1.2) return (safeRatio - 1.0) * 2.5;
  if (safeRatio <= 1.4) return 0.5 + (safeRatio - 1.2) * 5;
  return 1.5 + (safeRatio - 1.4) * 8;
}

export function calcNumInverters(systemKwp, inverterKwAC, dcAcRatio) {
  const safeSystemKwp = toFiniteNumber(systemKwp);
  const safeInverterKwAC = toFiniteNumber(inverterKwAC);
  const safeDcAcRatio = toFiniteNumber(dcAcRatio);

  if (safeInverterKwAC <= 0 || safeDcAcRatio <= 0) {
    return 0;
  }

  return Math.ceil(safeSystemKwp / (safeInverterKwAC * safeDcAcRatio));
}
