import Link from "next/link";
import {
  CHECKLIST_ABERTURA,
  CHECKLIST_FECHAMENTO,
  getTodayChecklist,
} from "@/lib/checklist";

export async function ChecklistCard() {
  const state = await getTodayChecklist();
  if (state.error) return null; // tabela ainda não criada — some da home

  const abTotal = CHECKLIST_ABERTURA.length;
  const feTotal = CHECKLIST_FECHAMENTO.length;
  const allDone = state.aberturaDone === abTotal && state.fechamentoDone === feTotal;

  return (
    <Link
      href="/checklist"
      className="reveal d4 mx-4 mt-3 flex items-center gap-3.5 rounded-card bg-white p-4 px-[18px] shadow-card transition hover:shadow-glow"
    >
      <span
        className={`grid h-[46px] w-[46px] flex-shrink-0 place-items-center rounded-[14px] text-lg ${
          allDone ? "bg-ok-bg text-ok" : "bg-cyan/10 text-cyan"
        }`}
      >
        {allDone ? "✓" : "☑️"}
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block text-[15px] font-bold text-navy">Checklist do turno</strong>
        <span className="text-xs text-muted">
          Abertura {state.aberturaDone}/{abTotal} · Fechamento {state.fechamentoDone}/{feTotal}
        </span>
      </div>
      <span className="text-muted">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </Link>
  );
}
