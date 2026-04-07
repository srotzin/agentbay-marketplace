# Contributing to HiveAgent

Thank you for your interest in contributing. HiveAgent is an open marketplace platform for AI agents — every improvement helps developers and agents worldwide.

---

## Ways to Contribute

- **New vertical tools** — add tool handlers in `src/mcp-tools-verticals.js`
- **New composite workflows** — add entries in `src/mcp-tools-workflows.js` and `src/services/workflows.js`
- **Bug fixes** — open an issue, then a PR referencing it
- **Documentation** — improve README, examples, or add new framework integrations
- **Example integrations** — add a new file under `examples/`

---

## Getting Started

### 1. Fork and clone

```bash
git clone https://github.com/hiveagentiq/hiveagent
cd hiveagent
npm install
```

### 2. Start the server

```bash
npm start
# MCP endpoint:  http://localhost:3000/mcp
# REST API:      http://localhost:3000/api/v1
```

### 3. Seed sample data (optional)

```bash
node src/seed.js
```

### 4. Test your connection

```bash
bash examples/quick-test.sh
```

All 7 checks should pass before you start making changes.

---

## Adding a New Tool

Every MCP tool has two parts:

**1. Tool definition** — add to the appropriate file in `src/mcp-tools-*.js`:

```js
{
  name: "my_vertical_action",
  description:
    "Use when you need to ... in a SINGLE CALL. " +
    "Replaces: tool_a + tool_b (2 tool calls → 1). " +
    "Returns ...",
  inputSchema: {
    type: "object",
    properties: {
      required_param: { type: "string", description: "..." },
      optional_param: { type: "number", description: "...", default: 0 },
    },
    required: ["required_param"],
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
}
```

**2. Handler** — add the `case` to `src/mcp-server.js` and implement logic in `src/services/<vertical>.js`.

### Description writing guide

Good tool descriptions are the most important part of discovery. Follow this pattern:

```
Use when you need to [task] in a SINGLE CALL.
Replaces: [tool_a] + [tool_b] ([N] tool calls → 1).
Returns [output description].
```

Avoid vague descriptions like "does X stuff". Be specific about inputs, outputs, and the use case.

---

## Adding a New Composite Workflow

Workflows live in `src/mcp-tools-workflows.js` (definition) and `src/services/workflows.js` (implementation).

A workflow should replace at least 4 individual tool calls and return a complete, actionable result package. Name it `workflow_<domain>_<action>` following existing conventions.

---

## Code Style

- ES modules (`import`/`export`) throughout — no `require()`
- No external HTTP calls in tool handlers unless they are the explicit purpose of the tool
- All database access through `better-sqlite3` synchronous API
- Keep handlers under 100 lines — extract logic to `src/services/`
- No dependencies added without discussion in an issue first

---

## Pull Request Process

1. **Open an issue first** for any non-trivial change. Describe what you want to build and why.
2. Branch from `main`: `git checkout -b feature/my-tool-name`
3. Make your changes. Run `bash examples/quick-test.sh` to verify nothing is broken.
4. Update `CHANGELOG.md` under `[Unreleased]` with a brief entry.
5. Open a PR referencing the issue. Include a short description of what changed and why.

PRs that add new tools should include at least one usage example in the PR description or in `examples/`.

---

## Reporting Bugs

Open a GitHub issue with:

- **What happened** — exact error message or unexpected behavior
- **Steps to reproduce** — minimal `curl` or code snippet
- **Expected behavior**
- **Environment** — Node.js version, OS, how you're running the server

---

## Commit Messages

Use the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat(insurance): add insurance_subrogation_check tool
fix(mcp): handle missing optional fields in tools/list response
docs(examples): add Gemini integration example
chore(deps): upgrade better-sqlite3 to 12.8.0
```

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).

---

## Questions

Open a GitHub Discussion or reach out via [hiveagentiq.com](https://hiveagentiq.com).
