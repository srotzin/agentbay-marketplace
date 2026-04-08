use serde::{Deserialize, Serialize};
use serde_json::Value;

// ─────────────────────────────────────────
// MCP protocol types
// ─────────────────────────────────────────

/// A JSON-RPC 2.0 request for the MCP protocol.
#[derive(Debug, Serialize)]
pub struct McpRequest {
    pub jsonrpc: &'static str,
    pub id: u64,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

/// A JSON-RPC 2.0 response from the MCP protocol.
#[derive(Debug, Deserialize)]
pub struct McpResponse {
    pub jsonrpc: String,
    pub id: u64,
    pub result: Option<Value>,
    pub error: Option<McpError>,
}

/// A JSON-RPC error object returned by the MCP gateway.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct McpError {
    pub code: i64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

// ─────────────────────────────────────────
// Tool registry types
// ─────────────────────────────────────────

/// Describes a single HiveAgent tool from the registry manifest.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Tool {
    pub name: String,
    pub description: String,
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_schema: Option<Value>,
    pub cost_usd: f64,
    pub data_retained: bool,
    pub on_chain: bool,
    pub sandbox: bool,
}

/// A ranked match returned by the `discover` / `hiveagent_discover` tool.
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ToolMatch {
    pub tool: Tool,
    pub score: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<String>,
}

// ─────────────────────────────────────────
// Payment types
// ─────────────────────────────────────────

/// Input for sending a USDC payment on Base L2.
#[derive(Debug, Serialize)]
pub struct PaymentRequest {
    /// Recipient address (EVM-compatible, Base L2).
    pub to: String,
    /// Amount in USDC (e.g. 25.0).
    pub amount_usdc: f64,
    /// Optional human-readable memo.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub memo: Option<String>,
}

/// Result after a payment is submitted on-chain.
#[derive(Debug, Deserialize, Serialize)]
pub struct PaymentResult {
    pub tx_hash: String,
    pub status: String,
    pub gas_used_usdc: f64,
    pub fee_usdc: f64,
    pub explorer_url: String,
}

// ─────────────────────────────────────────
// ZK proof types
// ─────────────────────────────────────────

/// Input for generating a ZK proof. Witness data is never stored by HiveAgent.
#[derive(Debug, Serialize)]
pub struct ZkProofRequest {
    /// The type of claim to prove (e.g. "age_over_18", "kyc_verified").
    pub claim_type: String,
    /// Private witness data — processed client-side, never transmitted as plaintext.
    pub witness: Value,
}

/// Result after a ZK proof is generated.
#[derive(Debug, Deserialize, Serialize)]
pub struct ZkProofResult {
    pub proof_id: String,
    pub proof_data: String,
    pub public_inputs: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub on_chain_hash: Option<String>,
}

// ─────────────────────────────────────────
// Insurance types
// ─────────────────────────────────────────

/// Input for filing a parametric insurance claim.
#[derive(Debug, Serialize)]
pub struct InsuranceClaimRequest {
    pub policy_id: String,
    pub event_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence: Option<Value>,
}

/// Result after a claim is filed.
#[derive(Debug, Deserialize, Serialize)]
pub struct InsuranceClaim {
    pub claim_id: String,
    pub status: String,
    pub policy_id: String,
    pub filed_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub oracle_url: Option<String>,
}

// ─────────────────────────────────────────
// Escrow types
// ─────────────────────────────────────────

/// Input for creating a smart contract escrow on Base L2.
#[derive(Debug, Serialize)]
pub struct EscrowRequest {
    pub buyer: String,
    pub seller: String,
    pub amount_usdc: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub conditions: Option<String>,
}

/// Result after an escrow is created.
#[derive(Debug, Deserialize, Serialize)]
pub struct Escrow {
    pub escrow_id: String,
    pub contract_address: String,
    pub status: String,
    pub amount_usdc: f64,
    pub tx_hash: String,
}
