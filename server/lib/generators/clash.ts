import yaml from 'js-yaml'
import type { Proxy } from '../types'
import type { ExternalGenerateOptions } from './types'

function mapProxyToClash(proxy: Proxy): Record<string, unknown> | null {
  const base: Record<string, unknown> = {
    name: proxy.name,
    server: proxy.server,
    port: proxy.port,
  }

  switch (proxy.type) {
    case 'ss': {
      Object.assign(base, {
        type: 'ss',
        cipher: proxy.method,
        password: proxy.password,
        udp: proxy.udp ?? true,
      })
      if (proxy.plugin) {
        base['plugin'] = proxy.plugin
        if (proxy.pluginOpts) base['plugin-opts'] = proxy.pluginOpts
      }
      return base
    }

    case 'ssr': {
      Object.assign(base, {
        type: 'ssr',
        cipher: proxy.method,
        password: proxy.password,
        protocol: proxy.protocol,
        'protocol-param': proxy.protocolParam,
        obfs: proxy.obfs,
        'obfs-param': proxy.obfsParam,
        udp: proxy.udp ?? true,
      })
      return base
    }

    case 'vmess': {
      Object.assign(base, {
        type: 'vmess',
        uuid: proxy.uuid,
        alterId: proxy.alterId ?? 0,
        cipher: proxy.security || 'auto',
        tls: proxy.tls ?? false,
        udp: proxy.udp ?? true,
      })
      if (proxy.sni) base['servername'] = proxy.sni
      if (proxy.network) base['network'] = proxy.network
      if (proxy.skipCertVerify != null) base['skip-cert-verify'] = proxy.skipCertVerify
      if (proxy.network === 'ws') {
        const wsOpts: Record<string, unknown> = {}
        if (proxy.wsPath) wsOpts['path'] = proxy.wsPath
        if (proxy.wsHeaders) wsOpts['headers'] = proxy.wsHeaders
        base['ws-opts'] = wsOpts
      }
      if (proxy.network === 'grpc' && proxy.grpcServiceName) {
        base['grpc-opts'] = { 'grpc-service-name': proxy.grpcServiceName }
      }
      if (proxy.network === 'h2') {
        const h2Opts: Record<string, unknown> = {}
        if (proxy.h2Host) h2Opts['host'] = proxy.h2Host
        if (proxy.h2Path) h2Opts['path'] = proxy.h2Path
        base['h2-opts'] = h2Opts
      }
      return base
    }

    case 'vless': {
      Object.assign(base, {
        type: 'vless',
        uuid: proxy.uuid,
        tls: proxy.tls ?? true,
        udp: proxy.udp ?? true,
      })
      if (proxy.flow) base['flow'] = proxy.flow
      if (proxy.sni) base['servername'] = proxy.sni
      if (proxy.network) base['network'] = proxy.network
      if (proxy.skipCertVerify != null) base['skip-cert-verify'] = proxy.skipCertVerify
      if (proxy.fingerprint) base['client-fingerprint'] = proxy.fingerprint
      if (proxy.network === 'ws') {
        const wsOpts: Record<string, unknown> = {}
        if (proxy.wsPath) wsOpts['path'] = proxy.wsPath
        if (proxy.wsHeaders) wsOpts['headers'] = proxy.wsHeaders
        base['ws-opts'] = wsOpts
      }
      if (proxy.network === 'grpc' && proxy.grpcServiceName) {
        base['grpc-opts'] = { 'grpc-service-name': proxy.grpcServiceName }
      }
      if (proxy.publicKey || proxy.realityOpts) {
        const realityOpts: Record<string, unknown> = {}
        const pk = proxy.realityOpts?.publicKey || proxy.publicKey
        const sid = proxy.realityOpts?.shortId || proxy.shortId
        if (pk) realityOpts['public-key'] = pk
        if (sid) realityOpts['short-id'] = sid
        base['reality-opts'] = realityOpts
      }
      return base
    }

    case 'trojan': {
      Object.assign(base, {
        type: 'trojan',
        password: proxy.password,
        udp: proxy.udp ?? true,
      })
      if (proxy.sni) base['sni'] = proxy.sni
      if (proxy.skipCertVerify != null) base['skip-cert-verify'] = proxy.skipCertVerify
      if (proxy.network) base['network'] = proxy.network
      if (proxy.network === 'ws') {
        const wsOpts: Record<string, unknown> = {}
        if (proxy.wsPath) wsOpts['path'] = proxy.wsPath
        if (proxy.wsHeaders) wsOpts['headers'] = proxy.wsHeaders
        base['ws-opts'] = wsOpts
      }
      return base
    }

    case 'hysteria2': {
      Object.assign(base, {
        type: 'hysteria2',
        password: proxy.password,
      })
      if (proxy.obfsType) base['obfs'] = proxy.obfsType
      if (proxy.obfsPassword) base['obfs-password'] = proxy.obfsPassword
      if (proxy.sni) base['sni'] = proxy.sni
      if (proxy.skipCertVerify != null) base['skip-cert-verify'] = proxy.skipCertVerify
      if (proxy.up) base['up'] = proxy.up
      if (proxy.down) base['down'] = proxy.down
      return base
    }

    case 'snell': {
      // Skip snell v4+ (not supported in Clash)
      if (proxy.snellVersion && proxy.snellVersion >= 4) return null
      Object.assign(base, {
        type: 'snell',
        psk: proxy.psk,
      })
      if (proxy.snellVersion) base['version'] = proxy.snellVersion
      if (proxy.obfsMode) {
        const obfsOpts: Record<string, unknown> = { mode: proxy.obfsMode }
        if (proxy.obfsHost) obfsOpts['host'] = proxy.obfsHost
        base['obfs-opts'] = obfsOpts
      }
      return base
    }

    case 'hysteria': {
      Object.assign(base, {
        type: 'hysteria',
      })
      if (proxy.hysteriaProtocol) base['protocol'] = proxy.hysteriaProtocol
      if (proxy.obfsType) base['obfs-protocol'] = proxy.obfsType
      if (proxy.up) base['up'] = proxy.up
      if (proxy.upSpeed) base['up-speed'] = proxy.upSpeed
      if (proxy.down) base['down'] = proxy.down
      if (proxy.downSpeed) base['down-speed'] = proxy.downSpeed
      if (proxy.authStr) base['auth-str'] = proxy.authStr
      if (proxy.obfsPassword) base['obfs'] = proxy.obfsPassword
      if (proxy.sni) base['sni'] = proxy.sni
      if (proxy.skipCertVerify != null) base['skip-cert-verify'] = proxy.skipCertVerify
      if (proxy.fingerprint) base['fingerprint'] = proxy.fingerprint
      if (proxy.alpn) base['alpn'] = proxy.alpn
      if (proxy.recvWindowConn) base['recv-window-conn'] = proxy.recvWindowConn
      if (proxy.recvWindow) base['recv-window'] = proxy.recvWindow
      if (proxy.hopInterval) base['hop-interval'] = proxy.hopInterval
      if (proxy.tfo != null) base['fast-open'] = proxy.tfo
      return base
    }

    case 'wireguard': {
      Object.assign(base, {
        type: 'wireguard',
        'private-key': proxy.privateKey,
        'public-key': proxy.peerPublicKey,
        ip: proxy.ip,
        udp: proxy.udp ?? true,
      })
      if (proxy.ipv6) base['ipv6'] = proxy.ipv6
      if (proxy.preSharedKey) base['preshared-key'] = proxy.preSharedKey
      if (proxy.dns) base['dns'] = proxy.dns
      if (proxy.mtu) base['mtu'] = proxy.mtu
      if (proxy.reserved) base['reserved'] = proxy.reserved
      return base
    }

    case 'http': {
      Object.assign(base, {
        type: 'http',
        tls: proxy.tls ?? false,
      })
      if (proxy.username) base['username'] = proxy.username
      if (proxy.password) base['password'] = proxy.password
      if (proxy.sni) base['sni'] = proxy.sni
      if (proxy.skipCertVerify != null) base['skip-cert-verify'] = proxy.skipCertVerify
      return base
    }

    case 'socks5': {
      Object.assign(base, {
        type: 'socks5',
      })
      if (proxy.username) base['username'] = proxy.username
      if (proxy.password) base['password'] = proxy.password
      if (proxy.tls) base['tls'] = true
      if (proxy.skipCertVerify != null) base['skip-cert-verify'] = proxy.skipCertVerify
      return base
    }

    default:
      return null
  }
}

