use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    token, Address, Env, Symbol,
};

fn setup(
    env: &Env,
) -> (
    Address,
    EscrowContractClient<'_>,
    Address,
    Address,
    Address,
    Address,
    Symbol,
) {
    let contract_id = env.register(EscrowContract, ());
    let client = EscrowContractClient::new(env, &contract_id);
    let buyer = Address::generate(env);
    let seller = Address::generate(env);
    let arbiter = Address::generate(env);
    let admin = Address::generate(env);
    let token_id = env.register_stellar_asset_contract_v2(admin).address();
    let order = Symbol::new(env, "order_1");
    (contract_id, client, buyer, seller, arbiter, token_id, order)
}

#[test]
fn create_fund_and_release() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, buyer, seller, arbiter, token_id, order) = setup(&env);
    let token_client = token::Client::new(&env, &token_id);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &arbiter, &token_id, &500);
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
    let (contract_id, client, buyer, seller, arbiter, token_id, order) = setup(&env);
    let token_client = token::Client::new(&env, &token_id);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &arbiter, &token_id, &250);
    client.fund(&order);
    client.refund(&order);
    assert_eq!(token_client.balance(&buyer), 1_000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn rejects_duplicate_and_invalid_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (_contract_id, client, buyer, seller, arbiter, token_id, order) = setup(&env);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    assert!(client
        .try_create(&order, &buyer, &seller, &arbiter, &token_id, &0)
        .is_err());
    client.create(&order, &buyer, &seller, &arbiter, &token_id, &100);
    assert!(client
        .try_create(&order, &buyer, &seller, &arbiter, &token_id, &100)
        .is_err());
}

#[test]
fn rejects_release_before_funding() {
    let env = Env::default();
    env.mock_all_auths();
    let (_contract_id, client, buyer, seller, arbiter, token_id, order) = setup(&env);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &arbiter, &token_id, &100);
    assert!(client.try_release(&order).is_err());
    assert!(client.try_fund(&order).is_ok());
    assert!(client.try_fund(&order).is_err());
}

#[test]
fn reads_escrow_state() {
    let env = Env::default();
    env.mock_all_auths();
    let (_contract_id, client, buyer, seller, arbiter, token_id, order) = setup(&env);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &arbiter, &token_id, &100);
    let escrow = client.get(&order);
    assert_eq!(escrow.amount, 100);
    assert_eq!(escrow.status, Status::Created);
    assert_eq!(escrow.arbiter, arbiter);
    assert!(client.try_get(&Symbol::new(&env, "missing")).is_err());
}

#[test]
fn create_requires_buyer_authorization() {
    let env = Env::default();
    let (_contract_id, client, buyer, seller, arbiter, token_id, order) = setup(&env);
    env.set_auths(&[]);

    assert!(client
        .try_create(&order, &buyer, &seller, &arbiter, &token_id, &100)
        .is_err());
}

#[test]
fn state_changes_require_authorization() {
    let env = Env::default();
    env.mock_all_auths();
    let (_contract_id, client, buyer, seller, arbiter, token_id, order) = setup(&env);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);
    client.create(&order, &buyer, &seller, &arbiter, &token_id, &100);
    client.fund(&order);

    env.set_auths(&[]);
    assert!(client.try_release(&order).is_err());
    assert!(client.try_refund(&order).is_err());
}

#[test]
fn emits_created_funded_and_released_events() {
    let env = Env::default();
    env.mock_all_auths();
    let (_contract_id, client, buyer, seller, arbiter, token_id, order) = setup(&env);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &arbiter, &token_id, &100);
    assert_eq!(env.events().all().events().len(), 1);

    client.fund(&order);
    assert_eq!(env.events().all().events().len(), 2);

    client.release(&order);
    assert_eq!(env.events().all().events().len(), 2);
}

#[test]
fn buyer_dispute_resolved_to_seller() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, buyer, seller, arbiter, token_id, order) = setup(&env);
    let token_client = token::Client::new(&env, &token_id);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &arbiter, &token_id, &400);
    client.fund(&order);
    client.dispute(&order, &buyer);
    assert_eq!(client.get(&order).status, Status::Disputed);

    client.resolve(&order, &arbiter, &true);
    assert_eq!(token_client.balance(&seller), 400);
    assert_eq!(token_client.balance(&contract_id), 0);
    assert_eq!(client.get(&order).status, Status::Released);
}

#[test]
fn seller_dispute_resolved_to_buyer() {
    let env = Env::default();
    env.mock_all_auths();
    let (contract_id, client, buyer, seller, arbiter, token_id, order) = setup(&env);
    let token_client = token::Client::new(&env, &token_id);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &arbiter, &token_id, &300);
    client.fund(&order);
    client.dispute(&order, &seller);

    client.resolve(&order, &arbiter, &false);
    assert_eq!(token_client.balance(&buyer), 1_000);
    assert_eq!(token_client.balance(&contract_id), 0);
    assert_eq!(client.get(&order).status, Status::Refunded);
}

#[test]
fn dispute_requires_party_and_funded_status() {
    let env = Env::default();
    env.mock_all_auths();
    let (_contract_id, client, buyer, seller, arbiter, token_id, order) = setup(&env);
    let stranger = Address::generate(&env);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &arbiter, &token_id, &100);
    // Not funded yet.
    assert!(client.try_dispute(&order, &buyer).is_err());
    client.fund(&order);
    // Not a party to the order.
    assert!(client.try_dispute(&order, &stranger).is_err());
}

#[test]
fn resolve_requires_configured_arbiter() {
    let env = Env::default();
    env.mock_all_auths();
    let (_contract_id, client, buyer, seller, arbiter, token_id, order) = setup(&env);
    let intruder = Address::generate(&env);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &arbiter, &token_id, &100);
    client.fund(&order);
    client.dispute(&order, &buyer);

    assert!(client.try_resolve(&order, &intruder, &true).is_err());
    assert_eq!(client.get(&order).status, Status::Disputed);
}

#[test]
fn rejects_duplicate_resolution() {
    let env = Env::default();
    env.mock_all_auths();
    let (_contract_id, client, buyer, seller, arbiter, token_id, order) = setup(&env);
    token::StellarAssetClient::new(&env, &token_id).mint(&buyer, &1_000);

    client.create(&order, &buyer, &seller, &arbiter, &token_id, &100);
    client.fund(&order);
    client.dispute(&order, &buyer);
    client.resolve(&order, &arbiter, &true);

    // Second resolution is rejected because the order is no longer disputed.
    assert!(client.try_resolve(&order, &arbiter, &false).is_err());
}
