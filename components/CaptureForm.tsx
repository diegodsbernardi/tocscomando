"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compressImage";

type Extracted = {
  credito: number;
  debito: number;
  pix: number;
  data_hora: string;
  signature: string;
  duplicate: { id: string; created_at: string } | null;
};

type Step =
  | "capture"
  | "extracting"
  | "duplicate"
  | "confirm"
  | "saving"
  | "done";

export function CaptureForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("capture");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pickFile() {
    fileInputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setError(null);
    // Comprime a foto antes de upar — reduz tamanho e acelera a IA
    let f: File;
    try {
      f = await compressImage(raw);
    } catch {
      f = raw;
    }
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    await extract(f);
  }

  async function extract(f: File) {
    setStep("extracting");
    const fd = new FormData();
    fd.append("image", f);

    try {
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Falha ao extrair valores");
      }
      const data = (await res.json()) as Extracted;
      setExtracted(data);
      setStep(data.duplicate ? "duplicate" : "confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("capture");
    }
  }

  function updateField(field: "credito" | "debito" | "pix", value: string) {
    if (!extracted) return;
    const num = Number(value.replace(",", ".")) || 0;
    setExtracted({ ...extracted, [field]: num });
  }

  async function save() {
    if (!extracted || !file) return;
    setStep("saving");
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão expirada");

      // 1. Upload da foto
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("reports")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      // 2. Insert no banco
      const total = extracted.credito + extracted.debito + extracted.pix;
      const { error: insErr } = await supabase.from("reports").insert({
        user_id: user.id,
        credito: extracted.credito,
        debito: extracted.debito,
        pix: extracted.pix,
        total,
        image_path: path,
        data_hora_relatorio: extracted.data_hora || null,
        signature: extracted.signature,
      });
      if (insErr) {
        // Backstop: se a unique constraint disparar, tratamos como duplicata
        if (
          insErr.code === "23505" ||
          insErr.message?.toLowerCase().includes("duplicate")
        ) {
          setStep("duplicate");
          return;
        }
        throw insErr;
      }

      setStep("done");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
      setStep("confirm");
    }
  }

  function reset() {
    setStep("capture");
    setExtracted(null);
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />

      {step === "capture" && (
        <div className="space-y-4">
          <button
            onClick={pickFile}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-line bg-white py-14 text-muted transition hover:border-cyan hover:text-brand active:scale-[0.99]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
              />
            </svg>
            <span className="font-semibold">Tirar foto do relatório</span>
            <span className="text-xs text-muted">
              Aponte para o cupom da Safrapay
            </span>
          </button>
          {error && (
            <div
              role="alert"
              className="space-y-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger"
            >
              <p className="break-words">{error}</p>
              <Link
                href="/status"
                className="inline-block text-xs font-medium text-danger underline hover:text-red-900"
              >
                Ver status do sistema →
              </Link>
            </div>
          )}
        </div>
      )}

      {step === "extracting" && (
        <div className="space-y-4 rounded-2xl bg-white p-6 text-center shadow">
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Relatório"
              className="mx-auto max-h-64 rounded-lg object-contain"
            />
          )}
          <div className="flex items-center justify-center gap-2 text-muted">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
            <span>Lendo valores...</span>
          </div>
        </div>
      )}

      {step === "duplicate" && (
        <div
          role="alert"
          className="space-y-4 rounded-2xl border-2 border-red-200 bg-danger-bg p-5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wide text-danger">
                Relatório já cadastrado
              </p>
              <p className="text-xs text-danger">
                Esse cupom já foi enviado anteriormente.
              </p>
            </div>
          </div>

          {previewUrl && (
            <img
              src={previewUrl}
              alt="Relatório duplicado"
              className="mx-auto max-h-40 rounded-lg object-contain opacity-70"
            />
          )}

          {extracted && (
            <div className="rounded-lg bg-white/70 p-3 text-sm text-navy">
              <p className="mb-1 font-medium">Valores lidos:</p>
              <div className="flex justify-between tabular-nums">
                <span>Crédito {brl(extracted.credito)}</span>
                <span>Débito {brl(extracted.debito)}</span>
                <span>Pix {brl(extracted.pix)}</span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Link
              href="/historico"
              className="flex-1 rounded-lg border border-line bg-white py-3 text-center font-medium text-navy hover:bg-line"
            >
              Ver relatórios
            </Link>
            <button
              onClick={reset}
              className="flex-1 rounded-lg bg-danger py-3 font-semibold text-white hover:brightness-90"
            >
              Refazer
            </button>
          </div>
        </div>
      )}

      {step === "confirm" && extracted && (
        <div className="space-y-4 rounded-2xl bg-white p-5 shadow">
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Relatório"
              className="mx-auto max-h-48 rounded-lg object-contain"
            />
          )}
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Confirme os valores antes de salvar:
            </p>
            <Field
              label="Crédito"
              value={extracted.credito}
              onChange={(v) => updateField("credito", v)}
            />
            <Field
              label="Débito"
              value={extracted.debito}
              onChange={(v) => updateField("debito", v)}
            />
            <Field
              label="Pix"
              value={extracted.pix}
              onChange={(v) => updateField("pix", v)}
            />
            <div className="flex items-center justify-between border-t border-line pt-3">
              <span className="font-semibold text-navy">Total</span>
              <span className="text-lg font-bold tabular-nums text-cyan">
                {brl(extracted.credito + extracted.debito + extracted.pix)}
              </span>
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 rounded-lg border border-line py-3 font-medium text-navy hover:bg-line"
            >
              Refazer
            </button>
            <button
              onClick={save}
              className="flex-1 rounded-lg bg-cyan py-3 font-semibold text-white hover:bg-cyan-deep"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {step === "saving" && (
        <div className="rounded-2xl bg-white p-6 text-center shadow">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          <p className="mt-3 text-muted">Salvando...</p>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-4 rounded-2xl bg-white p-6 text-center shadow">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          </div>
          <p className="font-semibold text-navy">Relatório salvo!</p>
          <button
            onClick={reset}
            className="w-full rounded-lg bg-cyan py-3 font-semibold text-white hover:bg-cyan-deep"
          >
            Novo relatório
          </button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="font-medium text-navy">{label}</label>
      <div className="flex items-center gap-1">
        <span className="text-muted">R$</span>
        <input
          type="text"
          inputMode="decimal"
          value={value.toFixed(2).replace(".", ",")}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 rounded-lg border border-line px-3 py-2 text-right tabular-nums outline-none focus:border-cyan"
        />
      </div>
    </div>
  );
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
