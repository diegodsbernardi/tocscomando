"use client";

import { useRef, useState } from "react";
import { createArea } from "@/app/motoboys/actions";

export function AreaForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await createArea(new FormData(e.currentTarget));
    setSubmitting(false);
    if (!res.ok) setError(res.error || "Erro");
    else formRef.current?.reset();
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="mb-4 grid grid-cols-4 gap-2 rounded-2xl bg-white p-3 shadow"
    >
      <input
        type="text"
        name="name"
        required
        placeholder="Nome do bairro"
        className="col-span-3 rounded-lg border border-line px-3 py-2 text-sm"
      />
      <input
        type="number"
        name="fee"
        required
        step="0.5"
        min={0}
        placeholder="Taxa"
        className="col-span-2 rounded-lg border border-line px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={submitting}
        className="col-span-2 rounded-lg bg-cyan text-sm font-semibold text-white hover:bg-cyan-deep disabled:opacity-50"
      >
        {submitting ? "..." : "Adicionar"}
      </button>
      {error && <p className="col-span-4 text-sm text-danger">{error}</p>}
    </form>
  );
}
