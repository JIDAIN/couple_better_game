import { LifeAppShell } from "@/components/life/LifeAppShell";
import { LifePlaceholderPage } from "@/components/life/LifePlaceholderPage";

export default function NestPage() {
  return (
    <LifeAppShell>
      <LifePlaceholderPage title="小窝" description="体重、小信箱、家庭药箱和游戏机都住在这里。" icon="🏠" />
    </LifeAppShell>
  );
}
