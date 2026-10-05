export enum EscrowStatus {
  Created = "Created",
  Funded = "Funded",
  Released = "Released",
  Refunded = "Refunded",
}

export interface EscrowRecord {
  buyer: string;
  seller: string;
  token: string;
  amount: bigint;
  status: EscrowStatus;
}

export interface CreateEscrowParams {
  orderId: string;
  buyer: string;
  seller: string;
  token: string;
  amount: bigint;
}

export type AssetRef =
  | { kind: "native" }
  | { kind: "credit"; code: string; issuer: string };

export interface PaymentIntent {
  orderId: string;
  source: string;
  destination: string;
  amount: string;
  asset: AssetRef;
  memo?: string;
}

export interface UnsignedTransaction {
  xdr: string;
  networkPassphrase: string;
}

export interface SubmittedTransaction {
  hash: string;
  status: string;
  ledger?: number;
}

export interface ContractEventSummary {
  id: string;
  ledger: number;
  type: string;
  orderId?: string;
}
