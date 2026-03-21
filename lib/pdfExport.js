import { REPORT_TOOL_DEFINITIONS } from "@/lib/reportStorage";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const HEADER_HEIGHT = 28;
const LEFT_MARGIN = 15;
const RIGHT_MARGIN = 15;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
const FOOTER_Y = PAGE_HEIGHT - 10;
const MONTH_LABELS_FALLBACK = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const COLORS = {
  brand: [29, 158, 117],
  brandDark: [15, 110, 86],
  brandLight: [225, 245, 238],
  grayText: [115, 115, 115],
  grayLine: [224, 224, 224],
  grayFill: [248, 248, 248],
  darkText: [28, 36, 34],
  greenBar: [29, 158, 117],
  greenSoft: [93, 202, 165],
  greenLight: [151, 196, 89],
  redSoft: [240, 149, 149],
  mutedBar: [180, 178, 169],
};

function formatDateParts(date = new Date()) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return {
    isoDate: `${year}${month}${day}`,
    displayDate: `${year}-${month}-${day}`,
    timestamp: `${year}-${month}-${day} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "report";
}

function valueToDisplay(value) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  return String(value);
}

function humanizeKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getToolSlug(toolName) {
  if (toolName === "Solar Yield Estimator") {
    return "solar";
  }

  if (toolName === "Battery Storage Sizer") {
    return "battery";
  }

  if (toolName === "Solar ROI Calculator") {
    return "roi";
  }

  if (toolName === "Shading Loss Analyzer") {
    return "shading";
  }

  if (toolName === "Wind Energy Estimator") {
    return "wind";
  }

  if (toolName === "Green Hydrogen Calculator") {
    return "hydrogen";
  }

  if (toolName === "Cable Sizing Calculator") {
    return "cable";
  }

  if (toolName === "Carbon Intensity Tracker") {
    return "carbon";
  }

  if (toolName === "Scope 2 Calculator") {
    return "scope2";
  }

  if (toolName === "Site Assessment") {
    return "site";
  }

  if (toolName === "PV Loss Breakdown") {
    return "pvloss";
  }

  if (toolName === "Inverter Sizing") {
    return "inverter";
  }

  if (toolName === "LCOE Comparator") {
    return "lcoe";
  }

  if (toolName === "Storage ROI Calculator") {
    return "storage-roi";
  }

  return slugify(toolName);
}

function extractMetricValue(metrics, label) {
  return metrics?.find((metric) => metric.label === label)?.value ?? "";
}

function buildNumericFileFragment(value) {
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.]+/g, ""));

  if (!Number.isFinite(parsed)) {
    return slugify(value);
  }

  return String(parsed).replace(/\./g, "-");
}

function buildFilename(toolName, data, reportDate) {
  const prefix = `voltiq-${getToolSlug(toolName)}`;

  if (toolName === "Solar Yield Estimator") {
    return `${prefix}-${slugify(data.inputs?.city)}-${reportDate.isoDate}.pdf`;
  }

  if (toolName === "Battery Storage Sizer") {
    const capacity = slugify(extractMetricValue(data.metrics, "Recommended Capacity") || extractMetricValue(data.metrics, "Nominal Capacity"));
    return `${prefix}-${capacity}kwh-${reportDate.isoDate}.pdf`;
  }

  if (toolName === "Solar ROI Calculator") {
    const size = slugify((data.inputs?.systemSize || "").replace(/\s*kWp/i, ""));
    return `${prefix}-${size}kwp-${reportDate.isoDate}.pdf`;
  }

  if (toolName === "Shading Loss Analyzer") {
    const loss = slugify((extractMetricValue(data.metrics, "Annual Shading Loss") || "").replace(/%/g, ""));
    return `${prefix}-${loss}pct-${reportDate.isoDate}.pdf`;
  }

  if (toolName === "Wind Energy Estimator") {
    return `${prefix}-${slugify(data.inputs?.city)}-${reportDate.isoDate}.pdf`;
  }

  if (toolName === "Green Hydrogen Calculator") {
    const size = buildNumericFileFragment(data.inputs?.["Rated power"] || "");
    return `${prefix}-${size}mw-${reportDate.isoDate}.pdf`;
  }

  if (toolName === "Cable Sizing Calculator") {
    const size = buildNumericFileFragment(extractMetricValue(data.metrics, "Recommended size") || "");
    const voltage = buildNumericFileFragment(data.inputs?.Voltage || "");
    return `${prefix}-${size}mm2-${voltage}v-${reportDate.isoDate}.pdf`;
  }

  if (toolName === "Carbon Intensity Tracker") {
    return `${prefix}-${slugify(data.inputs?.Country)}-${reportDate.isoDate}.pdf`;
  }

  if (toolName === "Scope 2 Calculator") {
    const company = slugify(data.inputs?.Company || data.headerSubtitle || "company");
    const year = slugify(data.inputs?.["Reporting year"] || "report");
    return `${prefix}-${company}-${year}-${reportDate.isoDate}.pdf`;
  }

  if (toolName === "Site Assessment") {
    const location = slugify(data.inputs?.Location || "site");
    const systemSize = buildNumericFileFragment(data.inputs?.["System size"] || "");
    return `${prefix}-${location}-${systemSize}mw-${reportDate.isoDate}.pdf`;
  }

  if (toolName === "PV Loss Breakdown") {
    const location = slugify(data.inputs?.Location || "site");
    const systemSize = buildNumericFileFragment(data.inputs?.["System size"] || "");
    return `${prefix}-${location}-${systemSize}kwp-${reportDate.isoDate}.pdf`;
  }

  if (toolName === "Inverter Sizing") {
    const systemSize = buildNumericFileFragment(data.inputs?.["System size"] || "");
    return `${prefix}-${systemSize}kwp-${reportDate.isoDate}.pdf`;
  }

  if (toolName === "LCOE Comparator") {
    return `${prefix}-${slugify(data.inputs?.Scenario || "custom")}-${reportDate.isoDate}.pdf`;
  }

  if (toolName === "Storage ROI Calculator") {
    const batteryCapacity = buildNumericFileFragment(data.inputs?.["Battery capacity"] || "");
    return `${prefix}-${batteryCapacity}kwh-${reportDate.isoDate}.pdf`;
  }

  return `${prefix}-${reportDate.isoDate}.pdf`;
}

function addHeader(doc, toolName, reportDate, data) {
  doc.setFillColor(...COLORS.brandDark);
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("VOLTIQ", LEFT_MARGIN, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Energy Engineering Tools", LEFT_MARGIN, 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(toolName, PAGE_WIDTH - LEFT_MARGIN, data?.headerSubtitle ? 15.5 : 18, { align: "right" });

  if (data?.headerSubtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(String(data.headerSubtitle), PAGE_WIDTH - LEFT_MARGIN, 20.5, { align: "right" });
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(reportDate.displayDate, PAGE_WIDTH - LEFT_MARGIN, 24, { align: "right" });
}

function addFooter(doc, pageNumber, pageCount) {
  doc.setDrawColor(...COLORS.grayLine);
  doc.setLineWidth(0.2);
  doc.line(LEFT_MARGIN, PAGE_HEIGHT - 14, PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.grayText);
  doc.text("Voltiq — voltiq.app", LEFT_MARGIN, FOOTER_Y);
  doc.text("Confidential — For estimation purposes only", PAGE_WIDTH / 2, FOOTER_Y, {
    align: "center",
  });
  doc.text(`Page ${pageNumber} of ${pageCount}`, PAGE_WIDTH - RIGHT_MARGIN, FOOTER_Y, {
    align: "right",
  });
}

function addSectionTitle(doc, title, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.brand);
  doc.text(title, LEFT_MARGIN, y);

  doc.setDrawColor(...COLORS.brand);
  doc.setLineWidth(0.5);
  doc.line(LEFT_MARGIN, y + 2.2, PAGE_WIDTH - RIGHT_MARGIN, y + 2.2);
}

function addNewPage(doc) {
  doc.addPage();
  return HEADER_HEIGHT + 12;
}

function ensureSpace(doc, y, requiredHeight) {
  if (y + requiredHeight > PAGE_HEIGHT - 20) {
    return addNewPage(doc);
  }

  return y;
}

function drawInfoBox(doc, reportDate) {
  const boxY = HEADER_HEIGHT + 8;
  const boxHeight = 22;

  doc.setFillColor(...COLORS.grayFill);
  doc.setDrawColor(...COLORS.grayLine);
  doc.setLineWidth(0.2);
  doc.roundedRect(LEFT_MARGIN, boxY, CONTENT_WIDTH, boxHeight, 2, 2, "FD");

  doc.setTextColor(...COLORS.grayText);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Report generated by Voltiq — voltiq.app", LEFT_MARGIN + 4, boxY + 5);
  doc.text(`Generated: ${reportDate.timestamp}`, LEFT_MARGIN + 4, boxY + 9.5);

  const disclaimer =
    "Results are estimates based on typical conditions. Not suitable for bankable financial analysis without professional verification.";
  const lines = doc.splitTextToSize(disclaimer, CONTENT_WIDTH - 8);
  doc.text(lines, LEFT_MARGIN + 4, boxY + 14.5);

  return boxY + boxHeight + 8;
}

function drawMetricGrid(doc, metrics, y, autoTable) {
  const safeMetrics = Array.isArray(metrics) ? metrics : [];
  const rows = [];

  for (let index = 0; index < safeMetrics.length; index += 2) {
    const left = safeMetrics[index];
    const right = safeMetrics[index + 1];

    rows.push([
      left?.label ?? "",
      valueToDisplay(left?.value),
      valueToDisplay(left?.unit),
      right?.label ?? "",
      valueToDisplay(right?.value),
      valueToDisplay(right?.unit),
    ]);
  }

  autoTable(doc, {
    startY: y,
    body: rows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3,
      textColor: COLORS.darkText,
      lineColor: COLORS.grayLine,
      lineWidth: 0.15,
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 28, textColor: COLORS.grayText },
      1: { cellWidth: 24, fontStyle: "bold" },
      2: { cellWidth: 18, textColor: COLORS.grayText },
      3: { cellWidth: 28, textColor: COLORS.grayText },
      4: { cellWidth: 24, fontStyle: "bold" },
      5: { cellWidth: 18, textColor: COLORS.grayText },
    },
    margin: {
      left: LEFT_MARGIN,
      right: RIGHT_MARGIN,
    },
  });

  return doc.lastAutoTable.finalY + 8;
}

function formatAxisValue(value) {
  const absValue = Math.abs(value);

  if (absValue >= 1000) {
    return `${Math.round(value).toLocaleString("en-US")}`;
  }

  if (absValue >= 100) {
    return value.toFixed(0);
  }

  if (absValue >= 10) {
    return value.toFixed(1);
  }

  return value.toFixed(1);
}

function drawBarChart(doc, labels, values, y, options = {}) {
  const normalizedValues = Array.isArray(values) ? values.map((value) => Number(value) || 0) : [];

  if (!normalizedValues.length) {
    return y;
  }

  const chartX = LEFT_MARGIN + 8;
  const chartY = y + 6;
  const chartWidth = 170;
  const chartHeight = 55;
  const labelY = chartY + chartHeight + 6;
  const axisLeft = chartX + 10;
  const axisBottom = chartY + chartHeight - 6;
  const plotWidth = chartWidth - 16;
  const plotHeight = chartHeight - 10;
  const maxValue = Math.max(...normalizedValues, 0);
  const minValue = Math.min(...normalizedValues, 0);
  const range = maxValue - minValue || 1;
  const baselineY = axisBottom - ((0 - minValue) / range) * plotHeight;
  const stepWidth = plotWidth / normalizedValues.length;
  const barWidth = Math.max(2, stepWidth * 0.62);
  const tickValues = [minValue, minValue + range / 2, maxValue];
  const fontSize = labels.length > 18 ? 5.5 : 7;

  doc.setDrawColor(...COLORS.grayLine);
  doc.setLineWidth(0.2);

  tickValues.forEach((tick) => {
    const tickY = axisBottom - ((tick - minValue) / range) * plotHeight;
    doc.line(axisLeft, tickY, axisLeft + plotWidth, tickY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.grayText);
    doc.text(formatAxisValue(tick), axisLeft - 2, tickY + 1, { align: "right" });
  });

  doc.setDrawColor(...COLORS.darkText);
  doc.line(axisLeft, chartY, axisLeft, axisBottom);
  doc.line(axisLeft, baselineY, axisLeft + plotWidth, baselineY);

  normalizedValues.forEach((value, index) => {
    const x = axisLeft + stepWidth * index + (stepWidth - barWidth) / 2;
    const valueTop = axisBottom - ((value - minValue) / range) * plotHeight;
    const top = value >= 0 ? valueTop : baselineY;
    const height = Math.max(0.8, Math.abs(baselineY - valueTop));
    const color =
      typeof options.getBarColor === "function"
        ? options.getBarColor(value, index)
        : COLORS.greenBar;

    doc.setFillColor(...color);
    doc.rect(x, top, barWidth, height, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...COLORS.grayText);
    doc.text(String(labels[index] ?? ""), x + barWidth / 2, labelY, { align: "center" });
  });

  return labelY + 6;
}

function drawAnalysisBox(doc, text, y) {
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH - 10);
  const boxHeight = Math.max(18, lines.length * 5 + 8);
  const adjustedY = ensureSpace(doc, y, boxHeight + 8);

  doc.setFillColor(...COLORS.brandLight);
  doc.setDrawColor(...COLORS.brand);
  doc.setLineWidth(0.2);
  doc.roundedRect(LEFT_MARGIN, adjustedY, CONTENT_WIDTH, boxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.darkText);
  doc.text(lines, LEFT_MARGIN + 5, adjustedY + 6);

  return adjustedY + boxHeight + 8;
}

function drawParametersTable(doc, inputs, y, autoTable) {
  const rows = Object.entries(inputs ?? {}).map(([key, value]) => [
    humanizeKey(key),
    valueToDisplay(value),
  ]);

  autoTable(doc, {
    startY: y,
    body: rows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 9,
      cellPadding: 3,
      textColor: COLORS.darkText,
      lineColor: COLORS.grayLine,
      lineWidth: 0.15,
    },
    alternateRowStyles: {
      fillColor: COLORS.grayFill,
    },
    columnStyles: {
      0: { cellWidth: 60, fontStyle: "bold", textColor: COLORS.grayText },
      1: { cellWidth: 120 },
    },
    margin: {
      left: LEFT_MARGIN,
      right: RIGHT_MARGIN,
    },
  });

  return doc.lastAutoTable.finalY + 6;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function hexToRgb(value) {
  const normalized = String(value ?? "").trim().replace(/^#/, "");
  const hex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => character + character)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return COLORS.mutedBar;
  }

  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function rgbToCss(color, alpha = 1) {
  const [red, green, blue] = color;

  if (alpha >= 1) {
    return `rgb(${red}, ${green}, ${blue})`;
  }

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function createCanvas(width, height) {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  return canvas;
}

function traceRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function fillRoundedRect(context, x, y, width, height, radius, fillStyle) {
  traceRoundedRect(context, x, y, width, height, radius);
  context.fillStyle = fillStyle;
  context.fill();
}

function strokeRoundedRect(context, x, y, width, height, radius, strokeStyle, lineWidth = 1) {
  traceRoundedRect(context, x, y, width, height, radius);
  context.strokeStyle = strokeStyle;
  context.lineWidth = lineWidth;
  context.stroke();
}

function renderEnergyMixPanel(energyMix) {
  const safeMix = Array.isArray(energyMix)
    ? energyMix.filter((entry) => Number(entry?.share) > 0)
    : [];

  if (!safeMix.length) {
    return null;
  }

  const columns = 2;
  const rows = Math.ceil(safeMix.length / columns);
  const width = 720;
  const height = 212 + rows * 48;
  const canvas = createCanvas(width, height);

  if (!canvas) {
    return null;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  fillRoundedRect(context, 0, 0, width, height, 18, rgbToCss(COLORS.grayFill));
  strokeRoundedRect(context, 0.5, 0.5, width - 1, height - 1, 18, rgbToCss(COLORS.grayLine));

  const centerX = width / 2;
  const centerY = 108;
  const outerRadius = 78;
  const innerRadius = 45;
  const totalShare = safeMix.reduce((sum, entry) => sum + Number(entry.share || 0), 0) || 1;
  let startAngle = -Math.PI / 2;

  safeMix.forEach((entry) => {
    const endAngle = startAngle + (Number(entry.share || 0) / totalShare) * Math.PI * 2;
    const fillColor = rgbToCss(hexToRgb(entry.color));

    context.beginPath();
    context.arc(centerX, centerY, outerRadius, startAngle, endAngle);
    context.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
    context.closePath();
    context.fillStyle = fillColor;
    context.fill();
    context.strokeStyle = "#FFFFFF";
    context.lineWidth = 3;
    context.stroke();

    startAngle = endAngle;
  });

  context.beginPath();
  context.arc(centerX, centerY, innerRadius - 1, 0, Math.PI * 2);
  context.fillStyle = "#FFFFFF";
  context.fill();

  const paddingX = 28;
  const gapX = 14;
  const cardWidth = (width - paddingX * 2 - gapX) / 2;
  const cardHeight = 38;
  const legendStartY = 198;

  context.font = '600 16px "Helvetica Neue", Arial, sans-serif';

  safeMix.forEach((entry, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = paddingX + column * (cardWidth + gapX);
    const y = legendStartY + row * (cardHeight + 10);

    fillRoundedRect(context, x, y, cardWidth, cardHeight, 10, "#FFFFFF");
    strokeRoundedRect(context, x + 0.5, y + 0.5, cardWidth - 1, cardHeight - 1, 10, rgbToCss(COLORS.grayLine));

    context.beginPath();
    context.arc(x + 18, y + cardHeight / 2, 6, 0, Math.PI * 2);
    context.fillStyle = rgbToCss(hexToRgb(entry.color));
    context.fill();

    context.fillStyle = rgbToCss(COLORS.darkText);
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(String(entry.label ?? ""), x + 32, y + cardHeight / 2);

    context.textAlign = "right";
    context.fillStyle = rgbToCss(COLORS.brandDark);
    context.fillText(`${Number(entry.share || 0)}%`, x + cardWidth - 14, y + cardHeight / 2);
  });

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width,
    height,
  };
}

function renderGlobalBenchmarkPanel(globalBenchmark) {
  const items = Array.isArray(globalBenchmark?.items) ? globalBenchmark.items : [];
  const current = globalBenchmark?.current;

  if (!items.length || !current || !Number.isFinite(current.value)) {
    return null;
  }

  const minValue = Number.isFinite(globalBenchmark.min) ? globalBenchmark.min : 0;
  const maxValue = Number.isFinite(globalBenchmark.max) ? globalBenchmark.max : 800;
  const width = 720;
  const height = 220;
  const canvas = createCanvas(width, height);

  if (!canvas) {
    return null;
  }

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  fillRoundedRect(context, 0, 0, width, height, 18, rgbToCss(COLORS.grayFill));
  strokeRoundedRect(context, 0.5, 0.5, width - 1, height - 1, 18, rgbToCss(COLORS.grayLine));

  const lineStartX = 54;
  const lineEndX = width - 54;
  const lineY = 108;
  const trackWidth = lineEndX - lineStartX;

  context.strokeStyle = rgbToCss(COLORS.grayLine);
  context.lineWidth = 8;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(lineStartX, lineY);
  context.lineTo(lineEndX, lineY);
  context.stroke();

  function valueToX(value) {
    const normalized = (clampNumber(value, minValue, maxValue) - minValue) / (maxValue - minValue || 1);
    return lineStartX + normalized * trackWidth;
  }

  context.font = '600 13px "Helvetica Neue", Arial, sans-serif';
  context.textAlign = "center";

  items.forEach((item) => {
    const x = valueToX(Number(item.value || 0));
    const above = item.level === 0;
    const labelY = above ? lineY - 22 : lineY + 28;

    context.beginPath();
    context.arc(x, lineY, 7, 0, Math.PI * 2);
    context.fillStyle = rgbToCss(hexToRgb(item.color));
    context.fill();

    context.fillStyle = rgbToCss(hexToRgb(item.color));
    context.textBaseline = above ? "bottom" : "top";
    context.fillText(`${item.label} ${Math.round(Number(item.value || 0))}g`, x, labelY);
  });

  const currentX = valueToX(Number(current.value));
  context.beginPath();
  context.arc(currentX, lineY, 10, 0, Math.PI * 2);
  context.fillStyle = "#FFFFFF";
  context.fill();
  context.beginPath();
  context.arc(currentX, lineY, 8, 0, Math.PI * 2);
  context.fillStyle = rgbToCss(hexToRgb(current.color));
  context.fill();
  context.strokeStyle = rgbToCss(COLORS.grayFill);
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = rgbToCss(hexToRgb(current.color));
  context.textBaseline = "bottom";
  context.fillText(`${current.label} ${Math.round(Number(current.value))}g`, currentX, lineY - 32);

  context.font = '600 12px "Helvetica Neue", Arial, sans-serif';
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = rgbToCss(COLORS.darkText);
  context.fillText(`${minValue} gCO2/kWh`, lineStartX - 10, 174);
  context.textAlign = "right";
  context.fillText(`${maxValue} gCO2/kWh`, lineEndX + 10, 174);

  return {
    dataUrl: canvas.toDataURL("image/png"),
    width,
    height,
  };
}

function drawPanelImage(doc, panel, y) {
  if (!panel?.dataUrl || !panel.width || !panel.height) {
    return y;
  }

  const panelHeight = (panel.height / panel.width) * CONTENT_WIDTH;
  doc.addImage(panel.dataUrl, "PNG", LEFT_MARGIN, y, CONTENT_WIDTH, panelHeight);
  return y + panelHeight + 8;
}

export async function exportToPDF(toolName, data) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const reportDate = formatDateParts();
  const filename = buildFilename(toolName, data, reportDate);
  let y = drawInfoBox(doc, reportDate);

  addSectionTitle(doc, "KEY METRICS", y);
  y += 5;
  y = drawMetricGrid(doc, data.metrics, y, autoTable);

  if (toolName === "Carbon Intensity Tracker" && Array.isArray(data.energyMix) && data.energyMix.length) {
    const energyMixPanel = renderEnergyMixPanel(data.energyMix);

    if (energyMixPanel) {
      const panelHeight = (energyMixPanel.height / energyMixPanel.width) * CONTENT_WIDTH;
      y = ensureSpace(doc, y, panelHeight + 10);
      addSectionTitle(doc, "ENERGY MIX", y);
      y += 4;
      y = drawPanelImage(doc, energyMixPanel, y);
    }
  }

  if (toolName === "Carbon Intensity Tracker" && data.globalBenchmark) {
    const benchmarkPanel = renderGlobalBenchmarkPanel(data.globalBenchmark);

    if (benchmarkPanel) {
      const panelHeight = (benchmarkPanel.height / benchmarkPanel.width) * CONTENT_WIDTH;
      y = ensureSpace(doc, y, panelHeight + 10);
      addSectionTitle(doc, "GLOBAL BENCHMARK", y);
      y += 4;
      y = drawPanelImage(doc, benchmarkPanel, y);
    }
  }

  if (Array.isArray(data.monthlyData) && data.monthlyData.length) {
    y = ensureSpace(doc, y, 78);
    addSectionTitle(
      doc,
      toolName === "Solar ROI Calculator"
        ? "PROFITABILITY PROFILE"
        : toolName === "Green Hydrogen Calculator"
          ? "SENSITIVITY PROFILE"
          : toolName === "Carbon Intensity Tracker"
            ? "COUNTRY INTENSITY RANKING"
            : toolName === "Scope 2 Calculator"
              ? "SCOPE 2 REDUCTION PROFILE"
            : toolName === "Site Assessment"
              ? "SITE SCORE BREAKDOWN"
            : toolName === "PV Loss Breakdown"
              ? "LOSS CHAIN PROFILE"
            : toolName === "LCOE Comparator"
              ? "LCOE COMPARISON"
            : toolName === "Storage ROI Calculator"
              ? "CUMULATIVE CASHFLOW PROFILE"
          : "MONTHLY PRODUCTION PROFILE",
      y
    );
    y += 4;
    y = drawBarChart(doc, data.monthlyLabels ?? MONTH_LABELS_FALLBACK, data.monthlyData, y, {
      getBarColor(value, index) {
        if (toolName === "Solar ROI Calculator") {
          return value >= 0 ? COLORS.greenLight : COLORS.redSoft;
        }

        if (toolName === "Shading Loss Analyzer") {
          return COLORS.redSoft;
        }

        if (toolName === "Wind Energy Estimator") {
          return COLORS.greenBar;
        }

        if (toolName === "Green Hydrogen Calculator") {
          return COLORS.greenSoft;
        }

        if (toolName === "Carbon Intensity Tracker") {
          return COLORS.greenSoft;
        }

        if (toolName === "Scope 2 Calculator") {
          return [
            [136, 135, 128],
            [29, 158, 117],
            [29, 158, 117],
            [29, 158, 117],
            [15, 110, 86],
          ][index] || COLORS.greenBar;
        }

        if (toolName === "Site Assessment") {
          return [
            [239, 159, 39],
            [55, 138, 221],
            [29, 158, 117],
            [127, 119, 221],
          ][index] || COLORS.greenBar;
        }

        if (toolName === "PV Loss Breakdown") {
          return [
            [93, 202, 165],
            [239, 159, 39],
            [239, 159, 39],
            [239, 159, 39],
            [239, 159, 39],
            [240, 149, 149],
            [240, 149, 149],
            [226, 75, 74],
            [163, 45, 45],
            [163, 45, 45],
            [163, 45, 45],
            [136, 135, 128],
            [29, 158, 117],
          ][index] || COLORS.greenBar;
        }

        if (toolName === "Storage ROI Calculator") {
          return value >= 0 ? COLORS.greenLight : COLORS.redSoft;
        }

        return COLORS.greenBar;
      },
    });
  }

  if (data.aiAnalysis) {
    y = ensureSpace(doc, y, 32);
    addSectionTitle(doc, "AI ANALYSIS", y);
    y += 5;
    y = drawAnalysisBox(doc, data.aiAnalysis, y);
  }

  y = ensureSpace(doc, y, 28);
  addSectionTitle(doc, "INPUT PARAMETERS", y);
  y += 5;
  drawParametersTable(doc, data.inputs, y, autoTable);

  const totalPages = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    addHeader(doc, toolName, reportDate, data);
    addFooter(doc, pageNumber, totalPages);
  }

  doc.save(filename);
}

function getCurrencySymbol(currency) {
  if (currency === "EUR") {
    return "EUR ";
  }

  if (currency === "GBP") {
    return "GBP ";
  }

  if (currency === "TRY") {
    return "TRY ";
  }

  return "$";
}

function applyCurrencyDisplay(value, currency) {
  if (value === null || value === undefined) {
    return value;
  }

  const currencySymbol = getCurrencySymbol(currency);

  if (typeof value === "string") {
    return value.replace(/\$/g, currencySymbol);
  }

  return value;
}

function getReportCopy(language = "en") {
  if (language === "tr") {
    return {
      reportTitle: "Solar Project Feasibility Report",
      reportBadge: "FEASIBILITY REPORT",
      tableOfContents: "Table of Contents",
      executiveSummary: "Executive Summary",
      keyMetrics: "Key Metrics",
      chart: "Chart",
      analysis: "Tool Analysis",
      inputParameters: "Input Parameters",
      appendix: "Appendix",
      methodology: "Methodology Notes",
      disclaimer: "Signature & Disclaimer",
      generatedBy: "Prepared by Voltiq Engineering Tools",
      preparedFor: "Prepared for",
      preparedBy: "Prepared by",
      location: "Location",
      reportDate: "Date",
      noSummary: "Executive summary was not included in this report.",
      noAnalysis: "AI analysis was not available for this tool at report generation time.",
      noChart: "No chart data was stored for this section.",
      noInputs: "No input parameters were stored for this section.",
      summaryPromptLanguage: "Turkish",
      methodologyText:
        "This report combines previously generated Voltiq tool outputs. It does not rerun engineering calculations. Results reflect the latest localStorage snapshots available in the browser at the time of report generation.",
      sourcesText:
        "Primary data sources may include Open-Meteo climate data, Electricity Maps grid carbon data, NREL-style cost benchmarks, and IEC/GHG Protocol calculation frameworks depending on the selected tools.",
      signatureText:
        "Report generated by Voltiq - voltiq.app\nCalculations are based on previously generated tool outputs and supporting benchmark datasets.\nThis report is for estimation purposes only and does not constitute bankable financial analysis.",
    };
  }

  return {
    reportTitle: "Solar Project Feasibility Report",
    reportBadge: "FEASIBILITY REPORT",
    tableOfContents: "Table of Contents",
    executiveSummary: "Executive Summary",
    keyMetrics: "Key Metrics",
    chart: "Chart",
    analysis: "Tool Analysis",
    inputParameters: "Input Parameters",
    appendix: "Appendix",
    methodology: "Methodology Notes",
    disclaimer: "Signature & Disclaimer",
    generatedBy: "Prepared by Voltiq Engineering Tools",
    preparedFor: "Prepared for",
    preparedBy: "Prepared by",
    location: "Location",
    reportDate: "Date",
    noSummary: "Executive summary was not included in this report.",
    noAnalysis: "AI analysis was not available for this tool at report generation time.",
    noChart: "No chart data was stored for this section.",
    noInputs: "No input parameters were stored for this section.",
    summaryPromptLanguage: "English",
    methodologyText:
      "This report combines previously generated Voltiq tool outputs. It does not rerun engineering calculations. Results reflect the latest localStorage snapshots available in the browser at the time of report generation.",
    sourcesText:
      "Primary data sources may include Open-Meteo climate data, Electricity Maps grid carbon data, NREL-style cost benchmarks, and IEC/GHG Protocol calculation frameworks depending on the selected tools.",
    signatureText:
      "Report generated by Voltiq - voltiq.app\nCalculations are based on previously generated tool outputs and supporting benchmark datasets.\nThis report is for estimation purposes only and does not constitute bankable financial analysis.",
  };
}

function buildProjectReportFilename(projectData, reportDate) {
  const projectName = slugify(projectData?.projectName || "project");
  return `voltiq-report-${projectName}-${reportDate.isoDate}.pdf`;
}

function drawReportPageChrome(doc, projectData, reportDate, pageNumber, pageCount) {
  doc.setFillColor(...COLORS.brandDark);
  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("VOLTIQ", LEFT_MARGIN, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(projectData.projectName || "Project report", LEFT_MARGIN, 24);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(projectData.projectLocation || "--", PAGE_WIDTH - RIGHT_MARGIN, 17, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(reportDate.displayDate, PAGE_WIDTH - RIGHT_MARGIN, 23, { align: "right" });

  addFooter(doc, pageNumber, pageCount);
}

function drawReportCover(doc, projectData, copy) {
  doc.setFillColor(...COLORS.brandDark);
  doc.rect(0, 0, PAGE_WIDTH, 72, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text(projectData.projectName || "Project report", PAGE_WIDTH / 2, 32, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.text(projectData.projectLocation || "--", PAGE_WIDTH / 2, 43, { align: "center" });

  doc.setFillColor(...COLORS.brandLight);
  doc.roundedRect(PAGE_WIDTH / 2 - 28, 53, 56, 10, 4, 4, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.brandDark);
  doc.text(copy.reportBadge, PAGE_WIDTH / 2, 59.5, { align: "center" });

  doc.setTextColor(...COLORS.darkText);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(copy.reportTitle, LEFT_MARGIN, 102);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${copy.preparedFor}: ${projectData.clientName || "--"}`, LEFT_MARGIN, 120);
  doc.text(`${copy.preparedBy}: ${projectData.preparedBy || "Voltiq"}`, LEFT_MARGIN, 129);
  doc.text(`${copy.reportDate}: ${projectData.reportDate || "--"}`, LEFT_MARGIN, 138);
  doc.text(`${copy.location}: ${projectData.projectLocation || "--"}`, LEFT_MARGIN, 147);

  doc.setFillColor(...COLORS.grayFill);
  doc.roundedRect(LEFT_MARGIN, 165, CONTENT_WIDTH, 72, 4, 4, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.grayText);
  const introLines = doc.splitTextToSize(
    "This report compiles the latest Voltiq tool outputs selected by the project team. It is intended to provide a structured engineering snapshot spanning site suitability, yield, design, storage, finance, and sustainability performance.",
    CONTENT_WIDTH - 12
  );
  doc.text(introLines, LEFT_MARGIN + 6, 177);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.brandDark);
  doc.text("voltiq.app", PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 18, { align: "right" });
}

