import type { Proxy } from '../types'
import type { ExternalGenerateOptions } from './types'

interface SingBoxOutbound {
  type: string
  tag: string
  [key: string]: unknown
}

function buildTransport(proxy: Proxy): Record<string, unknown> | undefined {
  if (!proxy.network || proxy.network === 'tcp') return undefined

  if (proxy.network === 'ws') {
    const transport: Record<string, unknown> = { type: 'ws' }
    if (proxy.wsPath) transport.path = proxy.wsPath
    if (proxy.wsHeaders) transport.headers = proxy.wsHeaders
    return transport
  }

  if (proxy.network === 'grpc') {
    const transport: Record<string, unknown> = { type: 'grpc' }
    if (proxy.grpcServiceName) transport.service_name = proxy.grpcServiceName
    return transport
  }

  if (proxy.network === 'h2') {
    const transport: Record<string, unknown> = { type: 'http' }
    if (proxy.h2Host) transport.host = proxy.h2Host
    if (proxy.h2Path) transport.path = proxy.h2Path
    return transport
  }

  if (proxy.network === 'http') {
    const transport: Record<string, unknown> = { type: 'http' }
    if (proxy.httpHost) transport.host = proxy.httpHost
    if (proxy.httpPath) transport.path = proxy.httpPath
    return transport
  }

  if (proxy.network === 'httpupgrade') {
    const transport: Record<string, unknown> = { type: 'httpupgrade' }
    if (proxy.wsPath) transport.path = proxy.wsPath
    if (proxy.wsHeaders) transport.headers = proxy.wsHeaders
    return transport
  }

  return undefined
}

function buildTls(proxy: Proxy): Record<string, unknown> | undefined {
  if (!proxy.tls) return undefined

  const tls: Record<string, unknown> = {
    enabled: true,
  }
  if (proxy.sni) tls.server_name = proxy.sni
  if (proxy.skipCertVerify) tls.insecure = true
  if (proxy.alpn) tls.alpn = proxy.alpn
  if (proxy.fingerprint) tls.utls = { enabled: true, fingerprint: proxy.fingerprint }

  // Reality
  if (proxy.publicKey || proxy.realityOpts) {
    const pk = proxy.realityOpts?.publicKey || proxy.publicKey
    const sid = proxy.realityOpts?.shortId || proxy.shortId
    tls.reality = {
      enabled: true,
      public_key: pk,
      short_id: sid || '',
    }
  }

  return tls
}

function mapProxyToSingBox(proxy: Proxy): SingBoxOutbound | null {
  switch (proxy.type) {
    case 'ss': {
      const outbound: SingBoxOutbound = {
        type: 'shadowsocks',
        tag: proxy.name,
        server: proxy.server,
        server_port: proxy.port,
        method: proxy.method || 'aes-256-gcm',
        password: proxy.password || '',
      }
      if (proxy.plugin) {
        outbound.plugin = proxy.plugin
        if (proxy.pluginOpts) outbound.plugin_opts = typeof proxy.pluginOpts === 'string' ? proxy.pluginOpts : ''
      }
      return outbound
    }

    case 'vmess': {
      const outbound: SingBoxOutbound = {
        type: 'vmess',
        tag: proxy.name,
        server: proxy.server,
        server_port: proxy.port,
        uuid: proxy.uuid,
        alter_id: proxy.alterId ?? 0,
        security: proxy.security || 'auto',
      }
      const transport = buildTransport(proxy)
      if (transport) outbound.transport = transport
      const tls = buildTls(proxy)
      if (tls) outbound.tls = tls
      return outbound
    }

    case 'vless': {
      const outbound: SingBoxOutbound = {
        type: 'vless',
        tag: proxy.name,
        server: proxy.server,
        server_port: proxy.port,
        uuid: proxy.uuid || '',
      }
      if (proxy.flow) outbound.flow = proxy.flow
      const transport = buildTransport(proxy)
      if (transport) outbound.transport = transport
      const tls = buildTls(proxy)
      if (tls) outbound.tls = tls
      return outbound
    }

    case 'trojan': {
      const outbound: SingBoxOutbound = {
        type: 'trojan',
        tag: proxy.name,
        server: proxy.server,
        server_port: proxy.port,
        password: proxy.password || '',
      }
      const transport = buildTransport(proxy)
      if (transport) outbound.transport = transport
      const tls: Record<string, unknown> = {
        enabled: true,
      }
      if (proxy.sni) tls.server_name = proxy.sni
      if (proxy.skipCertVerify) tls.insecure = true
      if (proxy.alpn) tls.alpn = proxy.alpn
      outbound.tls = tls
      return outbound
    }

    case 'hysteria2': {
      const outbound: SingBoxOutbound = {
        type: 'hysteria2',
        tag: proxy.name,
        server: proxy.server,
        server_port: proxy.port,
        password: proxy.password || '',
      }
      if (proxy.obfsType) {
        outbound.obfs = {
          type: proxy.obfsType,
          password: proxy.obfsPassword || '',
        }
      }
      const tls: Record<string, unknown> = {
        enabled: true,
      }
      if (proxy.sni) tls.server_name = proxy.sni
      if (proxy.skipCertVerify) tls.insecure = true
      if (proxy.alpn) tls.alpn = proxy.alpn
      outbound.tls = tls
      if (proxy.up) outbound.up_mbps = Number.parseInt(proxy.up) || 0
      if (proxy.down) outbound.down_mbps = Number.parseInt(proxy.down) || 0
      return outbound
    }

    // ssr, wireguard, http, socks5 — skip for now
    default:
      return null
  }
}

