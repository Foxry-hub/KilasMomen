import { redirect } from "next/navigation";

/** Akar aplikasi mengarah ke layar kios (§7.1). */
export default function RootPage() {
  redirect("/kiosk");
}
