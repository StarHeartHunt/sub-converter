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

/**
 * Apply emoji flags to proxy names based on subconverter's emoji rules.
 * First removes any existing flag emojis, then prepends the matched emoji.
 */
export function applyEmoji(proxies: Proxy[]): void {
  const rules = loadEmojiRules()
  if (rules.length === 0) return

  // Unicode range for regional indicator symbols (flag emojis) and some other emoji
  const flagRegex = /[\u{1F1E0}-\u{1F1FF}]{2}|[\u{1F3F4}\u{E0067}-\u{E007F}]+|🏳️‍🌈|🏳️‍⚧️/gu

  for (const proxy of proxies) {
    // Find matching emoji
    let matchedEmoji: string | null = null
    for (const rule of rules) {
      if (rule.pattern.test(proxy.name)) {
        matchedEmoji = rule.emoji
        break
      }
    }

    if (matchedEmoji) {
      // Remove existing flag emojis from name
      const cleanName = proxy.name.replace(flagRegex, '').trim()
      proxy.name = `${matchedEmoji} ${cleanName}`
    }
  }
}
