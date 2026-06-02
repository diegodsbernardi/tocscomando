import { BottomNav } from "./BottomNav";
import { getCurrentProfile, canSeeMotoboys } from "@/lib/profile";

/**
 * Container "phone" usado em todas as telas autenticadas.
 * - Mobile-first com max-w-md
 * - Padding bottom pra dar espaço pra BottomNav fixa
 * - Renderiza a BottomNav junto, escondendo itens conforme o papel
 */
export async function Shell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const hideMotoboys = !canSeeMotoboys(profile);

  return (
    <>
      <div className="mx-auto min-h-screen w-full max-w-md pb-[92px]">
        {children}
      </div>
      <BottomNav hideMotoboys={hideMotoboys} />
    </>
  );
}
