#!/usr/bin/env python3
"""
Rewrite all tool descriptions in mcp-tools-new.js to follow the "Use when..." pattern.
Only replaces the description field values. Does not touch names, inputSchema, or handlers.
"""

import re

FILE_PATH = "/home/user/workspace/agentbay/src/mcp-tools-new.js"

# Map of tool name -> new description
DESCRIPTIONS = {

    # ── 1. HUMAN-IN-THE-LOOP ─────────────────────────────────────
    "hitl_submit_task": (
        "Use when an agent hits a wall that only a human can solve — MFA approval, "
        "phone verification, document notarization, subjective judgment, or physical-world tasks. "
        "Submit a task with a budget and urgency level and get matched with a verified human worker. "
        "Handles MFA approval, phone calls, document notarization, subjective judgment, "
        "physical verification, data entry, and translation. "
        "Returns task ID, assigned worker, and ETA."
    ),
    "hitl_get_status": (
        "Use when you've submitted a HITL task and need to know if a human has picked it up yet. "
        "Poll this after hitl_submit_task to check progress percentage, worker assignment, "
        "and whether the task is still queued, in progress, or done. Returns current status and completion percentage."
    ),
    "hitl_get_result": (
        "Use when a HITL task is complete and you need to read the human's actual output. "
        "Returns the worker's structured result, free-text notes, quality rating, and any "
        "attachments or evidence they submitted. Call after hitl_get_status shows 'completed'."
    ),
    "hitl_list_workers": (
        "Use when you want to hand-pick a human worker before submitting a task — "
        "browse the pool by specialty (MFA, phone calls, notarization, translation, etc.) "
        "and filter by minimum star rating. Returns worker profiles, specialties, ratings, and hourly rates. "
        "Useful for high-stakes tasks where you need a proven expert."
    ),
    "hitl_set_budget": (
        "Use when you need a hard cap on how much an agent can spend on human tasks per day "
        "to prevent runaway costs. Sets a daily USD spending ceiling for HITL tasks for a specific agent. "
        "Returns the updated budget configuration."
    ),

    # ── 2. VOICE TELEPHONY ──────────────────────────────────────
    "voice_initiate_call": (
        "Use when an agent needs to make a real phone call — confirm an appointment, "
        "read a verification code over the phone, conduct a scripted survey, or reach someone "
        "who won't respond to email or SMS. Converts a text script to speech and dials out. "
        "Supports custom caller ID and optional call recording. Returns a call ID for tracking."
    ),
    "voice_get_status": (
        "Use when you've placed a call and need to know if it connected, was answered, "
        "went to voicemail, or failed. Poll this after voice_initiate_call. "
        "Returns connection status, call duration, and final disposition."
    ),
    "voice_get_transcript": (
        "Use when a completed call was recorded and you need the full conversation as text. "
        "Returns a timestamped transcript with speaker labels for every turn in the call. "
        "Essential for extracting structured information from a phone interaction."
    ),
    "voice_schedule_callback": (
        "Use when you need to place a call at a future time — schedule a reminder call, "
        "a follow-up after business hours, or a retry for a number that was busy. "
        "Supports automatic retry logic if the call isn't answered. Returns a scheduled call ID."
    ),
    "voice_list_calls": (
        "Use when you need an overview of recent outbound calls — to audit activity, "
        "find a specific call ID, or check how many calls are currently in progress. "
        "Filterable by status (ringing, completed, failed, no-answer) and supports pagination."
    ),

    # ── 3. PHYSICAL LOGISTICS ───────────────────────────────────
    "logistics_create_shipment": (
        "Use when an agent needs to ship a physical package — create a label, "
        "select a carrier, and get a tracking number without leaving the workflow. "
        "Supports UPS, FedEx, USPS, DHL, or auto-select cheapest. "
        "Returns tracking number, label PDF URL, and estimated delivery date."
    ),
    "logistics_track": (
        "Use when you have a tracking number and need real-time package status — "
        "whether it's in transit, out for delivery, delivered, or stuck. "
        "Works across all major carriers with auto-detection. "
        "Returns current location, scan events, and estimated delivery window."
    ),
    "logistics_request_verification": (
        "Use when you need eyes on the ground — send a local agent to physically confirm "
        "an asset exists, check a property's condition, verify an identity in person, "
        "or count inventory at a warehouse. Supports asset condition, location confirmation, "
        "identity check, and inventory count. Returns a photo report and verifier notes."
    ),
    "logistics_dispatch_courier": (
        "Use when you need something physically moved within a metro area the same day — "
        "pick up documents, deliver a package to a specific person, or transport a device. "
        "Dispatches an on-demand local courier with a configurable pickup window. "
        "Returns courier assignment, ETA, and live tracking link."
    ),
    "logistics_get_fulfillment_quote": (
        "Use when you need to know what it will cost to pick, pack, and ship a physical order "
        "from a third-party warehouse before committing. Provide a SKU list and destination "
        "address to get an itemized price quote. Returns total cost, carrier options, and estimated transit time."
    ),

    # ── 4. COMMUNICATION RAILS ──────────────────────────────────
    "comms_send_verified_message": (
        "Use when you need provable delivery — not just 'sent' but cryptographically confirmed "
        "the message reached the recipient. Sends via email, SMS, push, WhatsApp, or Telegram "
        "with delivery proof and optional read receipts. Supports required acknowledgment to "
        "force the recipient to explicitly confirm they received it. Returns a message ID for tracking."
    ),
    "comms_get_delivery_status": (
        "Use when you've sent a verified message and need to confirm delivery and read status. "
        "Returns sent timestamp, delivery timestamp, read timestamp, and whether the recipient "
        "has acknowledged it. Use this before triggering follow-up actions that depend on confirmed delivery."
    ),
    "comms_schedule_followup": (
        "Use when you send a message but need an automatic nudge if the person goes silent. "
        "Schedules a follow-up message to fire after a configurable hours-of-silence window, "
        "with a cap on total retries. Returns a scheduled follow-up ID."
    ),
    "comms_verify_acknowledgment": (
        "Use when a workflow must not proceed until a human explicitly confirms receipt — "
        "legal notices, compliance approvals, or critical alerts requiring a response. "
        "Returns the acknowledgment timestamp and cryptographic proof of confirmation, or "
        "null if the recipient hasn't responded yet."
    ),
    "comms_list_channels": (
        "Use when you need to decide which messaging channel to use — check what's available, "
        "compare delivery success rates, and see per-message pricing before sending. "
        "Filterable by geographic region. Returns channel capabilities, delivery SLAs, and pricing."
    ),

    # ── 5. BROWSER & WEB ACCESS ─────────────────────────────────
    "browser_lease_session": (
        "Use when an agent needs to browse a website as an authenticated user — "
        "log in, maintain session cookies, and interact with pages that require a real browser. "
        "Essential for sites that block headless browsers or require persistent login state. "
        "Supports stealth mode and geo-targeted proxies. Returns a session ID for subsequent operations."
    ),
    "browser_get_session_status": (
        "Use when you need to verify a leased browser session is still alive and authenticated "
        "before sending it more work. Returns health status, target URL, authentication state, "
        "and remaining session time."
    ),
    "browser_end_session": (
        "Use when a browser session is no longer needed — terminates the session immediately "
        "and releases underlying compute resources to stop billing. Call this as cleanup "
        "after you're done with a leased browser session."
    ),
    "browser_list_sessions": (
        "Use when you need to see all active browser sessions for an agent — "
        "audit what's running, find a session ID for a specific site, or identify idle sessions "
        "to terminate. Filterable by status (active, idle, expired). Returns session IDs, URLs, and expiry times."
    ),
    "browser_configure_session": (
        "Use when you need to tune a browser session's fingerprint — change the user-agent, "
        "set a custom viewport, inject cookies for a specific site, or configure proxy IP rotation. "
        "Run this after browser_lease_session to harden the session against detection."
    ),

    # ── 6. ANTIBOT BYPASS ───────────────────────────────────────
    "antibot_extract_page": (
        "Use when a target URL blocks normal HTTP requests with CAPTCHAs, "
        "Cloudflare protection, or JavaScript challenges that prevent content access. "
        "Renders the page in a real browser, solves challenges automatically, "
        "and returns clean HTML, text, JSON, or Markdown. Supports proxy regions and CSS selector waiting."
    ),
    "antibot_batch_extract": (
        "Use when you need content from many bot-protected pages at once — "
        "submit a list of URLs and process them in parallel without managing individual sessions. "
        "Configurable concurrency. Returns a batch job ID; retrieve results with antibot_get_extraction_status."
    ),
    "antibot_get_extraction_status": (
        "Use when you've submitted a batch extraction job and want to check progress "
        "or retrieve completed results. Returns job status, completion count, "
        "and extracted content for finished pages."
    ),
    "antibot_configure_proxy": (
        "Use when you need to control where extraction requests appear to come from — "
        "pin to a specific geographic region, switch between residential and datacenter IPs, "
        "or change how often the IP rotates. Run before extracting region-locked or "
        "geo-filtered content."
    ),
    "antibot_get_stats": (
        "Use when you need to audit the antibot service's performance — check CAPTCHA solve rates, "
        "bypass success rates, and total usage for cost tracking. "
        "Provide an agent ID for per-agent stats or omit for global platform stats."
    ),

    # ── 7. PAYWALL BROKER ───────────────────────────────────────
    "paywall_search": (
        "Use when you need information locked behind subscriptions — WSJ, FT, Bloomberg, "
        "JSTOR, or other premium sources — without having individual credentials. "
        "Searches across licensed databases and paywalled publications. "
        "Returns article summaries, publication dates, and source attribution."
    ),
    "paywall_access_article": (
        "Use when you have a specific URL or DOI for a paywalled article and need the full text. "
        "Uses platform-level licensed access to retrieve the complete content "
        "without requiring a personal subscription. Returns full article text and metadata."
    ),
    "paywall_query_database": (
        "Use when you need structured data from a licensed proprietary database — "
        "Crunchbase company profiles, PitchBook funding rounds, Dun & Bradstreet firmographics, "
        "or similar premium data sources. Returns structured records matching your query parameters."
    ),
    "paywall_list_sources": (
        "Use when you need to discover which licensed data sources are available "
        "and what they contain before running a search. Filterable by category "
        "(news, finance, academic, legal, market data). Returns source names, coverage, and per-access pricing."
    ),
    "paywall_get_pricing": (
        "Use when you need to know the cost of accessing a specific licensed data source "
        "before committing — compare subscription vs. per-access pricing. "
        "Returns pricing tiers, per-article fees, and volume discounts."
    ),

    # ── 8. API SUBLETTING ───────────────────────────────────────
    "apisub_rent_access": (
        "Use when you need an API you don't have credentials for — rent short-term access "
        "to another agent's surplus quota for OpenAI, Google Maps, or other premium APIs. "
        "Set a time duration and max call limit to control spend. "
        "Returns a rental ID and credentials for making calls directly."
    ),
    "apisub_list_available": (
        "Use when you need to find available API access to rent — browse by category "
        "(AI models, data, maps, communication, finance, search) and filter by price per call. "
        "Returns API names, current rates, rate limits, and provider reputation scores."
    ),
    "apisub_get_usage_stats": (
        "Use when you need to track how much of a rented API you've consumed — "
        "check calls made, cost incurred so far, and remaining quota before you hit the cap. "
        "Useful for cost control mid-workflow."
    ),
    "apisub_estimate_cost": (
        "Use before renting API access to calculate the expected cost for your usage pattern. "
        "Provide the API name, expected call count, and duration to get a cost estimate "
        "before committing budget. Returns total estimated cost and per-call breakdown."
    ),

    # ── 9. AGENT IDENTITY & DELEGATION ─────────────────────────
    "identity_register": (
        "Use when a new agent needs a verifiable identity on the HiveAgent network — "
        "register with a name, capability claims, and an optional public key to create "
        "a cryptographic identity with a public reputation profile. "
        "Returns an agent ID and identity credential for use in delegations and service interactions."
    ),
    "identity_grant_delegation": (
        "Use when a parent agent needs to authorize a sub-agent to act on its behalf — "
        "hire workers, spend money, or read data — within defined permission scopes and an optional spend cap. "
        "Time-bounded with configurable expiry. Returns a delegation credential ID."
    ),
    "identity_verify_delegation": (
        "Use before accepting work or executing an action on behalf of another agent — "
        "verify the delegation credential is valid, unexpired, and actually covers the permission "
        "scope you're about to use. Prevents fraud and unauthorized action. "
        "Returns valid/invalid status with scope details."
    ),
    "identity_revoke_delegation": (
        "Use when a sub-agent should immediately lose its delegated authority — "
        "the task is done, trust was violated, or the delegation was issued in error. "
        "Revocation is instant and permanent. Returns confirmation and audit log entry."
    ),
    "identity_get_profile": (
        "Use when you need to vet an agent before collaborating — check its registered capabilities, "
        "reputation scores, history of completed tasks, and any fraud flags. "
        "Returns the full public identity profile and performance metrics."
    ),

    # ── 10. LEGAL & COMPLIANCE ROUTER ──────────────────────────
    "legal_check_compliance": (
        "Use before an agent takes any regulated action — sending money, processing personal data, "
        "hiring someone, or making a healthcare decision. Checks whether the proposed action "
        "is legal in a given jurisdiction. Returns a compliance verdict, blocking issues, "
        "and required remediation steps."
    ),
    "legal_route_jurisdiction": (
        "Use when a transaction or contract involves parties in multiple countries "
        "and you're not sure which laws apply. Determines the governing jurisdiction and "
        "routes to the appropriate compliance frameworks. Returns the applicable jurisdiction "
        "and relevant regulatory regimes."
    ),
    "legal_get_requirements": (
        "Use when you need the specific regulatory checklist for a given jurisdiction and regulation type — "
        "KYC/AML steps for a payment, GDPR requirements for data processing, HIPAA rules for "
        "health data handling. Returns the full requirement list with documentation needs."
    ),
    "legal_validate_action": (
        "Use when you have a specific action payload that needs a pass/fail compliance verdict "
        "against a named ruleset before execution. Returns pass/fail, the specific rule that "
        "triggered any failure, and the remediation steps required to proceed."
    ),
    "legal_list_jurisdictions": (
        "Use when you need to know which legal jurisdictions and regulation types the platform "
        "can check before starting compliance work. Filterable by region. "
        "Returns jurisdiction codes, supported regulations, and coverage details."
    ),

    # ── 11. E-SIGNATURE & FILING ────────────────────────────────
    "esig_create_signature_request": (
        "Use when a document needs legally binding signatures from one or more people — "
        "contracts, NDAs, board resolutions, or any agreement requiring wet-ink equivalence. "
        "Routes the document to signatories by email with configurable expiry. "
        "Returns a signature request ID for status tracking."
    ),
    "esig_file_entity": (
        "Use when an agent needs to register a legal entity, file an amendment, "
        "submit an annual report, or dissolve a company with the relevant government authority. "
        "Handles LLC formation, corp formation, amendments, annual reports, and DBA registrations. "
        "Supports rush filing. Returns a filing ID and estimated processing time."
    ),
    "esig_check_filing_status": (
        "Use when you've submitted a signature request or government filing "
        "and need to know if all parties have signed or the authority has processed it. "
        "Returns current status, pending signatories, and any rejection reasons."
    ),
    "esig_get_templates": (
        "Use when you need a pre-built legal document to start from — NDA, service agreement, "
        "employment contract, partnership agreement, or term sheet. Filterable by category "
        "and jurisdiction. Returns template IDs, descriptions, and variable fields to fill in."
    ),
    "esig_sign_document": (
        "Use when an agent has authority to sign a document on behalf of a principal "
        "and needs to apply a cryptographic e-signature programmatically. "
        "Requires a valid signature request ID and authorized signer agent ID. "
        "Returns the signed document URL and signature timestamp."
    ),

    # ── 12. ZERO-KNOWLEDGE VAULTS ───────────────────────────────
    "zkvault_deposit": (
        "Use when an agent needs to store a secret — API key, private key, password, "
        "or sensitive document — so it's available later but the platform can never read it. "
        "Client-side encryption means only the depositing agent can decrypt. "
        "Supports configurable TTL for auto-expiry. Returns a vault ID."
    ),
    "zkvault_request_token": (
        "Use when an agent needs to actually use a secret stored in a vault for a single operation — "
        "authenticate to an API, sign a transaction, or decrypt a document. "
        "Issues a short-lived ephemeral token (default 5 min) logged for audit purposes. "
        "Returns the token needed to decrypt the vault payload."
    ),
    "zkvault_revoke_access": (
        "Use when a vault has been compromised, the secret has been rotated, "
        "or the operation requiring it is complete and you want to invalidate all outstanding tokens. "
        "Optionally deletes the vault entirely. Revocation is immediate and permanent."
    ),
    "zkvault_list_vaults": (
        "Use when you need to see what secrets an agent has stored — "
        "check vault labels, types, and expiry dates without exposing any secret content. "
        "Filterable by secret type (API key, private key, credential, document)."
    ),
    "zkvault_audit_access": (
        "Use when you need a full access history for a vault — who requested tokens, "
        "when, and for what stated purpose. Essential for security audits, "
        "incident investigation, or proving a secret was accessed without authorization."
    ),

    # ── 13. PROOF OF COMPLETION ─────────────────────────────────
    "proof_submit": (
        "Use when an agent finishes a task and needs to prove it to a third party — "
        "submit a deliverable hash, output URL, attestation, or ZK proof for independent verification. "
        "Required before escrow release or reputation update in milestone-based workflows. "
        "Returns a proof ID for verification and attestation generation."
    ),
    "proof_verify_completion": (
        "Use when you've received a submitted proof and need an independent verdict on whether "
        "the work actually meets the requirements. Checks the proof against your criteria "
        "and returns a pass/fail result with a detailed verification report."
    ),
    "proof_get_status": (
        "Use when you've submitted a proof and need to know if it's been verified yet. "
        "Poll this after proof_submit to check whether the verification is pending, passed, failed, or disputed."
    ),
    "proof_generate_attestation": (
        "Use when a proof has been verified and you need a signed certificate to share with "
        "a third party, record on-chain, or attach to a payment release request. "
        "Returns a cryptographically signed attestation document suitable for external use."
    ),
    "proof_list_verifications": (
        "Use when you need an audit trail of all proofs submitted or verified by an agent — "
        "track completion history, identify failed verifications, or build a performance record. "
        "Filterable by status (pending, verified, failed, disputed)."
    ),

    # ── 14. DISPUTE RESOLUTION ──────────────────────────────────
    "dispute_file": (
        "Use when an agent has been defrauded, received non-delivery, been overbilled, "
        "or experienced a breach of terms — formally open an arbitration case. "
        "Covers non-delivery, quality failures, fraud, billing disputes, and terms violations. "
        "Returns a dispute ID and initiates the arbitration process."
    ),
    "dispute_submit_evidence": (
        "Use after filing a dispute to submit supporting evidence — transaction logs, "
        "screenshots, documents, or witness statements that prove your case. "
        "Either party can submit evidence. Returns a confirmation that the evidence is on the record."
    ),
    "dispute_get_ruling": (
        "Use when an arbitration case has been reviewed and you need the arbitrator's decision — "
        "who won, why, and what action was taken (refund, escrow release, account suspension). "
        "Returns the full ruling with reasoning and enforcement action."
    ),
    "dispute_appeal_ruling": (
        "Use when you believe an arbitrator's ruling was wrong and you're within the appeal window — "
        "escalate to a senior review panel with additional grounds and supporting evidence. "
        "Returns an appeal ID and expected review timeline."
    ),
    "dispute_list": (
        "Use when you need a summary of all active or historical disputes for an agent — "
        "track open cases, identify patterns, or review resolved disputes for compliance purposes. "
        "Filterable by status (open, under review, resolved, appealed, closed)."
    ),

    # ── 15. OUTCOME REPUTATION ──────────────────────────────────
    "reputation_get_score": (
        "Use before hiring a provider or trusting an agent's output — get its verified reputation score "
        "based on real completed deliveries, not self-reported claims. "
        "Filterable by dimension (delivery speed, quality, reliability). "
        "Returns overall score, category breakdown, and total verified outcomes."
    ),
    "reputation_report_outcome": (
        "Use after receiving a service delivery to update the provider's reputation with your actual experience — "
        "success, partial success, failure, or fraud. Contributes to the platform's trust layer "
        "so other agents can make better hiring decisions."
    ),
    "reputation_get_metrics": (
        "Use when you need a deep performance profile on an agent or provider — "
        "not just a score but full metrics across all tracked dimensions over a configurable time window. "
        "Returns time-series data on quality, speed, reliability, and dispute rate."
    ),
    "reputation_compare_providers": (
        "Use when selecting between multiple providers for a service — "
        "compare them side by side on a specific metric (overall score, delivery speed, quality, reliability, fraud rate). "
        "Returns a ranked comparison table with scores for each provider."
    ),
    "reputation_get_risk_score": (
        "Use before committing to a high-value transaction with an unknown agent — "
        "get a fraud and non-delivery risk score calibrated to the transaction size. "
        "Returns risk level, fraud probability, and recommended due diligence steps."
    ),

    # ── 16. CONFIDENCE ORACLES ──────────────────────────────────
    "oracle_query_confidence": (
        "Use when an agent faces genuine uncertainty about a factual or predictive question "
        "that can't be resolved with a web search — 'will this API be deprecated?', "
        "'is this entity solvent?', 'how likely is this regulatory change?' "
        "Posts the question to a market of staking experts. "
        "Returns a query ID; retrieve calibrated estimates with oracle_get_calibrated_estimate."
    ),
    "oracle_stake_answer": (
        "Use when an agent has domain expertise on an open oracle question and wants to earn "
        "rewards for correct answers. Stake USD on your answer with a calibrated confidence score. "
        "Earn if right, lose stake if wrong — skin in the game ensures quality."
    ),
    "oracle_get_calibrated_estimate": (
        "Use after posting an oracle query to retrieve the aggregated expert consensus — "
        "a calibrated probability estimate with confidence intervals derived from all stakers. "
        "Use this to make decisions that depend on uncertain facts or future outcomes."
    ),
    "oracle_list_open_queries": (
        "Use when looking for oracle questions to answer and earn rewards on — "
        "browse open queries sorted by total stake and urgency. "
        "Filterable by domain (finance, technology, security, geopolitics, etc.)."
    ),
    "oracle_resolve_query": (
        "Use when ground truth for an oracle question is now verifiably known "
        "and payouts to correct stakers should be triggered. "
        "Provide the verified answer; the system calculates and distributes rewards. "
        "Returns resolution confirmation and payout summary."
    ),

    # ── 17. RED TEAM & SECURITY ─────────────────────────────────
    "redteam_submit_workflow": (
        "Use before deploying an agent workflow to production — submit it for adversarial review "
        "to find prompt injection vulnerabilities, data exfiltration paths, auth bypasses, "
        "and failure modes you didn't think of. Choose quick, standard, or deep review depth. "
        "Returns a review ID; retrieve results with redteam_get_threat_analysis."
    ),
    "redteam_get_threat_analysis": (
        "Use after submitting a workflow for red-team review to read the full threat report — "
        "identified vulnerabilities, severity ratings (critical/high/medium/low), "
        "attack vectors, and recommended mitigations. "
        "Returns a structured vulnerability report."
    ),
    "redteam_list_vulnerabilities": (
        "Use when you want to proactively harden an agent before red-teaming — "
        "browse the full catalog of known vulnerability classes for your agent type "
        "(trading, research, code execution, financial, etc.) with mitigation strategies. "
        "Filterable by severity."
    ),
    "redteam_simulate_failure": (
        "Use when you want to stress-test a specific failure scenario against a workflow — "
        "simulate a prompt injection attack, resource exhaustion, dependency failure, "
        "auth bypass, or data poisoning at configurable intensity. "
        "Returns how the workflow responded and whether it recovered gracefully."
    ),
    "redteam_get_risk_report": (
        "Use to get a comprehensive security posture report for an agent — "
        "aggregates all historical vulnerability findings, current risk score, "
        "and prioritized mitigation recommendations. "
        "Returns a report suitable for sharing with operators or compliance reviewers."
    ),

    # ── 18. VIRTUAL CARDS & FIAT BRIDGE ────────────────────────
    "vcard_mint": (
        "Use when an agent needs to make a real-world purchase but only holds USDC — "
        "mint a disposable virtual Visa or Mastercard funded from on-chain balance. "
        "Supports single-use cards that self-destruct after one transaction, "
        "and merchant category restrictions to limit where the card can be charged. "
        "Returns full card details (PAN, expiry, CVV) and card ID."
    ),
    "vcard_get_details": (
        "Use when you need the current card number, expiry, CVV, balance, and status "
        "for a virtual card — retrieve these before making a purchase or sharing with a service. "
        "Returns PAN, expiry, CVV, remaining balance, and freeze status."
    ),
    "vcard_freeze": (
        "Use to instantly block all transactions on a virtual card — "
        "if a card number may have been exposed, a purchase attempt is unexpected, "
        "or you want to pause spending temporarily. Toggle between frozen and active. "
        "Returns updated card status."
    ),
    "vcard_list_transactions": (
        "Use when you need to audit spending on a virtual card — "
        "see every charge with merchant name, amount, timestamp, and authorization result. "
        "Useful for reconciliation, fraud detection, or passing receipts back to a budget system."
    ),
    "vcard_set_limits": (
        "Use to lock down a virtual card so it can only be used at specific merchants "
        "or for transactions under a certain amount. Set per-transaction caps and "
        "allowlists of approved merchant names to prevent misuse. Returns updated card configuration."
    ),

    # ── 19. AGENT FINANCIAL CONTROLS ───────────────────────────
    "budget_create": (
        "Use when standing up a new agent and you need spending guardrails — "
        "create a named budget with a total USD limit, a reset period (daily/weekly/monthly/total), "
        "and optional per-category sub-limits (HITL, compute, logistics, etc.). "
        "Returns a budget ID used in all subsequent budget operations."
    ),
    "budget_allocate_funds": (
        "Use when a project or spending category needs a dedicated slice of a larger budget — "
        "ring-fence funds so they can't be consumed by other operations. "
        "Returns an allocation ID and updated remaining budget balance."
    ),
    "budget_get_spending_report": (
        "Use when you need to see how much an agent has spent vs. its limits — "
        "break down spend by category, compare actual vs. budget, and optionally "
        "drill into individual transactions. Returns a full spending summary with category breakdown."
    ),
    "budget_set_approval_threshold": (
        "Use when you want a human or parent agent to approve any single transaction "
        "above a certain dollar amount before it executes. Prevents large accidental or "
        "unauthorized spends. Returns the updated budget policy."
    ),
    "budget_reconcile": (
        "Use at the end of a period to verify the budget's recorded transactions "
        "match an external ledger and surface any discrepancies or missing entries. "
        "Provide a date range; returns a reconciliation report with matched, unmatched, "
        "and flagged transaction lists."
    ),

    # ── 20. PROJECT MANAGEMENT ──────────────────────────────────
    "project_create": (
        "Use when coordinating a multi-agent or multi-human effort that needs "
        "a shared budget, deadline, and structured progress tracking. "
        "Creates a project container with configurable visibility. "
        "Returns a project ID used for all milestone and assignment operations."
    ),
    "project_add_milestone": (
        "Use when a project needs to be broken into paid checkpoints — "
        "define what must be delivered, attach a payment amount released on completion, "
        "and set a due date. Returns a milestone ID for progress updates and payment release."
    ),
    "project_update_progress": (
        "Use when an agent has made progress on a project or milestone and needs to "
        "update the completion percentage and leave a status note for collaborators. "
        "Target a specific milestone or update the project overall."
    ),
    "project_assign_agent": (
        "Use when you need to formally assign an agent to a project in a defined role — "
        "contributor, reviewer, coordinator, or observer. "
        "Optionally scope the assignment to a specific milestone. "
        "Returns updated project team roster."
    ),
    "project_get_status": (
        "Use when you need a full snapshot of a project — "
        "current progress, milestone statuses, team assignments, budget consumed, "
        "and any blockers. Returns the complete project status object."
    ),
    "project_release_milestone_payment": (
        "Use when a milestone has been completed and verified and the escrowed payment "
        "should be released to the delivering agent. Optionally attach a proof-of-completion ID "
        "for an on-chain audit trail. Returns payment release confirmation."
    ),

    # ── 21. SLA & INSURANCE ─────────────────────────────────────
    "sla_purchase": (
        "Use when you need financial protection against a service missing its performance targets — "
        "buy an SLA insurance policy that pays out if uptime, latency, delivery speed, "
        "or quality fall below your thresholds. "
        "Returns an SLA policy ID and coverage terms."
    ),
    "sla_check_status": (
        "Use to monitor an active SLA policy — check whether the service is currently "
        "in compliance or has breached any thresholds, and see the current payout exposure. "
        "Returns policy health, breach events detected, and days remaining."
    ),
    "sla_file_claim": (
        "Use when a service has breached its SLA and you want to claim the insurance payout — "
        "describe the breach, attach evidence (logs, screenshots, monitoring data), "
        "and specify the claimed amount. Returns a claim ID and expected resolution timeline."
    ),
    "sla_get_coverage_options": (
        "Use when shopping for SLA insurance to understand what coverage types are available, "
        "what thresholds they protect, and what the premiums are. "
        "Filterable by coverage type and max monthly premium. Returns available plans and pricing."
    ),
    "sla_list_active": (
        "Use when you need to see all SLA policies protecting an agent's services — "
        "audit coverage, check for any policies close to expiry, or find policies "
        "with active breach alerts. Returns policy IDs, coverage details, and breach status."
    ),

    # ── 22. KNOWLEDGE DISTILLATION ──────────────────────────────
    "knowledge_publish_lesson": (
        "Use when an agent has learned something valuable from completing a task "
        "and wants to monetize or share that knowledge with other agents. "
        "Publish distilled lessons, best practices, or domain insights to the marketplace. "
        "Returns a lesson ID that other agents can discover and purchase."
    ),
    "knowledge_query": (
        "Use when you need a shortcut to wisdom other agents have already earned the hard way — "
        "search the knowledge marketplace for lessons, guides, and insights on a topic "
        "before investing compute in figuring it out yourself. "
        "Returns matching lessons with titles, summaries, ratings, and pricing."
    ),
    "knowledge_get_trending": (
        "Use when you want to know what other agents are learning right now — "
        "see the most-accessed lessons and hottest insights across domains over a time window. "
        "Returns ranked lessons with access counts and domain tags."
    ),
    "knowledge_rate_lesson": (
        "Use after accessing a purchased lesson to rate its quality and accuracy — "
        "helps surface the best content and bury misleading lessons. "
        "Improves the marketplace for all agents. Returns the updated lesson rating."
    ),
    "knowledge_list_domains": (
        "Use when you want to explore what knowledge domains have content before querying — "
        "see all domains, how many lessons they contain, and their average quality scores. "
        "Returns domain names, lesson counts, and quality metrics."
    ),

    # ── 23. SCHEMA TRANSLATION ──────────────────────────────────
    "schema_translate": (
        "Use when integrating two systems that speak different schema languages — "
        "convert JSON Schema to Protobuf, OpenAPI to GraphQL, Avro to Parquet, SQL DDL to JSON Schema, "
        "or any other supported pair. Returns the translated schema string in the target format."
    ),
    "schema_list_formats": (
        "Use when you need to know which schema formats the translation service supports "
        "and which conversion pairs are available before starting a translation job. "
        "Returns all supported formats and their compatible target formats."
    ),
    "schema_validate": (
        "Use when you have a schema definition and need to verify it's correct before "
        "publishing an API, deploying a service, or sending it to a translation job. "
        "Returns a list of validation errors and warnings with line references."
    ),
    "schema_batch_translate": (
        "Use when you need to migrate many schemas at once — an entire API surface area, "
        "a full microservice boundary, or a data warehouse schema. "
        "Submit all jobs in one call; returns a batch job ID for result retrieval."
    ),

    # ── 24. SANDBOX TESTING ─────────────────────────────────────
    "sandbox_create": (
        "Use when you need a safe, isolated environment to test code or agent logic "
        "without any real-world side effects — no real API calls, no real money, no production data. "
        "Supports Node.js, Python, browser, Docker, and WASM environments. "
        "Returns a sandbox ID for running tests."
    ),
    "sandbox_run_test": (
        "Use to execute a code snippet or test case inside an isolated sandbox environment. "
        "Pass input data, set a timeout, and get back execution results without touching production. "
        "Returns a test run ID; retrieve output with sandbox_get_results."
    ),
    "sandbox_get_results": (
        "Use after running a sandbox test to retrieve the full execution output — "
        "stdout, stderr, return values, and any exceptions thrown. "
        "Returns the complete test result including execution time and exit code."
    ),
    "sandbox_compare_providers": (
        "Use when you need to objectively evaluate multiple provider implementations "
        "before picking one — run the same test against all of them in parallel "
        "and compare output quality, latency, and cost side by side. "
        "Returns a ranked comparison table."
    ),
    "sandbox_list": (
        "Use when you need to see all sandbox environments for an agent — "
        "audit what's running, find idle sandboxes consuming resources, "
        "or locate a specific environment by status. Returns sandbox IDs, types, status, and resource usage."
    ),

    # ── 25. DOCUMENT PROCESSING ─────────────────────────────────
    "doc_extract": (
        "Use when you have a PDF, DOCX, or image and need structured data out of it — "
        "pull fields from invoices, contracts, ID documents, financial statements, or forms "
        "using AI-powered layout analysis. Optionally provide a schema to target specific fields. "
        "Returns a structured JSON object with extracted values."
    ),
    "doc_redact": (
        "Use before sharing a document externally when it contains PII, financial data, "
        "legally privileged material, or confidential information that must be removed. "
        "Automatically detects and blacks out sensitive content by category. "
        "Returns a redacted document URL in your preferred output format."
    ),
    "doc_compare": (
        "Use when you need to find what changed between two versions of a document — "
        "contract redlines, policy amendments, financial statement revisions, or agreement updates. "
        "Supports text diff, semantic diff, legal clause comparison, and financial figure comparison. "
        "Returns a detailed change report."
    ),
    "doc_ocr_scan": (
        "Use when you have a scanned image, photo of a document, or non-searchable PDF "
        "that needs to become machine-readable text. Extracts text with layout preservation "
        "in plain text, Markdown, JSON with bounding boxes, or searchable PDF. "
        "Returns extracted text in your chosen format."
    ),
    "doc_translate": (
        "Use when a document needs to be in a different language for a foreign counterparty, "
        "cross-border filing, or multilingual workflow. Translates while preserving "
        "the original layout and formatting. Returns the translated document URL."
    ),

    # ── 26. GPU INFERENCE ───────────────────────────────────────
    "gpu_request_inference": (
        "Use when you need to run a large model — LLM, image generator, embedder, or custom model — "
        "on dedicated GPU hardware at controlled cost and latency. "
        "Select from T4 to H200 tiers based on your speed and cost requirements. "
        "Returns an inference job ID; retrieve results with gpu_get_result."
    ),
    "gpu_get_result": (
        "Use after submitting an async GPU inference job to retrieve the completed output — "
        "generated text, images, embeddings, or custom model results. "
        "Returns the full inference output along with token usage and compute cost."
    ),
    "gpu_list_models": (
        "Use when selecting which model to run for a GPU inference task — "
        "browse available LLMs, image generators, embedding models, and audio/video models "
        "with context lengths and per-token pricing. Filterable by model type and price cap."
    ),
    "gpu_estimate_cost": (
        "Use before submitting a large GPU inference job to avoid budget surprises — "
        "estimate total cost from model ID, token counts, and hardware tier. "
        "Returns expected cost breakdown before you commit."
    ),
    "gpu_batch_inference": (
        "Use when you need to run the same model against many inputs — embedding a dataset, "
        "generating images in bulk, or processing hundreds of prompts — at reduced per-unit cost. "
        "Submit all inputs in one call with configurable priority. "
        "Returns a batch job ID for progress tracking."
    ),
}


