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

/**
 * Parse an ssr:// ShadowsocksR URI into a Proxy object.
 *
 * Format: ssr://BASE64(server:port:protocol:method:obfs:base64pass/?params)
 * Params: obfsparam, protoparam, remarks, group (all base64-encoded)
 */
export function parseSSR(uri: string): Proxy | null {
  try {
    uri = uri.trim()
    if (!uri.startsWith('ssr://')) return null

    const encoded = uri.slice(6)
    const decoded = safeBase64Decode(encoded)

    // Split main part and query params
    const questionIdx = decoded.indexOf('/?')
    let mainPart: string
    let queryStr = ''

    if (questionIdx !== -1) {
      mainPart = decoded.slice(0, questionIdx)
      queryStr = decoded.slice(questionIdx + 2)
    }
    else {
      mainPart = decoded
    }

    // Parse: server:port:protocol:method:obfs:base64pass
    // Server can be IPv6 so we need to be careful.
    // The format guarantees 5 colons for the 6 fields, reading from the right.
    const parts = mainPart.split(':')
    if (parts.length < 6) return null

    // Read from right: base64pass, obfs, method, protocol, port
    // Everything left is the server (could contain colons for IPv6)
    const base64Pass = parts.pop()!
    const obfs = parts.pop()!
    const method = parts.pop()!
    const protocol = parts.pop()!
    const portStr = parts.pop()!
    const server = parts.join(':')

    const port = Number.parseInt(portStr, 10)
    if (Number.isNaN(port) || port <= 0 || port > 65535) return null

    const password = safeBase64Decode(base64Pass)

    // Parse query parameters
    let obfsParam = ''
    let protocolParam = ''
    let name = ''

    if (queryStr) {
      const params = new URLSearchParams(queryStr)
      const obfsparamB64 = params.get('obfsparam')
      const protoparamB64 = params.get('protoparam')
      const remarksB64 = params.get('remarks')

      if (obfsparamB64) obfsParam = safeBase64Decode(obfsparamB64)
      if (protoparamB64) protocolParam = safeBase64Decode(protoparamB64)
      if (remarksB64) name = safeBase64Decode(remarksB64)
    }

    const proxy: Proxy = {
      type: 'ssr',
      name: name || `${server}:${port}`,
      server,
      port,
      method,
      password,
      protocol,
      obfs,
    }

    if (protocolParam) proxy.protocolParam = protocolParam
    if (obfsParam) proxy.obfsParam = obfsParam

    return proxy
  }
  catch {
    return null
  }
}
