"use client";

import { useRef, useState } from "react";
import { addSuggestion } from "@/app/sugestoes/actions";

export function SuggestionForm() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await addSuggestion(new FormData(e.currentTarget));
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || "Erro ao enviar");
      return;
    }
    formRef.current?.reset();
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="rounded-card bg-white p-4 shadow-card">
      <label className="text-sm font-bold text-navy" htmlFor="content">
        Qual a tua ideia?
      </label>
      <textarea
        id="content"
        name="content"
        rows={3}
        required
        maxLength={1000}
        placeholder="Ex: colocar um suporte de celular perto da chapa…"
        className="mt-2 w-full rounded-xl border-[1.5px] border-line px-3 py-2.5 text-sm focus:border-cyan focus:outline-none"
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-3 min-h-[44px] w-full rounded-xl bg-cyan text-[15px] font-bold text-white hover:bg-cyan-deep disabled:opacity-50"
      >
        {submitting ? "Enviando…" : sent ? "✓ Enviada!" : "Enviar sugestão"}
      </button>
    </form>
  );
}
