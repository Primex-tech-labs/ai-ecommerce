import { buildCreateAndFundEscrow } from "@repo/stellar";
import { StrKey } from "@stellar/stellar-sdk";
import { NextResponse } from "next/server";
import { subtotalFromLines, type CartLineInput } from "@/lib/pricing";
import { getStellarConfig, toTokenAmount } from "@/lib/stellar";

interface CreateBody {
  orderId: string;
  buyer: string;
  lines: CartLineInput[];
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
    if (!body.buyer || !body.orderId || !Array.isArray(body.lines)) {
      return NextResponse.json(
        { error: "orderId, buyer and cart lines are required" },
        { status: 400 },
      );
    }
    if (!StrKey.isValidEd25519PublicKey(body.buyer)) {
      return NextResponse.json({ error: "buyer is not a valid Stellar account" }, { status: 400 });
    }

    const amount = subtotalFromLines(body.lines);
    const transaction = await buildCreateAndFundEscrow(config, {
      orderId: body.orderId,
      buyer: body.buyer,
      seller,
      token,
      amount: toTokenAmount(amount),
    });
    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
