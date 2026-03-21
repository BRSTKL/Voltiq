function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function calcSiteScore(params) {
  const {
    solarScore = 0,
    gridScore = 0,
    terrainScore = 0,
    regulatoryScore = 0,
  } = params ?? {};

  return (
    toFiniteNumber(solarScore) +
    toFiniteNumber(gridScore) +
    toFiniteNumber(terrainScore) +
    toFiniteNumber(regulatoryScore)
  );
}

export function calcSolarScore(irradiance) {
  const safeIrradiance = toFiniteNumber(irradiance);

  if (safeIrradiance >= 6.0) return 40;
  if (safeIrradiance >= 5.0) return 35;
  if (safeIrradiance >= 4.5) return 30;
  if (safeIrradiance >= 4.0) return 24;
  if (safeIrradiance >= 3.5) return 18;
  if (safeIrradiance >= 3.0) return 12;
  return 6;
}

export function calcGridScore(gridDistanceKm) {
  const safeDistance = Math.max(0, toFiniteNumber(gridDistanceKm));

  if (safeDistance <= 1) return 25;
  if (safeDistance <= 5) return 20;
  if (safeDistance <= 15) return 14;
  if (safeDistance <= 30) return 8;
  if (safeDistance <= 50) return 3;
  return 0;
}

export function calcTerrainScore(slopePercent, landType) {
  const landScores = {
    flat_open: 20,
    agricultural: 16,
    degraded: 18,
    forest: 4,
    urban: 8,
    water: 0,
  };

  const safeSlope = Math.max(0, toFiniteNumber(slopePercent));
  const slopeDeduction =
    safeSlope > 10 ? 8 : safeSlope > 5 ? 4 : safeSlope > 3 ? 2 : 0;

  return Math.max(0, (landScores[landType] ?? 10) - slopeDeduction);
}

export function calcRegulatoryScore(params) {
  const {
    protectedArea = false,
    nearAirport = false,
    gridPolicy = "moderate",
    permittingTime = 12,
  } = params ?? {};

  let score = 15;

  if (protectedArea) score -= 10;
  if (nearAirport) score -= 5;
  if (gridPolicy === "moderate") score -= 3;
  if (gridPolicy === "difficult") score -= 7;
  if (toFiniteNumber(permittingTime) > 24) score -= 3;
  if (toFiniteNumber(permittingTime) > 12) score -= 1;

  return Math.max(0, score);
}

export function classifySite(totalScore) {
  const safeScore = toFiniteNumber(totalScore);

  if (safeScore >= 80) {
    return {
      label: "Excellent",
      color: "#1D9E75",
      bg: "#E1F5EE",
      recommendation: "Highly suitable for utility-scale solar",
    };
  }

  if (safeScore >= 65) {
    return {
      label: "Good",
      color: "#3B6D11",
      bg: "#EAF3DE",
      recommendation: "Suitable for commercial solar development",
    };
  }

  if (safeScore >= 50) {
    return {
      label: "Moderate",
      color: "#854F0B",
      bg: "#FAEEDA",
      recommendation: "Feasible with mitigation measures",
    };
  }

  if (safeScore >= 35) {
    return {
      label: "Challenging",
      color: "#A32D2D",
      bg: "#FCEBEB",
      recommendation: "Significant barriers - detailed study required",
    };
  }

  return {
    label: "Unsuitable",
    color: "#791F1F",
    bg: "#F7C1C1",
    recommendation: "Not recommended for solar development",
  };
}

export function estimateGridConnectionCost(distanceKm, systemMW) {
  const safeDistance = Math.max(0, toFiniteNumber(distanceKm));
  const safeSystemSize = Math.max(0, toFiniteNumber(systemMW));
  const baseCost = safeDistance * 15000;
  const substationCost = safeSystemSize > 5 ? 180000 : 60000;

  return baseCost + substationCost;
}

export function calcLandRequirement(systemMW, panelEfficiency) {
  const safeSystemSize = Math.max(0, toFiniteNumber(systemMW));
  const safeEfficiency = toFiniteNumber(panelEfficiency, 21);
  const haPerMW = 2.5 - (safeEfficiency - 18) * 0.05;

  return safeSystemSize * haPerMW;
}