function drawPageHeading(doc, title, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.darkText);
  doc.text(title, LEFT_MARGIN, y);
  doc.setDrawColor(...COLORS.grayLine);
  doc.setLineWidth(0.3);
  doc.line(LEFT_MARGIN, y + 3, PAGE_WIDTH - RIGHT_MARGIN, y + 3);
  return y + 10;
}

function drawSectionBanner(doc, title, y) {
  doc.setFillColor(...COLORS.brand);
  doc.roundedRect(LEFT_MARGIN, y, CONTENT_WIDTH, 14, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(title, LEFT_MARGIN + 5, y + 8.8);
  return y + 18;
}

function drawWrappedParagraph(doc, text, y, width = CONTENT_WIDTH) {
  const lines = doc.splitTextToSize(String(text || ""), width);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.darkText);
  doc.text(lines, LEFT_MARGIN, y);
  return y + lines.length * 5 + 2;
}

function pickExecutiveMetrics(selectedResults, currency) {
  const metrics = [];

  if (selectedResults.solar?.results?.annualYield !== undefined) {
    metrics.push({
      label: "Annual Yield",
      value: `${formatAxisValue(selectedResults.solar.results.annualYield)} kWh/yr`,
    });
  }

  if (selectedResults.roi?.results?.paybackYear !== undefined) {
    metrics.push({
      label: "Payback",
      value: selectedResults.roi.results.paybackYear
        ? `${selectedResults.roi.results.paybackYear} years`
        : "Not reached",
    });
  }

  if (selectedResults.pvloss?.results?.prPercent !== undefined) {
    metrics.push({
      label: "Performance Ratio",
      value: `${formatAxisValue(selectedResults.pvloss.results.prPercent)}%`,
    });
  }

  if (selectedResults.solar?.results?.co2Saved !== undefined) {
    metrics.push({
      label: "CO2 Avoided",
      value: `${formatAxisValue(selectedResults.solar.results.co2Saved)} kg/yr`,
    });
  }

  if (metrics.length < 4 && selectedResults.site?.results?.totalScore !== undefined) {
    metrics.push({
      label: "Site Score",
      value: `${selectedResults.site.results.totalScore}/100`,
    });
  }

  if (metrics.length < 4 && selectedResults.scope2?.results?.marketBased !== undefined) {
    metrics.push({
      label: "Scope 2",
      value: `${formatAxisValue(selectedResults.scope2.results.marketBased)} tCO2e`,
    });
  }

  return metrics.slice(0, 4).map((entry) => ({
    ...entry,
    value: applyCurrencyDisplay(entry.value, currency),
  }));
}

