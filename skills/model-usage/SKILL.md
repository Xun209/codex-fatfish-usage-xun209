---
name: model-usage
description: "Report the current Codex session's real token usage and the remaining ChatGPT/Codex subscription quota (5-hour window and weekly window). Use when the user asks how much quota or tokens are left, how much of the subscription is used, when the limit resets, or wants that figure shown on the desktop pet."
---

# 用量与订阅额度

读 Codex 自己的会话日志，拿到**真实**的用量与剩余额度（不是估算）。

## 一条命令拿到全部

```bash
node "<plugin-root>/scripts/usage.mjs"
```

输出 JSON：

| 字段 | 含义 |
|---|---|
| `model` | 当前模型（取自 `config.toml`） |
| `windows[]` | 订阅周期窗口：`label`（`5h` / `周`）、`usedPercent`、`remainingPercent`、`resetsAt`、`resetsIn` |
| `credits` | 账号额度状态：`hasCredits` / `unlimited` / `balance` |
| `tokens` | 本会话累计 token：`total` / `input` / `cachedInput` / `output` / `reasoningOutput` |
| `contextWindow` | 上下文窗口大小 |
| `summary` | 已拼好的单行摘要（≤50 字符） |

只要那一行摘要（可直接喂给 `update_running_summary`）：

```bash
node "<plugin-root>/scripts/usage.mjs" --summary
# → gpt-5.5 · 5h 剩 93% · 周 剩 99%
```

只看原始 `rate_limits` 片段：`--raw`

## 数据来源与口径

- **模型**：`$CODEX_HOME/config.toml` 的顶层 `model`（默认 `~/.codex/config.toml`）
- **额度与 token**：最近改动的 `~/.codex/sessions/**/rollout-*.jsonl` 里，
  最后一条 `token_count` 事件的 `rate_limits` 与 `info.total_token_usage`
- `rate_limits.primary` = **5 小时窗口**（`window_minutes: 300`）
- `rate_limits.secondary` = **每周窗口**（`window_minutes: 10080`）
- `used_percent` 是**已用**百分比，剩余 = `100 - used_percent`
- `resets_at` 是 Unix 秒，脚本已换算成 `resetsAt`(ISO) 与 `resetsIn`（人类可读）

## 推给宠物活动条

用户想让用量一直挂在桌面宠物旁边时，用 `update_running_summary`
（`codex_app` 命名空间；若被延迟加载，先用工具检索找到它）：

1. 先跑一次 `usage.mjs --summary`
2. 把结果原样作为 `summary` 传给 `update_running_summary`

```json
{ "summary": "gpt-5.5 · 5h 剩 93% · 周 剩 99%" }
```

约束（Codex 内置约定）：**1–50 字符、单行**；只在高层阶段变化时更新，不要定时刷新。

## 注意

- 会话日志可能还没落盘（刚开始的对话），此时 `windows` 为空、`tokens` 为 null ——
  如实说明「本会话还没有用量数据」，不要编造
- `resetsIn` 显示「即将重置」表示该窗口已到期
- 额度来自 Codex 账号的订阅限制，与具体模型的 API 计费无关
