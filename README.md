# Codex 大肥魚記賬掛件 · 勛

Codex 用量掛件：讀 Codex 自己的會話日誌，回報真實 token 用量與訂閱額度剩餘，並可推到寵物活動條。

> 本倉庫為 **勛** 的版本，改編自
> [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)（DeepSeek Harness 的大肥魚桌寵，MIT）與
> [MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)（小鯨魚記賬掛件，MIT）。
> 角色形象為社群二創的 DeepSeek「大肥魚」（鯨魚娘），非官方形象，美術素材 CC BY-NC-SA 4.0（禁止商用）。
> 詳見 [LICENSE](LICENSE)。

---

# 用量挂件 · Codex（usage-gauge）

显示 **当前 Codex 会话的真实用量**与**会员订阅周期剩余额度**，并能把摘要推到桌面宠物的活动条上。

## 用法

```bash
node scripts/usage.mjs            # 完整 JSON
node scripts/usage.mjs --summary  # 单行摘要（≤50 字符）
node scripts/usage.mjs --raw      # 原始 rate_limits
```

实测输出：

```
gpt-5.5 · 5h 剩 93% · 周 剩 99%
```

## 数据来源

| 来源 | 内容 |
|---|---|
| `~/.codex/config.toml` | 当前模型、provider、推理档位 |
| `~/.codex/sessions/**/rollout-*.jsonl` | 最后一条 `token_count` 事件里的 `rate_limits` 与 `total_token_usage` |

窗口口径：

- `primary` = **5 小时**（`window_minutes: 300`）
- `secondary` = **每周**（`window_minutes: 10080`）
- `used_percent` 是已用%，剩余 = `100 - used_percent`

## 推到宠物活动条

配合 `update_running_summary`（`codex_app` 命名空间）：

```json
{ "summary": "gpt-5.5 · 5h 剩 93% · 周 剩 99%" }
```

约束：**1–50 字符、单行**；只在阶段变化时更新，不要定时刷新。

## 目录

```
codex-usage-gauge/
├── .codex-plugin/
│   ├── plugin.json
│   └── unified-skill.md
├── assets/
│   ├── logo.png
│   └── composer-icon.png
├── scripts/
│   └── usage.mjs
└── skills/model-usage/
    ├── SKILL.md
    └── agents/openai.yaml
```

## 说明

- 额度来自 **Codex 账号的订阅限制**（ChatGPT 订阅的 5h / 每周窗口），不是某个模型的 API 计费
- 会话刚开始、日志还没落盘时，`windows` 会是空的 —— 此时如实说明，不要编造
- 纯本地读取，不联网、不改任何文件
