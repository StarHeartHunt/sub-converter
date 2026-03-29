import type { Proxy } from './types'

export interface RulesetEntry {
  group: string
  /** URL to a rule list file, or inline rule like `[]GEOIP,CN` or `[]FINAL` */
  url: string
}

export interface ProxyGroupTemplate {
  name: string
  type: 'select' | 'url-test' | 'fallback' | 'load-balance'
  /** Mix of `[]GroupName`, `[]DIRECT`, `[]REJECT`, and regex patterns like `.*` */
  members: string[]
  testUrl?: string
  interval?: number
  tolerance?: number
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

    // custom_proxy_group=Name`type`member1`member2`...
    if (line.startsWith('custom_proxy_group=')) {
      const value = line.slice('custom_proxy_group='.length)
      const parts = value.split('`')
      if (parts.length >= 3) {
        const name = parts[0]
        const type = parts[1] as ProxyGroupTemplate['type']
        const members: string[] = []
        let testUrl: string | undefined
        let interval: number | undefined
        let tolerance: number | undefined

        for (let i = 2; i < parts.length; i++) {
          const part = parts[i].trim()
          if (!part) continue
          if (part.startsWith('http://') || part.startsWith('https://')) {
            testUrl = part
          }
          else if (/^\d+$/.test(part)) {
            if (!interval) interval = Number(part)
            else tolerance = Number(part)
          }
          else {
            members.push(part)
          }
        }

        config.proxyGroups.push({ name, type, members, testUrl, interval, tolerance })
      }
    }

    if (line.startsWith('enable_rule_generator=')) {
      config.enableRuleGenerator = line.split('=')[1].trim() === 'true'
    }
    if (line.startsWith('overwrite_original_rules=')) {
      config.overwriteOriginalRules = line.split('=')[1].trim() === 'true'
    }
  }

  return config
}

/**
 * Resolve proxy group members — replace `[]GroupName` with group references,
 * `[]DIRECT`/`[]REJECT` with built-in policies, and regex patterns with matching proxy names.
 */
export function resolveProxyGroups(
  templates: ProxyGroupTemplate[],
  proxies: Proxy[],
): Array<{
  name: string
  type: string
  proxies: string[]
  url?: string
  interval?: number
  tolerance?: number
}> {
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

    return {
      name: tpl.name,
      type: tpl.type,
      proxies: resolved,
      url: tpl.testUrl,
      interval: tpl.interval,
      tolerance: tpl.tolerance,
    }
  })
}

/**
 * Fetch a ruleset from URL and parse it into Clash rule lines.
 * Handles both inline rules ([]GEOIP,CN) and remote rule list files.
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

  // Remote rule list
  try {
    const content = await $fetch<string>(url, {
      responseType: 'text',
      headers: { 'User-Agent': 'ClashForAndroid/2.5.12' },
      timeout: 10000,
    })

    const rules: string[] = []
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#') || line.startsWith(';')) continue

      // Rule list format: each line is like DOMAIN-SUFFIX,example.com
      // We need to append the group name
      if (/^(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|IP-CIDR|IP-CIDR6|GEOIP|GEOSITE|SRC-IP-CIDR|SRC-PORT|DST-PORT|PROCESS-NAME|MATCH|RULE-SET|USER-AGENT|URL-REGEX)/i.test(line)) {
        const parts = line.split(',')
        const ruleType = parts[0].toUpperCase()

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

/** Default config presets — using bundled local configs */
export const CONFIG_PRESETS = [
  { label: 'ACL4SSR 默认版', value: 'ACL4SSR_Online' },
  { label: 'ACL4SSR 全分组', value: 'ACL4SSR_Online_Full' },
  { label: 'ACL4SSR 精简版', value: 'ACL4SSR_Online_Mini' },
  { label: 'ACL4SSR 无自动测速', value: 'ACL4SSR_Online_NoAuto' },
  { label: 'ACL4SSR 全分组无测速', value: 'ACL4SSR_Online_Full_NoAuto' },
  { label: 'ACL4SSR 精简无测速', value: 'ACL4SSR_Online_Mini_NoAuto' },
  { label: 'ACL4SSR 去广告Plus', value: 'ACL4SSR_Online_AdblockPlus' },
  { label: 'ACL4SSR 全分组去广告Plus', value: 'ACL4SSR_Online_Full_AdblockPlus' },
  { label: 'ACL4SSR 全分组多国家', value: 'ACL4SSR_Online_Full_MultiMode' },
  { label: 'ACL4SSR 精简多模式', value: 'ACL4SSR_Online_Mini_MultiMode' },
  { label: 'ACL4SSR 多国家', value: 'ACL4SSR_Online_MultiCountry' },
  { label: 'ACL4SSR 精简多国家', value: 'ACL4SSR_Online_Mini_MultiCountry' },
  { label: 'ACL4SSR 无拦截', value: 'ACL4SSR_Online_NoReject' },
  { label: 'ACL4SSR 全分组奈飞', value: 'ACL4SSR_Online_Full_Netflix' },
  { label: 'ACL4SSR 全分组谷歌', value: 'ACL4SSR_Online_Full_Google' },
  { label: 'ACL4SSR 精简Fallback', value: 'ACL4SSR_Online_Mini_Fallback' },
  { label: 'ACL4SSR 精简去广告Plus', value: 'ACL4SSR_Online_Mini_AdblockPlus' },
]
