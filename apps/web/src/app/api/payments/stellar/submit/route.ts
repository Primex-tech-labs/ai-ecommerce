import { submitSignedTransaction } from "@repo/stellar";
import { NextResponse } from "next/server";
import { getStellarConfig } from "@/lib/stellar";

interface SubmitBody {
  orderId: string;
  signedXdr: string;
}

export async function POST(request: Request) {
  const config = getStellarConfig();
  if (!config.escrowContractId) {
    return NextResponse.json({ error: "Stellar checkout is not configured" }, { status: 503 });
  }

  try {
    const body = (await request.json()) as SubmitBody;
    if (!body.signedXdr) {
      return NextResponse.json({ error: "signedXdr is required" }, { status: 400 });
    }
    const result = await submitSignedTransaction(config, body.signedXdr);
    return NextResponse.json({
      orderId: body.orderId,
      hash: result.hash,
      status: result.status,
      ledger: result.ledger,
      explorerUrl: `${config.explorerUrl}/tx/${result.hash}`,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}
