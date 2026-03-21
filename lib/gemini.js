export async function callGemini(prompt) {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key is missing.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini request failed.");
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text;
}

export function buildSolarPrompt(params, results) {
  return [
    "Respond in English in 3-4 sentences using a professional engineering tone.",
    "Cover site suitability, performance evaluation, and optimization tips.",
    "End with one concrete optimization recommendation.",
    `City: ${params.city}. System size: ${params.kWp} kWp. Tilt: ${params.tilt} deg. Azimuth: ${params.azimuth} deg. System type: ${params.systemType}. Performance ratio: ${params.PR}.`,
    `Annual yield: ${results.annualYield} kWh/year. Specific yield: ${results.specificYield} kWh/kWp. CO2 saved: ${results.co2Saved} kg/year.`,
  ].join(" ");
}

export function buildBatteryPrompt(params, results) {
  return [
    "Respond in English in 3-4 sentences using a professional engineering tone.",
    "Assess battery technology suitability, sizing rationale, and operational performance.",
    "End with one concrete optimization recommendation.",
    `Daily consumption: ${params.consumption} kWh. Battery type: ${params.battType}. System voltage: ${params.voltage} V. Autonomy: ${params.autonomy} days.`,
    `Nominal capacity: ${results.nominalCapacity} kWh. Battery count: ${results.battCount}. Depth of discharge: ${results.dod}%.`,
  ].join(" ");
}

export function buildWindPrompt(params, results) {
  return [
    "Respond in English in 3-4 sentences using a professional engineering tone.",
    "Assess site wind quality, turbine suitability, and performance expectations.",
    "End with one concrete optimization recommendation.",
    `City: ${params.city}. Turbine model: ${params.turbineModel}. Hub height: ${params.hubHeight} m. Number of turbines: ${params.numTurbines}.`,
    `Annual production: ${results.annualMWh} MWh. Capacity factor: ${results.capacityFactor}%. Average wind speed: ${results.avgWindSpeed} m/s.`,
  ].join(" ");
}
