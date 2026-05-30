"use client";

import { useState, useTransition } from "react";
import { toggleEmployeeActive, updateEmployee } from "@/app/extras/funcionarios/actions";

export function EmployeeRow({
  id,
  initialName,
  initialPhone,
  centro,
  active,
}: {
  id: string;
  initialName: string;
  initialPhone: string | null;
  centro: "atendimento" | "cozinha";
  active: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("name", name);
      fd.set("phone", phone);
      const res = await updateEmployee(fd);
      if (!res.ok) alert(res.error || "Erro");
      else setEditing(false);
    });
  }

  function toggle() {
    if (isPending) return;
    startTransition(async () => {
      const res = await toggleEmployeeActive(id, !active);
      if (!res.ok) alert(res.error || "Erro");
    });
  }

  const tag =
    centro === "cozinha"
      ? "bg-cozinha-bg text-cozinha"
      : "bg-atend-bg text-atend";
  const tagLabel = centro === "cozinha" ? "Cozinha" : "Atendimento";

  return (
    <article
      className={`flex items-center gap-3 rounded-card p-3 px-[15px] shadow-card ${active ? "bg-white" : "bg-white opacity-50"}`}
    >
      {editing ? (
        <div className="flex-1 space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border-[1.5px] border-line px-3 py-2 text-sm focus:border-cyan focus:outline-none"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefone"
            className="w-full rounded-lg border-[1.5px] border-line px-3 py-2 text-sm focus:border-cyan focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setName(initialName);
                setPhone(initialPhone ?? "");
                setEditing(false);
              }}
              className="rounded-lg bg-line px-3 py-1.5 text-xs font-bold text-navy"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={isPending || !name.trim()}
              className="rounded-lg bg-cyan px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {isPending ? "..." : "Salvar"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <strong className="block text-[15px] font-bold">{name}</strong>
            <div className="mt-1 flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${tag}`}>
                {tagLabel}
              </span>
              {phone ? (
                <a
                  href={`tel:${phone.replace(/\D/g, "")}`}
                  className="text-[11px] text-muted hover:text-navy"
                >
                  📞 {phone}
                </a>
              ) : (
                <span className="text-[11px] italic text-muted">sem telefone</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg bg-line px-2 py-1 text-xs font-bold text-navy"
          >
            Editar
          </button>
          <button
            onClick={toggle}
            disabled={isPending}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
              active
                ? "bg-danger-bg text-danger"
                : "bg-ok-bg text-ok"
            }`}
          >
            {active ? "Desativar" : "Ativar"}
          </button>
        </>
      )}
    </article>
  );
}
