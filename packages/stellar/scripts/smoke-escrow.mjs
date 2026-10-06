import {
  Account,
  Address,
  Asset,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";

const rpcUrl = process.env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
const networkPassphrase = process.env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
const friendbot = process.env.STELLAR_FRIENDBOT ?? "https://friendbot.stellar.org";
const contractId = process.env.ESCROW_CONTRACT_ID;

if (!contractId) {
  console.error("ESCROW_CONTRACT_ID is required");
  process.exit(1);
}

const server = new rpc.Server(rpcUrl, { allowHttp: rpcUrl.startsWith("http://") });
const contract = new Contract(contractId);
const nativeSac = new Address(Asset.native().contractId(networkPassphrase));
const tokenContract = new Contract(nativeSac.toString());
const amount = 10_000_000n;

async function fundViaFriendbot(address) {
  const response = await fetch(`${friendbot}?addr=${address}`);
  if (!response.ok) throw new Error(`friendbot failed for ${address}`);
}

async function tokenBalance(address) {
  const source = new Account(Keypair.random().publicKey(), "0");
  const transaction = new TransactionBuilder(source, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(tokenContract.call("balance", new Address(address).toScVal()))
    .setTimeout(30)
    .build();
  const simulation = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulation)) return null;
  return scValToNative(simulation.result.retval).toString();
}

async function invoke(method, args, signer) {
  const account = await server.getAccount(signer.publicKey());
  const built = new TransactionBuilder(account, { fee: "2000000", networkPassphrase })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  const prepared = await server.prepareTransaction(built);
  prepared.sign(signer);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`send error: ${JSON.stringify(sent.errorResult)}`);
  }
  const result = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (result.status !== "SUCCESS") {
    throw new Error(`tx ${sent.hash} status ${result.status}`);
  }
  return sent.hash;
}

async function main() {
  const buyer = Keypair.random();
  const seller = Keypair.random();
  console.log(JSON.stringify({ msg: "accounts", buyer: buyer.publicKey(), seller: seller.publicKey() }));
  await Promise.all([fundViaFriendbot(buyer.publicKey()), fundViaFriendbot(seller.publicKey())]);

  const orderId = `order${Date.now().toString(36)}`.slice(0, 32);
  const orderArg = nativeToScVal(orderId, { type: "symbol" });
  const buyerArg = new Address(buyer.publicKey()).toScVal();
  const sellerArg = new Address(seller.publicKey()).toScVal();
  const tokenArg = nativeSac.toScVal();
  const amountArg = nativeToScVal(amount, { type: "i128" });

  const sellerBefore = await tokenBalance(seller.publicKey());

  console.log(JSON.stringify({ msg: "create", hash: await invoke("create", [orderArg, buyerArg, sellerArg, tokenArg, amountArg], buyer) }));
  console.log(JSON.stringify({ msg: "fund", hash: await invoke("fund", [orderArg], buyer) }));
  console.log(JSON.stringify({ msg: "release", hash: await invoke("release", [orderArg], buyer) }));

  const sellerAfter = await tokenBalance(seller.publicKey());
  console.log(
    JSON.stringify({
      msg: "done",
      contractId,
      orderId,
      sellerBefore,
      sellerAfter,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
