"use client";

import { useRef, useState } from "react";
import { createMotoboy } from "@/app/motoboys/actions";

export function MotoboyForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await createMotoboy(new FormData(e.currentTarget));
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
        placeholder="Nome"
        className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <input
        type="tel"
        name="phone"
        placeholder="Telefone"
        className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={submitting}
        className="row-span-2 rounded-lg bg-brand text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {submitting ? "..." : "Add"}
      </button>
      {error && <p className="col-span-3 text-sm text-red-600">{error}</p>}
    </form>
  );
}