def rewrite_descriptions(filepath, descriptions):
    with open(filepath, 'r') as f:
        content = f.read()

    # Pattern to match a tool object's description field
    # Finds: name: "TOOL_NAME", then later description: "...",
    # We'll do it tool by tool
    
    changes = 0
    for tool_name, new_desc in descriptions.items():
        # Build a pattern that matches the tool block's description field
        # We look for the name field followed (within 300 chars) by a description field
        # Strategy: find 'name: "tool_name"' then find the next 'description: "..."'
        
        # Escape special regex chars in tool name (none needed here but be safe)
        escaped_name = re.escape(tool_name)
        
        # Pattern: name: "TOOL_NAME", ... description: "OLD DESC"
        # The description value is a double-quoted string, possibly multiline with escaped chars
        # We match greedily within the tool block
        pattern = (
            r'(name:\s*"' + escaped_name + r'"'  # name field
            r'(?:[^}]|\n)*?)'                     # anything up to
            r'(description:\s*")'                 # description key + opening quote
            r'((?:[^"\\]|\\.)*)'                  # old description value
            r'(")'                                # closing quote
        )
        
        # Escape the new description for use in a replacement string
        safe_new_desc = new_desc.replace('\\', '\\\\').replace('"', '\\"')
        
        replacement = r'\g<1>\g<2>' + safe_new_desc + r'\g<4>'
        
        new_content, n = re.subn(pattern, replacement, content, count=1)
        if n == 0:
            print(f"WARNING: Could not find description for tool '{tool_name}'")
        else:
            content = new_content
            changes += 1
    
    print(f"Updated {changes} tool descriptions out of {len(descriptions)} expected.")
    
    with open(filepath, 'w') as f:
        f.write(content)
    
    print(f"Written to {filepath}")


if __name__ == "__main__":
    rewrite_descriptions(FILE_PATH, DESCRIPTIONS)
