"use client";

import { useState } from "react";
import { notifyDialog } from "@/components/ui/ConfirmDialog";

/** Botão que copia o texto do relatório pro clipboard, pronto pra colar no WhatsApp. */
export function CopyWhatsAppButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      await notifyDialog("Não consegui copiar automaticamente. Selecione o texto acima e copie manualmente.");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl font-display text-sm font-extrabold transition-colors ${
        copied ? "bg-ok-bg text-ok" : "bg-cyan text-white shadow-glow"
      }`}
    >
      {copied ? "Copiado ✓ — é só colar no WhatsApp" : "Copiar pro WhatsApp"}
    </button>
  );
}
