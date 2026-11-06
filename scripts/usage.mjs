#!/usr/bin/env node
/**
 * 读取 Codex 当前的模型用量与会员订阅周期剩余额度。
 *
 * 数据来源：
 *   1. <CODEX_HOME>/config.toml        → 当前模型 / provider
 *   2. <CODEX_HOME>/sessions/**.jsonl   → 最近一次会话的 token_count 事件
 *      里的 rate_limits：primary = 5 小时窗口，secondary = 每周窗口
 *
 * 用法：
 *   node usage.mjs            # 完整 JSON
 *   node usage.mjs --summary  # 一行摘要（可直接喂给 update_running_summary，≤50 字符）
 *   node usage.mjs --raw      # 原始 rate_limits 片段
 */
import { existsSync, readFileSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs'
import { join } from 'node:path'

const CODEX_HOME = process.env.CODEX_HOME || join(process.env.USERPROFILE || process.env.HOME || '.', '.codex')
const SESSIONS_DIR = join(CODEX_HOME, 'sessions')

/* ---------- config.toml：只取顶层键 ---------- */
function readConfig() {
  const p = join(CODEX_HOME, 'config.toml')
  const out = { model: null, model_provider: null, effort: null }
  if (!existsSync(p)) return out
  const text = readFileSync(p, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(model|model_provider|model_reasoning_effort)\s*=\s*"([^"]*)"/)
    if (!m) continue
    if (m[1] === 'model') out.model = m[2]
    else if (m[1] === 'model_provider') out.model_provider = m[2]
    else out.effort = m[2]
  }
  return out
}

/* ---------- 找最近改动的会话文件 ---------- */
function listSessionFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return acc }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) listSessionFiles(p, acc)
    else if (e.isFile() && e.name.endsWith('.jsonl')) acc.push(p)
  }
  return acc
}

function newestSession() {
  const files = listSessionFiles(SESSIONS_DIR)
  let best = null, bestT = 0
  for (const f of files) {
    try {
      const t = statSync(f).mtimeMs
      if (t > bestT) { bestT = t; best = f }
    } catch { /* ignore */ }
  }
  return best
}

/* ---------- 从会话日志里取最后一条带 rate_limits 的 token_count ---------- */
function readRateLimits(file) {
  if (!file || !existsSync(file)) return null
  const size = statSync(file).size
  const TAIL = 4 * 1024 * 1024            // 只读尾部，避免大文件全量解析
  const start = Math.max(0, size - TAIL)
  const fd = openSync(file, 'r')
  const buf = Buffer.alloc(size - start)
  readSync(fd, buf, 0, buf.length, start)
  closeSync(fd)
  const text = buf.toString('utf8')
  const lines = text.split(/\r?\n/)
  let found = null
  for (const line of lines) {
    if (!line.includes('"rate_limits"')) continue
    try {
      const j = JSON.parse(line)
      const p = j?.payload
      if (p && p.rate_limits) found = { payload: p, ts: j.timestamp }
    } catch { /* 行不完整，跳过 */ }
  }
  return found
}

/* ---------- 窗口格式化 ---------- */
function fmtWindow(w) {
  if (!w) return null
  const used = Number(w.used_percent) || 0
  const mins = Number(w.window_minutes) || 0
  const label = mins === 300 ? '5h' : mins === 10080 ? '周' : mins === 60 ? '1h' : `${Math.round(mins / 60)}h`
  let resetsIn = null
  if (w.resets_at) {
    const ms = Number(w.resets_at) * 1000 - Date.now()
    if (ms > 0) {
      const h = Math.floor(ms / 3600000)
      const d = Math.floor(h / 24)
      resetsIn = d > 0 ? `${d}天${h % 24}小时` : h > 0 ? `${h}小时${Math.floor((ms % 3600000) / 60000)}分` : `${Math.max(1, Math.floor(ms / 60000))}分`
    } else resetsIn = '即将重置'
  }
  return {
    label,
    windowMinutes: mins,
    usedPercent: Math.round(used * 10) / 10,
    remainingPercent: Math.max(0, Math.round((100 - used) * 10) / 10),
    resetsAt: w.resets_at ? new Date(Number(w.resets_at) * 1000).toISOString() : null,
    resetsIn,
  }
}

function build() {
  const cfg = readConfig()
  const file = newestSession()
  const hit = readRateLimits(file)
  const rl = hit?.payload?.rate_limits || null
  const info = hit?.payload?.info || null
  const windows = []
  const p = fmtWindow(rl?.primary)
  const s = fmtWindow(rl?.secondary)
  if (p) windows.push(p)
  if (s) windows.push(s)
  const t = info?.total_token_usage || null
  return {
    codexHome: CODEX_HOME,
    model: cfg.model || null,
    modelProvider: cfg.model_provider || null,
    reasoningEffort: cfg.effort || null,
    windows,
    credits: rl?.credits ? {
      hasCredits: !!rl.credits.has_credits,
      unlimited: !!rl.credits.unlimited,
      balance: rl.credits.balance ?? null,
    } : null,
    tokens: t ? {
      total: t.total_tokens ?? null,
      input: t.input_tokens ?? null,
      cachedInput: t.cached_input_tokens ?? null,
      output: t.output_tokens ?? null,
      reasoningOutput: t.reasoning_output_tokens ?? null,
    } : null,
    contextWindow: info?.model_context_window ?? null,
    sessionFile: file || null,
    sessionTimestamp: hit?.ts || null,
  }
}

/* ---------- 摘要（给 update_running_summary 用） ---------- */
function summary(d) {
  const model = d.model || '当前模型'
  if (!d.windows.length) {
    const tk = d.tokens?.total
    return tk ? `${model} · 已用 ${tk.toLocaleString()} tokens` : `${model}`
  }
  const bits = d.windows.map(w => {
    const rem = Math.round(w.remainingPercent)
    return `${w.label} 剩 ${rem}%`
  })
  let s = `${model} · ${bits.join(' · ')}`
  if (s.length > 50) s = s.slice(0, 49) + '…'
  return s
}

const d = build()
const arg = process.argv[2] || ''
if (arg === '--summary') {
  console.log(summary(d))
} else if (arg === '--raw') {
  console.log(JSON.stringify({ rate_limits: readRateLimits(d.sessionFile)?.payload?.rate_limits ?? null }, null, 2))
} else {
  console.log(JSON.stringify({ ...d, summary: summary(d) }, null, 2))
}
