"use client";

import { useState, useTransition } from "react";
import { deleteReport } from "@/app/historico/actions";

export function DeleteReportButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (isPending) return;
    const ok = window.confirm(
      "Tem certeza que deseja apagar este relatório? Essa ação não pode ser desfeita.",
    );
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const res = await deleteReport(id);
      if (!res.ok) {
        setError(res.error || "Erro ao apagar");
      }
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={handleClick}
        disabled={isPending}
        aria-label="Apagar relatório"
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-danger hover:bg-danger-bg disabled:opacity-50"
      >
        {isPending ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border border-red-600 border-t-transparent" />
            Apagando
          </>
        ) : (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
            Apagar
          </>
        )}
      </button>
      {error && <p className="mt-1 text-[10px] text-danger">{error}</p>}
    </div>
  );
}
