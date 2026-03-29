/** Unified proxy node representation — all parsers normalize to this struct */
export interface Proxy {
  type: ProxyType
  name: string
  server: string
  port: number

  // Auth
  username?: string // HTTP, SOCKS5
  password?: string
  uuid?: string
  method?: string // encryption method

  // SSR specific
  protocol?: string
  protocolParam?: string
  obfs?: string
  obfsParam?: string

  // VMess / VLESS
  alterId?: number
  security?: string // auto, aes-128-gcm, chacha20-poly1305, none
  flow?: string // VLESS flow control (xtls-rprx-vision etc.)

  // Transport
  network?: 'tcp' | 'ws' | 'grpc' | 'h2' | 'http' | 'quic' | 'httpupgrade'
  wsPath?: string
  wsHeaders?: Record<string, string>
  grpcServiceName?: string
  h2Path?: string
  h2Host?: string[]
  httpPath?: string
  httpHost?: string[]

  // TLS
  tls?: boolean
  sni?: string
  skipCertVerify?: boolean
  alpn?: string[]
  fingerprint?: string
  publicKey?: string // reality
  shortId?: string // reality
  realityOpts?: { publicKey?: string; shortId?: string }

  // Snell
  psk?: string
  snellVersion?: number
  obfsMode?: string // http, tls
  obfsHost?: string

  // Hysteria v1 / v2
  obfsType?: string // salamander
  obfsPassword?: string
  up?: string
  down?: string
  upSpeed?: number
  downSpeed?: number
  authStr?: string
  hysteriaProtocol?: string
  recvWindowConn?: number
  recvWindow?: number
  hopInterval?: number

  // WireGuard
  privateKey?: string
  peerPublicKey?: string
  preSharedKey?: string
  ip?: string
  ipv6?: string
  mtu?: number
  reserved?: number[]
  dns?: string[]

  // Flags
  udp?: boolean
  tfo?: boolean // TCP Fast Open
  plugin?: string
  pluginOpts?: Record<string, string> | string
}

export type ProxyType =
  | 'ss'
  | 'ssr'
  | 'vmess'
  | 'vless'
  | 'trojan'
  | 'hysteria'
  | 'hysteria2'
  | 'snell'
  | 'wireguard'
  | 'http'
  | 'socks5'

export type TargetType =
  | 'clash'
  | 'clashr'
  | 'surge'
  | 'quanx'
  | 'quan'
  | 'loon'
  | 'surfboard'
  | 'singbox'
  | 'mellow'
  | 'v2ray'
  | 'ss'
  | 'ssr'
  | 'sssub'
  | 'mixed'

export interface SubConfig {
  target: TargetType
  url: string // pipe-separated URLs
  config?: string // remote config URL
  emoji?: boolean
  addEmoji?: boolean // independent add emoji control
  removeEmoji?: boolean // independent remove emoji control
  list?: boolean
  include?: string // regex
  exclude?: string // regex
  rename?: string // pattern@replacement
  sort?: boolean
  udp?: boolean
  tfo?: boolean
  scv?: boolean // skip cert verify
  appendType?: boolean
  filename?: string
  ver?: number // surge version
  filterScript?: string // JS filter expression
  sortScript?: string // JS sort expression
  managedConfig?: boolean // whether to output #!MANAGED-CONFIG header
  interval?: number // managed config update interval
  strict?: boolean // managed config strict mode
}
