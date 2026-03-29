import type { Proxy, TargetType } from '../types'
import type { ExternalGenerateOptions } from './types'
import { generateClash } from './clash'
import { generateLoon } from './loon'
import { generateQuanX } from './quanx'
import { generateSingBox } from './singbox'
import { generateSurge } from './surge'
import { generateMellow } from './mellow'
import { generateV2ray, proxyToUri } from './v2ray'

export type { ExternalGenerateOptions }

function safeBase64Encode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64')
}

function generateFilteredBase64(proxies: Proxy[], type: string): string {
  const filtered = proxies.filter(p => p.type === type)
  const lines = filtered
    .map(proxyToUri)
    .filter((line): line is string => line !== null)
  return safeBase64Encode(lines.join('\n'))
}

export function generateConfig(
  proxies: Proxy[],
  target: TargetType,
  options?: { ver?: number; list?: boolean; externalOptions?: ExternalGenerateOptions },
): string {
  const ext = options?.externalOptions

  switch (target) {
    case 'clash':
    case 'clashr':
      return generateClash(proxies, ext)

    case 'surge':
    case 'surfboard':
      return generateSurge(proxies, ext ? { ...ext, ver: options?.ver } : { ver: options?.ver })

    case 'quanx':
    case 'quan':
      return generateQuanX(proxies, ext)

    case 'loon':
      return generateLoon(proxies, ext)

    case 'singbox':
      return generateSingBox(proxies, ext)

    case 'mellow':
      return generateMellow(proxies, ext)

    case 'v2ray':
    case 'mixed':
      return generateV2ray(proxies)

    case 'ss':
      return generateFilteredBase64(proxies, 'ss')

    case 'ssr':
      return generateFilteredBase64(proxies, 'ssr')

    case 'sssub': {
      const ssProxies = proxies.filter(p => p.type === 'ss')
      const servers = ssProxies.map(p => ({
        id: p.name,
        remarks: p.name,
        server: p.server,
        server_port: p.port,
        method: p.method,
        password: p.password,
      }))
      return JSON.stringify(servers, null, 2)
    }

    default:
      return generateV2ray(proxies)
  }
}
