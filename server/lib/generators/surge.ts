import type { Proxy } from '../types'
import type { ExternalGenerateOptions } from './types'

function proxyToSurgeLine(proxy: Proxy): string | null {
  switch (proxy.type) {
    case 'ss': {
      const parts = [
        `${proxy.name} = ss`,
        proxy.server,
        String(proxy.port),
        `encrypt-method=${proxy.method}`,
        `password=${proxy.password}`,
      ]
      if (proxy.udp !== false) parts.push('udp-relay=true')
      if (proxy.tfo) parts.push('tfo=true')
      if (proxy.plugin === 'obfs-local' || proxy.plugin === 'v2ray-plugin') {
        if (typeof proxy.pluginOpts === 'object') {
          for (const [k, v] of Object.entries(proxy.pluginOpts)) {
            parts.push(`${k}=${v}`)
          }
        }
      }
      return parts.join(', ')
    }

    case 'vmess': {
      const parts = [
        `${proxy.name} = vmess`,
        proxy.server,
        String(proxy.port),
        `username=${proxy.uuid}`,
      ]
      if (proxy.tls) parts.push('tls=true')
      if (proxy.sni) parts.push(`sni=${proxy.sni}`)
      if (proxy.skipCertVerify) parts.push('skip-cert-verify=true')
      if (proxy.network === 'ws') {
        parts.push('ws=true')
        if (proxy.wsPath) parts.push(`ws-path=${proxy.wsPath}`)
        if (proxy.wsHeaders?.Host) parts.push(`ws-headers=Host:${proxy.wsHeaders.Host}`)
      }
      return parts.join(', ')
    }

    case 'trojan': {
      const parts = [
        `${proxy.name} = trojan`,
        proxy.server,
        String(proxy.port),
        `password=${proxy.password}`,
      ]
      if (proxy.sni) parts.push(`sni=${proxy.sni}`)
      if (proxy.skipCertVerify) parts.push('skip-cert-verify=true')
      if (proxy.network === 'ws') {
        parts.push('ws=true')
        if (proxy.wsPath) parts.push(`ws-path=${proxy.wsPath}`)
      }
      if (proxy.udp !== false) parts.push('udp-relay=true')
      return parts.join(', ')
    }

    case 'hysteria2': {
      const parts = [
        `${proxy.name} = hysteria2`,
        proxy.server,
        String(proxy.port),
        `password=${proxy.password}`,
      ]
      if (proxy.sni) parts.push(`sni=${proxy.sni}`)
      if (proxy.skipCertVerify) parts.push('skip-cert-verify=true')
      if (proxy.down) parts.push(`download-bandwidth=${proxy.down}`)
      return parts.join(', ')
    }

    // ssr, vless, wireguard etc. not natively supported in Surge
    default:
      return null
  }
}

export function generateSurge(proxies: Proxy[], options?: ExternalGenerateOptions & { ver?: number }): string {
  const proxyLines: string[] = []
  const proxyNames: string[] = []

  for (const proxy of proxies) {
    const line = proxyToSurgeLine(proxy)
    if (line) {
      proxyLines.push(line)
      proxyNames.push(proxy.name)
    }
  }

  const nameList = proxyNames.join(', ')
  const hasExternal = options?.externalGroups && options.externalGroups.length > 0

  const sections: string[] = []

  // [General]
  sections.push(`[General]
loglevel = notify
skip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10, 17.0.0.0/8, localhost, *.local, *.crashlytics.com
dns-server = 8.8.8.8, 8.8.4.4, 223.5.5.5
ipv6 = false`)

  // [Proxy]
  sections.push(`[Proxy]
DIRECT = direct
${proxyLines.join('\n')}`)

  // [Proxy Group]
  let groupLines: string[]
  if (hasExternal) {
    groupLines = options!.externalGroups!.map((g) => {
      const members = g.proxies.join(', ')
      if (g.type === 'url-test' || g.type === 'fallback') {
        const url = g.url || 'http://www.gstatic.com/generate_204'
        const interval = g.interval || 300
        return `${g.name} = ${g.type}, ${members}, url=${url}, interval=${interval}`
      }
      if (g.type === 'load-balance') {
        return `${g.name} = load-balance, ${members}`
      }
      return `${g.name} = select, ${members}`
    })
  }
  else {
    groupLines = [
      `PROXY = select, ${nameList}, DIRECT, REJECT`,
      `Auto = url-test, ${nameList}, url=http://www.gstatic.com/generate_204, interval=300`,
    ]
  }
  sections.push(`[Proxy Group]\n${groupLines.join('\n')}`)

  // [Rule]
  let rules: string[]
  if (options?.externalRules && options.externalRules.length > 0) {
    rules = options.externalRules.map((r) => {
      // Convert MATCH to FINAL for Surge
      if (r.startsWith('MATCH,')) return r.replace('MATCH,', 'FINAL,')
      return r
    })
  }
  else {
    rules = ['GEOIP,CN,DIRECT', 'FINAL,PROXY']
  }
  sections.push(`[Rule]\n${rules.join('\n')}`)

  return sections.join('\n\n') + '\n'
}
