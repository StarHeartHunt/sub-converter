import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Proxy } from './types'

/** Base path for local rule files bundled with subconverter */
const RULES_BASE_PATH = resolve(process.cwd(), 'thirdparty/subconverter/base')

export interface RulesetEntry {
  group: string
  /** URL to a rule list file, or inline rule like `[]GEOIP,CN` or `[]FINAL` */
  url: string
}

export interface ProxyGroupTemplate {
  name: string
  type: 'select' | 'url-test' | 'fallback' | 'load-balance' | 'relay' | 'ssid' | 'smart'
  /** Mix of `[]GroupName`, `[]DIRECT`, `[]REJECT`, and regex patterns like `.*` */
  members: string[]
  testUrl?: string
  interval?: number
  tolerance?: number
  timeout?: number
  lazy?: boolean
  disableUdp?: boolean
  strategy?: 'consistent-hashing' | 'round-robin'
  providers?: string[]
}

export interface ExternalConfig {
  rulesets: RulesetEntry[]
  proxyGroups: ProxyGroupTemplate[]
  enableRuleGenerator: boolean
  overwriteOriginalRules: boolean
}

/**
 * Parse external config in INI format (subconverter-compatible).
 * Only the `[custom]` section is processed.
 */
export function parseExternalConfig(content: string): ExternalConfig {
  const config: ExternalConfig = {
    rulesets: [],
    proxyGroups: [],
    enableRuleGenerator: true,
    overwriteOriginalRules: true,
  }

  const lines = content.split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith(';') || line.startsWith('#') || line.startsWith('[')) continue

    // ruleset=GroupName,URL
    if (line.startsWith('ruleset=')) {
      const value = line.slice('ruleset='.length)
      const commaIdx = value.indexOf(',')
      if (commaIdx > 0) {
        config.rulesets.push({
          group: value.slice(0, commaIdx).trim(),
          url: value.slice(commaIdx + 1).trim(),
        })
      }
    }

    // custom_proxy_group=Name`type`member1`member2`...`url`interval,timeout,tolerance
    if (line.startsWith('custom_proxy_group=')) {
      const value = line.slice('custom_proxy_group='.length)
      const parts = value.split('`')
      if (parts.length >= 3) {
        const name = parts[0]
        const type = parts[1] as ProxyGroupTemplate['type']
        const members: string[] = []
        const providers: string[] = []
        let testUrl: string | undefined
        let interval: number | undefined
        let tolerance: number | undefined
        let timeout: number | undefined

        // For url-test, fallback, load-balance: last two parts are url and timing
        const needsUrlTest = type === 'url-test' || type === 'fallback' || type === 'load-balance' || type === 'smart'
        let upperBound = parts.length

        if (needsUrlTest && parts.length >= 5) {
          // Last part: interval or interval,timeout,tolerance
          const lastPart = parts[parts.length - 1]!.trim()
          const secondLast = parts[parts.length - 2]!.trim()
          if (secondLast.startsWith('http://') || secondLast.startsWith('https://')) {
            testUrl = secondLast
            upperBound -= 2
            // Parse timing: "300" or "300,5,100"
            const timeParts = lastPart.split(',').map(s => Number.parseInt(s.trim()))
            if (timeParts[0]) interval = timeParts[0]
            if (timeParts[1]) timeout = timeParts[1]
            if (timeParts[2]) tolerance = timeParts[2]
          }
        }

        for (let i = 2; i < upperBound; i++) {
          const part = parts[i]!.trim()
          if (!part) continue
          if (part.startsWith('!!PROVIDER=')) {
            providers.push(...part.slice(11).split(',').map(s => s.trim()).filter(Boolean))
          }
          else {
            members.push(part)
          }
        }

        // Fallback: if url wasn't extracted by the structured approach, scan for it
        if (!testUrl && needsUrlTest) {
          for (let i = 2; i < parts.length; i++) {
            const part = parts[i]!.trim()
            if (part.startsWith('http://') || part.startsWith('https://')) {
              testUrl = part
              const idx = members.indexOf(part)
              if (idx >= 0) members.splice(idx, 1)
              break
            }
          }
          // Scan for standalone numeric parts as interval
          if (!interval) {
            for (let i = members.length - 1; i >= 0; i--) {
              const m = members[i]!
              if (/^\d+(,\d+)*$/.test(m)) {
                const timeParts = m.split(',').map(s => Number.parseInt(s.trim()))
                interval = timeParts[0] || undefined
                timeout = timeParts[1] || undefined
                tolerance = timeParts[2] || undefined
                members.splice(i, 1)
                break
              }
            }
          }
        }

        const tpl: ProxyGroupTemplate = { name: name!, type, members, testUrl, interval, tolerance }
        if (timeout != null) tpl.timeout = timeout
        if (providers.length > 0) tpl.providers = providers
        config.proxyGroups.push(tpl)
      }
    }

    if (line.startsWith('enable_rule_generator=')) {
      config.enableRuleGenerator = line.slice('enable_rule_generator='.length).trim() === 'true'
    }
    if (line.startsWith('overwrite_original_rules=')) {
      config.overwriteOriginalRules = line.slice('overwrite_original_rules='.length).trim() === 'true'
    }
  }

  return config
}

/**
 * Resolve proxy group members — replace `[]GroupName` with group references,
 * `[]DIRECT`/`[]REJECT` with built-in policies, and regex patterns with matching proxy names.
 */
export interface ResolvedProxyGroup {
  name: string
  type: string
  proxies: string[]
  url?: string
  interval?: number
  tolerance?: number
  timeout?: number
  lazy?: boolean
  disableUdp?: boolean
  strategy?: string
  providers?: string[]
}

