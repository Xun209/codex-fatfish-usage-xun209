# 安装说明 —— 请交给 Codex 里的 AI 执行

> 这份文件是写给 **AI 助手** 的操作指令。人类用户可以只读「人话版」那一节。
> 本插件让 Codex 能报出**当前会话真实 token 消耗**与**会员订阅周期剩余额度**（5 小时窗口 / 每周窗口）。

---

## 一、这是什么

一个 **Codex 插件**，读取 Codex 自己的会话日志，给出：

- 当前模型（`gpt-5.5` 等）与推理档位
- 本会话累计 token：总量 / 输入 / 缓存命中 / 输出 / 推理输出
- **会员订阅剩余额度**：5 小时窗口与每周窗口的已用百分比、重置时间

并提供一个 skill，让 Codex 可以把这行摘要**推到桌面宠物的活动条上**（配合 `update_running_summary`），
让用量一直挂在眼前。

纯本地读取，**不联网、不修改任何 Codex 数据**。

---

## 二、前置条件

| 条件 | 说明 |
|---|---|
| Codex 桌面版或 CLI | 都可用（不依赖宠物窗） |
| Codex 版本 | 建议 ≥ 26.1027（需要 `update_running_summary`；旧版只能口头报数） |
| Node.js | ≥ 18 |
| 已有会话记录 | `~/.codex/sessions/**/rollout-*.jsonl`；**刚开始、还没落盘的对话会读不到用量** |

---

## 三、给 AI 的安装步骤（照做即可）

### 步骤 1 — 确认解压位置

压缩包解开后应该有这个结构：

```
<解压目录>/
├── INSTALL.md
└── marketplace/
    ├── .agents/plugins/marketplace.json
    └── plugins/usage-gauge/
        ├── .codex-plugin/plugin.json
        ├── scripts/{install.mjs, usage.mjs}
        └── skills/model-usage/SKILL.md
```

如果解压出来不是这个结构，**先停下来告诉用户**，不要自行猜测路径。

### 步骤 2 — 执行注册脚本

```bash
node "<解压目录>/marketplace/plugins/usage-gauge/scripts/install.mjs"
```

脚本会在 `~/.codex/config.toml` 里注册一个本地插件市场 `usage-gauge-local` 并启用插件。
**不写任何宠物资源**（本插件不需要）。

脚本是幂等的：重复执行不会写重 config.toml。

### 步骤 3 — 告诉用户需要手动做的事

**完全退出 Codex 客户端**（含系统托盘）再重新打开，让插件被加载。

### 步骤 4 — 验证

让 AI 执行：

```bash
node "<解压目录>/marketplace/plugins/usage-gauge/scripts/usage.mjs" --summary
```

期望输出类似：

```
gpt-5.5 · 5h 剩 93% · 周 剩 99%
```

如果输出里额度窗口为空、token 也是 null，说明**当前会话还没产生用量数据**（日志未落盘）——
如实告诉用户「还没有数据，等这一轮跑完再看」，不要编造数字。

---

## 四、人话版（给用户看的）

1. 解压这个 zip
2. 让 Codex 里的 AI 跑一次 `node marketplace/plugins/usage-gauge/scripts/install.mjs`
3. 重启 Codex

之后直接问 Codex「我还剩多少额度」就行；也可以让它把用量显示到宠物旁边。

---

## 五、数据口径（AI 回答时用）

| 数据 | 来源 |
|---|---|
| 当前模型 | `~/.codex/config.toml` 的顶层 `model` |
| 额度窗口 | 最近改动的 `~/.codex/sessions/**/rollout-*.jsonl` 中最后一条 `token_count` 事件的 `rate_limits` |
| token 统计 | 同一条事件的 `info.total_token_usage` |

- `rate_limits.primary` = **5 小时窗口**（`window_minutes: 300`）
- `rate_limits.secondary` = **每周窗口**（`window_minutes: 10080`）
- `used_percent` 是**已用**百分比 → 剩余 = `100 - used_percent`
- `resets_at` 是 Unix 秒 → 脚本已换算成 `resetsAt`(ISO) 与 `resetsIn`（如「3天4小时」）

**注意**：这是 **Codex 账号的订阅限制**，不是某个模型的 API 计费，两者不要混为一谈。

---

## 六、常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 额度窗口为空 | 当前会话还没落盘 → 跑一轮对话后再试 |
| `node: command not found` | 没装 Node.js → 装 LTS 版 |
| Codex 里看不到插件 | 没重启 Codex；或 config.toml 没写成功（用 `--status` 查） |
| 摘要超过 50 字符 | 脚本会自动截断到 50 字符内 |

---

## 七、隐私

本插件**只读** `~/.codex/config.toml` 与 `~/.codex/sessions/**`，不写入、不上传、不联网。
所有输出都留在本机。
