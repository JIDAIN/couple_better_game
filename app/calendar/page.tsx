import { LifeAppShell } from "@/components/life/LifeAppShell";
import { LifePlaceholderPage } from "@/components/life/LifePlaceholderPage";

export default function CalendarPage() {
  return (
    <LifeAppShell>
      <LifePlaceholderPage title="日历" description="双人心情月历，以及每一天的生活详情。" icon="📅" />
    </LifeAppShell>
  );
}