function drawExecutiveSummaryPage(doc, summary, selectedResults, options, copy) {
  let y = HEADER_HEIGHT + 12;
  y = drawPageHeading(doc, copy.executiveSummary, y);

  const sidebarX = PAGE_WIDTH - RIGHT_MARGIN - 54;
  const summaryWidth = CONTENT_WIDTH - 62;
  const summaryLines = doc.splitTextToSize(summary || copy.noSummary, summaryWidth);
  const summaryHeight = Math.max(48, summaryLines.length * 5 + 10);

  doc.setFillColor(...COLORS.grayFill);
  doc.roundedRect(LEFT_MARGIN, y, summaryWidth, summaryHeight, 3, 3, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.darkText);
  doc.text(summaryLines, LEFT_MARGIN + 5, y + 6);

  const keyMetrics = pickExecutiveMetrics(selectedResults, options.currency);
  doc.setFillColor(...COLORS.brandLight);
  doc.roundedRect(sidebarX, y, 54, summaryHeight, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.brandDark);
  doc.text(copy.keyMetrics, sidebarX + 4, y + 7);

  let metricY = y + 15;
  keyMetrics.forEach((metric) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.grayText);
    doc.text(metric.label, sidebarX + 4, metricY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.darkText);
    const valueLines = doc.splitTextToSize(metric.value, 46);
    doc.text(valueLines, sidebarX + 4, metricY + 5);
    metricY += valueLines.length * 4.2 + 10;
  });
}

