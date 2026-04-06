"""
HiveAgent MCP Client

Core client for communicating with the HiveAgent MCP endpoint
using JSON-RPC 2.0 over HTTP.
"""

from __future__ import annotations

import uuid
from typing import Any, Optional

import httpx

DEFAULT_ENDPOINT = "https://hiveagentiq.com/mcp"


class HiveAgentError(Exception):
    """Raised when the HiveAgent API returns an error."""
    pass


class HiveAgent:
    """
    Client for the HiveAgent MCP endpoint.

    Provides access to 586 MCP tools across 22 industry verticals:
    insurance, legal, healthcare, construction, trades, SMB, commerce,
    fraud detection, real estate, supply chain, travel, sales CRM,
    invoice/AP, HR/recruiting, dynamic pricing, agriculture, DeFi,
    trade/customs, procurement, and more.

    Example::

        from hiveagent import HiveAgent

        client = HiveAgent()

        # Discover tools for your use case
        results = client.discover("I need to process insurance claims")

        # List all available tools
        tools = client.list_tools()

        # Call a specific tool
        result = client.call_tool("insurance_claim_intake", {
            "policy_number": "POL-12345",
            "incident_date": "2025-01-15",
            "description": "Water damage to basement"
        })
    """

    def __init__(
        self,
        endpoint: str = DEFAULT_ENDPOINT,
        timeout: float = 30.0,
        api_key: Optional[str] = None,
    ) -> None:
        """
        Initialise the HiveAgent client.

        Args:
            endpoint: MCP endpoint URL. Defaults to https://hiveagentiq.com/mcp
            timeout: HTTP request timeout in seconds. Defaults to 30.
            api_key: Optional API key for authenticated requests.
        """
        self.endpoint = endpoint
        self.timeout = timeout
        self._headers: dict[str, str] = {"Content-Type": "application/json"}
        if api_key:
            self._headers["Authorization"] = f"Bearer {api_key}"

    # ── JSON-RPC transport ────────────────────────────────────────────────────

    def _rpc(self, method: str, params: Any = None) -> Any:
        """
        Send a JSON-RPC 2.0 request and return the result.

        Args:
            method: JSON-RPC method name.
            params: Method parameters (dict or list).

        Returns:
            The 'result' field of the JSON-RPC response.

        Raises:
            HiveAgentError: If the server returns an error or the request fails.
        """
        payload = {
            "jsonrpc": "2.0",
            "id": str(uuid.uuid4()),
            "method": method,
        }
        if params is not None:
            payload["params"] = params

        try:
            response = httpx.post(
                self.endpoint,
                json=payload,
                headers=self._headers,
                timeout=self.timeout,
            )
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HiveAgentError(f"HTTP error communicating with HiveAgent: {exc}") from exc

        data = response.json()

        if "error" in data:
            err = data["error"]
            raise HiveAgentError(
                f"HiveAgent API error {err.get('code', 'unknown')}: {err.get('message', 'unknown error')}"
            )

        return data.get("result")

    # ── MCP protocol methods ──────────────────────────────────────────────────

    def list_tools(self) -> list[dict]:
        """
        List all available MCP tools.

        Returns:
            List of tool definition dicts, each with 'name', 'description',
            and 'inputSchema' fields.

        Example::

            tools = client.list_tools()
            for tool in tools:
                print(tool['name'], '-', tool['description'])
        """
        result = self._rpc("tools/list")
        if isinstance(result, dict) and "tools" in result:
            return result["tools"]
        return result or []

    def call_tool(self, name: str, args: Optional[dict] = None) -> Any:
        """
        Call a specific MCP tool.

        Args:
            name: Tool name (e.g. 'insurance_claim_intake').
            args: Tool arguments as a dict. Defaults to empty dict.

        Returns:
            Tool result. Structure depends on the tool called.

        Example::

            result = client.call_tool("hiveagent_discover", {
                "query": "process insurance claims"
            })
        """
        result = self._rpc("tools/call", {"name": name, "arguments": args or {}})
        if isinstance(result, dict) and "content" in result:
            content = result["content"]
            if isinstance(content, list) and content:
                first = content[0]
                if isinstance(first, dict) and first.get("type") == "text":
                    import json
                    try:
                        return json.loads(first["text"])
                    except (json.JSONDecodeError, KeyError):
                        return first.get("text", result)
        return result

    def discover(self, query: str) -> dict:
        """
        Discover the best HiveAgent tools for a given task description.

        Uses semantic search across all 586 tools to find the most
        relevant ones for your use case.

        Args:
            query: Natural-language description of what you want to do.

        Returns:
            Dict with 'tools', 'suggested_workflow', and 'verticals' fields.

        Example::

            results = client.discover("I need to validate supplier invoices")
            for tool in results['tools']:
                print(tool['name'])
        """
        return self.call_tool("hiveagent_discover", {"query": query})

    def suggest_workflow(self, task: str) -> dict:
        """
        Get a step-by-step workflow for a complex task.

        Args:
            task: Description of the end-to-end task to accomplish.

        Returns:
            Dict with 'workflow_name', 'steps', 'tools_used', and
            'estimated_time' fields.

        Example::

            workflow = client.suggest_workflow(
                "Process an end-to-end insurance claim from intake to settlement"
            )
            for step in workflow['steps']:
                print(step['order'], step['tool'], step['description'])
        """
        return self.call_tool("hiveagent_suggest_workflow", {"task": task})

    def list_verticals(self) -> list[str]:
        """
        List all 22 industry verticals available on HiveAgent.

        Returns:
            List of vertical name strings.
        """
        result = self.call_tool("hiveagent_vertical_guide", {"vertical": "all"})
        if isinstance(result, dict) and "verticals" in result:
            return result["verticals"]
        # Fallback to static list
        from .tools import VERTICALS
        return VERTICALS


# ── Module-level convenience functions ───────────────────────────────────────

_default_client: Optional[HiveAgent] = None


def _get_default_client() -> HiveAgent:
    """Return (or create) the module-level default client."""
    global _default_client
    if _default_client is None:
        _default_client = HiveAgent()
    return _default_client


def discover(query: str) -> dict:
    """
    Module-level shortcut: discover tools for a task.

    Creates a default HiveAgent client and calls discover().

    Args:
        query: Natural-language description of what you want to do.

    Returns:
        Dict with matching tools, suggested workflow, and verticals.

    Example::

        from hiveagent import discover
        results = discover("process insurance claims automatically")
    """
    return _get_default_client().discover(query)


def search(query: str) -> dict:
    """
    Module-level shortcut: alias for discover().

    Args:
        query: Natural-language search query.

    Returns:
        Dict with matching tools and metadata.

    Example::

        from hiveagent import search
        results = search("fraud detection financial transactions")
    """
    return _get_default_client().discover(query)
