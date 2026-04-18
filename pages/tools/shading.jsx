import ToolUsageGate from "../../components/ToolUsageGate";
import ShadingLossAnalyzer from "../../components/tools/ShadingLossAnalyzer";

export default function ShadingToolPage() {
  return (
    <ToolUsageGate toolSlug="shading">
      <ShadingLossAnalyzer />
    </ToolUsageGate>
  );
}
