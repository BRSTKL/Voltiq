export const REPORT_STORAGE_KEYS = {
  site: "voltiq_results_site",
  solar: "voltiq_results_solar",
  wind: "voltiq_results_wind",
  shading: "voltiq_results_shading",
  pvloss: "voltiq_results_pvloss",
  inverter: "voltiq_results_inverter",
  cable: "voltiq_results_cable",
  battery: "voltiq_results_battery",
  storageRoi: "voltiq_results_storage_roi",
  roi: "voltiq_results_roi",
  lcoe: "voltiq_results_lcoe",
  carbon: "voltiq_results_carbon",
  scope2: "voltiq_results_scope2",
  h2: "voltiq_results_h2",
};

export const REPORT_PHASES = [
  { id: "phase1", label: "Phase 1 - Site & Resource" },
  { id: "phase2", label: "Phase 2 - Technical Design" },
  { id: "phase3", label: "Phase 3 - Storage" },
  { id: "phase4", label: "Phase 4 - Financial & ESG" },
];

export const REPORT_TOOL_DEFINITIONS = [
  {
    id: "site",
    name: "Site Assessment",
    href: "/tools/site-assessment",
    phase: "phase1",
    storageKey: REPORT_STORAGE_KEYS.site,
  },
  {
    id: "solar",
    name: "Solar Yield Estimator",
    href: "/tools/solar",
    phase: "phase1",
    storageKey: REPORT_STORAGE_KEYS.solar,
  },
  {
    id: "wind",
    name: "Wind Energy Estimator",
    href: "/tools/wind",
    phase: "phase1",
    storageKey: REPORT_STORAGE_KEYS.wind,
  },
  {
    id: "carbon",
    name: "Carbon Intensity Tracker",
    href: "/tools/carbon",
    phase: "phase1",
    storageKey: REPORT_STORAGE_KEYS.carbon,
  },
  {
    id: "shading",
    name: "Shading Loss Analyzer",
    href: "/tools/shading",
    phase: "phase2",
    storageKey: REPORT_STORAGE_KEYS.shading,
  },
  {
    id: "pvloss",
    name: "PV Loss Breakdown",
    href: "/tools/pv-loss",
    phase: "phase2",
    storageKey: REPORT_STORAGE_KEYS.pvloss,
  },
  {
    id: "inverter",
    name: "Inverter Sizing",
    href: "/tools/inverter-sizing",
    phase: "phase2",
    storageKey: REPORT_STORAGE_KEYS.inverter,
  },
  {
    id: "cable",
    name: "Cable Sizing Calculator",
    href: "/tools/cable",
    phase: "phase2",
    storageKey: REPORT_STORAGE_KEYS.cable,
  },
  {
    id: "battery",
    name: "Battery Storage Sizer",
    href: "/tools/battery",
    phase: "phase3",
    storageKey: REPORT_STORAGE_KEYS.battery,
  },
  {
    id: "storageRoi",
    name: "Storage ROI Calculator",
    href: "/tools/storage-roi",
    phase: "phase3",
    storageKey: REPORT_STORAGE_KEYS.storageRoi,
  },
  {
    id: "roi",
    name: "Solar ROI Calculator",
    href: "/tools/roi",
    phase: "phase4",
    storageKey: REPORT_STORAGE_KEYS.roi,
  },
  {
    id: "lcoe",
    name: "LCOE Comparator",
    href: "/tools/lcoe",
    phase: "phase4",
    storageKey: REPORT_STORAGE_KEYS.lcoe,
  },
  {
    id: "scope2",
    name: "Scope 2 Calculator",
    href: "/tools/scope2",
    phase: "phase4",
    storageKey: REPORT_STORAGE_KEYS.scope2,
  },
  {
    id: "h2",
    name: "Green Hydrogen Calculator",
    href: "/tools/hydrogen",
    phase: "phase4",
    storageKey: REPORT_STORAGE_KEYS.h2,
  },
];

export function createToolReportSnapshot({
  toolName,
  inputs,
  results,
  pdfData,
  aiAnalysis = "",
}) {
  return {
    timestamp: new Date().toISOString(),
    toolName,
    inputs: inputs ?? pdfData?.inputs ?? {},
    results: results ?? {},
    metrics: Array.isArray(pdfData?.metrics) ? pdfData.metrics : [],
    chart:
      Array.isArray(pdfData?.monthlyData) && pdfData.monthlyData.length
        ? {
            labels: Array.isArray(pdfData?.monthlyLabels) ? pdfData.monthlyLabels : [],
            values: pdfData.monthlyData,
          }
        : null,
    aiAnalysis: aiAnalysis || pdfData?.aiAnalysis || "",
    headerSubtitle: pdfData?.headerSubtitle || "",
  };
}

export function saveToolReportResult(storageKey, payload) {
  if (typeof window === "undefined" || !storageKey || !payload) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // Ignore storage errors so tool calculations never fail on quota/private mode.
  }
}

export function loadToolReportResults() {
  if (typeof window === "undefined") {
    return {};
  }

  return REPORT_TOOL_DEFINITIONS.reduce((accumulator, tool) => {
    const raw = window.localStorage.getItem(tool.storageKey);

    if (!raw) {
      return accumulator;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        accumulator[tool.id] = parsed;
      }
    } catch {
      // Ignore corrupted entries and treat them as unavailable.
    }

    return accumulator;
  }, {});
}

export function formatSavedResultTimestamp(timestamp, locale = "en-US") {
  if (!timestamp) {
    return "Not available";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
