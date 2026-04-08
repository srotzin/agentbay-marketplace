//! # hiveagent
//!
//! Official Rust SDK for the [HiveAgent](https://hiveagentiq.com) MCP API.
//! 828 tools across 40 verticals — DeFi, escrow, ZK proofs, parametric insurance,
//! payments, AI models, and more.
//!
//! ## Quick start
//!
//! ```rust,no_run
//! use hiveagent::HiveAgent;
//! use serde_json::json;
//!
//! #[tokio::main]
//! async fn main() -> hiveagent::Result<()> {
//!     let client = HiveAgent::new("agent_your_id_here");
//!
//!     let result = client
//!         .call_tool("web_search", json!({ "query": "latest AI news" }))
//!         .await?;
//!
//!     println!("{}", serde_json::to_string_pretty(&result)?);
//!     Ok(())
//! }
//! ```

pub mod client;
pub mod types;

pub use client::HiveAgent;
pub use types::{Tool, ToolMatch, McpError};

/// The standard Result type for hiveagent operations.
pub type Result<T> = std::result::Result<T, Error>;

/// All errors that can be returned by the hiveagent SDK.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// An HTTP transport error from reqwest.
    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    /// A JSON serialization or deserialization error.
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    /// An MCP protocol error returned by the HiveAgent gateway.
    #[error("MCP error {code}: {message}")]
    Mcp { code: i64, message: String },

    /// The rate limit was exceeded.
    #[error("Rate limit exceeded. Retry after {retry_after_secs} seconds. Upgrade at https://hiveagentiq.com/pricing")]
    RateLimit { retry_after_secs: u64 },

    /// A generic error with a message.
    #[error("{0}")]
    Other(String),
}

impl From<McpError> for Error {
    fn from(e: McpError) -> Self {
        Error::Mcp { code: e.code, message: e.message }
    }
}
