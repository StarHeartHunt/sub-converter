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
      const group: Record<string, unknown> = {
        name: g.name,
        type: g.type,
        proxies: g.proxies,
      }
      if (g.type === 'url-test' || g.type === 'fallback') {
        group['url'] = g.url || 'http://www.gstatic.com/generate_204'
        group['interval'] = g.interval || 300
      }
      else {
        if (g.url) group['url'] = g.url
        if (g.interval) group['interval'] = g.interval
      }
      if (g.tolerance) group['tolerance'] = g.tolerance
      return group
    })
    rules = options?.externalRules ?? ['GEOIP,CN,DIRECT', 'MATCH,PROXY']
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
