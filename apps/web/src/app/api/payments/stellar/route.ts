import { buildCreateAndFundEscrow } from "@repo/stellar";
import { NextResponse } from "next/server";
import { getStellarConfig, toTokenAmount } from "@/lib/stellar";

interface CreateBody {
  orderId: string;
  buyer: string;
  amount: number;
}

export async function POST(request: Request) {
  const config = getStellarConfig();
  const seller = process.env.STELLAR_MERCHANT_ADDRESS;
  const token = process.env.STELLAR_TOKEN_CONTRACT_ID;

  if (!config.escrowContractId || !seller || !token) {
    return NextResponse.json(
      { error: "Stellar checkout is not configured" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as CreateBody;
    if (!body.buyer || !body.orderId || !body.amount) {
      return NextResponse.json({ error: "orderId, buyer and amount are required" }, { status: 400 });
    }
    const transaction = await buildCreateAndFundEscrow(config, {
      orderId: body.orderId,
      buyer: body.buyer,
      seller,
      token,
      amount: toTokenAmount(body.amount),
    });
    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
