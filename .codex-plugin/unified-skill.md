---
name: model-usage
description: "Report the current Codex session's real token usage and the remaining ChatGPT/Codex subscription quota (5-hour window and weekly window). Use when the user asks how much quota or tokens are left, how much of the subscription is used, when the limit resets, or wants that figure shown on the desktop pet."
---

# 用量与订阅额度

从 Codex 自己的会话日志读出**真实**用量与剩余额度。

```bash
node "<plugin-root>/scripts/usage.mjs"
```

只取一行摘要（≤50 字符，可直接喂给 `update_running_summary`）：

```bash
node "<plugin-root>/scripts/usage.mjs" --summary
# → gpt-5.5 · 5h 剩 93% · 周 剩 99%
```

原始 `rate_limits`：`--raw`

## 输出字段

| 字段 | 含义 |
|---|---|
| `model` | 当前模型（`config.toml`） |
| `windows[]` | 订阅周期窗口：`5h` / `周`，各含 `usedPercent`、`remainingPercent`、`resetsAt`、`resetsIn` |
| `credits` | 账号额度状态 |
| `tokens` | 本会话 token：total / input / cachedInput / output / reasoningOutput |
| `summary` | 单行摘要 |

## 口径

- 模型来自 `$CODEX_HOME/config.toml`（默认 `~/.codex/config.toml`）
- 额度与 token 来自最近改动的 `~/.codex/sessions/**/rollout-*.jsonl` 中最后一条
  `token_count` 事件
- `primary` = 5 小时窗口（300 分），`secondary` = 每周窗口（10080 分）
- 剩余% = `100 - used_percent`

## 推到宠物活动条

用 `update_running_summary`（`codex_app` 命名空间；被延迟加载时先用工具检索找到），
把 `--summary` 的输出原样传进去：

```json
{ "summary": "gpt-5.5 · 5h 剩 93% · 周 剩 99%" }
```

约束：**1–50 字符、单行**；只在阶段变化时更新，不要定时刷新。

会话日志还没落盘时 `windows` 为空 —— 如实说明，不要编造。
