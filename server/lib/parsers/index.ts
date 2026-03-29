import type { Proxy } from '../types'
import { parseClash } from './clash'
import { parseHysteria2 } from './hysteria2'
import { parseSS } from './ss'
import { parseSSR } from './ssr'
import { parseTrojan } from './trojan'
import { parseVLess } from './vless'
import { parseVMess } from './vmess'

/**
 * Parse subscription content (Base64, Clash YAML, or plain URI list) into Proxy objects.
 *
 * Detection order:
 * 1. Clash YAML — if content starts with "proxies:" or contains "proxy-groups:"
 * 2. Base64 — try decoding the whole content as base64, then parse lines
 * 3. Plain text — split by newlines and parse each line as a URI
 */
export function parseSubscription(content: string): Proxy[] {
  if (!content || typeof content !== 'string') return []

  content = content.trim()
  if (!content) return []

  // 1. Detect Clash YAML
  if (isClashYaml(content)) {
    return parseClash(content)
  }

  // 2. Try Base64 decode
  if (looksLikeBase64(content)) {
    try {
      const decoded = safeBase64Decode(content)
      // If decoded content contains known protocol schemes, treat it as decoded URI list
      if (hasKnownScheme(decoded)) {
        return parseLines(decoded)
      }
    }
    catch {
      // Not valid base64, fall through
    }
  }

  // 3. Parse as plain text lines
  return parseLines(content)
}

/**
 * Parse a single proxy URI line. Returns null if unrecognized or unparseable.
 */
export function parseLine(line: string): Proxy | null {
  line = line.trim()
  if (!line) return null

  if (line.startsWith('ss://') && !line.startsWith('ssr://')) return parseSS(line)
  if (line.startsWith('ssr://')) return parseSSR(line)
  if (line.startsWith('vmess://')) return parseVMess(line)
  if (line.startsWith('vless://')) return parseVLess(line)
  if (line.startsWith('trojan://')) return parseTrojan(line)
  if (line.startsWith('hysteria2://') || line.startsWith('hy2://')) return parseHysteria2(line)

  return null
}

/** Split text into lines and parse each one, skipping failures. */
function parseLines(text: string): Proxy[] {
  const lines = text.split(/\r?\n/)
  const proxies: Proxy[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const proxy = parseLine(trimmed)
    if (proxy) proxies.push(proxy)
  }

  return proxies
}

/** Detect Clash YAML format */
function isClashYaml(content: string): boolean {
  const firstLine = content.slice(0, 200)
  return /^proxies\s*:/m.test(firstLine) || content.includes('proxy-groups:')
}

/**
 * Heuristic: content looks like base64 if it's a single block with no spaces
 * and only valid base64 characters.
 */
function looksLikeBase64(content: string): boolean {
  // If it already contains known URI schemes, it's not base64-encoded
  if (hasKnownScheme(content)) return false

  // Skip if it looks like HTML
  if (content.startsWith('<') || content.startsWith('{')) return false

  // Must have minimum length and only valid base64 characters
  if (content.length < 10) return false
  return /^[A-Za-z0-9+/=_\-\s]+$/.test(content)
}

function hasKnownScheme(text: string): boolean {
  return /^(ss|ssr|vmess|vless|trojan|hysteria2|hy2):\/\//m.test(text)
}

function safeBase64Decode(str: string): string {
  let s = str.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4
  if (pad === 2) s += '=='
  else if (pad === 3) s += '='
  return Buffer.from(s, 'base64').toString('utf-8')
}
