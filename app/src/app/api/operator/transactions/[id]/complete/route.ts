import { fromService, requireOperator } from "@/lib/operator-api";
import { completeTransaction } from "@/lib/transaction-service";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const guard = await requireOperator();
  if (guard) return guard;

  const { id } = await ctx.params;
  return fromService(await completeTransaction(id));
}