/** Convert Clash-format rules to sing-box route rules */
function convertRulesToSingBox(rules: string[]): Array<Record<string, unknown>> {
  const singboxRules: Array<Record<string, unknown>> = []

  for (const line of rules) {
    const parts = line.split(',').map(s => s.trim())
    if (parts.length < 2) continue

    const ruleType = parts[0]!.toUpperCase()
    const value = parts[1]!
    const policy = parts[2] || value

    // Map policy name to outbound tag
    const outbound = policy === 'DIRECT' ? 'direct'
      : policy === 'REJECT' ? 'block'
        : 'proxy'

    switch (ruleType) {
      case 'DOMAIN':
        singboxRules.push({ domain: [value], outbound })
        break
      case 'DOMAIN-SUFFIX':
        singboxRules.push({ domain_suffix: [value], outbound })
        break
      case 'DOMAIN-KEYWORD':
        singboxRules.push({ domain_keyword: [value], outbound })
        break
      case 'IP-CIDR':
      case 'IP-CIDR6':
        singboxRules.push({ ip_cidr: [value], outbound })
        break
      case 'GEOIP':
        singboxRules.push({ geoip: value.toLowerCase(), outbound })
        break
      case 'GEOSITE':
        singboxRules.push({ geosite: value.toLowerCase(), outbound })
        break
      case 'MATCH':
      case 'FINAL':
        // handled as default route
        break
    }
  }

  return singboxRules
}

export function generateSingBox(proxies: Proxy[], options?: ExternalGenerateOptions): string {
  const outbounds: SingBoxOutbound[] = []
  const tags: string[] = []

  for (const proxy of proxies) {
    const ob = mapProxyToSingBox(proxy)
    if (ob) {
      outbounds.push(ob)
      tags.push(ob.tag)
    }
  }

  // Build proxy/selector outbounds from external groups or defaults
  const hasExternal = options?.externalGroups && options.externalGroups.length > 0

  let selectorOutbounds: SingBoxOutbound[]
  if (hasExternal) {
    selectorOutbounds = options!.externalGroups!.map((g) => {
      if (g.type === 'url-test' || g.type === 'fallback') {
        return {
          type: 'urltest',
          tag: g.name,
          outbounds: g.proxies.length > 0 ? g.proxies : [...tags],
          url: g.url || 'http://www.gstatic.com/generate_204',
          interval: `${g.interval || 300}s`,
        }
      }
      return {
        type: 'selector',
        tag: g.name,
        outbounds: g.proxies.length > 0 ? g.proxies : [...tags, 'direct'],
        default: g.proxies[0] || tags[0] || 'direct',
      }
    })
  }
  else {
    selectorOutbounds = [
      {
        type: 'selector',
        tag: 'proxy',
        outbounds: [...tags, 'auto', 'direct'],
        default: tags[0] || 'direct',
      },
      {
        type: 'urltest',
        tag: 'auto',
        outbounds: [...tags],
        url: 'http://www.gstatic.com/generate_204',
        interval: '3m',
      },
    ]
  }

  // Build route rules
  let routeRules: Array<Record<string, unknown>>
  if (options?.externalRules && options.externalRules.length > 0) {
    routeRules = [
      { protocol: 'dns', outbound: 'dns-out' },
      ...convertRulesToSingBox(options.externalRules),
    ]
  }
  else {
    routeRules = [
      { protocol: 'dns', outbound: 'dns-out' },
      { geoip: 'cn', geosite: 'cn', outbound: 'direct' },
    ]
  }

  const config = {
    log: {
      level: 'info',
      timestamp: true,
    },
    dns: {
      servers: [
        {
          tag: 'google',
          address: 'https://dns.google/dns-query',
          detour: 'proxy',
        },
        {
          tag: 'local',
          address: '223.5.5.5',
          detour: 'direct',
        },
      ],
      rules: [
        {
          geosite: 'cn',
          server: 'local',
        },
      ],
    },
    inbounds: [
      {
        type: 'mixed',
        tag: 'mixed-in',
        listen: '127.0.0.1',
        listen_port: 2080,
      },
    ],
    outbounds: [
      ...selectorOutbounds,
      ...outbounds,
      {
        type: 'direct',
        tag: 'direct',
      },
      {
        type: 'block',
        tag: 'block',
      },
      {
        type: 'dns',
        tag: 'dns-out',
      },
    ],
    route: {
      rules: routeRules,
      auto_detect_interface: true,
    },
  }

  return JSON.stringify(config, null, 2)
}
