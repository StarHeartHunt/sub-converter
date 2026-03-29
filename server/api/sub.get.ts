import { parseSubscription } from '../lib/parsers'
import { generateConfig } from '../lib/generators'
import type { ExternalGenerateOptions } from '../lib/generators'
import { parseExternalConfig, resolveProxyGroups, fetchAllRulesets } from '../lib/config'
import { DEFAULT_PROXY_GROUPS, DEFAULT_RULESETS } from '../lib/defaults'
import { applyEmoji } from '../lib/emoji'
import type { Proxy, TargetType, SubConfig } from '../lib/types'

/**
 * Merge multiple Subscription-UserInfo header values by summing numeric fields.
 * Format: upload=N; download=N; total=N; expire=N
 */
function mergeSubscriptionInfo(parts: string[]): string {
  if (parts.length === 1) return parts[0]!

  let upload = 0, download = 0, total = 0, expire = 0
  for (const part of parts) {
    for (const seg of part.split(';')) {
      const [key = '', val = ''] = seg.split('=').map(s => s.trim())
      const n = Number(val)
      if (Number.isNaN(n)) continue
      switch (key) {
        case 'upload': upload += n; break
        case 'download': download += n; break
        case 'total': total += n; break
        case 'expire': expire = Math.max(expire, n); break
      }
    }
  }
  return `upload=${upload}; download=${download}; total=${total}; expire=${expire}`
}

const VALID_TARGETS = new Set<TargetType>([
  'clash', 'clashr', 'surge', 'quanx', 'quan', 'loon',
  'surfboard', 'singbox', 'mellow', 'v2ray', 'ss', 'ssr', 'sssub', 'mixed',
])

/**
 * Detect target type from User-Agent header (matches subconverter behavior).
 * Returns null if no known client detected.
 */
