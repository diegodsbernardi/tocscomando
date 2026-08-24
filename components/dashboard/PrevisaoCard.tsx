import { conselhoPara, getPrevisao, type DiaPrevisto } from "@/lib/previsao";
import { todayISO } from "@/lib/dates";

const TOM_CLASSES: Record<string, { fundo: string; texto: string }> = {
  frio: { fundo: "bg-warn-bg", texto: "text-warn" },
  chuva: { fundo: "bg-warn-bg", texto: "text-warn" },
  quente: { fundo: "bg-ok-bg", texto: "text-ok" },
  normal: { fundo: "bg-surface", texto: "text-muted" },
};

function rotulo(iso: string, hoje: string): string {
  if (iso === hoje) return "Hoje";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const amanha = new Date(`${hoje}T12:00:00`);
  amanha.setDate(amanha.getDate() + 1);
  if (dt.toDateString() === amanha.toDateString()) return "Amanhã";
  return dt.toLocaleDateString("pt-BR", { weekday: "short" });
}

export async function PrevisaoCard() {
  const previsao = await getPrevisao(3);
  if (!previsao || previsao.length === 0) return null;

  const hoje = todayISO();
  // O card serve pra decidir escala: o que interessa é amanhã em diante,
  // mas hoje fica junto porque o freela ainda pode ser cancelado.
  const dias: DiaPrevisto[] = previsao.slice(0, 3);
  const destaque = conselhoPara(dias[1] ?? dias[0]);
  const diaDestaque = dias[1] ?? dias[0];
  const cls = TOM_CLASSES[destaque.tom] ?? TOM_CLASSES.normal;

  return (
    <section className="reveal d5 mx-4 mt-4 overflow-hidden rounded-card bg-white shadow-card">
      <div className="flex items-center justify-between px-[18px] pt-4">
        <strong className="text-sm font-bold">Tempo em Chapecó</strong>
        <span className="text-[11px] font-semibold text-muted">escala do salão</span>
      </div>

      <div className="mt-3 flex gap-2 px-[18px]">
        {dias.map((d) => {
          const c = conselhoPara(d);
          return (
            <div key={d.data} className="flex-1 rounded-xl border-[1.5px] border-line p-2 text-center">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">
                {rotulo(d.data, hoje)}
              </div>
              <div className="mt-1 text-xl leading-none">{c.icone}</div>
              <div className="mt-1 font-display text-[15px] font-bold tabular-nums text-navy">
                {d.tmax.toFixed(0)}°
                <span className="ml-1 text-[11px] font-semibold text-muted">
                  {d.tmin.toFixed(0)}°
                </span>
              </div>
              <div className="mt-0.5 text-[10px] font-semibold text-muted">
                {d.chuva > 0 ? `${d.chuva.toFixed(0)}mm` : `${d.chanceChuva}%`}
              </div>
            </div>
          );
        })}
      </div>

      <div className={`mt-3 px-[18px] py-3 ${cls.fundo}`}>
        <div className={`text-[12px] font-extrabold ${cls.texto}`}>
          {rotulo(diaDestaque.data, hoje)}: {destaque.titulo}
        </div>
        <ul className="mt-1.5 space-y-1">
          <li className="text-[12px] leading-snug text-navy">
            <span className="font-bold">Salão:</span> {destaque.salao}
          </li>
          <li className="text-[12px] leading-snug text-navy">
            <span className="font-bold">Delivery:</span> {destaque.delivery}
          </li>
        </ul>
      </div>
    </section>
  );
}
