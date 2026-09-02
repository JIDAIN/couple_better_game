import { LifeAppShell } from "@/components/life/LifeAppShell";
import { LifePlaceholderPage } from "@/components/life/LifePlaceholderPage";

export default function MePage() {
  return (
    <LifeAppShell>
      <LifePlaceholderPage title="我的" description="同步、数据与其他设置后续会集中在这里。" icon="⚙️" />
    </LifeAppShell>
  );
}
