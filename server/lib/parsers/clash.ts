import yaml from 'js-yaml'
import type { Proxy, ProxyType } from '../types'

interface ClashProxy {
  type: string
  name: string
  server: string
  port: number
  [key: string]: unknown
}

interface ClashConfig {
  proxies?: ClashProxy[]
}

/**
 * Parse a Clash YAML configuration string into an array of Proxy objects.
 */
export function parseClash(content: string): Proxy[] {
  try {
    const config = yaml.load(content) as ClashConfig
    if (!config || !Array.isArray(config.proxies)) return []

    const results: Proxy[] = []
    for (const p of config.proxies) {
      const proxy = mapClashProxy(p)
      if (proxy) results.push(proxy)
    }
    return results
  }
  catch {
    return []
  }
}

function mapClashProxy(p: ClashProxy): Proxy | null {
  try {
    const type = mapType(p.type)
    if (!type) return null

    if (!p.server || !p.port) return null

    const proxy: Proxy = {
      type,
      name: p.name || `${p.server}:${p.port}`,
      server: String(p.server),
      port: Number(p.port),
    }

    switch (type) {
      case 'ss':
        mapSS(proxy, p)
        break
      case 'ssr':
        mapSSR(proxy, p)
        break
      case 'vmess':
        mapVMess(proxy, p)
        break
      case 'vless':
        mapVLess(proxy, p)
        break
      case 'trojan':
        mapTrojan(proxy, p)
        break
      case 'hysteria2':
        mapHysteria2(proxy, p)
        break
    }

    // Common fields
    if (p.udp) proxy.udp = true
    if (p.tfo) proxy.tfo = true
    if (p['skip-cert-verify']) proxy.skipCertVerify = true

    return proxy
  }
  catch {
    return null
  }
}

function mapType(t: string): ProxyType | null {
  const map: Record<string, ProxyType> = {
    'ss': 'ss',
    'ssr': 'ssr',
    'vmess': 'vmess',
    'vless': 'vless',
    'trojan': 'trojan',
    'hysteria2': 'hysteria2',
    'hy2': 'hysteria2',
    'wireguard': 'wireguard',
    'http': 'http',
    'socks5': 'socks5',
  }
  return map[t] ?? null
}

function mapSS(proxy: Proxy, p: ClashProxy): void {
  proxy.method = str(p.cipher)
  proxy.password = str(p.password)
  if (p.plugin) {
    proxy.plugin = str(p.plugin)
    if (p['plugin-opts']) proxy.pluginOpts = p['plugin-opts'] as Record<string, string>
  }
}

function mapSSR(proxy: Proxy, p: ClashProxy): void {
  proxy.method = str(p.cipher)
  proxy.password = str(p.password)
  proxy.protocol = str(p.protocol)
  proxy.protocolParam = str(p['protocol-param'])
  proxy.obfs = str(p.obfs)
  proxy.obfsParam = str(p['obfs-param'])
}

function mapVMess(proxy: Proxy, p: ClashProxy): void {
  proxy.uuid = str(p.uuid)
  proxy.alterId = num(p.alterId) ?? 0
  proxy.security = str(p.cipher) || 'auto'
  mapTransport(proxy, p)
  mapTLS(proxy, p)
}

function mapVLess(proxy: Proxy, p: ClashProxy): void {
  proxy.uuid = str(p.uuid)
  if (p.flow) proxy.flow = str(p.flow)
  mapTransport(proxy, p)
  mapTLS(proxy, p)

  // Reality
  const realityOpts = p['reality-opts'] as Record<string, string> | undefined
  if (realityOpts) {
    proxy.realityOpts = {}
    if (realityOpts['public-key']) {
      proxy.publicKey = realityOpts['public-key']
      proxy.realityOpts.publicKey = realityOpts['public-key']
    }
    if (realityOpts['short-id']) {
      proxy.shortId = realityOpts['short-id']
      proxy.realityOpts.shortId = realityOpts['short-id']
    }
  }
}

function mapTrojan(proxy: Proxy, p: ClashProxy): void {
  proxy.password = str(p.password)
  mapTransport(proxy, p)
  mapTLS(proxy, p)
}

function mapHysteria2(proxy: Proxy, p: ClashProxy): void {
  proxy.password = str(p.password)
  if (p.obfs) proxy.obfsType = str(p.obfs)
  if (p['obfs-password']) proxy.obfsPassword = str(p['obfs-password'])
  if (p.up) proxy.up = str(p.up)
  if (p.down) proxy.down = str(p.down)
  mapTLS(proxy, p)
}

function mapTransport(proxy: Proxy, p: ClashProxy): void {
  const network = str(p.network) || 'tcp'
  proxy.network = network as Proxy['network']

  switch (network) {
    case 'ws': {
      const opts = p['ws-opts'] as Record<string, unknown> | undefined
      if (opts) {
        if (opts.path) proxy.wsPath = str(opts.path)
        if (opts.headers) proxy.wsHeaders = opts.headers as Record<string, string>
      }
      break
    }
    case 'grpc': {
      const opts = p['grpc-opts'] as Record<string, unknown> | undefined
      if (opts && opts['grpc-service-name']) {
        proxy.grpcServiceName = str(opts['grpc-service-name'])
      }
      break
    }
    case 'h2': {
      const opts = p['h2-opts'] as Record<string, unknown> | undefined
      if (opts) {
        if (opts.path) proxy.h2Path = str(opts.path)
        if (opts.host) proxy.h2Host = opts.host as string[]
      }
      break
    }
    case 'http': {
      const opts = p['http-opts'] as Record<string, unknown> | undefined
      if (opts) {
        if (opts.path) proxy.httpPath = Array.isArray(opts.path) ? str(opts.path[0]) : str(opts.path)
        if (opts.headers) {
          const headers = opts.headers as Record<string, string[]>
          if (headers.Host) proxy.httpHost = Array.isArray(headers.Host) ? headers.Host : [String(headers.Host)]
        }
      }
      break
    }
  }
}

function mapTLS(proxy: Proxy, p: ClashProxy): void {
  if (p.tls) {
    proxy.tls = true
    if (p.sni) proxy.sni = str(p.sni)
    if (p.servername) proxy.sni = str(p.servername)
    if (p.alpn) proxy.alpn = p.alpn as string[]
    if (p['client-fingerprint']) proxy.fingerprint = str(p['client-fingerprint'])
  }
}

function str(v: unknown): string {
  if (v === undefined || v === null) return ''
  return String(v)
}

function num(v: unknown): number | undefined {
  if (v === undefined || v === null) return undefined
  const n = Number(v)
  return Number.isNaN(n) ? undefined : n
}
