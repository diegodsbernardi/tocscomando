import { redirect } from "next/navigation";

export default function FuncionariosLegacyRedirect() {
  redirect("/cadastros?tab=func");
}
