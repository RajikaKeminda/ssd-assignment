/** Soft gradient backdrop for auth screens */
export function AuthScenery() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-1/3 top-0 h-[min(28rem,70vw)] w-[min(28rem,70vw)] rounded-full bg-emerald-400/25 blur-3xl dark:bg-emerald-600/15" />
      <div className="absolute -right-1/4 bottom-0 h-[min(24rem,60vw)] w-[min(24rem,60vw)] rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-600/12" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.7),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(15,23,42,0.5),transparent_55%)]" />
    </div>
  )
}
