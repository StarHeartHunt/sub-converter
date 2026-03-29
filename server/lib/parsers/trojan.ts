import type { Proxy } from '../types'

/**
 * Parse a trojan:// URI into a Proxy object.
 *
 * Format: trojan://password@server:port?sni=xxx&type=tcp&security=tls#name
 */
export function parseTrojan(uri: string): Proxy | null {
  try {
    uri = uri.trim()
    if (!uri.startsWith('trojan://')) return null

    // Use URL parser — trojan:// maps cleanly to http:// structure
    const url = new URL(uri.replace('trojan://', 'http://'))

    const password = decodeURIComponent(url.username)
    if (!password) return null

    const server = url.hostname.replace(/^\[|\]$/g, '')
    const port = Number.parseInt(url.port || '443', 10)
    if (Number.isNaN(port) || port <= 0 || port > 65535) return null

    const params = url.searchParams
    const name = decodeURIComponent(url.hash.slice(1)) || `${server}:${port}`

    const proxy: Proxy = {
      type: 'trojan',
      name,
      server,
      port,
      password,
    }

    // Transport
    const type = params.get('type') || 'tcp'
    proxy.network = mapNetwork(type)

    // TLS (trojan defaults to TLS)
    const security = params.get('security') || 'tls'
    if (security !== 'none') {
      proxy.tls = true

      const sni = params.get('sni') || params.get('peer')
      if (sni) proxy.sni = sni

      const fp = params.get('fp')
      if (fp) proxy.fingerprint = fp

      const alpn = params.get('alpn')
      if (alpn) proxy.alpn = alpn.split(',').map(s => s.trim())

      const allowInsecure = params.get('allowInsecure')
      if (allowInsecure === '1' || allowInsecure === 'true') {
        proxy.skipCertVerify = true
      }
    }

    // Transport-specific
    switch (type) {
      case 'ws': {
        const path = params.get('path')
        if (path) proxy.wsPath = decodeURIComponent(path)
        const host = params.get('host')
        if (host) proxy.wsHeaders = { Host: host }
        break
      }
      case 'grpc': {
        const serviceName = params.get('serviceName')
        if (serviceName) proxy.grpcServiceName = serviceName
        break
      }
      case 'h2': {
        const path = params.get('path')
        if (path) proxy.h2Path = decodeURIComponent(path)
        const host = params.get('host')
        if (host) proxy.h2Host = host.split(',').map(s => s.trim())
        break
      }
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
