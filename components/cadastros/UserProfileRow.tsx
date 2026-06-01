"use client";

import { useState, useTransition } from "react";
import { updateUserProfile } from "@/app/cadastros/actions";

export type Drawer = { id: string; name: string };

const DRAWER_LABEL: Record<string, string> = {
  DLV: "Delivery",
  LTDA: "Salão",
};

export function UserProfileRow({
  userId,
  email,
  initialName,
  initialRole,
  initialDrawerId,
  isSelf,
  drawers,
}: {
  userId: string;
  email: string;
  initialName: string | null;
  initialRole: "admin" | "operator";
  initialDrawerId: string | null;
  isSelf: boolean;
  drawers: Drawer[];
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName ?? "");
  const [role, setRole] = useState<"admin" | "operator">(initialRole);
  const [drawerId, setDrawerId] = useState<string>(initialDrawerId ?? "none");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("user_id", userId);
      fd.set("display_name", name);
      fd.set("role", role);
      fd.set("default_drawer_id", drawerId);
      const res = await updateUserProfile(fd);
      if (!res.ok) setError(res.error || "Erro");
      else setEditing(false);
    });
  }

  const currentDrawerName = drawers.find((d) => d.id === initialDrawerId)?.name;
  const drawerLabel = currentDrawerName ? DRAWER_LABEL[currentDrawerName] || currentDrawerName : null;

  return (
    <article className="rounded-card bg-white p-3 px-[15px] shadow-card">
      {editing ? (
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome"
            className="w-full rounded-lg border-[1.5px] border-line px-3 py-2 text-sm focus:border-cyan focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "operator")}
              className="rounded-lg border-[1.5px] border-line px-3 py-2 text-sm focus:border-cyan focus:outline-none"
            >
              <option value="operator">Operador</option>
              <option value="admin">Admin</option>
            </select>
            <select
              value={drawerId}
              onChange={(e) => setDrawerId(e.target.value)}
              disabled={role === "admin"}
              className="rounded-lg border-[1.5px] border-line px-3 py-2 text-sm focus:border-cyan focus:outline-none disabled:opacity-50"
            >
              <option value="none">Sem caixa fixo</option>
              {drawers.map((d) => (
                <option key={d.id} value={d.id}>
                  {DRAWER_LABEL[d.name] || d.name}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setName(initialName ?? "");
                setRole(initialRole);
                setDrawerId(initialDrawerId ?? "none");
                setEditing(false);
                setError(null);
              }}
              className="rounded-lg bg-line px-3 py-1.5 text-xs font-bold text-navy"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={isPending}
              className="rounded-lg bg-cyan px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {isPending ? "..." : "Salvar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <strong className="block text-[15px] font-bold">
              {initialName || email.split("@")[0]}
              {isSelf && (
                <span className="ml-2 text-[11px] font-medium text-muted">(você)</span>
              )}
            </strong>
            <small className="block truncate text-[11px] text-muted">{email}</small>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span
                className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                  initialRole === "admin"
                    ? "bg-navy text-white"
                    : "bg-atend-bg text-atend"
                }`}
              >
                {initialRole === "admin" ? "Admin" : "Operador"}
              </span>
              {initialRole === "operator" && (
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    drawerLabel === "Salão"
                      ? "bg-cozinha-bg text-cozinha"
                      : drawerLabel === "Delivery"
                        ? "bg-atend-bg text-atend"
                        : "bg-line text-muted"
                  }`}
                >
                  {drawerLabel ?? "sem caixa fixo"}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg bg-line px-3 py-1.5 text-xs font-bold text-navy"
          >
            Editar
          </button>
        </div>
      )}
    </article>
  );
}
