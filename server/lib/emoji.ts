import { join } from 'pathe'
import { readFileSync } from 'node:fs'
import type { Proxy } from './types'

interface EmojiRule {
  pattern: RegExp
  emoji: string
}

let emojiRules: EmojiRule[] | null = null

function loadEmojiRules(): EmojiRule[] {
  if (emojiRules) return emojiRules

  const filePath = join(process.cwd(), 'server/lib/rules/snippets/emoji.txt')
  try {
    const content = readFileSync(filePath, 'utf-8')
    emojiRules = []
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue

      const lastComma = trimmed.lastIndexOf(',')
      if (lastComma <= 0) continue

      const pattern = trimmed.slice(0, lastComma)
      const emoji = trimmed.slice(lastComma + 1)
      try {
        emojiRules.push({ pattern: new RegExp(pattern), emoji })
      }
      catch {
        // skip invalid regex
      }
    }
    return emojiRules
  }
  catch {
    emojiRules = []
    return emojiRules
  }
}

// Unicode range for regional indicator symbols (flag emojis) and some other emoji
const flagRegex = /[\u{1F1E0}-\u{1F1FF}]{2}|[\u{1F3F4}\u{E0067}-\u{E007F}]+|🏳️‍🌈|🏳️‍⚧️/gu

/**
 * Apply emoji flags to proxy names based on subconverter's emoji rules.
 * @param addEmoji - whether to prepend matched emoji (default: true)
 * @param removeEmoji - whether to remove existing flag emojis first (default: true)
 */
export function applyEmoji(proxies: Proxy[], addEmoji = true, removeEmoji = true): void {
  const rules = addEmoji ? loadEmojiRules() : []

  for (const proxy of proxies) {
    // Remove existing flag emojis if requested
    if (removeEmoji) {
      proxy.name = proxy.name.replace(flagRegex, '').trim()
    }

    // Add matched emoji if requested
    if (addEmoji && rules.length > 0) {
      for (const rule of rules) {
        if (rule.pattern.test(proxy.name)) {
          proxy.name = `${rule.emoji} ${proxy.name}`
          break
        }
      }
    }
  }
}