function detectTargetFromUA(ua: string): { target: TargetType; ver?: number } | null {
  if (!ua) return null
  // Order matters — more specific patterns first
  if (/ClashForAndroid.*R/i.test(ua)) return { target: 'clashr' }
  if (/ClashForAndroid|ClashforWindows|ClashX|Clash/i.test(ua)) return { target: 'clash' }
  if (/Stash/i.test(ua)) return { target: 'clash' }
  if (/Loon/i.test(ua)) return { target: 'loon' }
  if (/Quantumult%20X|Quantumult X/i.test(ua)) return { target: 'quanx' }
  if (/Quantumult/i.test(ua)) return { target: 'quan' }
  if (/Surfboard/i.test(ua)) return { target: 'surfboard' }
  // Surge version detection
  const surgeMatch = ua.match(/Surge\/(\d+)/i)
  if (surgeMatch) {
    const ver = Number.parseInt(surgeMatch[1]!)
    if (ver >= 1419) return { target: 'surge', ver: 4 }
    if (ver >= 900) return { target: 'surge', ver: 3 }
    return { target: 'surge', ver: 2 }
  }
  if (/Surge/i.test(ua)) return { target: 'surge', ver: 3 }
  if (/Shadowrocket/i.test(ua)) return { target: 'mixed' }
  if (/SingBox|sing-box/i.test(ua)) return { target: 'singbox' }
  if (/V2Ray|v2rayN|v2rayNG/i.test(ua)) return { target: 'v2ray' }
  return null
}

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
  'clash', 'clashr', 'surge', 'surfboard', 'quanx', 'quan', 'loon', 'singbox', 'mellow',
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

  let target = (query.target as string)?.toLowerCase() as TargetType
  let autoDetectedVer: number | undefined

  // If no target specified, try to auto-detect from User-Agent
  if (!target || !VALID_TARGETS.has(target)) {
    const ua = getHeader(event, 'user-agent') || ''
    const detected = detectTargetFromUA(ua)
    if (detected) {
      target = detected.target
      autoDetectedVer = detected.ver
    }
    else {
      throw createError({ statusCode: 400, message: 'Missing or invalid target parameter' })
    }
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
    addEmoji: query.add_emoji !== undefined ? query.add_emoji !== 'false' : undefined,
    removeEmoji: query.remove_emoji !== undefined ? query.remove_emoji !== 'false' : undefined,
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
    ver: query.ver ? Number(query.ver) : autoDetectedVer,
    filterScript: query.filter_script as string,
    sortScript: query.sort_script as string,
    interval: query.interval ? Number(query.interval) : undefined,
    strict: query.strict === 'true',
  }

  // Fetch subscription content from URL(s)
  const urls = config.url.split('|').map(u => u.trim()).filter(Boolean)
  const allProxies: Proxy[] = []
  const errors: string[] = []
  const subInfoParts: string[] = []

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

      // Extract Subscription-UserInfo header from upstream
      const userInfo = response.headers.get('subscription-userinfo')
      if (userInfo) {
        subInfoParts.push(userInfo)
      }

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
  // Supports independent add_emoji / remove_emoji params; falls back to unified `emoji` param
  {
    const addEmoji = config.addEmoji ?? config.emoji ?? true
    const removeEmoji = config.removeEmoji ?? config.emoji ?? true
    if (addEmoji || removeEmoji) {
      applyEmoji(allProxies, addEmoji, removeEmoji)
    }
  }

  // Apply filters — supports multiple patterns separated by backtick (`)
  let filtered = allProxies

  if (config.include) {
    const patterns = config.include.split('`').filter(Boolean)
    const validRegexes: RegExp[] = []
    for (const p of patterns) {
      try { validRegexes.push(new RegExp(p, 'i')) }
      catch { /* skip invalid */ }
    }
    if (validRegexes.length > 0) {
      filtered = filtered.filter(px => validRegexes.some(re => re.test(px.name)))
    }
  }

  if (config.exclude) {
    const patterns = config.exclude.split('`').filter(Boolean)
    const validRegexes: RegExp[] = []
    for (const p of patterns) {
      try { validRegexes.push(new RegExp(p, 'i')) }
      catch { /* skip invalid */ }
    }
    if (validRegexes.length > 0) {
      filtered = filtered.filter(px => !validRegexes.some(re => re.test(px.name)))
    }
  }

  // Rename — supports capture groups ($1, $2, etc.)
  if (config.rename) {
    const renamePairs = config.rename.split('`').filter(Boolean)
    for (const pair of renamePairs) {
      const atIdx = pair.indexOf('@')
      if (atIdx < 0) continue
      const pattern = pair.slice(0, atIdx)
      const replacement = pair.slice(atIdx + 1)
      if (!pattern) continue
      try {
        const re = new RegExp(pattern, 'g')
        filtered.forEach(p => { p.name = p.name.replace(re, replacement) })
      }
      catch { /* skip invalid */ }
    }
  }

  // Filter script — JS function that returns true to REMOVE a node
  if (config.filterScript) {
    try {
      // Build a filter function: `function filter(node) { return <script>; }`
      // The script should be a JS expression/body that returns boolean
      const filterFn = new Function('node', config.filterScript) as (node: Proxy) => boolean
      filtered = filtered.filter((p) => {
        try { return !filterFn(p) }
        catch { return true }
      })
    }
    catch (err: any) {
      console.warn(`[sub] filter_script error: ${err?.message}`)
    }
  }

  // Sort script — JS comparator function body, or default sort
  if (config.sortScript) {
    try {
      const sortFn = new Function('a', 'b', config.sortScript) as (a: Proxy, b: Proxy) => number
      filtered.sort((a, b) => {
        try { return sortFn(a, b) }
        catch { return 0 }
      })
    }
    catch (err: any) {
      console.warn(`[sub] sort_script error: ${err?.message}`)
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

  // Fetch and apply external config or built-in defaults (for targets that support groups/rules)
  let externalOptions: ExternalGenerateOptions | undefined
  if (TARGETS_WITH_CONFIG.has(target)) {
    try {
      let groupTemplates
      let rulesetEntries

      if (config.config) {
        // Use external config from parameter
        const configUrl = resolveConfigUrl(config.config, event)
        console.log(`[sub] Fetching external config: ${configUrl}`)
        const configContent = await $fetch<string>(configUrl, {
          responseType: 'text',
          timeout: 10000,
        })
        const extConfig = parseExternalConfig(configContent)
        console.log(`[sub] External config: ${extConfig.proxyGroups.length} groups, ${extConfig.rulesets.length} rulesets`)
        groupTemplates = extConfig.proxyGroups
        rulesetEntries = extConfig.rulesets
      }
      else {
        // Use built-in default groups and rulesets (equivalent to subconverter's snippets)
        console.log(`[sub] Using built-in default groups and rulesets`)
        groupTemplates = DEFAULT_PROXY_GROUPS
        rulesetEntries = DEFAULT_RULESETS
      }

      // Resolve proxy groups
      const resolvedGroups = resolveProxyGroups(groupTemplates, filtered)

      // Fetch rulesets
      const rules = await fetchAllRulesets(rulesetEntries)
      console.log(`[sub] Fetched ${rules.length} rules from ${rulesetEntries.length} rulesets`)

      externalOptions = {
        externalGroups: resolvedGroups,
        externalRules: rules,
      }
    }
    catch (err: any) {
      console.warn(`[sub] Failed to process config: ${err?.message}`)
      // Fall through to generator's built-in fallback
    }
  }

  // Generate output
  let output = generateConfig(filtered, config.target, {
    ver: config.ver,
    list: config.list,
    externalOptions,
  })

  // Prepend #!MANAGED-CONFIG header for Surge/Surfboard targets
  if (target === 'surge' || target === 'surfboard') {
    const reqUrl = getRequestURL(event)
    const managedUrl = reqUrl.href
    const interval = config.interval || 86400
    const strict = config.strict ?? false
    output = `#!MANAGED-CONFIG ${managedUrl} interval=${interval} strict=${strict}\n\n${output}`
  }

  // Set response headers
  const contentType = CONTENT_TYPES[config.target] || 'text/plain; charset=utf-8'
  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Access-Control-Allow-Origin', '*')

  // Forward Subscription-UserInfo from upstream (merge multiple sources by summing values)
  if (subInfoParts.length > 0) {
    const merged = mergeSubscriptionInfo(subInfoParts)
    if (merged) {
      setHeader(event, 'Subscription-UserInfo', merged)
    }
  }

  // Profile update interval for Clash-type clients
  if (target === 'clash' || target === 'clashr') {
    setHeader(event, 'profile-update-interval', '12')
  }

  if (config.filename) {
    setHeader(event, 'Content-Disposition', `attachment; filename="${config.filename}"`)
  }

  return output
})
