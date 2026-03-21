const EMISSION_FACTORS = {
  Germany: { location: 0.385, residualMix: 0.624 },
  France: { location: 0.056, residualMix: 0.398 },
  "United Kingdom": { location: 0.183, residualMix: 0.256 },
  Netherlands: { location: 0.37, residualMix: 0.549 },
  Spain: { location: 0.168, residualMix: 0.291 },
  Italy: { location: 0.342, residualMix: 0.395 },
  Poland: { location: 0.635, residualMix: 0.7 },
  Sweden: { location: 0.045, residualMix: 0.033 },
  Norway: { location: 0.028, residualMix: 0.011 },
  Denmark: { location: 0.14, residualMix: 0.162 },
  Belgium: { location: 0.167, residualMix: 0.198 },
  Austria: { location: 0.158, residualMix: 0.159 },
  Switzerland: { location: 0.041, residualMix: 0.029 },
  "United States": { location: 0.367, residualMix: 0.455 },
  Canada: { location: 0.12, residualMix: 0.19 },
  Australia: { location: 0.49, residualMix: 0.61 },
  China: { location: 0.537, residualMix: 0.612 },
  India: { location: 0.632, residualMix: 0.706 },
  Japan: { location: 0.463, residualMix: 0.534 },
  "South Korea": { location: 0.415, residualMix: 0.486 },
  Brazil: { location: 0.088, residualMix: 0.133 },
  Turkey: { location: 0.39, residualMix: 0.458 },
};

function assertFiniteNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function assertPositiveNumber(value, fallback = 0) {
  const normalized = assertFiniteNumber(value, fallback);
  return normalized > 0 ? normalized : fallback;
}

function getCountryFactors(country) {
  return EMISSION_FACTORS[country] || {
    location: 0.475,
    residualMix: 0.55,
  };
}

function calcLocationBased(consumptionMwh, country) {
  const safeConsumption = assertPositiveNumber(consumptionMwh, 0);
  const ef = getCountryFactors(country).location;
  return safeConsumption * ef;
}

function calcMarketBased(params) {
  const safeParams = params || {};
  const totalConsumptionMwh = assertPositiveNumber(safeParams.totalConsumptionMwh, 0);
  const recMwh = assertPositiveNumber(safeParams.recMwh, 0);
  const ppaMwh = assertPositiveNumber(safeParams.ppaMwh, 0);
  const greenTariffMwh = assertPositiveNumber(safeParams.greenTariffMwh, 0);
  const ppaEmissionFactor = assertPositiveNumber(safeParams.ppaEmissionFactor, 0.01);
  const residualMix = getCountryFactors(safeParams.country).residualMix;
  const coveredMwh = recMwh + ppaMwh + greenTariffMwh;
  const uncoveredMwh = Math.max(0, totalConsumptionMwh - coveredMwh);

  return uncoveredMwh * residualMix + ppaMwh * ppaEmissionFactor;
}

function calcRECoverage(totalMwh, recMwh, ppaMwh, greenMwh) {
  const safeTotal = assertPositiveNumber(totalMwh, 0);

  if (!safeTotal) {
    return 0;
  }

  return Math.min(
    100,
    ((assertPositiveNumber(recMwh, 0) +
      assertPositiveNumber(ppaMwh, 0) +
      assertPositiveNumber(greenMwh, 0)) /
      safeTotal) *
      100
  );
}

function checkSBTiAlignment(marketBasedTco2, baseYearTco2, currentYear, baseYear) {
  const safeMarketBased = assertPositiveNumber(marketBasedTco2, 0);
  const safeBaseYearTco2 = assertPositiveNumber(baseYearTco2, 0);
  const safeCurrentYear = assertFiniteNumber(currentYear, new Date().getFullYear());
  const safeBaseYear = assertFiniteNumber(baseYear, safeCurrentYear);
  const yearsElapsed = Math.max(0, safeCurrentYear - safeBaseYear);
  const requiredReduction = 1 - Math.pow(1 - 0.042, yearsElapsed);
  const requiredTarget = safeBaseYearTco2 * (1 - requiredReduction);

  return {
    onTrack: safeMarketBased <= requiredTarget,
    requiredTarget,
    gap: safeMarketBased - requiredTarget,
  };
}

function calcOffsetCost(tco2e, offsetPricePerTon) {
  return assertPositiveNumber(tco2e, 0) * assertPositiveNumber(offsetPricePerTon, 0);
}

function calcIntensityMetrics(tco2e, params) {
  const safeTco2e = assertPositiveNumber(tco2e, 0);
  const safeParams = params || {};
  const revenue = assertPositiveNumber(safeParams.revenue, 0);
  const employees = assertPositiveNumber(safeParams.employees, 0);
  const floorAreaM2 = assertPositiveNumber(safeParams.floorAreaM2, 0);
  const productionUnits = assertPositiveNumber(safeParams.productionUnits, 0);

  return {
    perRevenueMillion: revenue ? (safeTco2e / revenue) * 1000000 : null,
    perEmployee: employees ? safeTco2e / employees : null,
    perM2: floorAreaM2 ? safeTco2e / floorAreaM2 : null,
    perUnit: productionUnits ? safeTco2e / productionUnits : null,
  };
}

export {
  EMISSION_FACTORS,
  calcLocationBased,
  calcMarketBased,
  calcRECoverage,
  checkSBTiAlignment,
  calcOffsetCost,
  calcIntensityMetrics,
};
