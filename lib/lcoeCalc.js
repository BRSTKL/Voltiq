export const TECH_DEFAULTS = {
  solar_utility: {
    name: "Utility Solar PV",
    color: "#EF9F27",
    colorDark: "#854F0B",
    capexPerKw: 900,
    fixedOpexPerKwYear: 17,
    variableOpexPerMwh: 0,
    fuelCostPerMwh: 0,
    capacityFactor: 25,
    projectLifeYears: 30,
    emissionsFactor: 0.02,
    icon: "solar",
  },
  onshore_wind: {
    name: "Onshore Wind",
    color: "#5DCAA5",
    colorDark: "#085041",
    capexPerKw: 1350,
    fixedOpexPerKwYear: 43,
    variableOpexPerMwh: 0,
    fuelCostPerMwh: 0,
    capacityFactor: 35,
    projectLifeYears: 25,
    emissionsFactor: 0.011,
    icon: "wind",
  },
  offshore_wind: {
    name: "Offshore Wind",
    color: "#378ADD",
    colorDark: "#0C447C",
    capexPerKw: 3200,
    fixedOpexPerKwYear: 120,
    variableOpexPerMwh: 0,
    fuelCostPerMwh: 0,
    capacityFactor: 45,
    projectLifeYears: 25,
    emissionsFactor: 0.014,
    icon: "offshore",
  },
  natural_gas: {
    name: "Natural Gas (CCGT)",
    color: "#888780",
    colorDark: "#444441",
    capexPerKw: 950,
    fixedOpexPerKwYear: 28,
    variableOpexPerMwh: 3,
    fuelCostPerMwh: 40,
    capacityFactor: 55,
    projectLifeYears: 30,
    emissionsFactor: 0.37,
    icon: "gas",
  },
  nuclear: {
    name: "Nuclear",
    color: "#AFA9EC",
    colorDark: "#3C3489",
    capexPerKw: 6500,
    fixedOpexPerKwYear: 120,
    variableOpexPerMwh: 2,
    fuelCostPerMwh: 8,
    capacityFactor: 92,
    projectLifeYears: 60,
    emissionsFactor: 0.012,
    icon: "nuclear",
  },
};

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

export function calcCRF(discountRate, projectLifeYears) {
  validateFiniteNumber(discountRate, "Discount rate");
  validatePositiveNumber(projectLifeYears, "Project life");

  const r = discountRate / 100;

  if (r === 0) {
    return 1 / projectLifeYears;
  }

  return (
    (r * Math.pow(1 + r, projectLifeYears)) /
    (Math.pow(1 + r, projectLifeYears) - 1)
  );
}

export function calcAnnualizedCapex(
  capexPerKw,
  capacityFactor,
  discountRate,
  projectLifeYears
) {
  validatePositiveNumber(capexPerKw, "CAPEX");
  validatePositiveNumber(capacityFactor, "Capacity factor");

  const crf = calcCRF(discountRate, projectLifeYears);
  const annualCapex = capexPerKw * crf * 1000;
  const annualMWh = (capacityFactor / 100) * 8760;

  if (annualMWh <= 0) {
    throw new Error("Capacity factor must produce positive annual energy.");
  }

  return annualCapex / annualMWh;
}

export function calcFixedOpexPerMwh(fixedOpexPerKwYear, capacityFactor) {
  validateFiniteNumber(fixedOpexPerKwYear, "Fixed O&M");
  validatePositiveNumber(capacityFactor, "Capacity factor");

  const annualMWh = (capacityFactor / 100) * 8760;

  if (annualMWh <= 0) {
    throw new Error("Capacity factor must produce positive annual energy.");
  }

  return (fixedOpexPerKwYear * 1000) / annualMWh;
}

export function calcLCOE(params) {
  const {
    capexPerKw,
    fixedOpexPerKwYear,
    variableOpexPerMwh,
    fuelCostPerMwh,
    capacityFactor,
    discountRate,
    projectLifeYears,
    carbonCostPerTon,
    emissionsFactor,
  } = params || {};

  validatePositiveNumber(capexPerKw, "CAPEX");
  validateFiniteNumber(fixedOpexPerKwYear, "Fixed O&M");
  validateFiniteNumber(variableOpexPerMwh, "Variable O&M");
  validateFiniteNumber(fuelCostPerMwh, "Fuel cost");
  validatePositiveNumber(capacityFactor, "Capacity factor");
  validateFiniteNumber(discountRate, "Discount rate");
  validatePositiveNumber(projectLifeYears, "Project life");
  validateFiniteNumber(carbonCostPerTon, "Carbon cost");
  validateFiniteNumber(emissionsFactor, "Emissions factor");

  const capexComponent = calcAnnualizedCapex(
    capexPerKw,
    capacityFactor,
    discountRate,
    projectLifeYears
  );
  const fixedOpexComponent = calcFixedOpexPerMwh(
    fixedOpexPerKwYear,
    capacityFactor
  );
  const carbonComponent = carbonCostPerTon * emissionsFactor;

  return {
    total:
      capexComponent +
      fixedOpexComponent +
      variableOpexPerMwh +
      fuelCostPerMwh +
      carbonComponent,
    breakdown: {
      capex: capexComponent,
      fixedOpex: fixedOpexComponent,
      variableOpex: variableOpexPerMwh,
      fuel: fuelCostPerMwh,
      carbon: carbonComponent,
    },
  };
}

export function calcSensitivityCF(baseParams, cfRange) {
  if (!Array.isArray(cfRange)) {
    throw new Error("Capacity factor range must be an array.");
  }

  return cfRange.map((cf) => ({
    cf,
    lcoe: calcLCOE({ ...baseParams, capacityFactor: cf }).total,
  }));
}

export function calcSensitivityDiscount(baseParams, rateRange) {
  if (!Array.isArray(rateRange)) {
    throw new Error("Discount rate range must be an array.");
  }

  return rateRange.map((rate) => ({
    rate,
    lcoe: calcLCOE({ ...baseParams, discountRate: rate }).total,
  }));
}
