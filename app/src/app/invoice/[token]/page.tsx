import InvoiceClient from "./InvoiceClient";

export const instant = false;

export default async function PublicInvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvoiceClient token={token} />;
}
