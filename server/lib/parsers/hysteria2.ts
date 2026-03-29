import type { Proxy } from '../types'

/**
 * Parse a hysteria2:// or hy2:// URI into a Proxy object.
 *
 * Format: hysteria2://password@server:port?sni=xxx&obfs=salamander&obfs-password=xxx#name
 */
export function parseHysteria2(uri: string): Proxy | null {
  try {
    uri = uri.trim()

    let body: string
    if (uri.startsWith('hysteria2://')) {
      body = uri.slice(12)
    }
    else if (uri.startsWith('hy2://')) {
      body = uri.slice(6)
    }
    else {
      return null
    }

    // Use URL parser with http:// prefix
    const url = new URL(`http://${body}`)

    const password = decodeURIComponent(url.username)
    if (!password) return null

    const server = url.hostname.replace(/^\[|\]$/g, '')
    const port = Number.parseInt(url.port || '443', 10)
    if (Number.isNaN(port) || port <= 0 || port > 65535) return null

    const params = url.searchParams
    const name = decodeURIComponent(url.hash.slice(1)) || `${server}:${port}`

    const proxy: Proxy = {
      type: 'hysteria2',
      name,
      server,
      port,
      password,
    }

    // TLS (hysteria2 defaults to TLS)
    proxy.tls = true

    const sni = params.get('sni')
    if (sni) proxy.sni = sni

    const insecure = params.get('insecure')
    if (insecure === '1' || insecure === 'true') {
      proxy.skipCertVerify = true
    }

    const alpn = params.get('alpn')
    if (alpn) proxy.alpn = alpn.split(',').map(s => s.trim())

    const fp = params.get('fp')
    if (fp) proxy.fingerprint = fp

    // Obfuscation
    const obfs = params.get('obfs')
    if (obfs) {
      proxy.obfsType = obfs
      const obfsPassword = params.get('obfs-password')
      if (obfsPassword) proxy.obfsPassword = obfsPassword
    }

    // Bandwidth hints
    const up = params.get('up')
    if (up) proxy.up = up
    const down = params.get('down')
    if (down) proxy.down = down

    return proxy
  }
  catch {
    return null
  }
}
