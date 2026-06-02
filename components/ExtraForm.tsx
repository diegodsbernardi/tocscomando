"use client";

import { useMemo, useState } from "react";

type Employee = { id: string; name: string; centro_custo: "atendimento" | "cozinha" };

// Regra de valor padrão: ter/qua/qui = 70, sex/sáb/dom = 100. Seg = 70 (extrapolação).
function defaultAmount(dateISO: string) {
  if (!dateISO) return 100;
  const [y, m, d] = dateISO.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=dom .. 6=sáb
  // sex(5) sab(6) dom(0) → 100; resto → 70
  return dow === 0 || dow === 5 || dow === 6 ? 100 : 70;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ExtraForm({
  employees,
  action,
}: {
  employees: Employee[];
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
}) {
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState<number>(defaultAmount(todayISO()));
  const [amountTouched, setAmountTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const grouped = useMemo(() => {
    const at = employees.filter((e) => e.centro_custo === "atendimento");
    const co = employees.filter((e) => e.centro_custo === "cozinha");
    return { at, co };
  }, [employees]);

  function onDateChange(v: string) {
    setDate(v);
    if (!amountTouched) setAmount(defaultAmount(v));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const res = await action(fd);
    setSubmitting(false);
    if (res && !res.ok) setError(res.error || "Erro ao salvar");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow">
      <label className="flex flex-col text-sm font-medium text-navy">
        Data
        <input
          type="date"
          name="work_date"
          required
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="mt-1 rounded-lg border border-line px-3 py-2 text-base"
        />
      </label>

      <label className="flex flex-col text-sm font-medium text-navy">
        Funcionário
        <select
          name="employee_id"
          required
          defaultValue=""
          className="mt-1 rounded-lg border border-line px-3 py-2 text-base"
        >
          <option value="" disabled>
            Selecione…
          </option>
          {grouped.at.length > 0 && (
            <optgroup label="Atendimento">
              {grouped.at.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          )}
          {grouped.co.length > 0 && (
            <optgroup label="Cozinha">
              {grouped.co.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      <label className="flex flex-col text-sm font-medium text-navy">
        Valor (R$)
        <input
          type="number"
          name="amount"
          required
          min={0}
          step={1}
          value={amount}
          onChange={(e) => {
            setAmount(Number(e.target.value));
            setAmountTouched(true);
          }}
          className="mt-1 rounded-lg border border-line px-3 py-2 text-base"
        />
        <span className="mt-1 text-[11px] text-muted">
          Padrão: 70 ter–qui · 100 sex–dom. Pode editar.
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-navy">
        <input
          type="checkbox"
          name="paid"
          className="h-4 w-4 rounded border-line"
        />
        Já está pago
      </label>

      <label className="flex flex-col text-sm font-medium text-navy">
        Observação (opcional)
        <input
          type="text"
          name="notes"
          maxLength={200}
          placeholder="Ex: pago em pix, dobro etc"
          className="mt-1 rounded-lg border border-line px-3 py-2 text-base"
        />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-cyan py-3 text-sm font-semibold text-white shadow hover:bg-cyan-deep disabled:opacity-50"
      >
        {submitting ? "Salvando…" : "Salvar"}
      </button>
    </form>
  );
}
