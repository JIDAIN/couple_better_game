import { LifeAppShell } from "@/components/life/LifeAppShell";
import { LifePlaceholderPage } from "@/components/life/LifePlaceholderPage";

export default function FoodPage() {
  return (
    <LifeAppShell>
      <LifePlaceholderPage title="饮食" description="三餐与加餐，查看我或 Ta 一天吃了什么。" icon="🍽️" />
    </LifeAppShell>
  );
}
