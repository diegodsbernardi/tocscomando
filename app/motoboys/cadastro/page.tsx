import { redirect } from "next/navigation";

export default function CadastroMotoboysLegacyRedirect() {
  redirect("/cadastros?tab=moto");
}