function mapMetricsForReport(metrics, currency) {
  return (metrics || []).map((metric) => ({
    ...metric,
    value: applyCurrencyDisplay(metric.value, currency),
    unit: applyCurrencyDisplay(metric.unit, currency),
  }));
}

function mapInputsForReport(inputs, currency) {
  return Object.fromEntries(
    Object.entries(inputs || {}).map(([key, value]) => [key, applyCurrencyDisplay(value, currency)])
  );
}

function drawReportSectionPage(doc, title, snapshot, options, copy, autoTable) {
  let y = HEADER_HEIGHT + 12;
  y = drawSectionBanner(doc, title, y);

  addSectionTitle(doc, copy.keyMetrics.toUpperCase(), y);
  y += 5;
  y = drawMetricGrid(doc, mapMetricsForReport(snapshot.metrics, options.currency), y, autoTable);

  if (snapshot.chart?.values?.length) {
    y = ensureSpace(doc, y, 78);
    addSectionTitle(doc, copy.chart.toUpperCase(), y);
    y += 4;
    y = drawBarChart(doc, snapshot.chart.labels || [], snapshot.chart.values || [], y, {
      getBarColor(value) {
        return value >= 0 ? COLORS.greenBar : COLORS.redSoft;
      },
    });
  } else {
    y = ensureSpace(doc, y, 16);
    addSectionTitle(doc, copy.chart.toUpperCase(), y);
    y += 6;
    y = drawWrappedParagraph(doc, copy.noChart, y, CONTENT_WIDTH - 4);
  }

  y = ensureSpace(doc, y, 30);
  addSectionTitle(doc, copy.analysis.toUpperCase(), y);
  y += 5;
  y = drawAnalysisBox(doc, snapshot.aiAnalysis || copy.noAnalysis, y);

  y = ensureSpace(doc, y, 28);
  addSectionTitle(doc, copy.inputParameters.toUpperCase(), y);
  y += 5;
  if (snapshot.inputs && Object.keys(snapshot.inputs).length) {
    drawParametersTable(doc, mapInputsForReport(snapshot.inputs, options.currency), y, autoTable);
  } else {
    drawWrappedParagraph(doc, copy.noInputs, y, CONTENT_WIDTH - 4);
  }
}

