"use client";

import { useRef, useState } from "react";
import { createEmployee } from "@/app/extras/funcionarios/actions";

export function EmployeeAddForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await createEmployee(new FormData(e.currentTarget));
    setSubmitting(false);
    if (!res.ok) setError(res.error || "Erro");
    else formRef.current?.reset();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="rounded-card bg-white p-3 shadow-card"
    >
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          name="name"
          required
          placeholder="Nome do funcionário"
          className="flex-1 min-w-[180px] rounded-xl border-[1.5px] border-line px-3 py-2.5 text-sm focus:border-cyan focus:outline-none"
        />
        <input
          type="tel"
          name="phone"
          placeholder="Telefone"
          className="flex-1 min-w-[140px] rounded-xl border-[1.5px] border-line px-3 py-2.5 text-sm focus:border-cyan focus:outline-none"
        />
        <select
          name="centro_custo"
          defaultValue="atendimento"
          className="flex-1 rounded-xl border-[1.5px] border-line px-3 py-2.5 text-sm focus:border-cyan focus:outline-none"
        >
          <option value="atendimento">Atendimento</option>
          <option value="cozinha">Cozinha</option>
        </select>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-cyan px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? "..." : "Add"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </form>
  );
}
