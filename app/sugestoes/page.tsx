import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { SuggestionForm } from "@/components/SuggestionForm";
import {
  SuggestionStatusToggle,
  DeleteSuggestionButton,
} from "@/components/SuggestionRowActions";
import { getAuthUser, getCurrentProfile, roleLabel } from "@/lib/profile";

export const dynamic = "force-dynamic";

type Suggestion = {
  id: string;
  created_at: string;
  author_name: string | null;
  content: string;
  status: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default async function SugestoesPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === "admin";

  const supabase = createClient();
  const { data, error } = await supabase
    .from("suggestions")
    .select("id, created_at, author_name, content, status")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data || []) as Suggestion[];
  const novas = rows.filter((r) => r.status !== "implementada");
  const feitas = rows.filter((r) => r.status === "implementada");

  return (
    <Shell>
      <TopBar
        title="Caixa de sugestões"
        subtitle="toda ideia é bem-vinda"
        role={roleLabel(profile)}
        backHref="/"
      />

      <div className="space-y-4 px-4">
        <SuggestionForm />

        {error && (
          <p className="rounded-card bg-warn-bg p-4 text-center text-sm font-semibold text-warn shadow-card">
            ⚠ Não consegui carregar as sugestões — tenta de novo.
          </p>
        )}

        {!error && rows.length === 0 && (
          <p className="rounded-card bg-white p-6 text-center text-sm text-muted shadow-card">
            Nenhuma sugestão ainda. Manda a primeira! 💡
          </p>
        )}

        {novas.length > 0 && (
          <section>
            <h3 className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
              Ideias
            </h3>
            <div className="space-y-2">
              {novas.map((s) => (
                <SuggestionCard key={s.id} s={s} isAdmin={isAdmin} />
              ))}
            </div>
          </section>
        )}

        {feitas.length > 0 && (
          <section>
            <h3 className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
              Já implementadas
            </h3>
            <div className="space-y-2">
              {feitas.map((s) => (
                <SuggestionCard key={s.id} s={s} isAdmin={isAdmin} />
              ))}
            </div>
          </section>
        )}
      </div>
    </Shell>
  );
}

function SuggestionCard({ s, isAdmin }: { s: Suggestion; isAdmin: boolean }) {
  return (
    <article className="rounded-card bg-white p-3 px-[15px] shadow-card">
      <p className="text-sm leading-snug text-navy">{s.content}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="flex-1 truncate text-[11px] text-muted">
          {s.author_name || "Anônimo"} · {fmtDate(s.created_at)}
        </span>
        {isAdmin && (
          <>
            <SuggestionStatusToggle id={s.id} implemented={s.status === "implementada"} />
            <DeleteSuggestionButton id={s.id} />
          </>
        )}
        {!isAdmin && s.status === "implementada" && (
          <span className="rounded bg-ok-bg px-2 py-0.5 text-[10px] font-extrabold text-ok">
            ✓ FEITA
          </span>
        )}
      </div>
    </article>
  );
}
