import Link from "next/link";

export function CaptureActionCard() {
  return (
    <Link
      href="/foto"
      className="reveal d4 mx-4 mt-4 flex items-center gap-3.5 rounded-card bg-navy p-4 px-[18px] text-white shadow-glow transition hover:brightness-110"
    >
      <span className="grid h-[46px] w-[46px] flex-shrink-0 place-items-center rounded-[14px] bg-brandyellow text-navy">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <strong className="block text-[15px] font-bold">
          Tirar foto do relatório
        </strong>
        <span className="text-xs opacity-70">
          Aponte para o cupom da Safrapay
        </span>
      </div>
      <span className="opacity-60">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </Link>
  );
}
