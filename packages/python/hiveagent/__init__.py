"""
HiveAgent MCP Client
====================
Connect to HiveAgent — 586 MCP tools across 22 industry verticals.
The Amazon for AI agents.

Quick start::

    from hiveagent import HiveAgent

    agent = HiveAgent()
    tools = agent.list_tools()

    # Or use module-level shortcuts
    from hiveagent import discover, search
    results = discover("I need to process insurance claims")

Full docs: https://hiveagentiq.com/docs
"""

from .client import HiveAgent, discover, search
from .tools import get_tools, get_tool, list_verticals

__version__ = "1.0.0"
__all__ = [
    "HiveAgent",
    "discover",
    "search",
    "get_tools",
    "get_tool",
    "list_verticals",
]
