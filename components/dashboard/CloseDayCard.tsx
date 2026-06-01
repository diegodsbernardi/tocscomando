import Link from "next/link";

export function CloseDayCard() {
  return (
    <Link
      href="/fechar-o-dia"
      className="reveal d4 mx-4 mt-3 flex items-center gap-3.5 rounded-card bg-brandyellow p-4 px-[18px] text-navy shadow-card transition hover:brightness-95"
    >
      <span className="grid h-[46px] w-[46px] flex-shrink-0 place-items-center rounded-[14px] bg-navy text-brandyellow">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <strong className="block text-[15px] font-bold">Fechar o dia</strong>
        <span className="text-xs opacity-70">
          Motos · Extras · Dinheiro · Cartões
        </span>
      </div>
      <span className="opacity-70">
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
