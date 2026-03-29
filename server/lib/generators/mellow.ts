import type { Proxy } from '../types'
import type { ExternalGenerateOptions } from './types'

function safeBase64Encode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64')
}

function proxyToMellowLine(proxy: Proxy): string | null {
  switch (proxy.type) {
    case 'ss': {
      // Skip if has plugin (Mellow doesn't support SS plugins)
      if (proxy.plugin) return null
      const userinfo = safeBase64Encode(`${proxy.method}:${proxy.password}`)
      return `${proxy.name}, ss, ss://${userinfo}@${proxy.server}:${proxy.port}`
    }

    case 'vmess': {
      const params: string[] = []
      const network = proxy.network || 'tcp'
      params.push(`network=${network}`)
      if (proxy.tls) params.push('tls=true')
      if (network === 'ws') {
        if (proxy.wsPath) params.push(`ws.path=${proxy.wsPath}`)
        if (proxy.wsHeaders?.Host) params.push(`ws.host=${proxy.wsHeaders.Host}`)
      }
      if (network === 'h2') {
        if (proxy.h2Path) params.push(`h2.path=${proxy.h2Path}`)
        if (proxy.h2Host?.[0]) params.push(`h2.host=${proxy.h2Host[0]}`)
      }
      const qs = params.length > 0 ? `?${params.join('&')}` : ''
      return `${proxy.name}, vmess1, vmess1://${proxy.uuid}@${proxy.server}:${proxy.port}${qs}`
    }

    case 'socks5': {
      let line = `${proxy.name}, socks, ${proxy.server}:${proxy.port}`
      if (proxy.username) line += `, username=${proxy.username}`
      if (proxy.password) line += `, password=${proxy.password}`
      return line
    }

    case 'http': {
      let line = `${proxy.name}, http, ${proxy.server}:${proxy.port}`
      if (proxy.username) line += `, username=${proxy.username}`
      if (proxy.password) line += `, password=${proxy.password}`
      return line
    }

    default:
      return null
  }
}

export function generateMellow(proxies: Proxy[], options?: ExternalGenerateOptions): string {
  const endpointLines: string[] = []
  const proxyNames: string[] = []

  for (const proxy of proxies) {
    const line = proxyToMellowLine(proxy)
    if (line) {
      endpointLines.push(line)
      proxyNames.push(proxy.name)
    }
  }

  const sections: string[] = []

  // [Endpoint]
  sections.push(`[Endpoint]\n${endpointLines.join('\n')}`)

  // [Routing]
  const hasExternal = options?.externalGroups && options.externalGroups.length > 0
  if (hasExternal) {
    const groupLines = options!.externalGroups!.map((g) => {
      return `${g.name} = ${g.proxies.join(', ')}`
    })
    sections.push(`[EndpointGroup]\n${groupLines.join('\n')}`)
  }
  else {
    const nameList = proxyNames.join(', ')
    sections.push(`[EndpointGroup]\nPROXY = ${nameList}`)
  }

  // [RoutingRule]
  let ruleLines: string[]
  if (options?.externalRules && options.externalRules.length > 0) {
    ruleLines = options.externalRules.map((r) => {
      if (r.startsWith('MATCH,')) return `FINAL, ${r.slice(6)}`
      return r
    })
  }
  else {
    ruleLines = ['FINAL, PROXY']
  }
  sections.push(`[RoutingRule]\n${ruleLines.join('\n')}`)

  // [General]
  sections.push(`[General]\nloglevel = warning\ndns-server = 8.8.8.8, 223.5.5.5`)

  return sections.join('\n\n') + '\n'
}
