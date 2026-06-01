"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CloseDayFinishButton() {
  const router = useRouter();
  const [done, setDone] = useState(false);

  function finish() {
    if (done) return;
    setDone(true);
    // Por enquanto o "fechar o dia" é só marcar como concluído visualmente
    // e voltar pra home — todos os fechamentos individuais já foram feitos.
    setTimeout(() => router.push("/"), 800);
  }

  return (
    <button
      onClick={finish}
      disabled={done}
      className="flex-1 rounded-xl bg-brandyellow py-3.5 text-[15px] font-bold text-navy disabled:opacity-70"
    >
      {done ? "✓ Dia fechado" : "Concluir"}
    </button>
  );
}
