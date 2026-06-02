"use client";

import { useState } from "react";

type Motoboy = { id: string; name: string };

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NewShiftForm({
  motoboys,
  action,
}: {
  motoboys: Motoboy[];
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await action(new FormData(e.currentTarget));
    setSubmitting(false);
    if (res && !res.ok) setError(res.error || "Erro ao criar turno");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow">
      <label className="flex flex-col text-sm font-medium text-navy">
        Motoboy
        <select
          name="motoboy_id"
          required
          defaultValue=""
          className="mt-1 rounded-lg border border-line px-3 py-2 text-base"
        >
          <option value="" disabled>
            Selecione…
          </option>
          {motoboys.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col text-sm font-medium text-navy">
          Data
          <input
            type="date"
            name="work_date"
            required
            defaultValue={todayISO()}
            className="mt-1 rounded-lg border border-line px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col text-sm font-medium text-navy">
          Hora chegada
          <input
            type="time"
            name="arrival_time"
            className="mt-1 rounded-lg border border-line px-3 py-2 text-base"
          />
        </label>
      </div>

      <label className="flex flex-col text-sm font-medium text-navy">
        Observação (opcional)
        <input
          type="text"
          name="notes"
          maxLength={200}
          placeholder=""
          className="mt-1 rounded-lg border border-line px-3 py-2 text-base"
        />
      </label>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-cyan py-3 text-sm font-semibold text-white shadow hover:bg-cyan-deep disabled:opacity-50"
      >
        {submitting ? "Criando…" : "Iniciar turno"}
      </button>
    </form>
  );
}
