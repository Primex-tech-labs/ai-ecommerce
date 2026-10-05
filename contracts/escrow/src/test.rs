use super::*;
use soroban_sdk::{testutils::Address as _, token, Address, Env, Symbol};

fn setup(
    env: &Env,
) -> (
    Address,
    EscrowContractClient<'_>,
    Address,
    Address,
    Address,
    Symbol,
) {
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(env, &contract_id);
    let buyer = Address::generate(env);
    let seller = Address::generate(env);
    let admin = Address::generate(env);
    let token_id = env.register_stellar_asset_contract_v2(admin).address();
    let order = Symbol::new(env, "order_1");
    (contract_id, client, buyer, seller, token_id, order)
}

#[test]
fn create_fund_and_release() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, buyer, seller, token_id, order) = setup(&env);
    let token_client = token::Client::new(&env, &token_id);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &token_id, &500);
    client.fund(&order);
    assert_eq!(token_client.balance(&contract_id), 500);

    client.release(&order);
    assert_eq!(token_client.balance(&seller), 500);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn refund_returns_funds_to_buyer() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, buyer, seller, token_id, order) = setup(&env);
    let token_client = token::Client::new(&env, &token_id);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &token_id, &250);
    client.fund(&order);
    client.refund(&order);
    assert_eq!(token_client.balance(&buyer), 1_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn rejects_duplicate_and_invalid_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (_contract_id, client, buyer, seller, token_id, order) = setup(&env);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    assert!(client
        .try_create(&order, &buyer, &seller, &token_id, &0)
        .is_err());
    client.create(&order, &buyer, &seller, &token_id, &100);
    assert!(client
        .try_create(&order, &buyer, &seller, &token_id, &100)
        .is_err());
}

#[test]
fn rejects_release_before_funding() {
    let env = Env::default();
    env.mock_all_auths();
    let (_contract_id, client, buyer, seller, token_id, order) = setup(&env);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &token_id, &100);
    assert!(client.try_release(&order).is_err());
    assert!(client.try_fund(&order).is_ok());
    assert!(client.try_fund(&order).is_err());
}

#[test]
fn reads_escrow_state() {
    let env = Env::default();
    env.mock_all_auths();
    let (_contract_id, client, buyer, seller, token_id, order) = setup(&env);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &token_id, &100);
    let escrow = client.get(&order);
    assert_eq!(escrow.amount, 100);
    assert_eq!(escrow.status, Status::Created);
    assert!(client.try_get(&Symbol::new(&env, "missing")).is_err());
}
