use reqwest::Client as HttpClient;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};

use crate::{
    types::{
        Escrow, EscrowRequest, InsuranceClaim, InsuranceClaimRequest, McpRequest, McpResponse,
        PaymentRequest, PaymentResult, Tool, ToolMatch, ZkProofRequest, ZkProofResult,
    },
    Error, Result,
};

const DEFAULT_ENDPOINT: &str = "https://hiveagentiq.com/mcp";
const SANDBOX_ENDPOINT: &str = "https://hiveagentiq.com/mcp/sandbox";
const SDK_VERSION: &str = env!("CARGO_PKG_VERSION");

/// The HiveAgent MCP client.
///
/// Create one with [`HiveAgent::new`] or [`HiveAgent::sandbox`], then call tools
/// with [`call_tool`], [`discover`], or the typed helper methods.
///
/// # Example
///
/// ```rust,no_run
/// use hiveagent::HiveAgent;
/// use serde_json::json;
///
/// #[tokio::main]
/// async fn main() -> hiveagent::Result<()> {
///     let client = HiveAgent::new("agent_xxx");
///     let result = client.call_tool("web_search", json!({ "query": "AI agents" })).await?;
///     println!("{result}");
///     Ok(())
/// }
/// ```
#[derive(Debug, Clone)]
pub struct HiveAgent {
    endpoint: String,
    agent_id: String,
    sandbox: bool,
    http: HttpClient,
    req_id: std::sync::Arc<AtomicU64>,
}

impl HiveAgent {
    /// Create a new HiveAgent client targeting the production endpoint.
    ///
    /// `agent_id` is your registered agent identifier from https://hiveagentiq.com.
    pub fn new(agent_id: impl Into<String>) -> Self {
        Self::with_endpoint(agent_id, DEFAULT_ENDPOINT, false)
    }

    /// Create a client in sandbox mode — all calls are mocked and **always free**.
    ///
    /// Sandbox responses are schema-valid but do not execute real transactions.
    pub fn sandbox(agent_id: impl Into<String>) -> Self {
        Self::with_endpoint(agent_id, SANDBOX_ENDPOINT, true)
    }

    /// Create a client with a custom endpoint URL.
    pub fn with_custom_endpoint(agent_id: impl Into<String>, endpoint: impl Into<String>) -> Self {
        Self::with_endpoint(agent_id, endpoint.into(), false)
    }

    fn with_endpoint(agent_id: impl Into<String>, endpoint: impl Into<String>, sandbox: bool) -> Self {
        let http = HttpClient::builder()
            .user_agent(format!("hiveagent-rust/{SDK_VERSION}"))
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");

        HiveAgent {
            endpoint: endpoint.into(),
            agent_id: agent_id.into(),
            sandbox,
            http,
            req_id: std::sync::Arc::new(AtomicU64::new(1)),
        }
    }

    // ─────────────────────────────────────────
    // Core MCP methods
    // ─────────────────────────────────────────

    /// Call any HiveAgent tool by name with JSON arguments.
    ///
    /// Returns the raw `serde_json::Value` of the tool result.
    ///
    /// ```rust,no_run
    /// # use hiveagent::HiveAgent; use serde_json::json;
    /// # async fn ex() -> hiveagent::Result<()> {
    /// let client = HiveAgent::sandbox("agent_dev");
    /// let result = client.call_tool("web_search", json!({ "query": "Rust async" })).await?;
    /// # Ok(()) }
    /// ```
    pub async fn call_tool(&self, name: &str, args: Value) -> Result<Value> {
        let mut params = json!({
            "name": name,
            "arguments": args,
        });

        if !self.agent_id.is_empty() {
            params["agent_id"] = json!(self.agent_id);
        }
        if self.sandbox {
            params["sandbox"] = json!(true);
        }

        let resp = self.do_request("tools/call", Some(params)).await?;
        resp.result.ok_or_else(|| Error::Other("Empty result from tools/call".into()))
    }

