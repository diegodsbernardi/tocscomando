import { redirect } from "next/navigation";

export default function BairrosLegacyRedirect() {
  redirect("/cadastros?tab=bairro");
}
