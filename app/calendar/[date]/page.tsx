import { LifeAppShell } from "@/components/life/LifeAppShell";
import { LifeCalendarDayPage } from "@/components/life/LifeCalendarDayPage";
import { parseLifeDayDate } from "@/lib/life/life-service";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ date: string }> };

export default async function CalendarDayPage({ params }: PageProps) {
  const { date } = await params;
  const parsed = parseLifeDayDate(date);
  if (!parsed.ok) notFound();
  return (
    <LifeAppShell>
      <LifeCalendarDayPage date={parsed.value} />
    </LifeAppShell>
  );
}
