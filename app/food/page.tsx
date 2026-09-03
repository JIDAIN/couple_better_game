import { LifeAppShell } from "@/components/life/LifeAppShell";
import { LifeFoodPage } from "@/components/life/LifeFoodPage";

function validDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export default async function FoodPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <LifeAppShell>
      <LifeFoodPage initialDate={validDate(params.date)} />
    </LifeAppShell>
  );
}
