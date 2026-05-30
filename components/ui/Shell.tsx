import { BottomNav } from "./BottomNav";

/**
 * Container "phone" usado em todas as telas autenticadas.
 * - Mobile-first com max-w-md
 * - Padding bottom pra dar espaço pra BottomNav fixa
 * - Renderiza a BottomNav junto
 */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="mx-auto min-h-screen w-full max-w-md pb-[92px]">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
