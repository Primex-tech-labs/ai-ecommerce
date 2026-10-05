import {
  Asset,
  Horizon,
  Memo,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type { StellarConfig } from "./config";
import type { PaymentIntent, SubmittedTransaction, UnsignedTransaction } from "./types";

function horizon(config: StellarConfig): Horizon.Server {
  return new Horizon.Server(config.horizonUrl, {
    allowHttp: config.horizonUrl.startsWith("http://"),
  });
}

function toAsset(intent: PaymentIntent): Asset {
  return intent.asset.kind === "native"
    ? Asset.native()
    : new Asset(intent.asset.code, intent.asset.issuer);
}

export async function buildPaymentTransaction(
  config: StellarConfig,
  intent: PaymentIntent,
): Promise<UnsignedTransaction> {
  const server = horizon(config);
  const account = await server.loadAccount(intent.source);
  const builder = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      Operation.payment({
        destination: intent.destination,
        asset: toAsset(intent),
        amount: intent.amount,
      }),
    )
    .setTimeout(180);

  if (intent.memo) {
    builder.addMemo(Memo.text(intent.memo));
  }

  return { xdr: builder.build().toXDR(), networkPassphrase: config.networkPassphrase };
}

export async function submitPaymentTransaction(
  config: StellarConfig,
  signedXdr: string,
): Promise<SubmittedTransaction> {
  const server = horizon(config);
  const transaction = TransactionBuilder.fromXDR(signedXdr, config.networkPassphrase);
  const result = await server.submitTransaction(
    transaction as Parameters<Horizon.Server["submitTransaction"]>[0],
  );
  return {
    hash: result.hash,
    status: result.successful ? "SUCCESS" : "FAILED",
    ledger: result.ledger,
  };
}
