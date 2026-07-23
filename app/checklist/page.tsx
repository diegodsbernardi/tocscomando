import { redirect } from "next/navigation";
import { Shell } from "@/components/ui/Shell";
import { TopBar } from "@/components/ui/TopBar";
import { DataErrorCard } from "@/components/ui/DataErrorCard";
import { ChecklistItemRow } from "@/components/ChecklistItemRow";
import { getAuthUser, getCurrentProfile, roleLabel } from "@/lib/profile";
import {
  CHECKLIST_ABERTURA,
  CHECKLIST_FECHAMENTO,
  getTodayChecklist,
  type ChecklistItem,
  type DayCheck,
} from "@/lib/checklist";
import { formatDateBR } from "@/lib/week";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ChecklistPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const profile = await getCurrentProfile();

  const state = await getTodayChecklist();

  return (
    <Shell>
      <TopBar
        title="Checklist do turno"
        subtitle={formatDateBR(todayISO(), { weekday: "short", day: "2-digit", month: "long" })}
        role={roleLabel(profile)}
        backHref="/"
      />
      <div className="space-y-5 px-4">
        {state.error && <DataErrorCard />}
        {!state.error && (
          <>
            <Bloco
              titulo="🌅 Abertura"
              done={state.aberturaDone}
              items={CHECKLIST_ABERTURA}
              checks={state.checks}
            />
            <Bloco
              titulo="🌙 Fechamento"
              done={state.fechamentoDone}
              items={CHECKLIST_FECHAMENTO}
              checks={state.checks}
            />
            <p className="px-1 text-[11px] leading-snug text-muted">
              Os checks zeram todo dia. Marcou errado? Toca de novo pra desmarcar.
            </p>
          </>
        )}
      </div>
    </Shell>
  );
}

function Bloco({
  titulo,
  done,
  items,
  checks,
}: {
  titulo: string;
  done: number;
  items: ChecklistItem[];
  checks: Map<string, DayCheck>;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">
          {titulo}
        </h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
            done === items.length ? "bg-ok-bg text-ok" : "bg-line text-muted"
          }`}
        >
          {done}/{items.length}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const check = checks.get(item.key);
          return (
            <ChecklistItemRow
              key={item.key}
              itemKey={item.key}
              label={item.label}
              doneByName={check?.done_by_name ?? null}
              doneAt={check?.done_at ?? null}
            />
          );
        })}
      </div>
    </section>
  );
}
