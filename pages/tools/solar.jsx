import ToolUsageGate from "../../components/ToolUsageGate";
import SolarYieldEstimator from "../../components/tools/SolarYieldEstimator";

export default function SolarToolPage() {
  return (
    <ToolUsageGate toolSlug="solar">
      <SolarYieldEstimator />
    </ToolUsageGate>
  );
}
