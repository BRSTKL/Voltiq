export function calculateROIProjection({
  systemCost,
  kWp,
  annualYield,
  tariff,
  escalation,
  selfConsumption,
  degradation,
}) {
  const inputs = [
    systemCost,
    kWp,
    annualYield,
    tariff,
    escalation,
    selfConsumption,
    degradation,
  ];

  if (inputs.some((value) => !Number.isFinite(value))) {
    throw new Error("Invalid ROI inputs.");
  }

  if (systemCost <= 0 || kWp <= 0 || annualYield <= 0 || tariff < 0) {
    throw new Error("Invalid ROI inputs.");
  }

  let cumulative = 0;
  let currentTariff = tariff;
  let paybackYear = null;
  const yearlyData = [];

  for (let year = 1; year <= 25; year += 1) {
    const production = kWp * annualYield * Math.pow(1 - degradation / 100, year - 1);
    const saving = production * (selfConsumption / 100) * currentTariff;

    cumulative += saving;

    if (!paybackYear && cumulative >= systemCost) {
      paybackYear = year;
    }

    yearlyData.push({
      year,
      value: cumulative - systemCost,
    });

    currentTariff *= 1 + escalation / 100;
  }

  const net25 = cumulative - systemCost;
  const roi = Math.round((net25 / systemCost) * 100);
  const year1saving = kWp * annualYield * (selfConsumption / 100) * tariff;

  return {
    paybackYear,
    net25,
    roi,
    year1saving,
    cumulative,
    yearlyData,
  };
}
