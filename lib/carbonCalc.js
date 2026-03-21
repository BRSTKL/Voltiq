export function calcCO2Emissions(consumptionKwh, carbonIntensityGCO2) {
  return (consumptionKwh * carbonIntensityGCO2) / 1000;
}

export function calcAnnualCO2(dailyKwh, carbonIntensityGCO2) {
  return calcCO2Emissions(dailyKwh * 365, carbonIntensityGCO2);
}

export function calcEquivalents(kgCO2) {
  return {
    carKm: Math.round(kgCO2 / 0.21),
    flightHours: Number((kgCO2 / 255).toFixed(1)),
    treeDays: Math.round(kgCO2 / 0.027),
    smartphoneCharges: Math.round(kgCO2 / 0.008),
  };
}

export function calcSavingsVsAverage(actualIntensity, consumptionKwh) {
  const globalAvg = 475;
  const savings = ((globalAvg - actualIntensity) / 1000) * consumptionKwh;
  return Math.max(0, savings);
}

export function calcRenewablePct(energyMix) {
  if (!energyMix) {
    return null;
  }

  const renewable =
    (energyMix.solar || 0) +
    (energyMix.wind || 0) +
    (energyMix.hydro || 0) +
    (energyMix.geothermal || 0) +
    (energyMix.biomass || 0) +
    (energyMix.renewables || 0);
  const total = Object.values(energyMix).reduce((sum, value) => sum + value, 0);

  return total > 0 ? Math.round((renewable / total) * 100) : null;
}

export function classifyIntensity(gCO2perKwh) {
  if (gCO2perKwh < 100) {
    return { label: "Very low", color: "#1D9E75", bg: "#E1F5EE" };
  }

  if (gCO2perKwh < 200) {
    return { label: "Low", color: "#3B6D11", bg: "#EAF3DE" };
  }

  if (gCO2perKwh < 350) {
    return { label: "Moderate", color: "#854F0B", bg: "#FAEEDA" };
  }

  if (gCO2perKwh < 500) {
    return { label: "High", color: "#A32D2D", bg: "#FCEBEB" };
  }

  return { label: "Very high", color: "#791F1F", bg: "#F7C1C1" };
}

export const STATIC_CARBON_DATA = {
  France: { intensity: 56, mix: { nuclear: 71, hydro: 11, wind: 8, solar: 4, gas: 4, coal: 1, other: 1 } },
  Norway: { intensity: 28, mix: { hydro: 88, wind: 8, gas: 3, other: 1 } },
  Sweden: { intensity: 45, mix: { nuclear: 29, hydro: 43, wind: 17, solar: 1, other: 10 } },
  Germany: { intensity: 385, mix: { wind: 34, solar: 12, coal: 26, gas: 15, nuclear: 2, hydro: 4, other: 7 } },
  Poland: { intensity: 635, mix: { coal: 68, gas: 9, wind: 12, solar: 5, other: 6 } },
  "United Kingdom": { intensity: 183, mix: { gas: 33, wind: 29, nuclear: 15, solar: 5, hydro: 2, other: 16 } },
  Spain: { intensity: 168, mix: { wind: 23, nuclear: 20, solar: 16, hydro: 11, gas: 20, other: 10 } },
  Italy: { intensity: 342, mix: { gas: 49, solar: 13, wind: 7, hydro: 14, other: 17 } },
  Netherlands: { intensity: 370, mix: { gas: 55, wind: 19, solar: 10, nuclear: 3, other: 13 } },
  Denmark: { intensity: 140, mix: { wind: 55, solar: 8, gas: 15, biomass: 17, other: 5 } },
  "United States": { intensity: 367, mix: { gas: 43, coal: 16, nuclear: 19, wind: 10, solar: 4, hydro: 6, other: 2 } },
  Canada: { intensity: 120, mix: { hydro: 59, nuclear: 14, wind: 7, solar: 2, gas: 10, coal: 5, other: 3 } },
  Brazil: { intensity: 88, mix: { hydro: 63, wind: 11, solar: 5, biomass: 9, gas: 7, other: 5 } },
  Australia: { intensity: 490, mix: { coal: 47, gas: 18, wind: 14, solar: 14, hydro: 6, other: 1 } },
  China: { intensity: 537, mix: { coal: 60, hydro: 15, wind: 9, solar: 5, nuclear: 5, gas: 3, other: 3 } },
  India: { intensity: 632, mix: { coal: 72, gas: 4, hydro: 10, wind: 5, solar: 6, nuclear: 2, other: 1 } },
  Japan: { intensity: 463, mix: { gas: 35, coal: 31, nuclear: 8, hydro: 8, solar: 9, wind: 1, other: 8 } },
  "South Korea": { intensity: 415, mix: { coal: 36, gas: 27, nuclear: 28, renewables: 9 } },
  Turkey: { intensity: 390, mix: { gas: 29, coal: 35, hydro: 24, wind: 7, solar: 4, other: 1 } },
  "South Africa": { intensity: 750, mix: { coal: 84, nuclear: 6, hydro: 1, wind: 5, solar: 3, other: 1 } },
  Mexico: { intensity: 445, mix: { gas: 57, oil: 8, coal: 7, hydro: 10, wind: 8, solar: 4, other: 6 } },
  Argentina: { intensity: 295, mix: { gas: 55, hydro: 27, nuclear: 6, wind: 7, solar: 3, other: 2 } },
  Switzerland: { intensity: 41, mix: { hydro: 55, nuclear: 36, solar: 5, wind: 1, other: 3 } },
  Austria: { intensity: 158, mix: { hydro: 60, wind: 12, solar: 7, gas: 14, other: 7 } },
  Portugal: { intensity: 140, mix: { wind: 26, hydro: 23, solar: 16, gas: 21, biomass: 8, other: 6 } },
  Belgium: { intensity: 167, mix: { nuclear: 48, wind: 15, solar: 7, gas: 23, other: 7 } },
  "Saudi Arabia": { intensity: 680, mix: { gas: 61, oil: 38, solar: 1 } },
  UAE: { intensity: 430, mix: { gas: 93, nuclear: 5, solar: 2 } },
};

export const ZONE_CODES = {
  France: "FR",
  Germany: "DE",
  "United Kingdom": "GB",
  Spain: "ES",
  Italy: "IT",
  Netherlands: "NL",
  Denmark: "DK",
  Norway: "NO",
  Sweden: "SE",
  Poland: "PL",
  Belgium: "BE",
  Austria: "AT",
  Switzerland: "CH",
  Portugal: "PT",
  "United States": "US-CAL-CISO",
  Canada: "CA-ON",
  Brazil: "BR-CS",
  Australia: "AU-NSW",
  China: "CN",
  India: "IN-NO",
  Japan: "JP-TK",
  "South Korea": "KR",
  Turkey: "TR",
  "South Africa": "ZA",
  Mexico: "MX-CE",
  Argentina: "AR",
  "Saudi Arabia": "SA",
  UAE: "AE",
};
