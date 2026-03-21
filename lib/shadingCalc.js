const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SUN_PATH_MONTHS = [0, 2, 4, 6, 8, 10];

const INVERTER_MULTIPLIERS = {
  string: 1,
  micro: 0.4,
  central: 1.3,
};

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function radToDeg(value) {
  return (value * 180) / Math.PI;
}

function getDeclination(month) {
  return degToRad(-23.45 * Math.cos(degToRad((360 / 365) * (month * 30 + 10))));
}

function normalizeObstacle(obstacle) {
  return {
    az: Math.max(-180, Math.min(180, Number(obstacle.az) || 0)),
    elev: Math.max(0, Math.min(90, Number(obstacle.elev) || 0)),
    width: Math.max(0, Math.min(180, Number(obstacle.width) || 0)),
  };
}

export function sunElevation(lat, month, hour) {
  const latR = degToRad(lat);
  const decl = getDeclination(month);
  const ha = degToRad((hour - 12) * 15);

  return radToDeg(
    Math.asin(
      Math.sin(latR) * Math.sin(decl) +
        Math.cos(latR) * Math.cos(decl) * Math.cos(ha)
    )
  );
}

export function sunAzimuth(lat, month, hour) {
  const latR = degToRad(lat);
  const decl = getDeclination(month);
  const ha = degToRad((hour - 12) * 15);

  return radToDeg(
    Math.atan2(
      Math.sin(ha),
      Math.cos(ha) * Math.sin(latR) - Math.tan(decl) * Math.cos(latR)
    )
  );
}

export function calculateShadingLoss({
  kWp,
  tilt,
  latitude,
  baseYield,
  inverterType,
  obstacles,
}) {
  void tilt;

  const numericInputs = [kWp, latitude, baseYield];

  if (numericInputs.some((value) => !Number.isFinite(value))) {
    throw new Error("Invalid shading inputs.");
  }

  const inverterMultiplier = INVERTER_MULTIPLIERS[inverterType];

  if (!inverterMultiplier) {
    throw new Error("Unsupported inverter type.");
  }

  const normalizedObstacles = Array.isArray(obstacles)
    ? obstacles.map(normalizeObstacle)
    : [];

  const monthlyLoss = [];
  const monthlyValidSamples = [];

  for (let month = 0; month < 12; month += 1) {
    let shadedSamples = 0;
    let validSamples = 0;

    for (let step = 0; step <= 26; step += 1) {
      const hour = 6 + step * 0.5;
      const elevation = sunElevation(latitude, month, hour);

      if (elevation <= 0) {
        continue;
      }

      const azimuth = sunAzimuth(latitude, month, hour);
      const shaded = normalizedObstacles.some(
        (obstacle) =>
          Math.abs(azimuth - obstacle.az) < obstacle.width / 2 && elevation < obstacle.elev
      );

      validSamples += 1;

      if (shaded) {
        shadedSamples += 1;
      }
    }

    const shadingRatio = validSamples ? shadedSamples / validSamples : 0;
    monthlyLoss.push(Math.min(1, shadingRatio * inverterMultiplier));
    monthlyValidSamples.push(validSamples);
  }

  const annualShadingLoss =
    (monthlyLoss.reduce((sum, value) => sum + value, 0) / monthlyLoss.length) * 100;
  const grossAnnualProduction = kWp * baseYield;
  const lostEnergy = grossAnnualProduction * (annualShadingLoss / 100);
  const netProduction = grossAnnualProduction - lostEnergy;
  const effectivePRDrop = annualShadingLoss;

  const totalValidSamples = monthlyValidSamples.reduce((sum, value) => sum + value, 0);
  const monthlyGrossProduction = monthlyValidSamples.map((sampleCount) =>
    totalValidSamples ? grossAnnualProduction * (sampleCount / totalValidSamples) : grossAnnualProduction / 12
  );
  const monthlyLossWeights = monthlyGrossProduction.map(
    (grossProduction, index) => grossProduction * monthlyLoss[index]
  );
  const totalLossWeight = monthlyLossWeights.reduce((sum, value) => sum + value, 0);

  const monthlyData = MONTH_LABELS.map((month, index) => {
    const grossProduction = monthlyGrossProduction[index];
    const lostProduction = totalLossWeight
      ? lostEnergy * (monthlyLossWeights[index] / totalLossWeight)
      : 0;

    return {
      month,
      grossProduction,
      lostProduction,
      netProduction: grossProduction - lostProduction,
    };
  });

  const worstMonthIndex = monthlyLoss.reduce(
    (worstIndex, value, index, values) => (value > values[worstIndex] ? index : worstIndex),
    0
  );

  const sunPaths = SUN_PATH_MONTHS.map((monthIndex) => ({
    month: MONTH_LABELS[monthIndex],
    monthIndex,
    points: Array.from({ length: 27 }, (_, index) => 6 + index * 0.5)
      .map((hour) => ({
        hour,
        azimuth: sunAzimuth(latitude, monthIndex, hour),
        elevation: sunElevation(latitude, monthIndex, hour),
      }))
      .filter((point) => point.elevation > 0),
  }));

  return {
    annualShadingLoss,
    lostEnergy,
    netProduction,
    effectivePRDrop,
    monthlyLoss,
    monthlyData,
    worstMonth: MONTH_LABELS[worstMonthIndex],
    sunPaths,
  };
}
