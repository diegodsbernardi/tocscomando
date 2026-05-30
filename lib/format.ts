export function brl(n: number | string | null | undefined): string {
  const v = Number(n) || 0;
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function brlSplit(n: number | string | null | undefined) {
  const v = Number(n) || 0;
  const fixed = v.toFixed(2);
  const [int, cents] = fixed.split(".");
  const formattedInt = "R$ " + int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return { int: formattedInt, cents: "," + cents };
}

export function greetingForNow(now = new Date()): string {
  const h = now.getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function firstName(full: string | null | undefined): string {
  if (!full) return "";
  const at = full.indexOf("@");
  const base = at > 0 ? full.slice(0, at) : full;
  const first = base.trim().split(/[.\s_]+/)[0] || "";
  return first.charAt(0).toUpperCase() + first.slice(1);
}
