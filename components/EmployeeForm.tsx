"use client";

import { useRef, useState } from "react";
import { createEmployee } from "@/app/extras/funcionarios/actions";

export function EmployeeForm() {
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
      className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 shadow"
    >
      <input
        type="text"
        name="name"
        required
        placeholder="Nome do funcionário"
        className="col-span-3 rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <select
        name="centro_custo"
        required
        defaultValue="atendimento"
        className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="atendimento">Atendimento</option>
        <option value="cozinha">Cozinha</option>
      </select>
      <button
        type="submit"
        disabled={submitting}
        className="col-span-1 rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {submitting ? "..." : "Add"}
      </button>
      {error && <p className="col-span-3 text-sm text-red-600">{error}</p>}
    </form>
  );
}
