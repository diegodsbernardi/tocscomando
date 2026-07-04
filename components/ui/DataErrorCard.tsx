/**
 * Aviso padrão quando uma query falha — pra tela não fingir que "não tem dados".
 */
export function DataErrorCard() {
  return (
    <p className="rounded-card bg-warn-bg p-4 text-center text-sm font-semibold text-warn shadow-card">
      ⚠ Não consegui carregar os dados — verifica a internet e tenta de novo.
    </p>
  );
}
