export function GameTitle() {
  return (
    <header className="text-center">
      <div className="inline-flex flex-col items-center gap-1">
        <div
          className="rounded-full border border-white/70 bg-white/55 px-3 py-1 text-[10px] font-semibold tracking-widest text-rose-400/90 shadow-sm backdrop-blur-sm"
          aria-hidden
        >
          双人同行 · 养成中
        </div>
        <h1 className="mt-1 max-w-[18ch] text-balance text-xl font-bold leading-snug tracking-tight text-stone-800 sm:text-2xl">
          🐟和🐱变美变瘦大作战
        </h1>
        <p className="mt-2 text-sm font-medium text-stone-500">
          今天也一起变得更闪亮 ✨
        </p>
      </div>
    </header>
  );
}
