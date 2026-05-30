"use client";

import { useState, useTransition } from "react";
import { toggleMotoboyActive, updateMotoboy } from "@/app/motoboys/actions";

export function MotoboyListItem({
  id,
  initialName,
  initialPhone,
  active,
}: {
  id: string;
  initialName: string;
  initialPhone: string | null;
  active: boolean;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (isPending) return;
    startTransition(async () => {
      const res = await toggleMotoboyActive(id, !active);
      if (!res.ok) alert(res.error || "Erro");
    });
  }

  function save() {
    if (isPending) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("name", name);
      fd.set("phone", phone);
      const res = await updateMotoboy(fd);
      if (!res.ok) alert(res.error || "Erro");
      else setEditing(false);
    });
  }

  return (
    <article
      className={`rounded-2xl p-3 shadow ${active ? "bg-white" : "bg-slate-100"}`}
    >
      {editing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Telefone"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setName(initialName);
                setPhone(initialPhone ?? "");
                setEditing(false);
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={isPending || !name.trim()}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {isPending ? "..." : "Salvar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={`text-sm font-semibold ${active ? "text-slate-800" : "text-slate-500 line-through"}`}
            >
              {name}
            </p>
            {phone ? (
              <a
                href={`tel:${phone.replace(/\D/g, "")}`}
                className="text-[11px] text-brand-dark hover:underline"
              >
                {phone}
              </a>
            ) : (
              <p className="text-[11px] italic text-slate-400">sem telefone</p>
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            Editar
          </button>
          <button
            onClick={toggle}
            disabled={isPending}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
              active
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            }`}
          >
            {isPending ? "..." : active ? "Desativar" : "Reativar"}
          </button>
        </div>
      )}
    </article>
  );
}
