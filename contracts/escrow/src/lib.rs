#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, Env, Symbol,
};

/// Persistent entries are bumped once they have less than ~7 days of TTL.
const TTL_THRESHOLD: u32 = 120_960;
/// Keep escrow state alive for roughly 30 days at 5s ledgers.
const TTL_EXTEND_TO: u32 = 518_400;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyExists = 1,
    NotFound = 2,
    InvalidStatus = 3,
    InvalidAmount = 4,
    NotArbiter = 5,
    NotParty = 6,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Status {
    Created,
    Funded,
    Disputed,
    Released,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    pub buyer: Address,
    pub seller: Address,
    /// Third party allowed to resolve a dispute. Cannot touch other orders.
    pub arbiter: Address,
    pub token: Address,
    pub amount: i128,
    pub status: Status,
}

#[contracttype]
pub enum DataKey {
    Escrow(Symbol),
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Created {
    #[topic]
    pub order_id: Symbol,
    pub buyer: Address,
    pub seller: Address,
    pub token: Address,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Funded {
    #[topic]
    pub order_id: Symbol,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Released {
    #[topic]
    pub order_id: Symbol,
    pub seller: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Refunded {
    #[topic]
    pub order_id: Symbol,
    pub buyer: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Disputed {
    #[topic]
    pub order_id: Symbol,
    pub initiator: Address,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn create(
        env: Env,
        order_id: Symbol,
        buyer: Address,
        seller: Address,
        arbiter: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), Error> {
        // The buyer authorizes the order, so nobody can squat another user's
        // predictable order id.
        buyer.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let key = DataKey::Escrow(order_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(Error::AlreadyExists);
        }
        let escrow = Escrow {
            buyer: buyer.clone(),
            seller: seller.clone(),
            arbiter,
            token: token.clone(),
            amount,
            status: Status::Created,
        };
        save(&env, &key, &escrow);
        Created {
            order_id: order_id.clone(),
            buyer,
            seller,
            token,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn fund(env: Env, order_id: Symbol) -> Result<(), Error> {
        let key = DataKey::Escrow(order_id.clone());
        let mut escrow = load(&env, &key)?;
        if escrow.status != Status::Created {
            return Err(Error::InvalidStatus);
        }
        escrow.buyer.require_auth();
        token::Client::new(&env, &escrow.token).transfer(
            &escrow.buyer,
            env.current_contract_address(),
            &escrow.amount,
        );
        escrow.status = Status::Funded;
        save(&env, &key, &escrow);
        Funded {
            order_id: order_id.clone(),
            amount: escrow.amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn release(env: Env, order_id: Symbol) -> Result<(), Error> {
        let key = DataKey::Escrow(order_id.clone());
        let mut escrow = load(&env, &key)?;
        if escrow.status != Status::Funded {
            return Err(Error::InvalidStatus);
        }
        escrow.buyer.require_auth();
        token::Client::new(&env, &escrow.token).transfer(
            &env.current_contract_address(),
            &escrow.seller,
            &escrow.amount,
        );
        escrow.status = Status::Released;
        save(&env, &key, &escrow);
        Released {
            order_id: order_id.clone(),
            seller: escrow.seller.clone(),
        }
        .publish(&env);
        Ok(())
    }

    pub fn refund(env: Env, order_id: Symbol) -> Result<(), Error> {
        let key = DataKey::Escrow(order_id.clone());
        let mut escrow = load(&env, &key)?;
        if escrow.status != Status::Funded {
            return Err(Error::InvalidStatus);
        }
        escrow.seller.require_auth();
        token::Client::new(&env, &escrow.token).transfer(
            &env.current_contract_address(),
            &escrow.buyer,
            &escrow.amount,
        );
        escrow.status = Status::Refunded;
        save(&env, &key, &escrow);
        Refunded {
            order_id: order_id.clone(),
            buyer: escrow.buyer.clone(),
        }
        .publish(&env);
        Ok(())
    }

    /// Open a dispute on a funded order. Only the buyer or seller may initiate.
    pub fn dispute(env: Env, order_id: Symbol, initiator: Address) -> Result<(), Error> {
        let key = DataKey::Escrow(order_id.clone());
        let mut escrow = load(&env, &key)?;
        if escrow.status != Status::Funded {
            return Err(Error::InvalidStatus);
        }
        if initiator != escrow.buyer && initiator != escrow.seller {
            return Err(Error::NotParty);
        }
        initiator.require_auth();
        escrow.status = Status::Disputed;
        save(&env, &key, &escrow);
        Disputed {
            order_id: order_id.clone(),
            initiator,
        }
        .publish(&env);
        Ok(())
    }

    /// Resolve a disputed order. Only the configured arbiter may resolve, and
    /// only while the order is disputed (prevents duplicate resolution).
    pub fn resolve(
        env: Env,
        order_id: Symbol,
        arbiter: Address,
        release_to_seller: bool,
    ) -> Result<(), Error> {
        let key = DataKey::Escrow(order_id.clone());
        let mut escrow = load(&env, &key)?;
        if escrow.status != Status::Disputed {
            return Err(Error::InvalidStatus);
        }
        if arbiter != escrow.arbiter {
            return Err(Error::NotArbiter);
        }
        arbiter.require_auth();

        let token_client = token::Client::new(&env, &escrow.token);
        if release_to_seller {
            token_client.transfer(
                &env.current_contract_address(),
                &escrow.seller,
                &escrow.amount,
            );
            escrow.status = Status::Released;
            save(&env, &key, &escrow);
            Released {
                order_id: order_id.clone(),
                seller: escrow.seller.clone(),
            }
            .publish(&env);
        } else {
            token_client.transfer(
                &env.current_contract_address(),
                &escrow.buyer,
                &escrow.amount,
            );
            escrow.status = Status::Refunded;
            save(&env, &key, &escrow);
            Refunded {
                order_id: order_id.clone(),
                buyer: escrow.buyer.clone(),
            }
            .publish(&env);
        }
        Ok(())
    }

    pub fn get(env: Env, order_id: Symbol) -> Result<Escrow, Error> {
        load(&env, &DataKey::Escrow(order_id))
    }
}

fn load(env: &Env, key: &DataKey) -> Result<Escrow, Error> {
    let escrow: Escrow = env.storage().persistent().get(key).ok_or(Error::NotFound)?;
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
    Ok(escrow)
}

fn save(env: &Env, key: &DataKey, escrow: &Escrow) {
    env.storage().persistent().set(key, escrow);
    env.storage()
        .persistent()
        .extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

#[cfg(test)]
mod test;