export function resolveProxyGroups(
  templates: ProxyGroupTemplate[],
  proxies: Proxy[],
): ResolvedProxyGroup[] {
  const proxyNames = proxies.map(p => p.name)

  return templates.map((tpl) => {
    const resolved: string[] = []

    for (const member of tpl.members) {
      if (member.startsWith('[]')) {
        // Reference to another group or built-in policy
        const ref = member.slice(2)
        resolved.push(ref)
      }
      else {
        // Regex pattern — match against proxy names
        try {
          const re = new RegExp(member)
          const matched = proxyNames.filter(n => re.test(n))
          for (const m of matched) {
            if (!resolved.includes(m)) resolved.push(m)
          }
        }
        catch {
          // Invalid regex, treat as literal
          if (!resolved.includes(member)) resolved.push(member)
        }
      }
    }

    const group: ResolvedProxyGroup = {
      name: tpl.name,
      type: tpl.type,
      proxies: resolved,
      url: tpl.testUrl,
      interval: tpl.interval,
      tolerance: tpl.tolerance,
    }
    if (tpl.timeout != null) group.timeout = tpl.timeout
    if (tpl.lazy != null) group.lazy = tpl.lazy
    if (tpl.disableUdp != null) group.disableUdp = tpl.disableUdp
    if (tpl.strategy) group.strategy = tpl.strategy
    if (tpl.providers && tpl.providers.length > 0) group.providers = tpl.providers
    return group
  })
}

/** Simple in-memory cache for fetched rulesets */
const rulesetCache = new Map<string, { rules: string[]; expiresAt: number }>()
const RULESET_CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours (same as C++ default: 21600s)

/**
 * Fetch a ruleset from URL and parse it into Clash rule lines.
 * Handles both inline rules ([]GEOIP,CN) and remote rule list files.
 * Results are cached in memory for RULESET_CACHE_TTL.
 */
export async function fetchRuleset(entry: RulesetEntry): Promise<string[]> {
  const { group, url } = entry

  // Inline rule: []GEOIP,CN or []FINAL
  if (url.startsWith('[]')) {
    const ruleBody = url.slice(2)
    if (ruleBody === 'FINAL') {
      return [`MATCH,${group}`]
    }
    return [`${ruleBody},${group}`]
  }

  // Check cache (keyed by url+group)
  const cacheKey = `${group}|${url}`
  const cached = rulesetCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rules
  }

  // Fetch content: local file or remote URL
  try {
    let content: string
    if (url.startsWith('http://') || url.startsWith('https://')) {
      content = await $fetch<string>(url, {
        responseType: 'text',
        headers: { 'User-Agent': 'ClashForAndroid/2.5.12' },
        timeout: 10000,
      })
    }
    else {
      // Local file path relative to subconverter base
      const filePath = resolve(RULES_BASE_PATH, url)
      content = readFileSync(filePath, 'utf-8')
    }

    const rules: string[] = []
    for (const rawLine of content.split(/\r?\n/)) {
      let line = rawLine.trim()
      if (!line || line.startsWith('#') || line.startsWith(';')) continue

      // Strip inline comments: "DOMAIN-SUFFIX,example.com // comment" → "DOMAIN-SUFFIX,example.com"
      const commentIdx = line.indexOf(' //')
      if (commentIdx > 0) {
        line = line.slice(0, commentIdx).trim()
      }

      // Rule list format: each line is like DOMAIN-SUFFIX,example.com
      // We need to append the group name
      if (/^(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|IP-CIDR|IP-CIDR6|GEOIP|GEOSITE|SRC-IP-CIDR|SRC-PORT|DST-PORT|PROCESS-NAME|MATCH|RULE-SET|USER-AGENT|URL-REGEX)/i.test(line)) {
        const parts = line.split(',')

        // Rules with no-resolve flag: IP-CIDR,x.x.x.x/y,no-resolve
        // This is NOT a policy — "no-resolve" is a flag
        // For DOMAIN/DOMAIN-SUFFIX/DOMAIN-KEYWORD: 2 parts means no policy
        // For IP-CIDR/IP-CIDR6: 2 parts = no policy, 3 parts could be policy OR no-resolve
        // For GEOIP: 2 parts = no policy

        const lastPart = parts[parts.length - 1]?.trim().toLowerCase()
        const hasNoResolve = lastPart === 'no-resolve'

        // Determine minimum parts that indicate a policy is present
        // type,value = 2 parts (no policy)
        // type,value,policy = 3 parts (has policy)
        // type,value,policy,no-resolve = 4 parts (has policy + flag)
        // type,value,no-resolve = 3 parts (no policy, just flag)

        const effectiveParts = hasNoResolve ? parts.length - 1 : parts.length

        if (effectiveParts >= 3) {
          // Already has a policy
          rules.push(line)
        }
        else {
          // Append group name (before no-resolve if present)
          if (hasNoResolve) {
            const withoutFlag = parts.slice(0, -1).join(',')
            rules.push(`${withoutFlag},${group},no-resolve`)
          }
          else {
            rules.push(`${line},${group}`)
          }
        }
      }
    }
    // Store in cache
    rulesetCache.set(cacheKey, { rules, expiresAt: Date.now() + RULESET_CACHE_TTL })
    return rules
  }
  catch (err: any) {
    console.warn(`[config] Failed to fetch ruleset: ${url}`, err?.message)
    return []
  }
}

/**
 * Fetch all rulesets in parallel and return merged rules.
 */
export async function fetchAllRulesets(entries: RulesetEntry[]): Promise<string[]> {
  const results = await Promise.all(entries.map(fetchRuleset))
  return results.flat()
}
