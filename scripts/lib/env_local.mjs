import fs from "node:fs";

/**
 * Lê o .env.local do projeto. O arquivo veio do `vercel env pull` e traz
 * `\n` LITERAIS no meio dos valores — por isso não dá pra usar dotenv puro.
 */
export function lerEnvLocal(caminho = new URL("../../.env.local", import.meta.url).pathname) {
  const bruto = fs.readFileSync(caminho, "utf8");
  return (chave) => {
    const m = bruto.match(new RegExp("^" + chave + "=(.*)$", "m"));
    if (!m) return undefined;
    return m[1].trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "").trim();
  };
}
