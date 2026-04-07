<div align="center">
  <img src="public/assets/logo.jpeg" alt="HiveAgent" width="120">
  <h1>HiveAgent</h1>
  <p><strong>Agentzon — AI 智能体的亚马逊</strong></p>
  <p>610 MCP 工具 &nbsp;·&nbsp; 22 个垂直领域 &nbsp;·&nbsp; 15 个复合工作流 &nbsp;·&nbsp; Base L2 USDC 支付</p>

  [![Smithery](https://smithery.ai/badge/@hiveagentiq/hiveagent)](https://smithery.ai/server/@hiveagentiq/hiveagent)
  [![Tools](https://img.shields.io/badge/MCP%20工具-610-F59E0B)](https://hiveagentiq.com)
  [![Score](https://img.shields.io/badge/Smithery-95%2F100-brightgreen)](https://smithery.ai/server/@hiveagentiq/hiveagent)
  [![License](https://img.shields.io/badge/许可证-MIT-blue)](LICENSE)
</div>

> **English version:** [README.md](README.md)

---

## ⚡ 10 秒接入

将以下配置添加到你的 MCP 客户端，即可立即获得 610 个真实世界工具：

```json
{
  "mcpServers": {
    "hiveagent": {
      "url": "https://hiveagentiq.com/mcp"
    }
  }
}
```

**无需 API 密钥。无需安装 SDK。无需注册账号。** 一个端点，610 个工具，即刻可用。

---

## 🗂 智能体能做什么？

610 个工具横跨 22 个行业垂直领域。每个工具通过单次 JSON-RPC 2.0 请求即可调用。

| 垂直领域 | 工具数 | 示例工具 |
|---|---|---|
| 🏥 医疗健康 | 28 | `health_prior_auth`, `health_clinical_note`, `health_claim_codes`, `health_interpret_labs` |
| ⚖️ 法律服务 | 26 | `legal_intake_case`, `legal_search_case_law`, `legal_demand_letter`, `legal_track_deadlines` |
| 🏗️ 建筑工程 | 30 | `construction_lookup_zoning`, `construction_permit_status`, `construction_material_takeoff`, `construction_match_subcontractor` |
| 🛡️ 保险理赔 | 28 | `insurance_claim_intake`, `insurance_assess_damage`, `insurance_check_subrogation`, `insurance_adjuster_report` |
| 🔧 技工行业 | 24 | `trades_lookup_permits`, `trades_estimate_job`, `trades_find_parts`, `trades_generate_invoice` |
| 💼 中小企业财务 | 26 | `smb_categorize_transaction`, `smb_prep_tax`, `smb_compare_insurance`, `smb_generate_contract` |
| 🌾 农业农村 | 20 | `ag_identify_crop_issue`, `ag_forecast_yield`, `ag_weather_advisory`, `ag_market_prices` |
| 🏛️ 政府服务 | 22 | `gov_lookup_license`, `gov_permit_requirements`, `gov_foia_request`, `gov_monitor_contract_bids` |
| 📦 贸易与海关 | 24 | `trade_classify_hs`, `trade_screen_sanctions`, `trade_calculate_duty`, `trade_generate_customs_docs` |
| 🛒 电子商务 | 22 | `commerce_verify_product`, `commerce_merchant_trust`, `commerce_detect_manipulation`, `commerce_risk_assessment` |
| 💱 去中心化金融 | 26 | `hiveagent_defi_swap`, `hiveagent_defi_yield_pools`, `hiveagent_defi_prices`, `hiveagent_stables_convert` |
| 💰 金融支付 | 22 | `hiveagent_pay_send`, `hiveagent_xborder_transfer`, `hiveagent_savings_deposit`, `hiveagent_credit_apply` |
| ✈️ 旅游出行 | 20 | `travel_search_flights`, `travel_search_hotels`, `travel_compare_car_rentals`, `travel_visa_requirements` |
| 🔍 反欺诈 | 18 | `fraud_screen_transaction`, `fraud_detect_anomalies`, `fraud_check_identity`, `fraud_predict_chargeback` |
| 📊 销售 | 20 | `sales_enrich_lead`, `sales_score_lead`, `sales_generate_outreach`, `sales_forecast_pipeline` |
| 🎓 教育 | 18 | `edu_verify_credential`, `edu_generate_curriculum`, `edu_track_progress`, `edu_check_financial_aid` |
| 🔒 身份与隐私 | 16 | `hiveagent_privacy_shield`, `hiveagent_rep_score`, `hiveagent_kyc_verify`, `hiveagent_aml_screen` |
| ⚙️ 企业管理 | 20 | `hiveagent_webhook_register`, `hiveagent_sched_job`, `hiveagent_audit_log`, `hiveagent_tenant_setup` |
| 🧩 合规监管 | 18 | `compliance_sanctions_screen`, `compliance_regulatory_check`, `compliance_report_generate` |
| 🖥️ 算力市场 | 16 | `hiveagent_mem_store`, `hiveagent_code_sandbox`, `compute_gpu_rent`, `compute_inference_run` |
| 🌐 服务市场 | 20 | `hiveagent_search`, `hiveagent_buy`, `hiveagent_auction_create`, `hiveagent_escrow_create` |
| 🔄 多智能体恢复 | 16 | `recovery_check_health`, `recovery_circuit_status`, `recovery_initiate_handoff`, `recovery_start_trace` |

---

## 🔀 复合工作流

15 个单次调用的复合工作流，替代整条多工具链。

| 工作流 | 替代工具数 | 返回内容 |
|---|---|---|
| `workflow_full_insurance_claim` | 4 → 1 | 承保录入 + 损失评估 + 代位追偿 + 理赔师报告 |
| `workflow_construction_project` | 5 → 1 | 区划分析 + 许可证 + 材料清单 + 分包商匹配 + 付款计划 |
| `workflow_legal_case_setup` | 4 → 1 | 案件录入 + 档案摘要 + 截止日期 + 判例引用 |
| `workflow_healthcare_encounter` | 4 → 1 | 预授权 + SOAP 病历 + ICD-10/CPT 编码 + HIPAA 确认 |
| `workflow_international_shipment` | 5 → 1 | HS 编码 + 制裁筛查 + 关税计算 + 报关文件 |
| `workflow_book_full_trip` | 6 → 1 | 机票 + 酒店 + 租车 + 餐厅 + 行程单 + 签证要求 |
| `workflow_full_fraud_check` | 5 → 1 | 风险评分 + 异常检测 + 身份核验 + 拒付预测 |
| `workflow_full_sales_cycle` | 5 → 1 | 线索丰富 + ICP 评分 + 邮件序列 + 会议预约 + 管道预测 |

---

## 🔌 多平台接入

### Claude Desktop

将以下内容添加到 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "hiveagent": {
      "url": "https://hiveagentiq.com/mcp"
    }
  }
}
```

### Cursor / VS Code

```json
{
  "mcp": {
    "servers": {
      "hiveagent": {
        "url": "https://hiveagentiq.com/mcp",
        "type": "http"
      }
    }
  }
}
```

### LangChain（Python）

```python
import httpx, json, asyncio

HIVEAGENT_URL = "https://hiveagentiq.com/mcp"

async def call_hiveagent(tool_name: str, arguments: dict) -> dict:
    payload = {
        "jsonrpc": "2.0", "id": 1,
        "method": "tools/call",
        "params": {"name": tool_name, "arguments": arguments}
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(HIVEAGENT_URL, json=payload,
                              headers={"Content-Type": "application/json"})
        content = r.json()["result"]["content"]
        return json.loads(content[0]["text"])
```

完整示例：[`examples/langchain-example.py`](examples/langchain-example.py)

### CrewAI

```python
from crewai_tools import tool

@tool("HiveAgent 保险理赔")
def file_insurance_claim(claim_type: str, policy_number: str) -> str:
    """端到端处理一笔完整的保险理赔。"""
    return asyncio.run(call_hiveagent("workflow_full_insurance_claim", {
        "claim_type": claim_type,
        "policy_number": policy_number
    }))
```

完整示例：[`examples/crewai-example.py`](examples/crewai-example.py)

### AutoGen / AG2

```python
import autogen

hiveagent_tools = {
    "process_claim": lambda **kw: call_tool_sync("workflow_full_insurance_claim", kw),
    "book_trip":     lambda **kw: call_tool_sync("workflow_book_full_trip", kw),
}

agent = autogen.AssistantAgent(
    name="HiveAgent",
    llm_config={"config_list": [{"model": "gpt-4o", "api_key": "sk-..."}]},
    function_map=hiveagent_tools,
)
```

完整示例：[`examples/autogen-example.py`](examples/autogen-example.py)

### OpenAI Agents SDK

```python
from agents import Agent, function_tool

@function_tool
def book_trip(origin: str, destination: str, departure_date: str) -> str:
    """预订包含机票、酒店和接送的完整行程。"""
    return call_tool_sync("workflow_book_full_trip", {
        "origin": origin,
        "destination": destination,
        "departure_date": departure_date
    })

travel_agent = Agent(name="旅行助手", tools=[book_trip])
```

完整示例：[`examples/openai-agents-example.py`](examples/openai-agents-example.py)

---

## 🔗 相关链接

| 资源 | 地址 |
|---|---|
| 官网 | [hiveagentiq.com](https://hiveagentiq.com) |
| Smithery（95/100 分） | [smithery.ai/server/@hiveagentiq/hiveagent](https://smithery.ai/server/@hiveagentiq/hiveagent) |
| MCP 端点 | [hiveagentiq.com/mcp](https://hiveagentiq.com/mcp) |
| 集成示例 | [examples/](examples/) |
| LLMs.txt | [hiveagentiq.com/llms.txt](https://hiveagentiq.com/llms.txt) |
| 国库地址（Base L2） | [`0x00383412D3d9B42540a4D536e4190b71d7d982b9`](https://basescan.org/address/0x00383412D3d9B42540a4D536e4190b71d7d982b9) |

---

<div align="center">
  <sub>由 <a href="https://hiveagentiq.com">HiveAgent DAO LLC</a> 构建 · 怀俄明州注册 · Base L2 驱动 · MIT 许可证</sub>
</div>
