"use client";

import { useEffect, useState } from "react";

/**
 * Substituto estilizado de window.confirm / alert.
 *
 * <DialogHost /> é montado uma vez no layout raiz; qualquer client component
 * chama `await confirmDialog("Apagar?")` ou `notifyDialog("Erro X")`.
 * Fallback para confirm/alert nativos se o host não estiver montado.
 */

type DialogState =
  | { kind: "confirm"; message: string; resolve: (v: boolean) => void }
  | { kind: "notice"; message: string };

let listener: ((s: DialogState) => void) | null = null;

export function confirmDialog(message: string): Promise<boolean> {
  if (!listener) return Promise.resolve(window.confirm(message));
  const l = listener;
  return new Promise<boolean>((resolve) => l({ kind: "confirm", message, resolve }));
}

export function notifyDialog(message: string) {
  if (!listener) {
    window.alert(message);
    return;
  }
  listener({ kind: "notice", message });
}

export function DialogHost() {
  const [state, setState] = useState<DialogState | null>(null);

  useEffect(() => {
    listener = setState;
    return () => {
      listener = null;
    };
  }, []);

  if (!state) return null;

  function close(answer: boolean) {
    if (state && state.kind === "confirm") state.resolve(answer);
    setState(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 backdrop-blur-[2px] sm:items-center"
      onClick={() => close(false)}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-7 shadow-glow sm:rounded-3xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[15px] font-semibold leading-snug text-navy">{state.message}</p>
        <div className="mt-4 flex gap-2">
          {state.kind === "confirm" ? (
            <>
              <button
                onClick={() => close(false)}
                className="min-h-[44px] flex-1 rounded-xl border-[1.5px] border-line bg-white text-sm font-bold text-muted"
              >
                Cancelar
              </button>
              <button
                onClick={() => close(true)}
                className="min-h-[44px] flex-1 rounded-xl bg-danger text-sm font-bold text-white"
              >
                Confirmar
              </button>
            </>
          ) : (
            <button
              onClick={() => close(false)}
              className="min-h-[44px] flex-1 rounded-xl bg-navy text-sm font-bold text-white"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