function drawTocPage(doc, tocItems, copy) {
  let y = HEADER_HEIGHT + 12;
  y = drawPageHeading(doc, copy.tableOfContents, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.darkText);

  tocItems.forEach((item, index) => {
    const rowY = y + index * 9;
    doc.text(`${index + 1}. ${item.title}`, LEFT_MARGIN, rowY);
    doc.text(String(item.page), PAGE_WIDTH - RIGHT_MARGIN, rowY, { align: "right" });
    doc.setDrawColor(...COLORS.grayLine);
    doc.setLineWidth(0.2);
    doc.line(LEFT_MARGIN, rowY + 2.5, PAGE_WIDTH - RIGHT_MARGIN, rowY + 2.5);
  });
}

function drawAppendixPage(doc, selectedEntries, options, copy, autoTable) {
  let y = HEADER_HEIGHT + 12;
  y = drawPageHeading(doc, copy.appendix, y);

  if (options.includeInputAppendix) {
    selectedEntries.forEach(([definition, snapshot]) => {
      y = ensureSpace(doc, y, 24);
      addSectionTitle(doc, definition.name.toUpperCase(), y);
      y += 5;
      if (snapshot.inputs && Object.keys(snapshot.inputs).length) {
        y = drawParametersTable(doc, mapInputsForReport(snapshot.inputs, options.currency), y, autoTable);
      } else {
        y = drawWrappedParagraph(doc, copy.noInputs, y, CONTENT_WIDTH - 4);
      }
    });
  }

  if (options.includeMethodologyNotes) {
    y = ensureSpace(doc, y, 40);
    addSectionTitle(doc, copy.methodology.toUpperCase(), y);
    y += 5;
    y = drawWrappedParagraph(doc, copy.methodologyText, y, CONTENT_WIDTH - 4);
    y = drawWrappedParagraph(doc, copy.sourcesText, y + 2, CONTENT_WIDTH - 4);
  }
}

