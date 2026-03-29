import type { Proxy } from '../types'

function safeBase64Encode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64')
}

function urlSafeBase64Encode(str: string): string {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function buildQueryString(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (pair): pair is [string, string] => pair[1] != null && pair[1] !== '',
  )
  if (entries.length === 0) return ''
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
}

function proxyToUri(proxy: Proxy): string | null {
  switch (proxy.type) {
    case 'vmess': {
      const vmessObj: Record<string, unknown> = {
        v: '2',
        ps: proxy.name,
        add: proxy.server,
        port: proxy.port,
        id: proxy.uuid,
        aid: proxy.alterId ?? 0,
        scy: proxy.security || 'auto',
        net: proxy.network || 'tcp',
        type: 'none',
        host: proxy.wsHeaders?.Host || proxy.h2Host?.[0] || proxy.httpHost?.[0] || '',
        path: proxy.wsPath || proxy.h2Path || proxy.httpPath || '',
        tls: proxy.tls ? 'tls' : '',
        sni: proxy.sni || '',
        alpn: proxy.alpn?.join(',') || '',
        fp: proxy.fingerprint || '',
      }
      return `vmess://${safeBase64Encode(JSON.stringify(vmessObj))}`
    }

    case 'vless': {
      const params: Record<string, string | undefined> = {
        type: proxy.network || 'tcp',
        security: proxy.tls ? (proxy.publicKey || proxy.realityOpts ? 'reality' : 'tls') : 'none',
        sni: proxy.sni,
        flow: proxy.flow,
        fp: proxy.fingerprint,
        pbk: proxy.realityOpts?.publicKey || proxy.publicKey,
        sid: proxy.realityOpts?.shortId || proxy.shortId,
        alpn: proxy.alpn?.join(','),
      }
      if (proxy.network === 'ws') {
        params.path = proxy.wsPath
        params.host = proxy.wsHeaders?.Host
      }
      if (proxy.network === 'grpc') {
        params.serviceName = proxy.grpcServiceName
      }
      const qs = buildQueryString(params)
      const name = encodeURIComponent(proxy.name)
      return `vless://${proxy.uuid}@${proxy.server}:${proxy.port}${qs}#${name}`
    }

    case 'ss': {
      const userinfo = safeBase64Encode(`${proxy.method}:${proxy.password}`)
      const name = encodeURIComponent(proxy.name)
      let uri = `ss://${userinfo}@${proxy.server}:${proxy.port}#${name}`
      if (proxy.plugin) {
        const pluginStr = typeof proxy.pluginOpts === 'string'
          ? `${proxy.plugin};${proxy.pluginOpts}`
          : proxy.plugin
        uri = `ss://${userinfo}@${proxy.server}:${proxy.port}?plugin=${encodeURIComponent(pluginStr)}#${name}`
      }
      return uri
    }

    case 'ssr': {
      const passwordB64 = urlSafeBase64Encode(proxy.password || '')
      const remarksB64 = urlSafeBase64Encode(proxy.name)
      const groupB64 = urlSafeBase64Encode('SubConverter')
      const mainPart = `${proxy.server}:${proxy.port}:${proxy.protocol}:${proxy.method}:${proxy.obfs}:${passwordB64}`
      const params = `/?remarks=${remarksB64}&group=${groupB64}`
      if (proxy.obfsParam) {
        const obfsParamB64 = urlSafeBase64Encode(proxy.obfsParam)
        return `ssr://${urlSafeBase64Encode(`${mainPart}${params}&obfsparam=${obfsParamB64}`)}`
      }
      if (proxy.protocolParam) {
        const protoParamB64 = urlSafeBase64Encode(proxy.protocolParam)
        return `ssr://${urlSafeBase64Encode(`${mainPart}${params}&protoparam=${protoParamB64}`)}`
      }
      return `ssr://${urlSafeBase64Encode(`${mainPart}${params}`)}`
    }

    case 'trojan': {
      const params: Record<string, string | undefined> = {
        sni: proxy.sni,
        type: proxy.network || 'tcp',
        allowInsecure: proxy.skipCertVerify ? '1' : undefined,
      }
      if (proxy.network === 'ws') {
        params.path = proxy.wsPath
        params.host = proxy.wsHeaders?.Host
      }
      const qs = buildQueryString(params)
      const name = encodeURIComponent(proxy.name)
      return `trojan://${encodeURIComponent(proxy.password || '')}@${proxy.server}:${proxy.port}${qs}#${name}`
    }

    case 'hysteria2': {
      const params: Record<string, string | undefined> = {
        sni: proxy.sni,
        obfs: proxy.obfsType,
        'obfs-password': proxy.obfsPassword,
        insecure: proxy.skipCertVerify ? '1' : undefined,
      }
      const qs = buildQueryString(params)
      const name = encodeURIComponent(proxy.name)
      return `hysteria2://${encodeURIComponent(proxy.password || '')}@${proxy.server}:${proxy.port}${qs}#${name}`
    }

    default:
      return null
  }
}

export { proxyToUri }

export function generateV2ray(proxies: Proxy[]): string {
  const lines = proxies
    .map(proxyToUri)
    .filter((line): line is string => line !== null)

  return safeBase64Encode(lines.join('\n'))
}