export function generateClash(proxies: Proxy[], options?: ExternalGenerateOptions): string {
  const clashProxies = proxies
    .map(mapProxyToClash)
    .filter((p): p is Record<string, unknown> => p !== null)

  const proxyNames = clashProxies.map(p => p.name as string)

  // Use external config groups/rules if provided
  const hasExternal = options?.externalGroups && options.externalGroups.length > 0

  let proxyGroups: Record<string, unknown>[]
  let rules: string[]

  if (hasExternal) {
    proxyGroups = options!.externalGroups!.map((g) => {
      // Smart maps to url-test in Clash
      const clashType = g.type === 'smart' ? 'url-test' : g.type
      const group: Record<string, unknown> = {
        name: g.name,
        type: clashType,
        proxies: g.proxies,
      }
      if (clashType === 'url-test' || clashType === 'fallback' || clashType === 'load-balance') {
        group['url'] = g.url || 'http://www.gstatic.com/generate_204'
        group['interval'] = g.interval || 300
        if (g.tolerance) group['tolerance'] = g.tolerance
        if (g.lazy != null) group['lazy'] = g.lazy
      }
      else if (clashType !== 'relay' && clashType !== 'ssid') {
        if (g.url) group['url'] = g.url
        if (g.interval) group['interval'] = g.interval
      }
      if (g.disableUdp) group['disable-udp'] = true
      if (g.strategy) group['strategy'] = g.strategy
      if (g.timeout) group['timeout'] = g.timeout
      return group
    })
    // Filter out rule types not supported by Clash
    const unsupported = /^(USER-AGENT|URL-REGEX),/i
    rules = (options?.externalRules ?? ['GEOIP,CN,DIRECT', 'MATCH,PROXY'])
      .filter(r => !unsupported.test(r))
  }
  else {
    proxyGroups = [
      {
        name: 'PROXY',
        type: 'select',
        proxies: [...proxyNames, 'DIRECT', 'REJECT'],
      },
      {
        name: 'Auto',
        type: 'url-test',
        proxies: [...proxyNames],
        url: 'http://www.gstatic.com/generate_204',
        interval: 300,
      },
    ]
    rules = ['GEOIP,CN,DIRECT', 'MATCH,PROXY']
  }

  const config: Record<string, unknown> = {
    'port': 7890,
    'socks-port': 7891,
    'allow-lan': true,
    'mode': 'Rule',
    'log-level': 'info',
    'external-controller': '127.0.0.1:9090',
    'proxies': clashProxies,
    'proxy-groups': proxyGroups,
    'rules': rules,
  }

  return yaml.dump(config, { lineWidth: -1 })
}
