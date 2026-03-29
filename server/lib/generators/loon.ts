import type { Proxy } from '../types'
import type { ExternalGenerateOptions } from './types'

function proxyToLoonLine(proxy: Proxy): string | null {
  switch (proxy.type) {
    case 'ss': {
      const parts = [
        `${proxy.name} = Shadowsocks`,
        proxy.server,
        String(proxy.port),
        proxy.method || 'aes-256-gcm',
        `"${proxy.password || ''}"`,
      ]
      if (proxy.plugin === 'obfs-local' && typeof proxy.pluginOpts === 'object') {
        parts.push(`obfs-name=${proxy.pluginOpts.mode || 'http'}`)
        if (proxy.pluginOpts.host) parts.push(`obfs-host=${proxy.pluginOpts.host}`)
        if (proxy.pluginOpts.path) parts.push(`obfs-uri=${proxy.pluginOpts.path}`)
      }
      if (proxy.udp !== false) parts.push('udp=true')
      if (proxy.tfo) parts.push('fast-open=true')
      return parts.join(',')
    }

    case 'ssr': {
      const parts = [
        `${proxy.name} = ShadowsocksR`,
        proxy.server,
        String(proxy.port),
        proxy.method || 'aes-256-cfb',
        `"${proxy.password || ''}"`,
        `protocol=${proxy.protocol || 'origin'}`,
      ]
      if (proxy.protocolParam) parts.push(`protocol-param=${proxy.protocolParam}`)
      parts.push(`obfs=${proxy.obfs || 'plain'}`)
      if (proxy.obfsParam) parts.push(`obfs-param=${proxy.obfsParam}`)
      if (proxy.udp !== false) parts.push('udp=true')
      if (proxy.tfo) parts.push('fast-open=true')
      return parts.join(',')
    }

    case 'vmess': {
      const parts = [
        `${proxy.name} = vmess`,
        proxy.server,
        String(proxy.port),
        proxy.security || 'auto',
        `"${proxy.uuid}"`,
      ]
      if (proxy.network === 'ws') {
        parts.push('transport=ws')
        if (proxy.wsPath) parts.push(`path=${proxy.wsPath}`)
        if (proxy.wsHeaders?.Host) parts.push(`host=${proxy.wsHeaders.Host}`)
      }
      else if (proxy.network === 'h2') {
        parts.push('transport=h2')
        if (proxy.h2Path) parts.push(`path=${proxy.h2Path}`)
        if (proxy.h2Host?.[0]) parts.push(`host=${proxy.h2Host[0]}`)
      }
      if (proxy.tls) {
        parts.push('over-tls=true')
        if (proxy.sni) parts.push(`tls-name=${proxy.sni}`)
        if (proxy.skipCertVerify) parts.push('skip-cert-verify=true')
      }
      if (proxy.alterId != null) parts.push(`alterId=${proxy.alterId}`)
      if (proxy.udp !== false) parts.push('udp=true')
      if (proxy.tfo) parts.push('fast-open=true')
      return parts.join(',')
    }

    case 'vless': {
      const parts = [
        `${proxy.name} = vless`,
        proxy.server,
        String(proxy.port),
        `"${proxy.uuid}"`,
      ]
      if (proxy.network === 'ws') {
        parts.push('transport=ws')
        if (proxy.wsPath) parts.push(`path=${proxy.wsPath}`)
        if (proxy.wsHeaders?.Host) parts.push(`host=${proxy.wsHeaders.Host}`)
      }
      else if (proxy.network === 'grpc') {
        parts.push('transport=grpc')
        if (proxy.grpcServiceName) parts.push(`grpc-service-name=${proxy.grpcServiceName}`)
      }
      if (proxy.tls !== false) {
        parts.push('over-tls=true')
        if (proxy.sni) parts.push(`tls-name=${proxy.sni}`)
        if (proxy.skipCertVerify) parts.push('skip-cert-verify=true')
      }
      if (proxy.udp !== false) parts.push('udp=true')
      if (proxy.tfo) parts.push('fast-open=true')
      return parts.join(',')
    }

    case 'trojan': {
      const parts = [
        `${proxy.name} = trojan`,
        proxy.server,
        String(proxy.port),
        `"${proxy.password || ''}"`,
      ]
      if (proxy.network === 'ws') {
        parts.push('transport=ws')
        if (proxy.wsPath) parts.push(`path=${proxy.wsPath}`)
        if (proxy.wsHeaders?.Host) parts.push(`host=${proxy.wsHeaders.Host}`)
      }
      if (proxy.sni) parts.push(`tls-name=${proxy.sni}`)
      if (proxy.skipCertVerify) parts.push('skip-cert-verify=true')
      if (proxy.udp !== false) parts.push('udp=true')
      if (proxy.tfo) parts.push('fast-open=true')
      return parts.join(',')
    }

    case 'hysteria2': {
      const parts = [
        `${proxy.name} = Hysteria2`,
        proxy.server,
        String(proxy.port),
        `"${proxy.password || ''}"`,
      ]
      if (proxy.sni) parts.push(`tls-name=${proxy.sni}`)
      if (proxy.skipCertVerify) parts.push('skip-cert-verify=true')
      if (proxy.down) parts.push(`download-bandwidth=${proxy.down}`)
      if (proxy.udp !== false) parts.push('udp=true')
      return parts.join(',')
    }

    default:
      return null
  }
}

export function generateLoon(proxies: Proxy[], options?: ExternalGenerateOptions): string {
  const proxyLines: string[] = []
  const proxyNames: string[] = []

  for (const proxy of proxies) {
    const line = proxyToLoonLine(proxy)
    if (line) {
      proxyLines.push(line)
      proxyNames.push(proxy.name)
    }
  }

  const sections: string[] = []

  // [General]
  sections.push(`[General]
skip-proxy = 192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,localhost,*.local,e.]
bypass-tun = 10.0.0.0/8,100.64.0.0/10,127.0.0.0/8,169.254.0.0/16,172.16.0.0/12,192.0.0.0/24,192.168.0.0/16,224.0.0.0/4,255.255.255.255/32
dns-server = system,119.29.29.29,223.5.5.5
allow-wifi-access = false
wifi-access-http-port = 7222
wifi-access-socks5-port = 7221`)

  // [Proxy]
  sections.push(`[Proxy]\n${proxyLines.join('\n')}`)

  // [Proxy Group]
  const hasExternal = options?.externalGroups && options.externalGroups.length > 0
  let groupLines: string[]

  if (hasExternal) {
    groupLines = options!.externalGroups!.map((g) => {
      const type = g.type === 'url-test' ? 'url-test' : g.type === 'fallback' ? 'fallback' : g.type === 'load-balance' ? 'load-balance' : 'select'
      const members = g.proxies.join(',')
      if (type === 'url-test' || type === 'fallback') {
        const url = g.url || 'http://www.gstatic.com/generate_204'
        const interval = g.interval || 300
        return `${g.name} = ${type},${members},url = ${url},interval = ${interval}`
      }
      return `${g.name} = ${type},${members}`
    })
  }
  else {
    const nameList = proxyNames.join(',')
    groupLines = [
      `PROXY = select,${nameList},DIRECT,REJECT`,
      `Auto = url-test,${nameList},url = http://www.gstatic.com/generate_204,interval = 300`,
    ]
  }
  sections.push(`[Proxy Group]\n${groupLines.join('\n')}`)

  // [Rule]
  let rules: string[]
  if (options?.externalRules && options.externalRules.length > 0) {
    rules = options.externalRules.map((r) => {
      // Convert MATCH to FINAL for Loon
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
