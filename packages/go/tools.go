package hiveagent

import (
	"context"
	"encoding/json"
)

// ─────────────────────────────────────────
// Tool registry types
// ─────────────────────────────────────────

// Tool describes a single HiveAgent tool from the registry manifest.
type Tool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Category    string          `json:"category"`
	InputSchema json.RawMessage `json:"inputSchema,omitempty"`
	CostUSD     float64         `json:"cost_usd"`
	DataRetained bool           `json:"data_retained"`
	OnChain     bool            `json:"on_chain"`
	Sandbox     bool            `json:"sandbox"`
}

// ToolMatch is a ranked result from the Discover endpoint.
type ToolMatch struct {
	Tool       Tool    `json:"tool"`
	Score      float64 `json:"score"`
	Reasoning  string  `json:"reasoning,omitempty"`
}

// ─────────────────────────────────────────
// Typed helpers for common tool categories
// ─────────────────────────────────────────

// Search calls the web_search tool and returns results.
func (c *Client) Search(query string) (json.RawMessage, error) {
	return c.SearchContext(context.Background(), query)
}

// SearchContext is like Search but accepts a context.
func (c *Client) SearchContext(ctx context.Context, query string) (json.RawMessage, error) {
	return c.CallToolContext(ctx, "web_search", map[string]interface{}{
		"query": query,
	})
}

// ─────────────────────────────────────────
// ZK proof helpers
// ─────────────────────────────────────────

// ZKProofRequest is the input for generating a ZK proof.
type ZKProofRequest struct {
	// ClaimType is the type of claim to prove (e.g. "age_over_18", "kyc_verified").
	ClaimType string `json:"claim_type"`
	// Witness is the private data used to generate the proof (never stored by HiveAgent).
	Witness map[string]interface{} `json:"witness"`
}

// ZKProofResult is returned after a successful ZK proof generation.
type ZKProofResult struct {
	ProofID   string `json:"proof_id"`
	ProofData string `json:"proof_data"`
	PublicInputs []string `json:"public_inputs"`
	OnChainHash string `json:"on_chain_hash,omitempty"`
}

// GenerateZKProof calls the zk_proof_generate tool.
// Witness data is processed client-side — HiveAgent never retains your private inputs.
func (c *Client) GenerateZKProof(req ZKProofRequest) (*ZKProofResult, error) {
	return c.GenerateZKProofContext(context.Background(), req)
}

