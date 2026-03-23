export const PANEL_PRESETS = [
  { id: "standard_400", label: "Standard 400W Mono-Si", watt: 400, width: 1.134, height: 2.094 },
  { id: "standard_450", label: "Standard 450W Mono-Si", watt: 450, width: 1.134, height: 2.094 },
  { id: "bifacial_500", label: "Bifacial 500W TOPCon", watt: 500, width: 1.134, height: 2.279 },
  { id: "bifacial_550", label: "Bifacial 550W TOPCon", watt: 550, width: 1.134, height: 2.384 },
  { id: "heff_600", label: "High-Eff 600W Bifacial", watt: 600, width: 1.303, height: 2.384 },
  { id: "custom", label: "Custom", watt: null, width: null, height: null },
];

export const INVERTER_PRESETS = [
  { id: "inv_50", label: "50 kW String Inverter", kw: 50 },
  { id: "inv_100", label: "100 kW String Inverter", kw: 100 },
  { id: "inv_250", label: "250 kW Central Inverter", kw: 250 },
  { id: "inv_500", label: "500 kW Central Inverter", kw: 500 },
];

const AREA_FACTORS = {
  m2: 1,
  ha: 10000,
  decare: 1000,
  acre: 4046.8564224,
  sqft: 0.09290304,
};

const DEFAULT_GCR = 0.4;
const TARGET_DC_AC_RATIO = 1.25;

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function convertArea(value, from, to) {
  const safeFrom = AREA_FACTORS[from];
  const safeTo = AREA_FACTORS[to];
  const numericValue = toFiniteNumber(value);

  if (!safeFrom || !safeTo) {
    throw new Error("Unsupported area unit.");
  }

  return (numericValue * safeFrom) / safeTo;
}

export function calcLandUseCapacity(params) {
  const landAreaValue = toFiniteNumber(params?.landAreaValue);
  const unusableRatio = Math.max(0, toFiniteNumber(params?.unusableRatio));
  const panelWatt = toFiniteNumber(params?.panelWatt);
  const panelWidth = toFiniteNumber(params?.panelWidth);
  const panelHeight = toFiniteNumber(params?.panelHeight);
  const panelsPerString = Math.max(1, Math.floor(toFiniteNumber(params?.panelsPerString)));
  const inverterKw = toFiniteNumber(params?.inverterKw);
  const landAreaUnit = params?.landAreaUnit || "m2";

  const landAreaM2 = Math.max(0, convertArea(landAreaValue, landAreaUnit, "m2"));
  const unusableAreaM2 = landAreaM2 * (unusableRatio / 100);
  const usableAreaM2 = Math.max(0, landAreaM2 - unusableAreaM2);
  const panelAreaM2 = panelWidth > 0 && panelHeight > 0 ? panelWidth * panelHeight : 0;
  const gcr = DEFAULT_GCR;
  const panelFootprintM2 = usableAreaM2 * gcr;
  const rowSpacingAreaM2 = Math.max(0, usableAreaM2 - panelFootprintM2);
  const totalPanels = panelAreaM2 > 0 ? Math.floor(panelFootprintM2 / panelAreaM2) : 0;
  const installedKwp = (totalPanels * panelWatt) / 1000;
  const installedMwp = installedKwp / 1000;
  const powerDensityKwpPerHa = landAreaM2 > 0 ? installedKwp / (landAreaM2 / 10000) : 0;
  const fullStrings = Math.floor(totalPanels / panelsPerString);
  const lastStringPanels = totalPanels % panelsPerString;
  const totalStrings = totalPanels === 0 ? 0 : Math.ceil(totalPanels / panelsPerString);
  const invertersNeeded =
    installedKwp === 0 || inverterKw <= 0 ? 0 : Math.ceil(installedKwp / (inverterKw * TARGET_DC_AC_RATIO));
  const totalAcKw = invertersNeeded * inverterKw;
  const dcAcRatio = totalAcKw > 0 ? installedKwp / totalAcKw : 0;
  const actualCols = totalPanels > 0 ? Math.ceil(Math.sqrt(totalPanels)) : 0;
  const actualRows = actualCols > 0 ? Math.ceil(totalPanels / actualCols) : 0;
  const displayCols = Math.min(30, actualCols);
  const displayRows = Math.min(20, actualRows);
  const isDiagramTruncated = actualCols > 30 || actualRows > 20;

  return {
    landAreaM2,
    unusableAreaM2,
    usableAreaM2,
    panelAreaM2,
    gcr,
    panelFootprintM2,
    rowSpacingAreaM2,
    totalPanels,
    installedKwp,
    installedMwp,
    powerDensityKwpPerHa,
    fullStrings,
    lastStringPanels,
    totalStrings,
    invertersNeeded,
    totalAcKw,
    dcAcRatio,
    actualCols,
    actualRows,
    displayCols,
    displayRows,
    isDiagramTruncated,
    panelFootprintPct: landAreaM2 > 0 ? (panelFootprintM2 / landAreaM2) * 100 : 0,
    rowSpacingPct: landAreaM2 > 0 ? (rowSpacingAreaM2 / landAreaM2) * 100 : 0,
    unusablePct: landAreaM2 > 0 ? (unusableAreaM2 / landAreaM2) * 100 : 0,
    visiblePanelCount:
      displayCols > 0 && displayRows > 0 ? Math.min(totalPanels, displayCols * displayRows) : 0,
  };
}