function drawSignaturePage(doc, copy) {
  let y = HEADER_HEIGHT + 12;
  y = drawPageHeading(doc, copy.disclaimer, y);

  doc.setFillColor(...COLORS.grayFill);
  doc.roundedRect(LEFT_MARGIN, y, CONTENT_WIDTH, 68, 4, 4, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.darkText);
  const lines = doc.splitTextToSize(copy.signatureText, CONTENT_WIDTH - 10);
  doc.text(lines, LEFT_MARGIN + 5, y + 8);
}

export async function generateFullReport(projectData, selectedResults, executiveSummary, options = {}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const reportDate = formatDateParts(projectData?.reportDate ? new Date(projectData.reportDate) : new Date());
  const copy = getReportCopy(options.language);
  const filename = buildProjectReportFilename(projectData, reportDate);
  const selectedEntries = REPORT_TOOL_DEFINITIONS.filter((definition) => selectedResults?.[definition.id]).map(
    (definition) => [definition, selectedResults[definition.id]]
  );
  const tocItems = [];

  drawReportCover(doc, projectData, copy);
  doc.addPage();

  if (options.includeExecutiveSummary !== false) {
    doc.addPage();
    tocItems.push({
      title: copy.executiveSummary,
      page: doc.getNumberOfPages(),
    });
    drawExecutiveSummaryPage(doc, executiveSummary, selectedResults, options, copy);
  }

  selectedEntries.forEach(([definition, snapshot]) => {
    doc.addPage();
    tocItems.push({
      title: definition.name,
      page: doc.getNumberOfPages(),
    });
    drawReportSectionPage(doc, definition.name, snapshot, options, copy, autoTable);
  });

  if (options.includeInputAppendix || options.includeMethodologyNotes) {
    doc.addPage();
    tocItems.push({
      title: copy.appendix,
      page: doc.getNumberOfPages(),
    });
    drawAppendixPage(doc, selectedEntries, options, copy, autoTable);
  }

  doc.addPage();
  tocItems.push({
    title: copy.disclaimer,
    page: doc.getNumberOfPages(),
  });
  drawSignaturePage(doc, copy);

  doc.setPage(2);
  drawTocPage(doc, tocItems, copy);

  const totalPages = doc.getNumberOfPages();

  for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    drawReportPageChrome(doc, projectData, reportDate, pageNumber, totalPages);
  }

  doc.save(filename);
}
