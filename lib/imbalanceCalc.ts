export interface ImbalanceInput {
  scheduledMWh: number;
  actualMWh: number;
  ptf: number;
  smf: number;
  direction: "long" | "short" | "balanced";
}

export interface ImbalanceResult {
  imbalanceVolume: number;
  imbalanceCost: number;
  effectivePrice: number;
  ptfSmfSpread: number;
  riskCategory: "low" | "medium" | "high";
  explanation: string;
}

const NEGATIVE_IMBALANCE_FACTOR = 1.03;
const SAME_SIDE_PENALTY_FACTOR = 1.1;

function round(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

function ensureFiniteNumber(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} sayisal bir deger olmali.`);
  }
}

function isSameSidePenalty(
  imbalanceVolume: number,
  direction: ImbalanceInput["direction"]
) {
  if (direction === "balanced" || imbalanceVolume === 0) {
    return false;
  }

  return (
    (imbalanceVolume > 0 && direction === "long") ||
    (imbalanceVolume < 0 && direction === "short")
  );
}

function getRiskCategory(
  imbalanceVolume: number,
  scheduledMWh: number,
  ptfSmfSpread: number,
  sameSidePenalty: boolean
): ImbalanceResult["riskCategory"] {
  const scheduledBaseline = Math.max(Math.abs(scheduledMWh), 1);
  const deviationRatio = Math.abs(imbalanceVolume) / scheduledBaseline;
  const spreadMagnitude = Math.abs(ptfSmfSpread);

  let score = 0;

  if (deviationRatio >= 0.15) {
    score += 2;
  } else if (deviationRatio >= 0.05) {
    score += 1;
  }

  if (spreadMagnitude >= 300) {
    score += 2;
  } else if (spreadMagnitude >= 120) {
    score += 1;
  }

  if (sameSidePenalty) {
    score += 1;
  }

  if (score >= 4 || deviationRatio >= 0.2) {
    return "high";
  }

  if (score >= 2) {
    return "medium";
  }

  return "low";
}

function buildExplanation(
  input: ImbalanceInput,
  imbalanceVolume: number,
  effectivePrice: number,
  sameSidePenalty: boolean
) {
  const directionLabel =
    input.direction === "long"
      ? "sistem fazlalikta"
      : input.direction === "short"
        ? "sistem acikta"
        : "sistem dengeli";

  if (imbalanceVolume === 0) {
    return "Programlanan enerji ile gerceklesen enerji ayni oldugu icin dengesizlik bedeli olusmadi.";
  }

  if (imbalanceVolume > 0) {
    if (sameSidePenalty) {
      return `${round(
        imbalanceVolume,
        3
      )} MWh pozitif dengesizlik olustu. Fazla enerji SMF uzerinden settle edilir; ancak ${directionLabel} oldugu icin gelir %10 azaltildi ve efektif fiyat ${round(
        effectivePrice,
        2
      )} TL/MWh seviyesine indi.`;
    }

    return `${round(
      imbalanceVolume,
      3
    )} MWh pozitif dengesizlik olustu. Fazla enerji SMF uzerinden ${round(
      effectivePrice,
      2
    )} TL/MWh efektif fiyatla settle edilir.`;
  }

  if (sameSidePenalty) {
    return `${round(
      Math.abs(imbalanceVolume),
      3
    )} MWh negatif dengesizlik olustu. Eksik enerji PTF x ${NEGATIVE_IMBALANCE_FACTOR.toFixed(
      2
    )} ile settle edilir; ${directionLabel} nedeniyle ceza %10 daha arttigi icin efektif maliyet ${round(
      effectivePrice,
      2
    )} TL/MWh oldu.`;
  }

  return `${round(
    Math.abs(imbalanceVolume),
    3
  )} MWh negatif dengesizlik olustu. Eksik enerji PTF x ${NEGATIVE_IMBALANCE_FACTOR.toFixed(
    2
  )} ile ${round(effectivePrice, 2)} TL/MWh efektif maliyet uzerinden settle edilir.`;
}

export function calculateImbalance(
  input: ImbalanceInput
): ImbalanceResult {
  ensureFiniteNumber(input.scheduledMWh, "Programlanan enerji");
  ensureFiniteNumber(input.actualMWh, "Gerceklesen enerji");
  ensureFiniteNumber(input.ptf, "PTF");
  ensureFiniteNumber(input.smf, "SMF");

  const imbalanceVolume = round(input.actualMWh - input.scheduledMWh, 3);
  const ptfSmfSpread = round(input.ptf - input.smf, 2);
  const sameSidePenalty = isSameSidePenalty(imbalanceVolume, input.direction);

  if (imbalanceVolume === 0) {
    return {
      imbalanceVolume,
      imbalanceCost: 0,
      effectivePrice: 0,
      ptfSmfSpread,
      riskCategory: "low",
      explanation: buildExplanation(input, imbalanceVolume, 0, sameSidePenalty),
    };
  }

  let settlementPrice =
    imbalanceVolume > 0 ? input.smf : input.ptf * NEGATIVE_IMBALANCE_FACTOR;

  if (sameSidePenalty) {
    settlementPrice *=
      imbalanceVolume > 0
        ? 2 - SAME_SIDE_PENALTY_FACTOR
        : SAME_SIDE_PENALTY_FACTOR;
  }

  const effectivePrice = round(Math.abs(settlementPrice), 2);
  const imbalanceCost = round(imbalanceVolume * settlementPrice, 2);
  const riskCategory = getRiskCategory(
    imbalanceVolume,
    input.scheduledMWh,
    ptfSmfSpread,
    sameSidePenalty
  );

  return {
    imbalanceVolume,
    imbalanceCost,
    effectivePrice,
    ptfSmfSpread,
    riskCategory,
    explanation: buildExplanation(
      input,
      imbalanceVolume,
      effectivePrice,
      sameSidePenalty
    ),
  };
}

export function calculateHourlyImbalance(
  hours: Array<{ scheduled: number; actual: number; ptf: number; smf: number }>,
  systemDirection: "long" | "short" | "balanced"
): { results: ImbalanceResult[]; totalCost: number; totalVolume: number } {
  const results = hours.map((hour) =>
    calculateImbalance({
      scheduledMWh: hour.scheduled,
      actualMWh: hour.actual,
      ptf: hour.ptf,
      smf: hour.smf,
      direction: systemDirection,
    })
  );

  const totalCost = round(
    results.reduce((sum, result) => sum + result.imbalanceCost, 0),
    2
  );
  const totalVolume = round(
    results.reduce((sum, result) => sum + result.imbalanceVolume, 0),
    3
  );

  return {
    results,
    totalCost,
    totalVolume,
  };
}
