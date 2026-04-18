import ToolUsageGate from "../../components/ToolUsageGate";
import WindEnergyEstimator from "../../components/tools/WindEnergyEstimator";

export default function WindToolPage() {
  return (
    <ToolUsageGate toolSlug="wind">
      <WindEnergyEstimator />
    </ToolUsageGate>
  );
}
