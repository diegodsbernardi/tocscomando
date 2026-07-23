import { createClient } from "@/lib/supabase/server";
import { ShiftNotesClient } from "@/components/ShiftNotesClient";

export type ShiftNote = {
  id: string;
  created_at: string;
  author_name: string | null;
  content: string;
};

/**
 * Mural de recados entre turnos — "acabou o pão", "cliente busca às 20h".
 * Lista os não resolvidos + input pra escrever. Resolver marca ✓ e some.
 */
export async function ShiftNotesCard() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("shift_notes")
    .select("id, created_at, author_name, content")
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(20);

  // tabela ainda não criada / falha: não quebra a home, só esconde o mural
  if (error) return null;

  return <ShiftNotesClient notes={(data || []) as ShiftNote[]} />;
}
