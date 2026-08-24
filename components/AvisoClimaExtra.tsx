import { conselhoPara, getPrevisao } from "@/lib/previsao";
import { todayISO } from "@/lib/dates";

/**
 * Aviso curto na hora de lançar freela: o clima de hoje justifica o reforço?
 * Só aparece quando tem o que dizer — dia ameno não vira ruído na tela.
 */
export async function AvisoClimaExtra() {
  const previsao = await getPrevisao(1);
  const hoje = previsao?.find((d) => d.data === todayISO()) ?? previsao?.[0];
  if (!hoje) return null;

  const c = conselhoPara(hoje);
  if (c.tom === "normal") return null;

  const alerta = c.tom === "frio" || c.tom === "chuva";

  return (
    <div
      className={`mx-4 mt-3 flex items-start gap-3 rounded-card p-3 px-4 ${
        alerta ? "bg-warn-bg" : "bg-ok-bg"
      }`}
    >
      <span className="text-lg leading-none">{c.icone}</span>
      <div>
        <div className={`text-[12px] font-extrabold ${alerta ? "text-warn" : "text-ok"}`}>
          {c.titulo}
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-navy">{c.salao}</p>
      </div>
    </div>
  );
}
