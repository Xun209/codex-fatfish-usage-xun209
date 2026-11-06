#!/usr/bin/env node
/**
 * 用量挂件 —— 一键注册（把插件接入 Codex 的本地插件市场并启用）
 *
 * 跨平台（Windows / macOS / Linux），纯 Node，无外部依赖。
 * 本插件不写入任何宠物资源，只做「让 Codex 认得这个插件」这一件事。
 *
 * 用法：
 *   node install.mjs            # 注册插件市场 + 启用插件（推荐）
 *   node install.mjs --status   # 查看当前状态
 *
 * 环境变量：
 *   CODEX_HOME   Codex 主目录，默认 ~/.codex
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PLUGIN_ROOT = resolve(HERE, '..')
const MARKETPLACE_ROOT = resolve(HERE, '..', '..', '..')

const MARKETPLACE_NAME = 'usage-gauge-local'
const PLUGIN_NAME = 'usage-gauge'
const CODEX_HOME = process.env.CODEX_HOME || join(process.env.USERPROFILE || process.env.HOME || '.', '.codex')
const CONFIG = join(CODEX_HOME, 'config.toml')

function log(...a) { console.log('[usage-gauge]', ...a) }

function stripSection(toml, header) {
  const out = []
  let skipping = false
  for (const line of toml.split(/\r?\n/)) {
    const t = line.trim()
    if (t.startsWith('[')) {
      skipping = (t === header)
      if (skipping) continue
    }
    if (!skipping) out.push(line)
  }
  return out.join('\n')
}

function registerMarketplace() {
  const mpJson = join(MARKETPLACE_ROOT, '.agents', 'plugins', 'marketplace.json')
  if (!existsSync(mpJson)) {
    log('⚠️ 找不到 marketplace 清单:', mpJson, '——无法自动注册')
    return
  }
  const mp = JSON.parse(readFileSync(mpJson, 'utf8'))
  const mpName = mp.name || MARKETPLACE_NAME
  const entry = (mp.plugins || []).find(p => p.name === PLUGIN_NAME)
  if (!entry) {
    log('⚠️ marketplace 清单里没有', PLUGIN_NAME, '——跳过注册')
    return
  }

  let toml = existsSync(CONFIG) ? readFileSync(CONFIG, 'utf8') : ''
  toml = stripSection(toml, `[marketplaces.${mpName}]`)
  toml = stripSection(toml, `[plugins."${PLUGIN_NAME}@${mpName}"]`)

  const block = [
    '',
    `# ===== ${PLUGIN_NAME}（由 install.mjs 写入：本地插件市场 + 启用）=====`,
    `[marketplaces.${mpName}]`,
    'source_type = "local"',
    // TOML basic string（双引号）：Windows 路径里的反斜杠必须转义，
    // 用 JSON.stringify 生成的内容与 TOML basic string 的转义规则兼容。
    `source = ${JSON.stringify(MARKETPLACE_ROOT)}`,
    '',
    `[plugins."${PLUGIN_NAME}@${mpName}"]`,
    'enabled = true',
    '',
  ].join('\n')

  mkdirSync(CODEX_HOME, { recursive: true })
  writeFileSync(CONFIG, toml.replace(/\s*$/, '\n') + block, 'utf8')
  log('✅ 已注册本地插件市场并启用插件')
  log('   marketplace:', mpName)
  log('   源目录     :', MARKETPLACE_ROOT)
  log('   config.toml:', CONFIG)
}

function status() {
  log('CODEX_HOME :', CODEX_HOME)
  log('市场源目录 :', MARKETPLACE_ROOT)
  if (existsSync(CONFIG)) {
    const t = readFileSync(CONFIG, 'utf8')
    log('   config.toml 含本插件注册:', t.includes(MARKETPLACE_NAME) ? '是' : '否')
  } else log('   config.toml 不存在')
}

const arg = process.argv[2] || ''
try {
  if (arg === '--status' || arg === 'status') status()
  else {
    registerMarketplace()
    log('')
    log('接下来请在 Codex 里：')
    log('  1) 完全退出 Codex 客户端（含系统托盘）再重新打开')
    log('  2) 在「设置 → 插件」里确认「用量挂件」已启用')
    log('  3) 之后可以直接问 Codex「我还剩多少额度」，')
    log('     或让它把用量摘要推到桌面宠物的活动条上')
  }
} catch (e) {
  console.error('[usage-gauge] 注册失败:', e.message)
  process.exitCode = 1
}
