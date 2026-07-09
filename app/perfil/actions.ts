"use server";

import { revalidatePath } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Troca o caixa/loja em que o PRÓPRIO usuário está trabalhando agora.
 *
 * A RLS de user_profiles só permite update por admin (de propósito — papel e
 * nome são governança). A troca de caixa, porém, é decisão do próprio
 * funcionário no dia a dia ("hoje estou no Salão"), então esta action valida a
 * sessão e usa a service key APENAS pra atualizar o default_drawer_id da
 * própria linha — nada além disso.
 */
export async function setMyDrawer(drawerId: string | null) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado" };

  // valida que o drawer existe e está ativo (ou null = sem caixa fixo)
  if (drawerId) {
    const { data: drawer } = await supabase
      .from("cash_drawers")
      .select("id")
      .eq("id", drawerId)
      .eq("active", true)
      .maybeSingle();
    if (!drawer) return { ok: false, error: "Caixa inválido" };
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { error } = await service
    .from("user_profiles")
    .update({ default_drawer_id: drawerId, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/");
  revalidatePath("/caixa");
  revalidatePath("/fechar-o-dia");
  revalidatePath("/motoboys");
  return { ok: true };
}
