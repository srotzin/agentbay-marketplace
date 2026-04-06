"""
HiveAgent CrewAI Integration

Drop-in CrewAI tools giving any crew access to all 586 HiveAgent tools.

Install::

    pip install "hiveagent-mcp[crewai]"

Usage (2 lines)::

    from hiveagent.crewai import HiveAgentTools
    tools = HiveAgentTools().get_tools()
"""

from __future__ import annotations

import json
from typing import Any, Optional, Type

from .client import HiveAgent, DEFAULT_ENDPOINT

try:
    from crewai.tools import BaseTool as CrewAIBaseTool  # type: ignore[import]
    from pydantic import BaseModel, Field  # type: ignore[assignment]
    _CREWAI_AVAILABLE = True
except ImportError:
    try:
        from crewai_tools import BaseTool as CrewAIBaseTool  # type: ignore[import,assignment]
        from pydantic import BaseModel, Field  # type: ignore[assignment]
        _CREWAI_AVAILABLE = True
    except ImportError:
        _CREWAI_AVAILABLE = False


def _require_crewai() -> None:
    if not _CREWAI_AVAILABLE:
        raise ImportError(
            "CrewAI is required for HiveAgentTools. "
            'Install it with: pip install "hiveagent-mcp[crewai]"'
        )


def _make_crewai_tool(name: str, description: str, client: HiveAgent) -> Any:
    """
    Dynamically build a CrewAI BaseTool subclass for a given MCP tool.

    CrewAI tools require a concrete class (not an instance), so we
    generate one per tool using type().
    """

    class _InputSchema(BaseModel):
        arguments: Optional[dict] = Field(
            default=None,
            description="Arguments to pass to the tool as a JSON object. "
                        "Omit or pass {} to run with defaults.",
        )

    def _run_tool(self_inner: Any, **kwargs: Any) -> str:
        args = kwargs.get("arguments") or {}
        result = client.call_tool(name, args)
        if isinstance(result, (dict, list)):
            return json.dumps(result, indent=2)
        return str(result)

    tool_class = type(
        f"HiveAgent_{name}",
        (CrewAIBaseTool,),
        {
            "name": name,
            "description": description,
            "args_schema": _InputSchema,
            "_run": _run_tool,
        },
    )
    return tool_class()


class HiveAgentTools:
    """
    Drop-in CrewAI tools. 2 lines to add 586 tools.

    Converts all HiveAgent MCP tools (or a filtered subset) into
    CrewAI-compatible tool objects that can be assigned to any agent.

    Example (2 lines)::

        from hiveagent.crewai import HiveAgentTools
        tools = HiveAgentTools().get_tools()

    Then assign to a crew agent::

        from crewai import Agent
        analyst = Agent(
            role="Insurance Analyst",
            goal="Process insurance claims end to end",
            tools=HiveAgentTools(verticals=["insurance"]).get_tools(),
        )

    Filter to specific verticals::

        from hiveagent.crewai import HiveAgentTools

        insurance_tools = HiveAgentTools(verticals=["insurance", "fraud_detection"]).get_tools()
        legal_tools     = HiveAgentTools(verticals=["legal"]).get_tools()

    Full crew example::

        from crewai import Agent, Task, Crew
        from hiveagent.crewai import HiveAgentTools

        tools = HiveAgentTools().get_tools()

        agent = Agent(
            role="Claims Processor",
            goal="Handle insurance claims efficiently",
            backstory="Expert in insurance workflows",
            tools=tools,
        )

        task = Task(
            description="Process the incoming claim for policy POL-12345",
            agent=agent,
        )

        crew = Crew(agents=[agent], tasks=[task])
        crew.kickoff()
    """

    def __init__(
        self,
        verticals: Optional[list[str]] = None,
        endpoint: str = DEFAULT_ENDPOINT,
        api_key: Optional[str] = None,
    ) -> None:
        """
        Initialise the tool collection.

        Args:
            verticals: Optional list of verticals to include. E.g.
                       ['insurance', 'legal']. None = all verticals.
            endpoint: HiveAgent MCP endpoint URL.
            api_key: Optional API key.
        """
        _require_crewai()
        self.client = HiveAgent(endpoint=endpoint, api_key=api_key)
        self.verticals = [v.lower() for v in verticals] if verticals else None
        self._tools: Optional[list] = None

    def get_tools(self) -> list:
        """
        Return a list of CrewAI-compatible tool objects.

        Fetches tool definitions from the HiveAgent MCP endpoint on
        first call, then caches the result.

        Returns:
            List of CrewAI tool objects ready to assign to an Agent.

        Example::

            from hiveagent.crewai import HiveAgentTools
            tools = HiveAgentTools().get_tools()
        """
        if self._tools is not None:
            return self._tools

        raw_tools = self.client.list_tools()

        if self.verticals:
            raw_tools = [
                t for t in raw_tools
                if any(v in t.get("name", "").lower() for v in self.verticals)
            ]

        self._tools = [
            _make_crewai_tool(
                name=t["name"],
                description=t.get("description", f"HiveAgent tool: {t['name']}"),
                client=self.client,
            )
            for t in raw_tools
        ]
        return self._tools

    def get_vertical(self, vertical: str) -> list:
        """
        Get tools for a single vertical.

        Args:
            vertical: Vertical name, e.g. 'insurance'.

        Returns:
            List of CrewAI tools for that vertical.
        """
        return HiveAgentTools(
            verticals=[vertical],
            endpoint=self.client.endpoint,
        ).get_tools()

    def split_by_vertical(self) -> dict[str, list]:
        """
        Get tools split by vertical — useful for assigning specialised
        tools to specialised agents.

        Returns:
            Dict mapping vertical name → list of CrewAI tools.

        Example::

            tool_sets = HiveAgentTools().split_by_vertical()
            claims_agent = Agent(tools=tool_sets["insurance"])
            legal_agent  = Agent(tools=tool_sets["legal"])
        """
        all_raw = self.client.list_tools()
        by_vertical: dict[str, list] = {}

        for t in all_raw:
            name = t.get("name", "")
            description = t.get("description", f"HiveAgent tool: {name}")
            # Infer vertical from name prefix
            vertical = name.split("_")[0] if "_" in name else "platform"
            tool_obj = _make_crewai_tool(name=name, description=description, client=self.client)
            by_vertical.setdefault(vertical, []).append(tool_obj)

        return by_vertical
