/**
 * Previsão do tempo de Chapecó aplicada à escala.
 *
 * A leitura vem de 561 dias de venda cruzados com o histórico climático
 * (ERA5/Open-Meteo). O que ficou medido:
 *   - Salão (49897): +R$ 95 por °C na máxima, −R$ 29 por mm de chuva.
 *     Dia de máxima abaixo de 18 °C rende R$ 2.560 contra R$ 3.977 num dia
 *     normal — 36% a menos.
 *   - Delivery (49895): correlação ZERO com temperatura e com chuva. No frio
 *     a demanda não some, ela troca de canal.
 * Por isso a recomendação é sempre separada por loja, e nunca manda cortar
 * moto por causa de frio.
 */

const LAT = -27.1009;
const LON = -52.6155;

/** Abaixo disso o salão cai forte (medido: −36%). */
export const FRIO_LIMITE = 18;
/** Acima disso o salão anda bem. */
export const CALOR_BOM = 25;
/** Chuva do dia que já derruba o movimento (medido: −14% num temporal). */
export const CHUVA_ALTA = 20;
export const CHUVA_MEDIA = 5;

export type DiaPrevisto = {
  data: string; // YYYY-MM-DD
  tmax: number;
  tmin: number;
  chuva: number; // mm
  chanceChuva: number; // %
  codigo: number; // WMO
};

export type Conselho = {
  tom: "frio" | "quente" | "chuva" | "normal";
  icone: string;
  titulo: string;
  salao: string;
  delivery: string;
};

/** Ícone a partir do código WMO — o suficiente pra cabeça de quem escala. */
export function iconeTempo(codigo: number, chuva: number): string {
  if (chuva >= CHUVA_ALTA) return "⛈️";
  if (codigo >= 95) return "⛈️";
  if (codigo >= 80) return "🌧️";
  if (codigo >= 71) return "🌨️";
  if (codigo >= 61) return "🌧️";
  if (codigo >= 51) return "🌦️";
  if (codigo >= 45) return "🌫️";
  if (codigo >= 2) return "⛅";
  return "☀️";
}

export function conselhoPara(d: DiaPrevisto): Conselho {
  const icone = iconeTempo(d.codigo, d.chuva);

  if (d.chuva >= CHUVA_ALTA) {
    return {
      tom: "chuva",
      icone,
      titulo: `Temporal — ${d.chuva.toFixed(0)}mm`,
      salao: "Salão esvazia. Escala mínima, sem freela.",
      delivery: "Delivery segura o dia. Mantenha as motos.",
    };
  }

  if (d.tmax < FRIO_LIMITE) {
    return {
      tom: "frio",
      icone,
      titulo: `Frio — máxima de ${d.tmax.toFixed(0)}°C`,
      salao: "Dia de salão fraco (−36% na média). Não chame freela.",
      delivery: "Delivery não cai no frio. Não corte moto.",
    };
  }

  if (d.chuva >= CHUVA_MEDIA) {
    return {
      tom: "chuva",
      icone,
      titulo: `Chuva — ${d.chuva.toFixed(0)}mm`,
      salao: "Salão um pouco abaixo do normal. Segure o reforço.",
      delivery: "Pedido migra pro delivery. Moto normal ou a mais.",
    };
  }

  if (d.tmax >= CALOR_BOM) {
    return {
      tom: "quente",
      icone,
      titulo: `Bom para salão — ${d.tmax.toFixed(0)}°C`,
      salao: "Dia forte de salão (+7% na média). Reforço se justifica.",
      delivery: "Delivery normal.",
    };
  }

  return {
    tom: "normal",
    icone,
    titulo: `Ameno — ${d.tmax.toFixed(0)}°C`,
    salao: "Dia normal de salão.",
    delivery: "Delivery normal.",
  };
}

/**
 * Busca a previsão de Chapecó. Revalida a cada 3h — previsão diária não muda
 * mais rápido que isso e evita bater na API a cada carregamento da home.
 * Devolve null se a API falhar; a home simplesmente não mostra o card.
 */
export async function getPrevisao(dias = 3): Promise<DiaPrevisto[] | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code` +
    `&timezone=America%2FSao_Paulo&forecast_days=${dias}`;

  try {
    const res = await fetch(url, { next: { revalidate: 10800 } });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      daily?: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        precipitation_probability_max: number[];
        weather_code: number[];
      };
    };
    const d = j.daily;
    if (!d?.time?.length) return null;
    return d.time.map((data, i) => ({
      data,
      tmax: Number(d.temperature_2m_max[i]),
      tmin: Number(d.temperature_2m_min[i]),
      chuva: Number(d.precipitation_sum[i]) || 0,
      chanceChuva: Number(d.precipitation_probability_max[i]) || 0,
      codigo: Number(d.weather_code[i]) || 0,
    }));
  } catch {
    return null;
  }
}
