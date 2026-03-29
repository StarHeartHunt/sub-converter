import { parseSubscription } from '../lib/parsers'
import { generateConfig } from '../lib/generators'
import type { ExternalGenerateOptions } from '../lib/generators'
import { parseExternalConfig, resolveProxyGroups, fetchAllRulesets } from '../lib/config'
import { applyEmoji } from '../lib/emoji'
import type { Proxy, TargetType, SubConfig } from '../lib/types'

const VALID_TARGETS = new Set<TargetType>([
  'clash', 'clashr', 'surge', 'quanx', 'quan', 'loon',
  'surfboard', 'singbox', 'v2ray', 'ss', 'ssr', 'sssub', 'mixed',
])

const CONTENT_TYPES: Partial<Record<TargetType, string>> = {
  clash: 'text/yaml; charset=utf-8',
  clashr: 'text/yaml; charset=utf-8',
  singbox: 'application/json; charset=utf-8',
  sssub: 'application/json; charset=utf-8',
  surge: 'text/plain; charset=utf-8',
  quanx: 'text/plain; charset=utf-8',
  loon: 'text/plain; charset=utf-8',
}

/** Targets that support external config (groups + rules) */
const TARGETS_WITH_CONFIG = new Set<TargetType>([
  'clash', 'clashr', 'surge', 'surfboard', 'quanx', 'quan', 'loon', 'singbox',
])

/**
 * Resolve config URL — if it looks like a local config name (no protocol),
 * resolve it to the local /api/config/ endpoint.
 */
