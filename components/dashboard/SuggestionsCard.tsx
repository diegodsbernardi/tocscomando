import Link from "next/link";

export function SuggestionsCard() {
  return (
    <Link
      href="/sugestoes"
      className="reveal d5 mx-4 mt-3 flex items-center gap-3.5 rounded-card bg-white p-4 px-[18px] shadow-card transition hover:shadow-glow"
    >
      <span className="grid h-[46px] w-[46px] flex-shrink-0 place-items-center rounded-[14px] bg-cyan/10 text-cyan">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
        >
          <path d="M9 18h6" />
          <path d="M10 22h4" />
          <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block text-[15px] font-bold text-navy">Caixa de sugestões</strong>
        <span className="text-xs text-muted">Tem uma ideia pro TOCS? Manda aqui</span>
      </div>
      <span className="text-muted">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </span>
    </Link>
  );
}
