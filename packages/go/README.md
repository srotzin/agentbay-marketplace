# hiveagent-go

Official Go SDK for the [HiveAgent](https://hiveagentiq.com) MCP API — 835 tools across 40 verticals, including DeFi, escrow, ZK proofs, parametric insurance, payments, and AI models.

## Install

```sh
go get github.com/hiveagentiq/hiveagent-go
```

Requires Go 1.21+.

## Quickstart

```go
package main

import (
    "fmt"
    "log"

    "github.com/hiveagentiq/hiveagent-go"
)

func main() {
    client := hiveagent.New(
        hiveagent.WithAgentID("agent_your_id_here"),
    )

    result, err := client.CallTool("web_search", map[string]interface{}{
        "query": "latest AI agent news",
    })
    if err != nil {
        log.Fatal(err)
    }
    fmt.Println(string(result))
}
```

## Sandbox mode

All calls in sandbox mode are mocked and **always free**. Use this for development and testing.

```go
client := hiveagent.New(
    hiveagent.WithAgentID("agent_xxx"),
    hiveagent.WithSandbox(), // routes to sandbox endpoint, no charges
)
```

## Examples

### Natural language tool discovery

```go
matches, err := client.Discover("file a parametric insurance claim for flight delay")
if err != nil {
    log.Fatal(err)
}
for _, m := range matches {
    fmt.Printf("%.2f  %s — %s\n", m.Score, m.Tool.Name, m.Tool.Description)
}
```

### File an insurance claim

```go
claim, err := client.FileInsuranceClaim(hiveagent.InsuranceClaimRequest{
    PolicyID:  "pol_8f3a9c12",
    EventType: "flight_delay",
    Evidence: map[string]interface{}{
        "flight":       "AA1234",
        "delay_minutes": 180,
    },
})
if err != nil {
    log.Fatal(err)
}
fmt.Printf("Claim filed: %s (status: %s)\n", claim.ClaimID, claim.Status)
```

### Generate a ZK proof

```go
proof, err := client.GenerateZKProof(hiveagent.ZKProofRequest{
    ClaimType: "age_over_18",
    Witness: map[string]interface{}{
        "birthdate": "1995-03-15",
    },
})
if err != nil {
    log.Fatal(err)
}
// Witness data never leaves your machine — only the proof artifact is submitted.
fmt.Printf("Proof ID: %s\nOn-chain hash: %s\n", proof.ProofID, proof.OnChainHash)
```

### Send a USDC payment on Base L2

```go
payment, err := client.SendPayment(hiveagent.PaymentRequest{
    To:         "0xRecipientAddress",
    AmountUSDC: 25.00,
    Memo:       "Agent service payment",
})
if err != nil {
    log.Fatal(err)
}
fmt.Printf("Tx: %s\nExplorer: %s\n", payment.TxHash, payment.ExplorerURL)
```

### Create an escrow

```go
escrow, err := client.CreateEscrow(hiveagent.EscrowRequest{
    Buyer:      "0xBuyerAddress",
    Seller:     "0xSellerAddress",
    AmountUSDC: 500.00,
    Conditions: "Release on delivery confirmation",
})
if err != nil {
    log.Fatal(err)
}
fmt.Printf("Escrow: %s at %s\n", escrow.EscrowID, escrow.ContractAddr)
```

### Call any tool directly

The `CallTool` method gives you access to all 835 tools by name:

```go
result, err := client.CallTool("defi_swap", map[string]interface{}{
    "from_token": "USDC",
    "to_token":   "ETH",
    "amount":     100.0,
})
```

### List all available tools

```go
tools, err := client.ListTools()
if err != nil {
    log.Fatal(err)
}
for _, t := range tools {
    fmt.Printf("%-40s $%.4f  data_retained=%v\n", t.Name, t.CostUSD, t.DataRetained)
}
```

## Configuration options

| Option | Description |
|---|---|
| `WithAgentID(id string)` | Set your agent identifier (required for production) |
| `WithSandbox()` | Route all calls to the sandbox (free, mocked) |
| `WithEndpoint(url string)` | Override the MCP endpoint URL |
| `WithTimeout(d time.Duration)` | Set HTTP request timeout (default: 30s) |
| `WithHTTPClient(hc *http.Client)` | Provide a custom HTTP client |

## Error handling

```go
result, err := client.CallTool("web_search", args)
if err != nil {
    // Check for MCP-level errors
    if mcpErr, ok := err.(*hiveagent.MCPError); ok {
        fmt.Printf("MCP error %d: %s\n", mcpErr.Code, mcpErr.Message)
    }
    // Rate limit errors include guidance to upgrade
    log.Fatal(err)
}
```

## Pricing

- Discovery and list tools calls: **always free**
- Tool calls: see [hiveagentiq.com/pricing](https://hiveagentiq.com/pricing) for per-call fees
- Sandbox mode: **always free**

## Links

- [Documentation](https://hiveagentiq.com)
- [Tool registry](https://hiveagentiq.com/playground)
- [Pricing](https://hiveagentiq.com/pricing)
- [Trust & Security](https://hiveagentiq.com/trust)
- [Status](https://hiveagentiq.com/status)
- [GitHub](https://github.com/hiveagentiq/hiveagent-go)
- [Discord](https://discord.gg/hiveagent)

## License

MIT — see [LICENSE](./LICENSE).
