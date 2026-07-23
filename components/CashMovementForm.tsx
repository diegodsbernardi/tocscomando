"use client";

import { useState } from "react";
import { addMovement } from "@/app/caixa/actions";

const CATS = {
  out: [
    "Fornecedor",
    "Depósito/Banco",
    "Vale / adiantamento",
    "Consumo interno",
    "Perda / desperdício",
    "Troco p/ outro caixa",
    "Outros",
  ],
  in: ["Troco do outro caixa", "Suprimento", "Outros"],
} as const;

// Destino da sangria (gravado como prefixo "[destino]" no note — sem migration).
const DESTINOS = ["Cofre", "Banco", "Pagamento", "Outro"] as const;

// Categorias em que o motivo é obrigatório (quem pegou o vale / o que consumiu / o que perdeu)
const MOTIVO_OBRIGATORIO = ["Outros", "Vale / adiantamento", "Consumo interno", "Perda / desperdício"];

const PLACEHOLDER_MOTIVO: Record<string, string> = {
  "Vale / adiantamento": "quem pegou? ex: João — desconta dia 05",
  "Consumo interno": "o que foi? ex: lanche funcionário / cortesia mesa 4",
  "Perda / desperdício": "o que perdeu? ex: 2 smash queimados",
  Outros: "obrigatório em Outros",
};

// "Troco p/ outro caixa" já tem destino implícito; vale/consumo/perda não são sangria.
function pedeDestino(direction: "out" | "in", category: string) {
  return (
    direction === "out" &&
    category !== "" &&
    !["Troco p/ outro caixa", "Vale / adiantamento", "Consumo interno", "Perda / desperdício"].includes(category)
  );
}

export function CashMovementForm({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [category, setCategory] = useState<string>("");
  const [destino, setDestino] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setError(null);
    if (pedeDestino(direction, category) && !destino) {
      setError("Escolha pra onde o dinheiro foi (destino).");
      return;
    }
    if (MOTIVO_OBRIGATORIO.includes(category) && !note.trim()) {
      setError(`Em '${category}' o motivo é obrigatório.`);
      return;
    }
    setSubmitting(true);
    const fd = new FormData();
    fd.set("session_id", sessionId);
    fd.set("direction", direction);
    fd.set("category", category);
    fd.set("amount", amount.replace(",", "."));
    fd.set(
      "note",
      pedeDestino(direction, category) && destino
        ? `[${destino}]${note ? ` ${note}` : ""}`
        : note,
    );
    const res = await addMovement(fd);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || "Erro ao salvar");
    } else {
      setOpen(false);
      setCategory("");
      setDestino("");
      setAmount("");
      setNote("");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="w-full rounded-xl border-[1.5px] border-dashed border-[#C6D3E0] bg-transparent py-3 text-sm font-bold text-cyan"
      >
        + Registrar saída / entrada
      </button>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => {
            setDirection("out");
            setCategory("");
            setDestino("");
          }}
          className={`flex-1 rounded-xl border-[1.5px] py-2.5 text-sm font-bold ${
            direction === "out"
              ? "border-danger bg-danger-bg text-danger"
              : "border-line bg-white text-muted"
          }`}
        >
          ↓ Saiu da gaveta
        </button>
        <button
          onClick={() => {
            setDirection("in");
            setCategory("");
            setDestino("");
          }}
          className={`flex-1 rounded-xl border-[1.5px] py-2.5 text-sm font-bold ${
            direction === "in"
              ? "border-ok bg-ok-bg text-ok"
              : "border-line bg-white text-muted"
          }`}
        >
          ↑ Entrou na gaveta
        </button>
      </div>

      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
        Categoria
      </div>
      <div className="my-2 flex flex-wrap gap-2">
        {CATS[direction].map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`rounded-xl border-[1.5px] px-3 py-2 text-xs font-semibold transition ${
              category === cat
                ? "border-navy bg-navy text-white"
                : "border-line bg-white text-navy"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {pedeDestino(direction, category) && (
        <div className="mt-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Pra onde foi? (destino)
          </div>
          <div className="my-2 flex flex-wrap gap-2">
            {DESTINOS.map((dest) => (
              <button
                key={dest}
                onClick={() => setDestino(dest)}
                className={`rounded-xl border-[1.5px] px-3 py-2 text-xs font-semibold transition ${
                  destino === dest
                    ? "border-cyan bg-cyan text-white"
                    : "border-line bg-white text-navy"
                }`}
              >
                {dest}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Valor (R$)
        </div>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          className="mt-1 w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-3 text-center text-xl font-display font-bold tabular-nums focus:border-cyan focus:outline-none"
        />
      </div>

      <div className="mt-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Motivo / observação
        </div>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={PLACEHOLDER_MOTIVO[category] || "ex: entrega de água"}
          className="mt-1 w-full rounded-xl border-[1.5px] border-line bg-white px-3 py-2.5 text-sm focus:border-cyan focus:outline-none"
        />
      </div>

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="flex-1 rounded-xl bg-line py-3 text-sm font-bold text-navy"
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={submitting}
          className="flex-1 rounded-xl bg-brandyellow py-3 text-sm font-bold text-navy disabled:opacity-50"
        >
          {submitting ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}
