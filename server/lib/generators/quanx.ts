import type { Proxy } from '../types'
import type { ExternalGenerateOptions } from './types'

function proxyToQuanXLine(proxy: Proxy): string | null {
  switch (proxy.type) {
    case 'ss': {
      const parts = [
        `shadowsocks=${proxy.server}:${proxy.port}`,
        `method=${proxy.method}`,
        `password=${proxy.password}`,
        'fast-open=false',
        'udp-relay=true',
        `tag=${proxy.name}`,
      ]
      if (proxy.plugin === 'obfs-local' || proxy.plugin === 'v2ray-plugin') {
        if (typeof proxy.pluginOpts === 'object') {
          if (proxy.pluginOpts.mode) parts.splice(1, 0, `obfs=${proxy.pluginOpts.mode}`)
          if (proxy.pluginOpts.host) parts.splice(2, 0, `obfs-host=${proxy.pluginOpts.host}`)
          if (proxy.pluginOpts.path) parts.splice(3, 0, `obfs-uri=${proxy.pluginOpts.path}`)
        }
      }
      return parts.join(', ')
    }

    case 'vmess': {
      const method = proxy.security === 'auto' || !proxy.security
        ? 'chacha20-ietf-poly1305'
        : proxy.security
      const parts = [
        `vmess=${proxy.server}:${proxy.port}`,
        `method=${method}`,
        `password=${proxy.uuid}`,
      ]
      if (proxy.network === 'ws' || proxy.network === 'http') {
        parts.push(`obfs=${proxy.network === 'ws' ? 'ws' : 'http'}`)
        const host = proxy.wsHeaders?.Host || proxy.httpHost?.[0] || ''
        if (host) parts.push(`obfs-host=${host}`)
        const path = proxy.wsPath || proxy.httpPath || '/'
        parts.push(`obfs-uri=${path}`)
      }
      if (proxy.tls) {
        parts.push('over-tls=true')
        if (proxy.sni) parts.push(`tls-host=${proxy.sni}`)
      }
      parts.push('tls-verification=false')
      parts.push(`tag=${proxy.name}`)
      return parts.join(', ')
    }

    case 'trojan': {
      const parts = [
        `trojan=${proxy.server}:${proxy.port}`,
        `password=${proxy.password}`,
        'over-tls=true',
        `tls-host=${proxy.sni || proxy.server}`,
        'tls-verification=false',
      ]
      if (proxy.network === 'ws') {
        parts.push('obfs=ws')
        if (proxy.wsPath) parts.push(`obfs-uri=${proxy.wsPath}`)
        if (proxy.wsHeaders?.Host) parts.push(`obfs-host=${proxy.wsHeaders.Host}`)
      }
      parts.push('fast-open=false')
      parts.push('udp-relay=true')
      parts.push(`tag=${proxy.name}`)
      return parts.join(', ')
    }

    // vless, ssr, hysteria2 not supported in Quantumult X natively
    default:
      return null
  }
}

export function generateQuanX(proxies: Proxy[], options?: ExternalGenerateOptions): string {
  const serverLines: string[] = []
  const proxyNames: string[] = []

  for (const proxy of proxies) {
    const line = proxyToQuanXLine(proxy)
    if (line) {
      serverLines.push(line)
      proxyNames.push(proxy.name)
    }
  }

  const sections: string[] = []

  // [general]
  sections.push(`[general]
server_check_url=http://www.gstatic.com/generate_204
dns_exclusion_list=*.cmpassport.com, *.jegotrip.com.cn, *.icitymobile.mobi, id6.me
geo_location_checker=http://ip-api.com/json/?lang=zh-CN, https://raw.githubusercontent.com/KOP-XIAO/QuantumultX/master/Scripts/IP_API.js`)

  // [dns]
  sections.push(`[dns]
server=223.5.5.5
server=8.8.8.8`)

  // [policy]
  const hasExternal = options?.externalGroups && options.externalGroups.length > 0
  let policyLines: string[]

  if (hasExternal) {
    policyLines = options!.externalGroups!.map((g) => {
      const members = g.proxies.join(', ')
      if (g.type === 'url-test') {
        const url = g.url || 'http://www.gstatic.com/generate_204'
        const interval = g.interval || 300
        const tolerance = g.tolerance || 0
        return `url-latency-benchmark=${g.name}, ${members}, server-tag-regex=.*, check-interval=${interval}, tolerance=${tolerance}, alive-checking=false`
      }
      if (g.type === 'fallback') {
        const url = g.url || 'http://www.gstatic.com/generate_204'
        return `available=${g.name}, ${members}, server-tag-regex=.*, check-interval=${g.interval || 300}`
      }
      return `static=${g.name}, ${members}`
    })
  }
  else {
    const nameList = proxyNames.join(', ')
    policyLines = [
      `static=PROXY, ${nameList}, direct, reject`,
      `url-latency-benchmark=Auto, ${nameList}, server-tag-regex=.*, check-interval=300, tolerance=0`,
    ]
  }
  sections.push(`[policy]\n${policyLines.join('\n')}`)

  // [server_remote]
  sections.push(`[server_remote]`)

  // [filter_remote]
  sections.push(`[filter_remote]`)

  // [server_local]
  sections.push(`[server_local]\n${serverLines.join('\n')}`)

  // [filter_local]
  let filterLines: string[]
  if (options?.externalRules && options.externalRules.length > 0) {
    filterLines = options.externalRules.map((r) => {
      // Convert Clash rule format to QuanX format
      // MATCH -> final
      if (r.startsWith('MATCH,')) return r.replace('MATCH,', 'final, ')
      // GEOIP -> geoip
      return r.toLowerCase().replace(/^(domain|domain-suffix|domain-keyword|ip-cidr|ip-cidr6|geoip|geosite|user-agent|host|host-suffix|host-keyword)/i, match => match.toLowerCase())
    })
  }
  else {
    filterLines = ['geoip, cn, direct', 'final, PROXY']
  }
  sections.push(`[filter_local]\n${filterLines.join('\n')}`)

  return sections.join('\n\n') + '\n'
}
