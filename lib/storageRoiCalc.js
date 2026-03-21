function validateFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a valid number.`);
  }
}

function validatePositiveNumber(value, label) {
  validateFiniteNumber(value, label);

  if (value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
}

export function calcPeakShavingRevenue(params) {
  const {
    batteryKwh,
    batteryKw,
    demandChargePerkW,
    peakReductionKw,
    monthsPerYear,
  } = params || {};

  validatePositiveNumber(batteryKwh, "Battery capacity");
  validatePositiveNumber(batteryKw, "Battery power");
  validateFiniteNumber(demandChargePerkW, "Demand charge");
  validateFiniteNumber(peakReductionKw, "Peak demand reduction");
  validatePositiveNumber(monthsPerYear, "Months per year");

  const actualReduction = Math.min(peakReductionKw, batteryKw);
  return actualReduction * demandChargePerkW * monthsPerYear;
}

export function calcArbitrageRevenue(params) {
  const {
    batteryKwh,
    cyclesPerYear,
    priceSpread,
    roundTripEfficiency,
    degradationRate,
  } = params || {};

  validatePositiveNumber(batteryKwh, "Battery capacity");
  validateFiniteNumber(cyclesPerYear, "Cycles per year");
  validateFiniteNumber(priceSpread, "Price spread");
  validatePositiveNumber(roundTripEfficiency, "Round-trip efficiency");
  validateFiniteNumber(degradationRate, "Degradation rate");

  const usableEnergy = batteryKwh * (roundTripEfficiency / 100);
  return usableEnergy * cyclesPerYear * priceSpread;
}

export function calcBackupValue(params) {
  const {
    criticalLoadKw,
    backupHours,
    outageCostPerHour,
    outagesPerYear,
  } = params || {};

  validatePositiveNumber(criticalLoadKw, "Critical load");
  validateFiniteNumber(backupHours, "Backup hours");
  validateFiniteNumber(outageCostPerHour, "Outage cost");
  validateFiniteNumber(outagesPerYear, "Outages per year");

  return outagesPerYear * backupHours * outageCostPerHour;
}

export function calcStorageNPV(params) {
  const {
    systemCost,
    annualRevenue,
    annualOpex,
    degradationRate,
    discountRate,
    projectYears,
    replacementYear,
    replacementCost,
  } = params || {};

  validatePositiveNumber(systemCost, "System cost");
  validateFiniteNumber(annualRevenue, "Annual revenue");
  validateFiniteNumber(annualOpex, "Annual OPEX");
  validateFiniteNumber(degradationRate, "Degradation rate");
  validateFiniteNumber(discountRate, "Discount rate");
  validatePositiveNumber(projectYears, "Project years");
  validateFiniteNumber(replacementYear, "Replacement year");
  validateFiniteNumber(replacementCost, "Replacement cost");

  let npv = -systemCost;
  let paybackYear = null;
  let cumulative = -systemCost;
  const yearlyData = [];

  for (let year = 1; year <= projectYears; year += 1) {
    const degFactor = Math.pow(1 - degradationRate / 100, year - 1);
    const revenue = annualRevenue * degFactor;
    const replacement = year === replacementYear ? replacementCost : 0;
    const cashflow = revenue - annualOpex - replacement;
    const discounted = cashflow / Math.pow(1 + discountRate / 100, year);

    npv += discounted;
    cumulative += cashflow;

    if (!paybackYear && cumulative >= 0) {
      paybackYear = year;
    }

    yearlyData.push({
      year,
      cashflow,
      cumulative,
      npv,
    });
  }

  return { npv, paybackYear, yearlyData };
}

export function calcLCOS(
  systemCost,
  replacementCost,
  annualOpex,
  batteryKwh,
  cyclesPerYear,
  projectYears,
  discountRate
) {
  validatePositiveNumber(systemCost, "System cost");
  validateFiniteNumber(replacementCost, "Replacement cost");
  validateFiniteNumber(annualOpex, "Annual OPEX");
  validatePositiveNumber(batteryKwh, "Battery capacity");
  validatePositiveNumber(cyclesPerYear, "Cycles per year");
  validatePositiveNumber(projectYears, "Project years");
  validateFiniteNumber(discountRate, "Discount rate");

  const r = discountRate / 100;
  const crf =
    r === 0
      ? 1 / projectYears
      : (r * Math.pow(1 + r, projectYears)) /
        (Math.pow(1 + r, projectYears) - 1);
  const annualCapex = systemCost * crf;
  const totalAnnualCost = annualCapex + annualOpex;
  const annualThroughput = batteryKwh * cyclesPerYear;

  if (annualThroughput <= 0) {
    throw new Error("Annual throughput must be greater than zero.");
  }

  return totalAnnualCost / annualThroughput;
}
