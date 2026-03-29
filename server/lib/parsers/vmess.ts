import type { Proxy } from '../types'

/**
 * Decode a base64 or base64url string to UTF-8.
 */
function safeBase64Decode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4
  if (pad === 2) s += '=='
  else if (pad === 3) s += '='
  return Buffer.from(s, 'base64').toString('utf-8')
}

interface VMessJSON {
  v?: string | number
  ps?: string
  add?: string
  port?: string | number
  id?: string
  aid?: string | number
  scy?: string
  net?: string
  type?: string // header type (for tcp: none/http)
  host?: string
  path?: string
  tls?: string
  sni?: string
  alpn?: string
  fp?: string
}

/**
 * Parse a vmess:// V2Ray VMess URI into a Proxy object.
 *
 * Format: vmess://BASE64(JSON)
 */
export function parseVMess(uri: string): Proxy | null {
  try {
    uri = uri.trim()
    if (!uri.startsWith('vmess://')) return null

    const encoded = uri.slice(8)
    const decoded = safeBase64Decode(encoded)
    const json: VMessJSON = JSON.parse(decoded)

    const server = json.add
    if (!server) return null

    const port = Number.parseInt(String(json.port ?? '0'), 10)
    if (Number.isNaN(port) || port <= 0 || port > 65535) return null

    const uuid = json.id
    if (!uuid) return null

    const proxy: Proxy = {
      type: 'vmess',
      name: json.ps || `${server}:${port}`,
      server,
      port,
      uuid,
      alterId: Number.parseInt(String(json.aid ?? '0'), 10) || 0,
      security: json.scy || 'auto',
    }

    // Network / transport
    const net = json.net || 'tcp'
    proxy.network = mapNetwork(net)

    // TLS
    if (json.tls === 'tls') {
      proxy.tls = true
      if (json.sni) proxy.sni = json.sni
      if (json.alpn) proxy.alpn = json.alpn.split(',').map(s => s.trim())
      if (json.fp) proxy.fingerprint = json.fp
    }

    // Transport-specific fields
    switch (net) {
      case 'ws':
        if (json.path) proxy.wsPath = json.path
        if (json.host) proxy.wsHeaders = { Host: json.host }
        break
      case 'h2':
        if (json.path) proxy.h2Path = json.path
        if (json.host) proxy.h2Host = json.host.split(',').map(s => s.trim())
        break
      case 'grpc':
        if (json.path) proxy.grpcServiceName = json.path
        break
      case 'http':
        if (json.path) proxy.httpPath = json.path
        if (json.host) proxy.httpHost = json.host.split(',').map(s => s.trim())
        break
      case 'tcp':
        // For tcp with http obfs, host/path go to httpPath/httpHost
        if (json.type === 'http') {
          proxy.network = 'http'
          if (json.path) proxy.httpPath = json.path
          if (json.host) proxy.httpHost = json.host.split(',').map(s => s.trim())
        }
        break
    }

    return proxy
  }
  catch {
    return null
  }
}

function mapNetwork(net: string): Proxy['network'] {
  const map: Record<string, Proxy['network']> = {
    tcp: 'tcp',
    ws: 'ws',
    h2: 'h2',
    grpc: 'grpc',
    http: 'http',
    quic: 'quic',
    httpupgrade: 'httpupgrade',
  }
  return map[net] ?? 'tcp'
}
