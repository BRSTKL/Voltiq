const ELECTROLYZER_EFFICIENCY = {
  pem: 0.68,
  alkaline: 0.63,
  soec: 0.8,
};

const CAPEX_PER_KW = {
  pem: 1200,
  alkaline: 800,
  soec: 2000,
};

const OPEX_RATE = {
  pem: 0.03,
  alkaline: 0.02,
  soec: 0.04,
};

const STACK_COST_RATIO = {
  pem: 0.4,
  alkaline: 0.25,
  soec: 0.5,
};

const REPLACEMENT_YEARS = {
  pem: 10,
  alkaline: 15,
  soec: 8,
};

const ELECTRICITY_SOURCE_CI = {
  solar: 0.04,
  wind: 0.02,
  hydro: 0.01,
  grid_eu: 0.25,
  grid_us: 0.38,
  grid_global: 0.49,
};

function validateType(type, dictionary, errorMessage) {
  if (!dictionary[type]) {
    throw new Error(errorMessage);
  }
}

export function calcElectrolyzerArea(ratedMW, type) {
  validateType(type, ELECTROLYZER_EFFICIENCY, "Unsupported electrolyzer type.");
  return (ratedMW * 1000) / ELECTROLYZER_EFFICIENCY[type];
}

export function calcAnnualProduction(ratedMW, capacityFactor, efficiency) {
  const annualKwh = ratedMW * 1000 * 8760 * (capacityFactor / 100);
  const kwhPerKgH2 = (1 / (efficiency / 100)) * 33.33;
  return annualKwh / kwhPerKgH2;
}

export function calcCapex(ratedMW, electType, includesStorage, includesCompressor) {
  validateType(electType, CAPEX_PER_KW, "Unsupported electrolyzer type.");

  let capex = ratedMW * 1000 * CAPEX_PER_KW[electType];

  if (includesStorage) {
    capex += ratedMW * 1000 * 150;
  }

  if (includesCompressor) {
    capex += ratedMW * 1000 * 200;
  }

  return capex;
}

export function calcAnnualOpex(capex, electType) {
  validateType(electType, OPEX_RATE, "Unsupported electrolyzer type.");
  return capex * OPEX_RATE[electType];
}

export function calcStackReplacement(capex, electType) {
  validateType(electType, STACK_COST_RATIO, "Unsupported electrolyzer type.");

  return {
    cost: capex * STACK_COST_RATIO[electType],
    every: REPLACEMENT_YEARS[electType],
  };
}

export function calcLCOH(params) {
  const {
    capex,
    annualOpex,
    electricityPrice,
    annualKwh,
    annualH2kg,
    projectLifeYears,
    discountRate,
    stackCost,
    stackEvery,
  } = params;

  const r = discountRate / 100;
  const crf =
    (r * Math.pow(1 + r, projectLifeYears)) /
    (Math.pow(1 + r, projectLifeYears) - 1);
  const annualCapex = capex * crf;
  const stackAnnualized = stackCost / stackEvery;
  const annualElectricityCost = annualKwh * (electricityPrice / 1000);
  const totalAnnualCost =
    annualCapex + annualOpex + annualElectricityCost + stackAnnualized;

  return totalAnnualCost / annualH2kg;
}

export function calcCostBreakdown(
  annualCapex,
  annualOpex,
  annualElecCost,
  stackAnnualized
) {
  const total = annualCapex + annualOpex + annualElecCost + stackAnnualized;

  return {
    capex: ((annualCapex / total) * 100).toFixed(1),
    opex: ((annualOpex / total) * 100).toFixed(1),
    electricity: ((annualElecCost / total) * 100).toFixed(1),
    stack: ((stackAnnualized / total) * 100).toFixed(1),
  };
}

export function calcCarbonIntensity(electricitySource) {
  validateType(
    electricitySource,
    ELECTRICITY_SOURCE_CI,
    "Unsupported electricity source."
  );

  const kwhPerKgH2 = 55;
  return (ELECTRICITY_SOURCE_CI[electricitySource] * kwhPerKgH2).toFixed(2);
}
