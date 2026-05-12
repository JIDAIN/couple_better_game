export function GameTitle() {
  return (
    <header className="text-center">
      <div className="inline-flex flex-col items-center gap-1">
        <div
          className="ui-button-secondary px-3 py-1 text-[10px] font-semibold tracking-[0.2em] text-rose-400/90"
          aria-hidden
        >
          双人同行 · 养成中
        </div>
        <h1 className="mt-1 max-w-[18ch] text-balance text-[1.45rem] font-extrabold leading-snug tracking-tight text-stone-800 sm:text-[1.65rem]">
          🐟和🐱变美变瘦大作战
        </h1>
        <p className="mt-1.5 text-[13px] font-semibold text-stone-500">
          今天也一起变得更闪亮 ✨
        </p>
      </div>
    </header>
  );
}