function resolveConfigUrl(configParam: string, event: any): string {
  if (configParam.startsWith('http://') || configParam.startsWith('https://')) {
    return configParam
  }
  // Local config name — resolve to local API
  const origin = getRequestURL(event).origin
  const name = configParam.endsWith('.ini') ? configParam : `${configParam}.ini`
  return `${origin}/api/config/${name}`
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const target = (query.target as string)?.toLowerCase() as TargetType
  if (!target || !VALID_TARGETS.has(target)) {
    throw createError({ statusCode: 400, message: 'Missing or invalid target parameter' })
  }

  const url = query.url as string
  if (!url) {
    throw createError({ statusCode: 400, message: 'Missing url parameter' })
  }

  const config: SubConfig = {
    target,
    url,
    config: query.config as string,
    emoji: query.emoji !== 'false',
    list: query.list === 'true',
    include: query.include as string,
    exclude: query.exclude as string,
    rename: query.rename as string,
    sort: query.sort === 'true',
    udp: query.udp === 'true',
    tfo: query.tfo === 'true',
    scv: query.scv === 'true',
    appendType: query.append_type === 'true',
    filename: query.filename as string,
    ver: query.ver ? Number(query.ver) : undefined,
  }

  // Fetch subscription content from URL(s)
  const urls = config.url.split('|').map(u => u.trim()).filter(Boolean)
  const allProxies: Proxy[] = []
  const errors: string[] = []

  for (const subUrl of urls) {
    try {
      const response = await $fetch.raw(subUrl, {
        responseType: 'text',
        headers: {
          'User-Agent': 'ClashForAndroid/2.5.12',
          'Accept': '*/*',
        },
        redirect: 'follow',
        timeout: 15000,
      })
      const body = response._data as string
      if (!body || typeof body !== 'string') {
        errors.push(`Empty response from ${subUrl}`)
        continue
      }
      console.log(`[sub] Fetched ${subUrl}: ${body.length} bytes`)
      const proxies = parseSubscription(body)
      console.log(`[sub] Parsed ${proxies.length} proxies from ${subUrl}`)
      allProxies.push(...proxies)
      if (proxies.length === 0) {
        errors.push(`No parseable proxies in response from ${subUrl} (${body.length} bytes, starts with: ${body.slice(0, 80)})`)
      }
    }
    catch (err: any) {
      const msg = err?.data?.message || err?.message || String(err)
      console.warn(`[sub] Failed to fetch: ${subUrl}`, msg)
      errors.push(`Fetch failed for ${subUrl}: ${msg}`)
    }
  }

  if (allProxies.length === 0) {
    throw createError({
      statusCode: 400,
      message: `No valid proxies found. ${errors.join('; ')}`,
    })
  }

  // Apply emoji flags (before filtering, so regex patterns can match emoji names)
  if (config.emoji) {
    applyEmoji(allProxies)
  }

  // Apply filters
  let filtered = allProxies

  if (config.include) {
    try {
      const re = new RegExp(config.include, 'i')
      filtered = filtered.filter(p => re.test(p.name))
    }
    catch { /* invalid regex, skip */ }
  }

  if (config.exclude) {
    try {
      const re = new RegExp(config.exclude, 'i')
      filtered = filtered.filter(p => !re.test(p.name))
    }
    catch { /* invalid regex, skip */ }
  }

  // Rename
  if (config.rename) {
    const renamePairs = config.rename.split('`').filter(Boolean)
    for (const pair of renamePairs) {
      const [pattern, replacement] = pair.split('@')
      if (pattern && replacement !== undefined) {
        try {
          const re = new RegExp(pattern, 'g')
          filtered.forEach(p => { p.name = p.name.replace(re, replacement) })
        }
        catch { /* skip invalid */ }
      }
    }
  }

  // Append type label
  if (config.appendType) {
    const typeLabels: Record<string, string> = {
      ss: '[SS]', ssr: '[SSR]', vmess: '[VMess]', vless: '[VLESS]',
      trojan: '[Trojan]', hysteria2: '[Hy2]', wireguard: '[WG]',
    }
    filtered.forEach(p => {
      const label = typeLabels[p.type] || `[${p.type.toUpperCase()}]`
      if (!p.name.includes(label)) p.name = `${label} ${p.name}`
    })
  }

  // Apply flags
  if (config.udp) filtered.forEach(p => { p.udp = true })
  if (config.tfo) filtered.forEach(p => { p.tfo = true })
  if (config.scv) filtered.forEach(p => { p.skipCertVerify = true })

  // Sort
  if (config.sort) {
    filtered.sort((a, b) => a.name.localeCompare(b.name))
  }

  // Deduplicate names
  const seen = new Map<string, number>()
  for (const p of filtered) {
    const count = (seen.get(p.name) || 0) + 1
    seen.set(p.name, count)
    if (count > 1) p.name = `${p.name} ${count}`
  }

  // Fetch and apply external config (for all targets that support groups/rules)
  let externalOptions: ExternalGenerateOptions | undefined
  if (config.config && TARGETS_WITH_CONFIG.has(target)) {
    try {
      const configUrl = resolveConfigUrl(config.config, event)
      console.log(`[sub] Fetching external config: ${configUrl}`)
      const configContent = await $fetch<string>(configUrl, {
        responseType: 'text',
        timeout: 10000,
      })
      const extConfig = parseExternalConfig(configContent)
      console.log(`[sub] External config: ${extConfig.proxyGroups.length} groups, ${extConfig.rulesets.length} rulesets`)

      // Resolve proxy groups
      const resolvedGroups = resolveProxyGroups(extConfig.proxyGroups, filtered)

      // Fetch rulesets
      const rules = await fetchAllRulesets(extConfig.rulesets)
      console.log(`[sub] Fetched ${rules.length} rules from ${extConfig.rulesets.length} rulesets`)

      externalOptions = {
        externalGroups: resolvedGroups,
        externalRules: rules,
      }
    }
    catch (err: any) {
      console.warn(`[sub] Failed to process external config: ${err?.message}`)
      // Fall through to default groups/rules
    }
  }

  // Generate output
  const output = generateConfig(filtered, config.target, {
    ver: config.ver,
    list: config.list,
    externalOptions,
  })

  // Set response headers
  const contentType = CONTENT_TYPES[config.target] || 'text/plain; charset=utf-8'
  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Access-Control-Allow-Origin', '*')

  if (config.filename) {
    setHeader(event, 'Content-Disposition', `attachment; filename="${config.filename}"`)
  }

  return output
})
