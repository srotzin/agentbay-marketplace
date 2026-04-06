"""
HiveAgent LangChain Integration

Drop-in LangChain toolkit giving any agent access to all 586 HiveAgent tools.

Install::

    pip install "hiveagent-mcp[langchain]"

Usage (3 lines)::

    from hiveagent.langchain import HiveAgentToolkit
    toolkit = HiveAgentToolkit()
    agent = create_react_agent(llm, toolkit.get_tools())
"""

from __future__ import annotations

import json
from typing import Any, Optional, Type

from .client import HiveAgent, DEFAULT_ENDPOINT

try:
    from langchain_core.tools import StructuredTool, BaseTool
    from langchain_core.pydantic_v1 import BaseModel, Field, create_model
    _LANGCHAIN_AVAILABLE = True
except ImportError:
    try:
        from langchain.tools import StructuredTool, BaseTool  # type: ignore[assignment]
        from pydantic.v1 import BaseModel, Field, create_model  # type: ignore[assignment]
        _LANGCHAIN_AVAILABLE = True
    except ImportError:
        _LANGCHAIN_AVAILABLE = False


def _require_langchain() -> None:
    if not _LANGCHAIN_AVAILABLE:
        raise ImportError(
            "LangChain is required for HiveAgentToolkit. "
            'Install it with: pip install "hiveagent-mcp[langchain]"'
        )


def _build_args_schema(tool_def: dict) -> Type:
    """Build a Pydantic model from an MCP tool's inputSchema."""
    schema = tool_def.get("inputSchema", {})
    properties = schema.get("properties", {})
    required = set(schema.get("required", []))

    fields: dict[str, Any] = {}
    for prop_name, prop_schema in properties.items():
        description = prop_schema.get("description", "")
        prop_type = prop_schema.get("type", "string")

        python_type: Any
        if prop_type == "integer":
            python_type = int
        elif prop_type == "number":
            python_type = float
        elif prop_type == "boolean":
            python_type = bool
        elif prop_type == "array":
            python_type = list
        elif prop_type == "object":
            python_type = dict
        else:
            python_type = str

        if prop_name in required:
            fields[prop_name] = (python_type, Field(description=description))
        else:
            fields[prop_name] = (Optional[python_type], Field(default=None, description=description))

    if not fields:
        # Fallback: single 'query' field
        fields["query"] = (Optional[str], Field(default=None, description="Tool input"))

    return create_model(f"_{tool_def['name']}_args", **fields)


class HiveAgentToolkit:
    """
    Drop-in LangChain toolkit. 3 lines to add 586 tools.

    Converts all HiveAgent MCP tools (or a filtered subset) into
    LangChain StructuredTool objects that can be passed directly to
    any LangChain agent.

    Example (3 lines)::

        from hiveagent.langchain import HiveAgentToolkit
        toolkit = HiveAgentToolkit()
        agent = create_react_agent(llm, toolkit.get_tools())

    Filter to specific verticals::

        toolkit = HiveAgentToolkit(verticals=["insurance", "fraud_detection"])

    Use a custom endpoint::

        toolkit = HiveAgentToolkit(endpoint="https://hiveagentiq.com/mcp")
    """

    def __init__(
        self,
        verticals: Optional[list[str]] = None,
        endpoint: str = DEFAULT_ENDPOINT,
        api_key: Optional[str] = None,
        lazy_load: bool = True,
    ) -> None:
        """
        Initialise the toolkit.

        Args:
            verticals: Optional list of verticals to include. E.g.
                       ['insurance', 'legal']. None = all verticals.
            endpoint: HiveAgent MCP endpoint URL.
            api_key: Optional API key.
            lazy_load: If True (default), tools are fetched on first
                       call to get_tools() rather than at init time.
        """
        _require_langchain()
        self.client = HiveAgent(endpoint=endpoint, api_key=api_key)
        self.verticals = [v.lower() for v in verticals] if verticals else None
        self._tools: Optional[list] = None
        if not lazy_load:
            self._tools = self._fetch_tools()

    def _fetch_tools(self) -> list:
        """Fetch and convert all matching tools from the MCP endpoint."""
        raw_tools = self.client.list_tools()

        if self.verticals:
            raw_tools = [
                t for t in raw_tools
                if any(v in t.get("name", "").lower() for v in self.verticals)
            ]

        return [self._to_langchain_tool(t) for t in raw_tools]

    def _to_langchain_tool(self, tool_def: dict) -> "StructuredTool":
        """Convert a single MCP tool definition to a LangChain StructuredTool."""
        name = tool_def["name"]
        description = tool_def.get("description", f"HiveAgent tool: {name}")
        client = self.client

        # Build args schema from MCP inputSchema
        try:
            args_schema = _build_args_schema(tool_def)
        except Exception:
            # Graceful fallback if schema parsing fails
            class _FallbackArgs(BaseModel):  # type: ignore[misc]
                query: Optional[str] = Field(default=None, description="Tool input")
            args_schema = _FallbackArgs

        def _run(**kwargs: Any) -> str:
            """Execute the HiveAgent tool."""
            # Filter out None values
            args = {k: v for k, v in kwargs.items() if v is not None}
            result = client.call_tool(name, args)
            if isinstance(result, (dict, list)):
                return json.dumps(result, indent=2)
            return str(result)

        async def _arun(**kwargs: Any) -> str:
            """Async execution (runs sync for now — use async httpx for full async)."""
            return _run(**kwargs)

        return StructuredTool(
            name=name,
            description=description,
            args_schema=args_schema,
            func=_run,
            coroutine=_arun,
        )

    def get_tools(self) -> list:
        """
        Return a list of LangChain StructuredTool objects.

        Fetches tool definitions from the HiveAgent MCP endpoint on
        first call, then caches the result.

        Returns:
            List of LangChain StructuredTool objects.

        Example::

            from langchain.agents import create_react_agent
            from hiveagent.langchain import HiveAgentToolkit

            toolkit = HiveAgentToolkit()
            tools = toolkit.get_tools()
            agent = create_react_agent(llm, tools)
        """
        if self._tools is None:
            self._tools = self._fetch_tools()
        return self._tools

    def get_insurance_tools(self) -> list:
        """Convenience: get insurance vertical tools only."""
        return HiveAgentToolkit(
            verticals=["insurance"],
            endpoint=self.client.endpoint,
        ).get_tools()

    def get_legal_tools(self) -> list:
        """Convenience: get legal vertical tools only."""
        return HiveAgentToolkit(
            verticals=["legal"],
            endpoint=self.client.endpoint,
        ).get_tools()

    def get_healthcare_tools(self) -> list:
        """Convenience: get healthcare vertical tools only."""
        return HiveAgentToolkit(
            verticals=["health"],
            endpoint=self.client.endpoint,
        ).get_tools()
