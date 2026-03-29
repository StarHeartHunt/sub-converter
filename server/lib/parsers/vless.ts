import type { Proxy } from '../types'

/**
 * Parse a vless:// URI into a Proxy object.
 *
 * Format: vless://uuid@server:port?type=tcp&security=tls&sni=xxx&flow=xxx&fp=xxx&pbk=xxx&sid=xxx#name
 */
export function parseVLess(uri: string): Proxy | null {
  try {
    uri = uri.trim()
    if (!uri.startsWith('vless://')) return null

    // Use URL parser with a dummy base for robust parsing
    // vless://uuid@server:port?params#fragment
    const url = new URL(uri.replace('vless://', 'http://'))

    const uuid = url.username
    if (!uuid) return null

    const server = url.hostname.replace(/^\[|\]$/g, '') // strip IPv6 brackets
    const port = Number.parseInt(url.port, 10)
    if (Number.isNaN(port) || port <= 0 || port > 65535) return null

    const params = url.searchParams
    const name = decodeURIComponent(url.hash.slice(1)) || `${server}:${port}`

    const proxy: Proxy = {
      type: 'vless',
      name,
      server,
      port,
      uuid,
    }

    // Flow
    const flow = params.get('flow')
    if (flow) proxy.flow = flow

    // Transport
    const type = params.get('type') || 'tcp'
    proxy.network = mapNetwork(type)

    // Security
    const security = params.get('security') || ''
    if (security === 'tls' || security === 'reality') {
      proxy.tls = true

      const sni = params.get('sni')
      if (sni) proxy.sni = sni

      const fp = params.get('fp')
      if (fp) proxy.fingerprint = fp

      const alpn = params.get('alpn')
      if (alpn) proxy.alpn = alpn.split(',').map(s => s.trim())

      // Reality-specific
      if (security === 'reality') {
        const pbk = params.get('pbk')
        const sid = params.get('sid')
        if (pbk || sid) {
          proxy.realityOpts = {}
          if (pbk) {
            proxy.publicKey = pbk
            proxy.realityOpts.publicKey = pbk
          }
          if (sid) {
            proxy.shortId = sid
            proxy.realityOpts.shortId = sid
          }
        }
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
      case 'http':
      case 'httpupgrade': {
        const path = params.get('path')
        if (path) proxy.httpPath = decodeURIComponent(path)
        const host = params.get('host')
        if (host) proxy.httpHost = host.split(',').map(s => s.trim())
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
