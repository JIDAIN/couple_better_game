import { AppPageShell } from "@/components/ui/AppPageShell";

export function LifePlaceholderPage({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <AppPageShell title={title} subtitle={description}>
      <section className="life-surface life-section-card mt-8 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--life-surface-soft)] text-3xl" aria-hidden>{icon}</div>
        <h2 className="mt-3 text-base font-extrabold text-[var(--life-text)]">已经留好入口</h2>
        <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[var(--life-text-body)]">这个页面会在后续阶段按已经定稿的视觉语言接入真实数据，不在这里临时拼一套界面。</p>
      </section>
    </AppPageShell>
  );
}
