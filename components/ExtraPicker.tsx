"use client";

import { useState } from "react";
import { levelForCount, VINCULO_LIMIT } from "@/lib/vinculo";

type Employee = {
  id: string;
  name: string;
  centro_custo: "atendimento" | "cozinha";
  phone: string | null;
  weekCount: number;
};

function defaultAmountForDate(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 5 || dow === 6 ? 100 : 70;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ExtraPicker({
  employees,
  action,
}: {
  employees: Employee[];
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
}) {
  const [date, setDate] = useState(todayISO());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>(String(defaultAmountForDate(todayISO())));
  const [paid, setPaid] = useState(false);
  const [paidBy, setPaidBy] = useState<"Sara" | "Eloir" | "">("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = employees.find((e) => e.id === selectedId);
  const selectedLevel = selected ? levelForCount(selected.weekCount) : "ok";

  function onDateChange(v: string) {
    setDate(v);
    setAmount(String(defaultAmountForDate(v)));
  }

  function onPick(id: string) {
    setSelectedId(id);
    setError(null);
    const e = employees.find((x) => x.id === id);
    if (e && paidBy === "") {
      setPaidBy(e.centro_custo === "cozinha" ? "Sara" : "Eloir");
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedId) {
      setError("Selecione um funcionário.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const fd = new FormData();
    fd.set("employee_id", selectedId);
    fd.set("work_date", date);
    fd.set("amount", amount.replace(",", "."));
    if (paid) {
      fd.set("paid", "on");
      if (paidBy) fd.set("notes", `pago por ${paidBy}`);
    }
    const res = await action(fd);
    setSubmitting(false);
    if (res && !res.ok) setError(res.error || "Erro");
  }

  // Ordenação: vínculo em perigo (vermelho) PRIMEIRO pra dar destaque ao alerta,
  // depois ativos com count > 0, depois alfabético.
  const sorted = [...employees].sort((a, b) => {
    const la = levelForCount(a.weekCount);
    const lb = levelForCount(b.weekCount);
    const order = { danger: 0, warn: 1, ok: 2 };
    if (order[la] !== order[lb]) return order[la] - order[lb];
    return a.name.localeCompare(b.name, "pt-BR");
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Data + valor */}
      <div className="grid grid-cols-2 gap-2 rounded-card bg-white p-4 shadow-card">
        <label className="text-sm font-bold text-navy">
          Data
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="mt-1 w-full rounded-xl border-[1.5px] border-line px-3 py-2.5 text-sm focus:border-cyan focus:outline-none"
          />
        </label>
        <label className="text-sm font-bold text-navy">
          Valor (R$)
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-xl border-[1.5px] border-line px-3 py-2.5 text-sm focus:border-cyan focus:outline-none"
          />
        </label>
        <p className="col-span-2 text-[11px] text-muted">
          Padrão: 70 ter–qui · 100 sex–dom.
        </p>
      </div>

      <p className="px-1 text-[13px] text-muted">
        Quem trabalhou hoje? O número é quantas vezes a pessoa já veio{" "}
        <b className="text-navy">esta semana</b>.
      </p>

      {/* Picker */}
      <div className="space-y-2">
        {sorted.map((e) => {
          const lvl = levelForCount(e.weekCount);
          const active = selectedId === e.id;
          return (
            <button
              type="button"
              key={e.id}
              onClick={() => onPick(e.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border-[1.5px] p-3.5 text-left transition ${
                active
                  ? "border-cyan bg-[#F4FBFF]"
                  : "border-line bg-white"
              }`}
            >
              <div className="min-w-0 flex-1">
                <strong className="block text-[15px] font-bold text-navy">
                  {e.name}
                </strong>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {e.centro_custo === "cozinha" ? (
                    <span className="rounded bg-cozinha-bg px-2 py-0.5 text-[10px] font-bold text-cozinha">
                      Cozinha
                    </span>
                  ) : (
                    <span className="rounded bg-atend-bg px-2 py-0.5 text-[10px] font-bold text-atend">
                      Atendimento
                    </span>
                  )}
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                  lvl === "danger"
                    ? "bg-danger-bg text-danger"
                    : lvl === "warn"
                      ? "bg-warn-bg text-warn"
                      : "bg-line text-muted"
                }`}
              >
                {e.weekCount}x esta semana
              </span>
            </button>
          );
        })}
      </div>

      {/* Previsão de vínculo: a 1 vinda do limite */}
      {selected && selectedLevel === "warn" && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-warn-bg p-4">
          <span className="text-lg">🔶</span>
          <p className="text-[13px] font-semibold leading-snug text-warn">
            {selected.name} já veio {selected.weekCount}x esta semana — se vier
            hoje, entra no limite de vínculo ({VINCULO_LIMIT}x na mesma semana).
          </p>
        </div>
      )}

      {/* Alerta de vínculo */}
      {selected && selectedLevel === "danger" && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-danger-bg p-4">
          <span className="text-lg">⚠️</span>
          <p className="text-[13px] font-semibold leading-snug text-danger">
            {selected.name} já veio {selected.weekCount}x esta semana. Chamar de novo
            pode configurar vínculo empregatício — confira com seu contador. Você pode
            seguir mesmo assim.
          </p>
        </div>
      )}

      {/* Paid toggle */}
      <div className="rounded-card bg-white p-4 shadow-card">
        <label className="flex items-center gap-2 text-sm font-bold text-navy">
          <input
            type="checkbox"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          Já está pago
        </label>
        {paid && (
          <div className="mt-2 flex gap-2">
            {(["Sara", "Eloir"] as const).map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPaidBy(p)}
                className={`flex-1 rounded-xl border-[1.5px] py-2 text-xs font-semibold transition ${
                  paidBy === p
                    ? "border-navy bg-navy text-white"
                    : "border-line bg-white text-muted"
                }`}
              >
                Pago por {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !selectedId}
        className="w-full rounded-2xl bg-brandyellow py-4 text-[15px] font-bold text-navy shadow-card disabled:opacity-50"
      >
        {submitting
          ? "Salvando…"
          : selected
            ? `Adicionar ${selected.name.split(" ")[0]} ${VINCULO_LIMIT && selected.weekCount >= VINCULO_LIMIT ? "mesmo assim" : ""}`
            : "Selecione alguém"}
      </button>
    </form>
  );
}
