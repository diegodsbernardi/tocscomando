import Link from "next/link";
import { Logo } from "./Logo";

type Props = {
  title?: string;
  subtitle?: string;
  greeting?: { hour: string; name: string };
  role?: "delivery" | "salao" | null;
  rightSlot?: React.ReactNode;
  backHref?: string;
};

const ROLE_LABEL: Record<NonNullable<Props["role"]>, string> = {
  delivery: "Delivery",
  salao: "Salão",
};

export function TopBar({
  title,
  subtitle,
  greeting,
  role,
  rightSlot,
  backHref,
}: Props) {
  return (
    <div className="flex items-center gap-3 px-5 pt-5 pb-2 reveal d1">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Voltar"
          className="grid h-[38px] w-[38px] place-items-center rounded-xl bg-surface text-navy shadow-card hover:bg-line"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
      ) : (
        <Logo />
      )}

      <div className="flex-1 leading-tight min-w-0">
        {greeting ? (
          <>
            <small className="block text-xs font-medium text-muted">
              {greeting.hour},
            </small>
            <strong className="block truncate text-base font-bold">
              {greeting.name}
            </strong>
          </>
        ) : (
          <>
            <strong className="block truncate text-base font-bold">
              {title}
            </strong>
            {subtitle && (
              <small className="block text-xs text-muted truncate">
                {subtitle}
              </small>
            )}
          </>
        )}
      </div>

      {role && (
        <span className="rounded-full bg-navy px-3 py-[5px] text-[11px] font-bold text-white">
          {ROLE_LABEL[role]}
        </span>
      )}

      {rightSlot}
    </div>
  );
}
