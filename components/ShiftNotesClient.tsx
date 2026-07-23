"use client";

import { useRef, useState, useTransition } from "react";
import { addNote, resolveNote } from "@/app/recados/actions";
import { notifyDialog } from "@/components/ui/ConfirmDialog";
import type { ShiftNote } from "@/components/dashboard/ShiftNotesCard";

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ShiftNotesClient({ notes }: { notes: ShiftNote[] }) {
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const shown = expanded ? notes : notes.slice(0, 3);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const res = await addNote(new FormData(e.currentTarget));
    setSubmitting(false);
    if (!res.ok) {
      notifyDialog(res.error || "Erro ao enviar recado");
      return;
    }
    formRef.current?.reset();
  }

  return (
    <section className="reveal d3 mx-4 mt-3 rounded-card bg-white p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-sm font-bold text-navy">📌 Recados do turno</strong>
        {notes.length > 0 && (
          <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-extrabold text-warn">
            {notes.length}
          </span>
        )}
      </div>

      {shown.length > 0 && (
        <ul className="mb-3 space-y-2">
          {shown.map((n) => (
            <NoteRow key={n.id} note={n} />
          ))}
        </ul>
      )}
      {notes.length > 3 && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mb-3 w-full text-center text-xs font-semibold text-cyan"
        >
          ver todos os {notes.length} recados
        </button>
      )}

      <form ref={formRef} onSubmit={onSubmit} className="flex gap-2">
        <input
          name="content"
          required
          maxLength={500}
          placeholder="Deixa um recado pro próximo turno…"
          className="min-h-[44px] flex-1 rounded-xl border-[1.5px] border-line px-3 text-sm focus:border-cyan focus:outline-none"
        />
        <button
          type="submit"
          disabled={submitting}
          className="min-h-[44px] rounded-xl bg-navy px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? "..." : "Fixar"}
        </button>
      </form>
    </section>
  );
}

function NoteRow({ note }: { note: ShiftNote }) {
  const [isPending, startTransition] = useTransition();
  const [gone, setGone] = useState(false);
  if (gone) return null;

  function resolve() {
    if (isPending) return;
    startTransition(async () => {
      const res = await resolveNote(note.id);
      if (!res.ok) {
        notifyDialog(res.error || "Erro");
        return;
      }
      setGone(true);
    });
  }

  return (
    <li className="flex items-start gap-2 rounded-xl bg-appbg p-2.5 px-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-navy">{note.content}</p>
        <span className="text-[11px] text-muted">
          {note.author_name || "Alguém"} · {fmtWhen(note.created_at)}
        </span>
      </div>
      <button
        onClick={resolve}
        disabled={isPending}
        aria-label="Marcar recado como resolvido"
        className="grid min-h-[40px] min-w-[40px] place-items-center rounded-lg bg-ok-bg text-sm font-bold text-ok disabled:opacity-50"
      >
        {isPending ? "..." : "✓"}
      </button>
    </li>
  );
}