    /// Return the full list of available tools from the HiveAgent registry.
    pub async fn list_tools(&self) -> Result<Vec<Tool>> {
        let resp = self.do_request("tools/list", None).await?;
        let raw = resp.result.ok_or_else(|| Error::Other("Empty result from tools/list".into()))?;

        #[derive(serde::Deserialize)]
        struct ToolsListResponse {
            tools: Vec<Tool>,
        }
        let parsed: ToolsListResponse = serde_json::from_value(raw)?;
        Ok(parsed.tools)
    }

    /// Perform natural language tool discovery.
    ///
    /// Returns ranked tool matches for the given query. Useful when your agent
    /// needs to find the right tool without knowing its exact name.
    ///
    /// ```rust,no_run
    /// # use hiveagent::HiveAgent;
    /// # async fn ex() -> hiveagent::Result<()> {
    /// let client = HiveAgent::sandbox("agent_dev");
    /// let matches = client.discover("file a parametric insurance claim").await?;
    /// for m in &matches {
    ///     println!("{:.2}  {} — {}", m.score, m.tool.name, m.tool.description);
    /// }
    /// # Ok(()) }
    /// ```
    pub async fn discover(&self, query: &str) -> Result<Vec<ToolMatch>> {
        let raw = self.call_tool("hiveagent_discover", json!({ "query": query })).await?;
        let matches: Vec<ToolMatch> = serde_json::from_value(raw)?;
        Ok(matches)
    }

    /// Check gateway reachability. Returns `Ok(())` on success.
    pub async fn ping(&self) -> Result<()> {
        self.call_tool("hiveagent_ping", json!({})).await.map(|_| ())
    }

    // ─────────────────────────────────────────
    // Typed helpers
    // ─────────────────────────────────────────

    /// Send USDC on Base L2.
    ///
    /// Fee: 0.1% of amount (min $0.001, max $5.00). Not available in sandbox.
    pub async fn send_payment(&self, req: PaymentRequest) -> Result<PaymentResult> {
        let raw = self.call_tool("payment_send_usdc", serde_json::to_value(req)?).await?;
        Ok(serde_json::from_value(raw)?)
    }

    /// Generate a ZK proof for a claim.
    ///
    /// Witness data is processed client-side — HiveAgent never stores your private inputs.
    /// `data_retained: false` is enforced at the protocol level.
    pub async fn generate_zk_proof(&self, req: ZkProofRequest) -> Result<ZkProofResult> {
        let raw = self.call_tool("zk_proof_generate", serde_json::to_value(req)?).await?;
        Ok(serde_json::from_value(raw)?)
    }

    /// File a parametric insurance claim.
    pub async fn file_insurance_claim(&self, req: InsuranceClaimRequest) -> Result<InsuranceClaim> {
        let raw = self.call_tool("insurance_claim_file", serde_json::to_value(req)?).await?;
        Ok(serde_json::from_value(raw)?)
    }

    /// Create a smart contract escrow on Base L2.
    pub async fn create_escrow(&self, req: EscrowRequest) -> Result<Escrow> {
        let raw = self.call_tool("escrow_create", serde_json::to_value(req)?).await?;
        Ok(serde_json::from_value(raw)?)
    }

    // ─────────────────────────────────────────
    // Internal HTTP
    // ─────────────────────────────────────────

    async fn do_request(&self, method: &str, params: Option<Value>) -> Result<McpResponse> {
        let id = self.req_id.fetch_add(1, Ordering::SeqCst);

        let body = McpRequest {
            jsonrpc: "2.0",
            id,
            method: method.to_owned(),
            params,
        };

        let http_resp = self
            .http
            .post(&self.endpoint)
            .header("X-Agent-ID", &self.agent_id)
            .json(&body)
            .send()
            .await?;

        let status = http_resp.status();

        if status.as_u16() == 429 {
            let retry_after = http_resp
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok())
                .unwrap_or(60);
            return Err(Error::RateLimit { retry_after_secs: retry_after });
        }

        if status.is_server_error() {
            let body = http_resp.text().await.unwrap_or_default();
            return Err(Error::Other(format!("Server error {status}: {body}")));
        }

        let mcp_resp: McpResponse = http_resp.json().await?;

        if let Some(err) = mcp_resp.error {
            return Err(Error::Mcp { code: err.code, message: err.message });
        }

        Ok(mcp_resp)
    }
}
