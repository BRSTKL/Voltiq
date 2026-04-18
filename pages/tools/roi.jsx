import ToolUsageGate from "../../components/ToolUsageGate";
import ROICalculator from "../../components/tools/ROICalculator";

export default function RoiToolPage() {
  return (
    <ToolUsageGate toolSlug="roi">
      <ROICalculator />
    </ToolUsageGate>
  );
}
