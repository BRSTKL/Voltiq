from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_PATH = OUTPUT_DIR / "voltiq_app_summary.pdf"


TITLE = "Voltiq App Summary"
WHAT_IT_IS = (
    "Voltiq is a Next.js web app for renewable energy engineering workflows. "
    "It guides teams from early site screening through design checks, storage, finance, ESG analysis, and final report assembly."
)
WHO_ITS_FOR = (
    "Primary users are energy engineers and renewable project teams, especially solar developers, technical consultants, "
    "and C&I decarbonization or energy-management teams."
)
FEATURES = [
    "Groups work into four phases: Site & Resource, Technical Design, Storage, and Financial & ESG.",
    "Provides workflow templates for solar development, energy consulting, and C&I optimization.",
    "Includes 15 engineering tools covering site scoring, land-use capacity, solar and wind yield, shading, PV loss, inverter sizing, cable sizing, storage, ROI, LCOE, carbon, Scope 2, and hydrogen.",
    "Pulls location and climate inputs from Nominatim and Open-Meteo, plus carbon signals from Electricity Maps where relevant.",
    "Saves tool snapshots and project metadata in browser localStorage for resume-able workspaces.",
    "Tracks phase progress, recent outputs, and recommended next actions inside the project workspace.",
    "Builds client-ready PDFs from saved outputs and can generate Gemini-based executive summaries."
]
ARCHITECTURE_ROWS = [
    ["UI shell", "Next.js Pages Router in `pages/`, global layout in `_app.jsx`, shared UI/layout components."],
    ["Tool layer", "Route pages mount tool components in `components/tools/`; calculators live in `lib/*Calc.js`."],
    ["Data flow", "Browser UI -> local calc and/or third-party fetch -> normalized snapshot -> localStorage."],
    ["State/reporting", "`reportStorage.js` and `projectWorkspace.js` manage saved outputs and workflow progress; `ReportGenerator.tsx` reads snapshots, optionally calls `lib/gemini.js`, then exports via `lib/pdfExport.js`."],
    ["Backend", "No in-repo API routes or database layer found in repo."],
]
RUN_STEPS = [
    "Open the app folder: `cd voltiq`",
    "Set `NEXT_PUBLIC_GEMINI_API_KEY` in `.env.local` for Gemini features; the variable is present in repo config.",
    "Install dependencies: `npm install`",
    "Start dev mode: `npm run dev`",
    "Open the local URL printed by Next.js in the terminal.",
]


def build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="TitleSmall",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=25,
            textColor=colors.HexColor("#17322A"),
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=13.5,
            textColor=colors.HexColor("#1D6F56"),
            spaceBefore=4,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BodyCompact",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.3,
            leading=12,
            textColor=colors.HexColor("#23322D"),
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="BulletCompact",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=9.0,
            leading=11.5,
            leftIndent=0,
            textColor=colors.HexColor("#23322D"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="Meta",
            parent=styles["BodyText"],
            fontName="Helvetica",
            fontSize=8.3,
            leading=10.2,
            textColor=colors.HexColor("#60706A"),
        )
    )
    return styles


def make_bullets(items, style):
    return ListFlowable(
        [
            ListItem(Paragraph(item, style), leftIndent=0)
            for item in items
        ],
        bulletType="bullet",
        start="circle",
        bulletFontName="Helvetica",
        bulletFontSize=7.8,
        leftIndent=11,
        bulletOffsetY=1,
        spaceBefore=1,
        spaceAfter=3,
    )


def build_pdf():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    styles = build_styles()

    doc = SimpleDocTemplate(
        str(OUTPUT_PATH),
        pagesize=A4,
        leftMargin=14 * mm,
        rightMargin=14 * mm,
        topMargin=11 * mm,
        bottomMargin=11 * mm,
        title=TITLE,
        author="OpenAI Codex",
    )

    story = []

    story.append(Paragraph(TITLE, styles["TitleSmall"]))
    story.append(Paragraph("Repository-based one-page summary", styles["Meta"]))
    story.append(Spacer(1, 5))

    intro_table = Table(
        [
            [
                Paragraph("<b>What it is</b>", styles["Section"]),
                Paragraph(WHAT_IT_IS, styles["BodyCompact"]),
            ],
            [
                Paragraph("<b>Who it's for</b>", styles["Section"]),
                Paragraph(WHO_ITS_FOR, styles["BodyCompact"]),
            ],
        ],
        colWidths=[31 * mm, 137 * mm],
        hAlign="LEFT",
    )
    intro_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EAF5F1")),
                ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#1D6F56")),
                ("BOX", (0, 0), (-1, -1), 0.35, colors.HexColor("#C9DED6")),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D8E7E2")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(intro_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph("What it does", styles["Section"]))
    story.append(make_bullets(FEATURES, styles["BulletCompact"]))
    story.append(Spacer(1, 5))

    story.append(Paragraph("How it works", styles["Section"]))
    arch_table = Table(
        [
            [
                Paragraph(f"<b>{label}</b>", styles["BodyCompact"]),
                Paragraph(value, styles["BodyCompact"]),
            ]
            for label, value in ARCHITECTURE_ROWS
        ],
        colWidths=[31 * mm, 137 * mm],
        hAlign="LEFT",
    )
    arch_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("BOX", (0, 0), (-1, -1), 0.35, colors.HexColor("#D8E7E2")),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#E2EEEA")),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(arch_table)
    story.append(Spacer(1, 6))

    story.append(Paragraph("How to run", styles["Section"]))
    story.append(make_bullets(RUN_STEPS, styles["BulletCompact"]))

    doc.build(story)


if __name__ == "__main__":
    build_pdf()
    print(OUTPUT_PATH)
