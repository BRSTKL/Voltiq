import ToolUsageGate from "../../components/ToolUsageGate";
import StorageROICalculator from "../../components/tools/StorageROICalculator";

export default function StorageRoiToolPage() {
  return (
    <ToolUsageGate toolSlug="storage-roi">
      <StorageROICalculator />
    </ToolUsageGate>
  );
}
