function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function applyPercentageLoss(energy, percent) {
  return energy * toFiniteNumber(percent) / 100;
}

export function calcLossChain(params) {
  const {
    grossIrradiance,
    systemKwp,
    tilt,
    azimuth,
    soilingLossPct,
    reflectionLossPct,
    spectralLossPct,
    tempCoefficient,
    avgOperatingTemp,
    moduleQualityPct,
    dcWiringLossPct,
    inverterEffPct,
    acWiringLossPct,
    transformerLossPct,
    availabilityPct,
    shadingLossPct,
  } = params ?? {};

  const annualIrradiance = Math.max(0, toFiniteNumber(grossIrradiance));
  const safeSystemKwp = Math.max(0, toFiniteNumber(systemKwp));
  const safeTilt = toFiniteNumber(tilt);
  const safeAzimuth = toFiniteNumber(azimuth);
  void safeTilt;
  void safeAzimuth;

  const steps = [];
  let energy = annualIrradiance * safeSystemKwp;

  steps.push({ name: "Gross irradiance", value: energy, loss: 0, lossType: "start" });

  const soilingLoss = applyPercentageLoss(energy, soilingLossPct);
  energy -= soilingLoss;
  steps.push({
    name: "Soiling / dust",
    value: energy,
    loss: soilingLoss,
    lossType: "irradiance",
  });

  const reflectionLoss = applyPercentageLoss(energy, reflectionLossPct);
  energy -= reflectionLoss;
  steps.push({
    name: "Reflection (IAM)",
    value: energy,
    loss: reflectionLoss,
    lossType: "irradiance",
  });

  const spectralLoss = applyPercentageLoss(energy, spectralLossPct);
  energy -= spectralLoss;
  steps.push({
    name: "Spectral losses",
    value: energy,
    loss: spectralLoss,
    lossType: "irradiance",
  });

  const shadingLoss = applyPercentageLoss(energy, shadingLossPct);
  energy -= shadingLoss;
  steps.push({
    name: "Shading losses",
    value: energy,
    loss: shadingLoss,
    lossType: "irradiance",
  });

  const tempLoss = energy * Math.abs(toFiniteNumber(tempCoefficient)) * toFiniteNumber(avgOperatingTemp) / 100;
  energy -= tempLoss;
  steps.push({
    name: "Temperature",
    value: energy,
    loss: tempLoss,
    lossType: "module",
  });

  const qualityLoss = applyPercentageLoss(energy, moduleQualityPct);
  energy -= qualityLoss;
  steps.push({
    name: "Module quality / LID",
    value: energy,
    loss: qualityLoss,
    lossType: "module",
  });

  const dcWiringLoss = applyPercentageLoss(energy, dcWiringLossPct);
  energy -= dcWiringLoss;
  steps.push({
    name: "DC wiring losses",
    value: energy,
    loss: dcWiringLoss,
    lossType: "dc",
  });

  const inverterLoss = applyPercentageLoss(energy, 100 - toFiniteNumber(inverterEffPct));
  energy -= inverterLoss;
  steps.push({
    name: "Inverter losses",
    value: energy,
    loss: inverterLoss,
    lossType: "ac",
  });

  const acWiringLoss = applyPercentageLoss(energy, acWiringLossPct);
  energy -= acWiringLoss;
  steps.push({
    name: "AC wiring losses",
    value: energy,
    loss: acWiringLoss,
    lossType: "ac",
  });

  const transformerLoss = applyPercentageLoss(energy, transformerLossPct);
  energy -= transformerLoss;
  steps.push({
    name: "Transformer losses",
    value: energy,
    loss: transformerLoss,
    lossType: "ac",
  });

  const availabilityLoss = applyPercentageLoss(energy, 100 - toFiniteNumber(availabilityPct));
  energy -= availabilityLoss;
  steps.push({
    name: "Downtime / availability",
    value: energy,
    loss: availabilityLoss,
    lossType: "system",
  });

  const netAC = energy;
  const totalLoss = steps[0].value - netAC;
  const overallPR = steps[0].value > 0 ? netAC / steps[0].value : 0;

  return {
    steps,
    netAC,
    totalLoss,
    overallPR,
    grossEnergy: steps[0].value,
  };
}

export function calcLossByCategory(steps) {
  const categories = {
    irradiance: 0,
    module: 0,
    dc: 0,
    ac: 0,
    system: 0,
  };

  (steps ?? []).forEach((step) => {
    if (step?.lossType !== "start" && Object.prototype.hasOwnProperty.call(categories, step?.lossType)) {
      categories[step.lossType] += toFiniteNumber(step.loss);
    }
  });

  return categories;
}
