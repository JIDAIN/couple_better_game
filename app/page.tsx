import { LifeAppShell } from "@/components/life/LifeAppShell";
import { TodayLifePage } from "@/components/life/TodayLifePage";

export default function Home() {
  return (
    <LifeAppShell>
      <TodayLifePage />
    </LifeAppShell>
  );
}