// GenerateZKProofContext is like GenerateZKProof but accepts a context.
func (c *Client) GenerateZKProofContext(ctx context.Context, req ZKProofRequest) (*ZKProofResult, error) {
	raw, err := c.CallToolContext(ctx, "zk_proof_generate", map[string]interface{}{
		"claim_type": req.ClaimType,
		"witness":    req.Witness,
	})
	if err != nil {
		return nil, err
	}
	var result ZKProofResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ─────────────────────────────────────────
// Payment helpers
// ─────────────────────────────────────────

// PaymentRequest is the input for sending a USDC payment.
type PaymentRequest struct {
	// To is the recipient address (EVM-compatible, Base L2).
	To string `json:"to"`
	// AmountUSDC is the amount to send in USDC (e.g. 10.50).
	AmountUSDC float64 `json:"amount_usdc"`
	// Memo is an optional human-readable note attached to the transaction.
	Memo string `json:"memo,omitempty"`
}

// PaymentResult is returned after a payment is submitted on-chain.
type PaymentResult struct {
	TxHash    string  `json:"tx_hash"`
	Status    string  `json:"status"`
	GasUsed   float64 `json:"gas_used_usdc"`
	FeeUSDC   float64 `json:"fee_usdc"`
	ExplorerURL string `json:"explorer_url"`
}

// SendPayment calls the payment_send_usdc tool to send USDC on Base L2.
func (c *Client) SendPayment(req PaymentRequest) (*PaymentResult, error) {
	return c.SendPaymentContext(context.Background(), req)
}

// SendPaymentContext is like SendPayment but accepts a context.
func (c *Client) SendPaymentContext(ctx context.Context, req PaymentRequest) (*PaymentResult, error) {
	args := map[string]interface{}{
		"to":          req.To,
		"amount_usdc": req.AmountUSDC,
	}
	if req.Memo != "" {
		args["memo"] = req.Memo
	}

	raw, err := c.CallToolContext(ctx, "payment_send_usdc", args)
	if err != nil {
		return nil, err
	}
	var result PaymentResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ─────────────────────────────────────────
// Insurance helpers
// ─────────────────────────────────────────

// InsuranceClaimRequest is the input for filing a parametric insurance claim.
type InsuranceClaimRequest struct {
	PolicyID  string                 `json:"policy_id"`
	EventType string                 `json:"event_type"`
	Evidence  map[string]interface{} `json:"evidence,omitempty"`
}

// InsuranceClaim is returned after a claim is filed.
type InsuranceClaim struct {
	ClaimID   string `json:"claim_id"`
	Status    string `json:"status"`
	PolicyID  string `json:"policy_id"`
	FiledAt   string `json:"filed_at"`
	OracleURL string `json:"oracle_url,omitempty"`
}

// FileInsuranceClaim calls the insurance_claim_file tool.
func (c *Client) FileInsuranceClaim(req InsuranceClaimRequest) (*InsuranceClaim, error) {
	return c.FileInsuranceClaimContext(context.Background(), req)
}

// FileInsuranceClaimContext is like FileInsuranceClaim but accepts a context.
func (c *Client) FileInsuranceClaimContext(ctx context.Context, req InsuranceClaimRequest) (*InsuranceClaim, error) {
	args := map[string]interface{}{
		"policy_id":  req.PolicyID,
		"event_type": req.EventType,
	}
	if req.Evidence != nil {
		args["evidence"] = req.Evidence
	}

	raw, err := c.CallToolContext(ctx, "insurance_claim_file", args)
	if err != nil {
		return nil, err
	}
	var claim InsuranceClaim
	if err := json.Unmarshal(raw, &claim); err != nil {
		return nil, err
	}
	return &claim, nil
}

// ─────────────────────────────────────────
// Escrow helpers
// ─────────────────────────────────────────

// EscrowRequest is the input for creating an escrow agreement.
type EscrowRequest struct {
	// Buyer is the buyer address.
	Buyer string `json:"buyer"`
	// Seller is the seller address.
	Seller string `json:"seller"`
	// AmountUSDC is the escrow amount in USDC.
	AmountUSDC float64 `json:"amount_usdc"`
	// Conditions describes the release conditions.
	Conditions string `json:"conditions,omitempty"`
}

// Escrow is returned after an escrow is created.
type Escrow struct {
	EscrowID    string  `json:"escrow_id"`
	ContractAddr string `json:"contract_address"`
	Status      string  `json:"status"`
	AmountUSDC  float64 `json:"amount_usdc"`
	TxHash      string  `json:"tx_hash"`
}

// CreateEscrow calls the escrow_create tool.
func (c *Client) CreateEscrow(req EscrowRequest) (*Escrow, error) {
	return c.CreateEscrowContext(context.Background(), req)
}

// CreateEscrowContext is like CreateEscrow but accepts a context.
func (c *Client) CreateEscrowContext(ctx context.Context, req EscrowRequest) (*Escrow, error) {
	args := map[string]interface{}{
		"buyer":       req.Buyer,
		"seller":      req.Seller,
		"amount_usdc": req.AmountUSDC,
	}
	if req.Conditions != "" {
		args["conditions"] = req.Conditions
	}

	raw, err := c.CallToolContext(ctx, "escrow_create", args)
	if err != nil {
		return nil, err
	}
	var escrow Escrow
	if err := json.Unmarshal(raw, &escrow); err != nil {
		return nil, err
	}
	return &escrow, nil
}
