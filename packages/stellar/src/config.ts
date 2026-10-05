import { Networks } from "@stellar/stellar-sdk";

export type StellarNetwork = "local" | "testnet" | "futurenet" | "mainnet";

export interface StellarNetworkConfig {
  name: StellarNetwork;
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
}

export interface StellarConfig extends StellarNetworkConfig {
  escrowContractId: string;
  explorerUrl: string;
}

export const NETWORKS: Record<StellarNetwork, StellarNetworkConfig> = {
  local: {
    name: "local",
    rpcUrl: "http://localhost:8000/soroban/rpc",
    horizonUrl: "http://localhost:8000",
    networkPassphrase: "Standalone Network ; February 2017",
  },
  testnet: {
    name: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
  },
  futurenet: {
    name: "futurenet",
    rpcUrl: "https://rpc-futurenet.stellar.org",
    horizonUrl: "https://horizon-futurenet.stellar.org",
    networkPassphrase: Networks.FUTURENET,
  },
  mainnet: {
    name: "mainnet",
    rpcUrl: "https://mainnet.sorobanrpc.com",
    horizonUrl: "https://horizon.stellar.org",
    networkPassphrase: Networks.PUBLIC,
  },
};

const EXPLORERS: Record<StellarNetwork, string> = {
  local: "http://localhost:8000",
  testnet: "https://stellar.expert/explorer/testnet",
  futurenet: "https://stellar.expert/explorer/futurenet",
  mainnet: "https://stellar.expert/explorer/public",
};

export interface StellarEnv {
  STELLAR_NETWORK?: string;
  STELLAR_RPC_URL?: string;
  STELLAR_HORIZON_URL?: string;
  STELLAR_NETWORK_PASSPHRASE?: string;
  ESCROW_CONTRACT_ID?: string;
}

export function resolveConfig(env: StellarEnv): StellarConfig {
  const network = (env.STELLAR_NETWORK as StellarNetwork) ?? "testnet";
  const base = NETWORKS[network] ?? NETWORKS.testnet;
  return {
    ...base,
    rpcUrl: env.STELLAR_RPC_URL || base.rpcUrl,
    horizonUrl: env.STELLAR_HORIZON_URL || base.horizonUrl,
    networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE || base.networkPassphrase,
    escrowContractId: env.ESCROW_CONTRACT_ID ?? "",
    explorerUrl: EXPLORERS[network] ?? EXPLORERS.testnet,
  };
}

export function explorerTxUrl(config: Pick<StellarConfig, "explorerUrl">, hash: string): string {
  return `${config.explorerUrl}/tx/${hash}`;
}

export function explorerContractUrl(
  config: Pick<StellarConfig, "explorerUrl">,
  contractId: string,
): string {
  return `${config.explorerUrl}/contract/${contractId}`;
}
