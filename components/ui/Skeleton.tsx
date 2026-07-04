/**
 * Primitivas de skeleton pros loading.tsx das rotas.
 * Mantém a silhueta das telas (TopBar + hero + cards) enquanto o server renderiza.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-navy/[0.08] ${className}`} />;
}

export function SkeletonTopBar() {
  return (
    <div className="flex items-center justify-between px-4 pt-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-40" />
      </div>
      <Skeleton className="h-[38px] w-[38px] rounded-xl" />
    </div>
  );
}

export function SkeletonHero() {
  return <Skeleton className="mx-4 mt-3 h-[180px] rounded-hero" />;
}

/** Silhueta genérica de página: TopBar + hero + n cards. */
export function PageSkeleton({ cards = 3, hero = true }: { cards?: number; hero?: boolean }) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-md pb-[92px]">
      <SkeletonTopBar />
      {hero && <SkeletonHero />}
      <div className="mt-4 space-y-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="mx-4 h-[88px] rounded-card" />
        ))}
      </div>
    </div>
  );
}
