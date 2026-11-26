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

// Order ids are used as on-chain contract symbols, so keep them constrained.
const ORDER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export async function POST(request: Request) {
  const config = getStellarConfig();
  const seller = process.env.STELLAR_MERCHANT_ADDRESS;
  const token = process.env.STELLAR_TOKEN_CONTRACT_ID;
  const arbiter = process.env.STELLAR_ARBITER_ADDRESS;

  if (!config.escrowContractId || !seller || !token || !arbiter) {
    return NextResponse.json(
      { error: "Stellar checkout is not configured" },
      { status: 503 },
    );
  }

  if (!StrKey.isValidEd25519PublicKey(arbiter)) {
    return NextResponse.json(
      { error: "STELLAR_ARBITER_ADDRESS is not a valid Stellar account" },
      { status: 503 },
    );
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (
    !body ||
    typeof body.orderId !== "string" ||
    !ORDER_ID_PATTERN.test(body.orderId) ||
    typeof body.buyer !== "string" ||
    !Array.isArray(body.lines)
  ) {
    return NextResponse.json(
      { error: "orderId, buyer and cart lines are required" },
      { status: 400 },
    );
  }

  if (!StrKey.isValidEd25519PublicKey(body.buyer)) {
    return NextResponse.json(
      { error: "buyer is not a valid Stellar account" },
      { status: 400 },
    );
  }

  // Recompute the total from the server-side catalog; never trust a client price.
  let amount: number;
  try {
    amount = subtotalFromLines(body.lines);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "cart total must be a positive integer amount" },
      { status: 400 },
    );
  }

  try {
    const transaction = await buildCreateAndFundEscrow(config, {
      orderId: body.orderId,
      buyer: body.buyer,
      seller,
      arbiter,
      token,
      amount: toTokenAmount(amount),
    });
    return NextResponse.json(transaction);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
