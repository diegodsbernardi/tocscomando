"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
  match: (path: string) => boolean;
  icon: React.ReactNode;
};

const ITEMS: Item[] = [
  {
    href: "/",
    label: "Início",
    match: (p) => p === "/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </svg>
    ),
  },
  {
    href: "/caixa",
    label: "Caixa",
    match: (p) => p.startsWith("/caixa"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="6" width="18" height="14" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 14h3" />
      </svg>
    ),
  },
  {
    href: "/motoboys",
    label: "Motoboys",
    match: (p) => p.startsWith("/motoboys"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="5" cy="17" r="3" />
        <circle cx="19" cy="17" r="3" />
        <path d="M5 17h7l4-7h3" />
        <path d="M13 4h3l1 3" />
      </svg>
    ),
  },
  {
    href: "/extras",
    label: "Extras",
    match: (p) => p.startsWith("/extras"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1z" />
        <line x1="8" y1="8" x2="16" y2="8" />
        <line x1="8" y1="12" x2="14" y2="12" />
      </svg>
    ),
  },
  {
    href: "/cadastros",
    label: "Cadastros",
    match: (p) => p.startsWith("/cadastros"),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    ),
  },
];

export function BottomNav({ hideMotoboys = false }: { hideMotoboys?: boolean } = {}) {
  const pathname = usePathname() || "/";
  const items = hideMotoboys ? ITEMS.filter((it) => it.href !== "/motoboys") : ITEMS;
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-line bg-white/95 px-2 pb-[14px] pt-[10px] backdrop-blur"
    >
      {items.map((it) => {
        const active = it.match(pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold ${
              active ? "text-cyan" : "text-muted"
            }`}
          >
            <span
              className={`grid h-8 w-[42px] place-items-center rounded-xl transition ${
                active ? "bg-cyan text-white" : ""
              }`}
            >
              <span className="block h-5 w-5">{it.icon}</span>
            </span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
