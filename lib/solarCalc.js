const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_DAY_COUNTS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function sumValues(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function calculateSolarYield({ dailyIrradiance, kWp, tilt, azimuth, PR }) {
  if (!Array.isArray(dailyIrradiance) || dailyIrradiance.length === 0) {
    throw new Error("No climate data available for calculation.");
  }

  const cleanDailyValues = dailyIrradiance.map(Number).filter((value) => Number.isFinite(value));

  if (cleanDailyValues.length === 0) {
    throw new Error("No climate data available for calculation.");
  }

  const tiltFactor = 1 - Math.abs(tilt - 30) * 0.003;
  const azimuthFactor = 1 - Math.abs(azimuth) * 0.002;
  const performanceFactor = tiltFactor * azimuthFactor * PR;
  const annualIrradiance = sumValues(cleanDailyValues);
  const specificYield = annualIrradiance * performanceFactor;
  const annualYield = kWp * specificYield;
  const co2Saved = annualYield * 0.233;

  let startIndex = 0;

  const monthlyData = MONTH_LABELS.map((month, index) => {
    const monthLength = MONTH_DAY_COUNTS[index];
    const monthValues = cleanDailyValues.slice(startIndex, startIndex + monthLength);
    const irradiance = sumValues(monthValues);
    const production = kWp * irradiance * performanceFactor;

    startIndex += monthLength;

    return {
      month,
      irradiance,
      production,
    };
  });

  return {
    annualYield,
    specificYield,
    co2Saved,
    monthlyData,
  };
}
