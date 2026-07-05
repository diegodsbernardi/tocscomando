import { NextResponse } from "next/server";
import { todayISO } from "@/lib/dates";
import { createHash } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `Você é um assistente que lê fotos de cupons/relatórios da máquina de cartão Safrapay.

Sua tarefa: extrair os totais por forma de pagamento e a data/hora do relatório.

Campos a extrair:
- credito (vendas no crédito)
- debito (vendas no débito)
- pix (vendas no PIX)
- data_hora (a data e hora impressa no relatório, no formato exato como aparece — ex: "08/04/2026 14:35" ou "08/04/26 14:35:22")

Regras IMPORTANTES:
1. Retorne APENAS um objeto JSON válido, sem texto antes ou depois, sem markdown, sem code fences.
2. Os valores monetários devem ser números (não strings), em reais, com ponto como separador decimal.
3. Se um tipo não aparecer no relatório, retorne 0 para ele.
4. Se o relatório listar vários itens, some os valores do mesmo tipo.
5. Não invente valores. Se não conseguir ler com certeza, retorne 0 para o campo em dúvida.
6. Para data_hora, retorne a string EXATA como aparece no cupom (não converta formato). Se não houver data legível, retorne string vazia "".

Formato exato da resposta:
{"credito": 0.00, "debito": 0.00, "pix": 0.00, "data_hora": ""}`;

type Extracted = {
  credito: number;
  debito: number;
  pix: number;
  data_hora: string;
};

function parseResponse(text: string): Extracted {
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta da IA sem JSON");

  const data = JSON.parse(match[0]);
  return {
    credito: Number(data.credito) || 0,
    debito: Number(data.debito) || 0,
    pix: Number(data.pix) || 0,
    data_hora: typeof data.data_hora === "string" ? data.data_hora.trim() : "",
  };
}

function computeSignature(
  userId: string,
  e: Extracted,
  fallbackDate: string,
): string {
  // Se o cupom tem data/hora legível, usamos como chave principal.
  // Caso contrário, fallback é a data do dia (mesmo cupom no mesmo dia = duplicado).
  const key = e.data_hora && e.data_hora.length > 0 ? e.data_hora : fallbackDate;
  const raw = `${userId}|${key}|${e.credito.toFixed(2)}|${e.debito.toFixed(2)}|${e.pix.toFixed(2)}`;
  return createHash("sha256").update(raw).digest("hex");
}

export async function POST(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const formData = await req.formData();
  const image = formData.get("image");
  if (!(image instanceof File)) {
    return NextResponse.json({ error: "Imagem não enviada" }, { status: 400 });
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mediaType = (image.type || "image/jpeg") as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: "text",
              text: "Extraia os totais de crédito, débito, pix e a data/hora deste relatório Safrapay.",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Resposta vazia da IA");
    }

    const extracted = parseResponse(textBlock.text);
    const today = todayISO();
    const signature = computeSignature(user.id, extracted, today);

    // Verifica duplicata antes de devolver pro client
    const { data: existing } = await supabase
      .from("reports")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("signature", signature)
      .maybeSingle();

    return NextResponse.json({
      ...extracted,
      signature,
      duplicate: existing
        ? { id: existing.id, created_at: existing.created_at }
        : null,
    });
  } catch (err) {
    console.error("[extract] erro:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Falha ao processar imagem",
      },
      { status: 500 },
    );
  }
}
