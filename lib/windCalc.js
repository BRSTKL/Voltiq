const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_HOURS = [744, 672, 744, 720, 744, 720, 744, 744, 720, 744, 720, 744];

export const WIND_TURBINES = {
  vestasV90: {
    key: "vestasV90",
    name: "Vestas V90-2MW",
    rated: 2000,
    cutIn: 3,
    cutOut: 25,
    ratedV: 12,
    rotor: 90,
  },
  enerconE70: {
    key: "enerconE70",
    name: "Enercon E-70",
    rated: 2300,
    cutIn: 2,
    cutOut: 28,
    ratedV: 13,
    rotor: 70,
  },
  small10: {
    key: "small10",
    name: "Small 10kW",
    rated: 10,
    cutIn: 2.5,
    cutOut: 20,
    ratedV: 10,
    rotor: 8,
  },
  small5: {
    key: "small5",
    name: "Small 5kW",
    rated: 5,
    cutIn: 2.5,
    cutOut: 20,
    ratedV: 9,
    rotor: 5,
  },
};

function average(values) {
  if (!Array.isArray(values) || !values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function groupArrayByMonth(values) {
  const grouped = [];
  let cursor = 0;

  MONTH_HOURS.forEach((monthHours) => {
    grouped.push(values.slice(cursor, cursor + monthHours));
    cursor += monthHours;
  });

  return grouped;
}

export function turbinePower(v, turbine) {
  if (v < turbine.cutIn || v > turbine.cutOut) {
    return 0;
  }

  const sweptArea = Math.PI * Math.pow(turbine.rotor / 2, 2);

  return Math.min(
    turbine.rated,
    (0.5 * 1.225 * sweptArea * Math.pow(v, 3) * 0.45) / 1000
  );
}

export function calculateWindEnergy({
  hourlyWind10m,
  monthlyWind10m,
  turbine,
  numTurbines,
  hubHeight,
  alpha,
  losses,
}) {
  if (!Array.isArray(hourlyWind10m) || !hourlyWind10m.length) {
    throw new Error("Missing hourly wind data.");
  }

  if (!turbine || !Number.isFinite(turbine.rated)) {
    throw new Error("Invalid turbine model.");
  }

  const numericInputs = [numTurbines, hubHeight, alpha, losses];

  if (numericInputs.some((value) => !Number.isFinite(value))) {
    throw new Error("Invalid wind calculation inputs.");
  }

  const scaledWind = hourlyWind10m.map((value) => value * Math.pow(hubHeight / 10, alpha));
  const avgScaledWind = average(scaledWind);
  const lambda = avgScaledWind / 0.8862;
  const k = 2.0;

  const hourlyPowerPerTurbine = scaledWind.map((value) => turbinePower(value, turbine));
  const grossAnnualKwhPerTurbine = hourlyPowerPerTurbine.reduce((sum, value) => sum + value, 0);
  const annualKwh = grossAnnualKwhPerTurbine * numTurbines * (1 - losses / 100);
  const annualMWh = annualKwh / 1000;
  const capacityFactor = (annualKwh / (turbine.rated * numTurbines * 8760)) * 100;
  const fullLoadHours = Math.round(annualKwh / (turbine.rated * numTurbines));
  const specificYield = Math.round(annualKwh / (turbine.rated * numTurbines));

  const monthlyScaledGroups = groupArrayByMonth(scaledWind);
  const monthlyPowerGroups = groupArrayByMonth(hourlyPowerPerTurbine);
  const fallbackMonthlyWind = Array.isArray(monthlyWind10m) ? monthlyWind10m : [];

  const monthlyAvgWindHub = MONTH_LABELS.map((_, index) => {
    if (monthlyScaledGroups[index]?.length) {
      return average(monthlyScaledGroups[index]);
    }

    if (Number.isFinite(fallbackMonthlyWind[index])) {
      return fallbackMonthlyWind[index] * Math.pow(hubHeight / 10, alpha);
    }

    return 0;
  });

  const monthlyProductionMWh = monthlyPowerGroups.map((group) =>
    (group.reduce((sum, value) => sum + value, 0) * numTurbines * (1 - losses / 100)) / 1000
  );

  const histogram = Array.from({ length: 26 }, (_, speed) => ({
    speed,
    hours: 0,
    inOperatingRange: speed >= turbine.cutIn && speed <= turbine.cutOut,
  }));

  scaledWind.forEach((value) => {
    const speedBin = Math.max(0, Math.min(25, Math.floor(value)));
    histogram[speedBin].hours += 1;
  });

  return {
    avgScaledWind,
    annualKwh,
    annualMWh,
    capacityFactor,
    fullLoadHours,
    specificYield,
    monthlyProductionMWh,
    monthlyAvgWindHub,
    weibull: {
      lambda,
      k,
    },
    histogram,
  };
}
