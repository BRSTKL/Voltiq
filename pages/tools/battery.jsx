import ToolUsageGate from "../../components/ToolUsageGate";
import BatteryStorageSizer from "../../components/tools/BatteryStorageSizer";

export default function BatteryToolPage() {
  return (
    <ToolUsageGate toolSlug="battery">
      <BatteryStorageSizer />
    </ToolUsageGate>
  );
}
