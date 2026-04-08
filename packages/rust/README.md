# hiveagent

Official Rust SDK for the [HiveAgent](https://hiveagentiq.com) MCP API — 835 tools across 40 verticals, including DeFi, escrow, ZK proofs, parametric insurance, payments, and AI models.

[![crates.io](https://img.shields.io/crates/v/hiveagent)](https://crates.io/crates/hiveagent)
[![docs.rs](https://docs.rs/hiveagent/badge.svg)](https://docs.rs/hiveagent)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## Install

```sh
cargo add hiveagent
```

Or add to `Cargo.toml`:

```toml
[dependencies]
hiveagent = "0.1"
tokio = { version = "1", features = ["full"] }
serde_json = "1"
```

## Quickstart

```rust
use hiveagent::HiveAgent;
use serde_json::json;

#[tokio::main]
async fn main() -> hiveagent::Result<()> {
    let client = HiveAgent::new("agent_your_id_here");

    let result = client
        .call_tool("web_search", json!({ "query": "latest AI news" }))
        .await?;

    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}
```

## Sandbox mode

Sandbox calls are **always free** and never execute real transactions. Use for development and CI.

```rust
let client = HiveAgent::sandbox("agent_dev");
// All calls return schema-valid mocked responses
```

## Examples

### Natural language tool discovery

```rust
let client = HiveAgent::sandbox("agent_dev");

let matches = client.discover("file a parametric insurance claim for flight delay").await?;
for m in &matches {
    println!("{:.2}  {}  — {}", m.score, m.tool.name, m.tool.description);
}
```

### File an insurance claim

```rust
use hiveagent::{HiveAgent, types::InsuranceClaimRequest};
use serde_json::json;

let client = HiveAgent::new("agent_xxx");

let claim = client
    .file_insurance_claim(InsuranceClaimRequest {
        policy_id: "pol_8f3a9c12".into(),
        event_type: "flight_delay".into(),
        evidence: Some(json!({
            "flight": "AA1234",
            "delay_minutes": 180,
        })),
    })
    .await?;

println!("Claim filed: {} (status: {})", claim.claim_id, claim.status);
```

### Generate a ZK proof

```rust
use hiveagent::{HiveAgent, types::ZkProofRequest};
use serde_json::json;

let client = HiveAgent::new("agent_xxx");

let proof = client
    .generate_zk_proof(ZkProofRequest {
        claim_type: "age_over_18".into(),
        // Witness is never stored by HiveAgent (data_retained: false)
        witness: json!({ "birthdate": "1995-03-15" }),
    })
    .await?;

println!("Proof ID: {}", proof.proof_id);
println!("On-chain hash: {}", proof.on_chain_hash.unwrap_or_default());
```

### Send a USDC payment on Base L2

```rust
use hiveagent::{HiveAgent, types::PaymentRequest};

let client = HiveAgent::new("agent_xxx");

let payment = client
    .send_payment(PaymentRequest {
        to: "0xRecipientAddress".into(),
        amount_usdc: 25.00,
        memo: Some("Agent service payment".into()),
    })
    .await?;

println!("Tx: {}", payment.tx_hash);
println!("Explorer: {}", payment.explorer_url);
```

### Create an escrow

```rust
use hiveagent::{HiveAgent, types::EscrowRequest};

let client = HiveAgent::new("agent_xxx");

let escrow = client
    .create_escrow(EscrowRequest {
        buyer: "0xBuyerAddress".into(),
        seller: "0xSellerAddress".into(),
        amount_usdc: 500.00,
        conditions: Some("Release on delivery confirmation".into()),
    })
    .await?;

println!("Escrow: {} at {}", escrow.escrow_id, escrow.contract_address);
```

### Call any tool directly

All 835 tools are accessible via `call_tool`:

```rust
let result = client
    .call_tool("defi_swap", json!({
        "from_token": "USDC",
        "to_token": "ETH",
        "amount": 100.0,
    }))
    .await?;
```

### List all available tools

```rust
let tools = client.list_tools().await?;
for tool in &tools {
    println!("{:<40} ${:.4}  data_retained={}", tool.name, tool.cost_usd, tool.data_retained);
}
```

## Error handling

```rust
use hiveagent::{HiveAgent, Error};
use serde_json::json;

match client.call_tool("web_search", json!({ "query": "test" })).await {
    Ok(result) => println!("{result}"),
    Err(Error::Mcp { code, message }) => eprintln!("MCP {code}: {message}"),
    Err(Error::RateLimit { retry_after_secs }) => {
        eprintln!("Rate limited. Retry in {retry_after_secs}s");
    }
    Err(e) => eprintln!("Error: {e}"),
}
```

## API reference

### `HiveAgent::new(agent_id)` → `HiveAgent`
Create a client for the production endpoint.

### `HiveAgent::sandbox(agent_id)` → `HiveAgent`
Create a client in sandbox mode (free, mocked responses).

### `HiveAgent::with_custom_endpoint(agent_id, url)` → `HiveAgent`
Create a client with a custom MCP endpoint.

### `.call_tool(name, args)` → `Result<Value>`
Call any tool by name with JSON arguments.

### `.list_tools()` → `Result<Vec<Tool>>`
Return the full tool registry.

### `.discover(query)` → `Result<Vec<ToolMatch>>`
Natural language tool discovery — returns ranked matches.

### `.ping()` → `Result<()>`
Check gateway reachability.

### Typed helpers

| Method | Tool |
|---|---|
| `.send_payment(req)` | `payment_send_usdc` |
| `.generate_zk_proof(req)` | `zk_proof_generate` |
| `.file_insurance_claim(req)` | `insurance_claim_file` |
| `.create_escrow(req)` | `escrow_create` |

## Pricing

- Discovery and list tools: **always free**
- Per-call tool fees: see [hiveagentiq.com/pricing](https://hiveagentiq.com/pricing)
- Sandbox mode: **always free**

## Links

- [HiveAgent](https://hiveagentiq.com)
- [Playground](https://hiveagentiq.com/playground)
- [Pricing](https://hiveagentiq.com/pricing)
- [Trust & Security](https://hiveagentiq.com/trust)
- [Status](https://hiveagentiq.com/status)
- [GitHub](https://github.com/hiveagentiq/hiveagent-rust)
- [Discord](https://discord.gg/hiveagent)

## License

MIT — see [LICENSE](./LICENSE).
