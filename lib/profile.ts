import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { firstName as firstNameOf } from "./format";

export type Role = "admin" | "operator";

export type UserProfile = {
  user_id: string;
  display_name: string | null;
  role: Role;
  default_drawer_id: string | null;
  default_drawer_name: string | null;
  email: string;
};

/**
 * Obtém o perfil do usuário logado. Cria automaticamente como `operator`
 * sem drawer atribuído se for o primeiro acesso.
 *
 * Retorna null se não autenticado.
 */
export const getCurrentProfile = cache(getCurrentProfileImpl);

async function getCurrentProfileImpl(): Promise<UserProfile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("user_profiles")
    .select("user_id, display_name, role, default_drawer_id, cash_drawers:default_drawer_id(name)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const drawer = (existing as unknown as { cash_drawers: { name: string } | null }).cash_drawers;
    return {
      user_id: existing.user_id,
      display_name: existing.display_name,
      role: existing.role as Role,
      default_drawer_id: existing.default_drawer_id,
      default_drawer_name: drawer?.name ?? null,
      email: user.email ?? "",
    };
  }

  // Primeiro acesso: cria perfil como operator (sem drawer atribuído)
  const fallbackName = firstNameOf(user.email) || "Você";
  const { data: created, error } = await supabase
    .from("user_profiles")
    .insert({
      user_id: user.id,
      display_name: fallbackName,
      role: "operator",
    })
    .select("user_id, display_name, role, default_drawer_id")
    .single();

  if (error || !created) {
    // Política de RLS bloqueou ou outro erro: retorna perfil "fantasma" pra UI não quebrar
    return {
      user_id: user.id,
      display_name: fallbackName,
      role: "operator",
      default_drawer_id: null,
      default_drawer_name: null,
      email: user.email ?? "",
    };
  }

  return {
    user_id: created.user_id,
    display_name: created.display_name,
    role: created.role as Role,
    default_drawer_id: created.default_drawer_id,
    default_drawer_name: null,
    email: user.email ?? "",
  };
}

/**
 * Retorna a label visível do papel (Delivery / Salão / Admin / null).
 */
export function roleLabel(profile: UserProfile | null): string | null {
  if (!profile) return null;
  if (profile.role === "admin") return "Admin";
  if (profile.default_drawer_name === "DLV") return "Delivery";
  if (profile.default_drawer_name === "LTDA") return "Salão";
  return null;
}

/**
 * Retorna os drawers visíveis pelo perfil:
 *  - admin → todos
 *  - operator com drawer → só o dele
 *  - operator sem drawer → todos (default seguro)
 */
export function visibleDrawerFilter(profile: UserProfile | null): string | null {
  if (!profile || profile.role === "admin") return null;
  return profile.default_drawer_id;
}

/**
 * Motoboys / Entregas pertencem ao Delivery. Quem pode ver:
 *  - admin (sempre)
 *  - operator com drawer Delivery (DLV)
 *  - operator sem drawer atribuído (default seguro)
 *  - operator Salão → não vê.
 */
export function canSeeMotoboys(profile: UserProfile | null): boolean {
  if (!profile) return true; // sem profile = não bloqueia
  if (profile.role === "admin") return true;
  if (!profile.default_drawer_id) return true;
  return profile.default_drawer_name !== "LTDA";
}
