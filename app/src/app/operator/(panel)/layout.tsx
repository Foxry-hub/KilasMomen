import { redirect } from "next/navigation";
import { isOperatorAuthenticated } from "@/lib/auth";
import { OperatorShell } from "@/components/operator/OperatorShell";

export default async function OperatorPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isOperatorAuthenticated())) redirect("/operator/login");
  return <OperatorShell>{children}</OperatorShell>;
}
