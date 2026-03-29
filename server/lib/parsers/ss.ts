import type { Proxy } from '../types'

/**
 * Decode a base64 or base64url string to UTF-8.
 * Handles padding normalization and base64url (- -> +, _ -> /).
 */
function safeBase64Decode(str: string): string {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  // Fix missing padding
  const pad = s.length % 4
  if (pad === 2) s += '=='
  else if (pad === 3) s += '='
  return Buffer.from(s, 'base64').toString('utf-8')
}

/**
 * Parse an ss:// Shadowsocks URI into a Proxy object.
 *
 * Supported formats:
 *  - Legacy:  ss://BASE64(method:password)@server:port#name
 *  - SIP002:  ss://BASE64(method:password)@server:port/?plugin=...#name
 *  - Full b64: ss://BASE64(method:password@server:port)#name
 */
export function parseSS(uri: string): Proxy | null {
  try {
    uri = uri.trim()
    if (!uri.startsWith('ss://')) return null

    let body = uri.slice(5) // remove ss://

    // Extract fragment (name)
    let name = ''
    const hashIdx = body.indexOf('#')
    if (hashIdx !== -1) {
      name = decodeURIComponent(body.slice(hashIdx + 1))
      body = body.slice(0, hashIdx)
    }

    let method: string
    let password: string
    let server: string
    let port: number
    let plugin: string | undefined
    let pluginOpts: string | undefined

    // Extract query string (for SIP002 plugin params)
    let query = ''
    const questionIdx = body.indexOf('?')
    if (questionIdx !== -1) {
      query = body.slice(questionIdx + 1)
      body = body.slice(0, questionIdx)
    }

    const atIdx = body.indexOf('@')

    if (atIdx !== -1) {
      // Format: BASE64(method:password)@server:port
      // or:     method:password@server:port (already decoded)
      const userinfo = body.slice(0, atIdx)
      const hostPort = body.slice(atIdx + 1)

      // Try base64 decode first
      let decoded: string
      try {
        decoded = safeBase64Decode(userinfo)
        // Validate it looks like method:password
        if (!decoded.includes(':')) {
          decoded = userinfo // not base64, use as-is
        }
      }
      catch {
        decoded = userinfo
      }

      const colonIdx = decoded.indexOf(':')
      if (colonIdx === -1) return null

      method = decoded.slice(0, colonIdx)
      password = decoded.slice(colonIdx + 1)

      // Parse server:port — handle IPv6 [::1]:port
      const parsed = parseHostPort(hostPort)
      if (!parsed) return null
      server = parsed.server
      port = parsed.port
    }
    else {
      // Entire body is base64: BASE64(method:password@server:port)
      const decoded = safeBase64Decode(body)
      const decodedAtIdx = decoded.lastIndexOf('@')
      if (decodedAtIdx === -1) return null

      const userinfo = decoded.slice(0, decodedAtIdx)
      const hostPort = decoded.slice(decodedAtIdx + 1)

      const colonIdx = userinfo.indexOf(':')
      if (colonIdx === -1) return null

      method = userinfo.slice(0, colonIdx)
      password = userinfo.slice(colonIdx + 1)

      const parsed = parseHostPort(hostPort)
      if (!parsed) return null
      server = parsed.server
      port = parsed.port
    }

    // Parse query for plugin
    if (query) {
      const params = new URLSearchParams(query)
      const pluginStr = params.get('plugin')
      if (pluginStr) {
        const semiIdx = pluginStr.indexOf(';')
        if (semiIdx !== -1) {
          plugin = pluginStr.slice(0, semiIdx)
          pluginOpts = pluginStr.slice(semiIdx + 1)
        }
        else {
          plugin = pluginStr
        }
      }
    }

    const proxy: Proxy = {
      type: 'ss',
      name: name || `${server}:${port}`,
      server,
      port,
      method,
      password,
    }

    if (plugin) proxy.plugin = plugin
    if (pluginOpts) proxy.pluginOpts = pluginOpts

    return proxy
  }
  catch {
    return null
  }
}

function parseHostPort(str: string): { server: string; port: number } | null {
  let server: string
  let portStr: string

  if (str.startsWith('[')) {
    // IPv6: [::1]:port
    const bracketEnd = str.indexOf(']')
    if (bracketEnd === -1) return null
    server = str.slice(1, bracketEnd)
    portStr = str.slice(bracketEnd + 2) // skip ]:
  }
  else {
    const lastColon = str.lastIndexOf(':')
    if (lastColon === -1) return null
    server = str.slice(0, lastColon)
    portStr = str.slice(lastColon + 1)
  }

  const port = Number.parseInt(portStr, 10)
  if (Number.isNaN(port) || port <= 0 || port > 65535) return null

  return { server, port }
}
