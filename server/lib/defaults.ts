/**
 * Built-in default proxy groups and rulesets.
 * Equivalent to subconverter's snippets/groups.toml + snippets/rulesets.toml,
 * used when no external config (`config` param) is provided.
 */
import type { ProxyGroupTemplate, RulesetEntry } from './config'

/** Default proxy groups — from snippets/groups.toml */
export const DEFAULT_PROXY_GROUPS: ProxyGroupTemplate[] = [
  {
    name: '🔰 节点选择',
    type: 'select',
    members: ['[]♻️ 自动选择', '[]🎯 全球直连', '.*'],
  },
  {
    name: '♻️ 自动选择',
    type: 'url-test',
    members: ['.*'],
    testUrl: 'http://www.gstatic.com/generate_204',
    interval: 300,
  },
  {
    name: '🎥 NETFLIX',
    type: 'select',
    members: ['[]🔰 节点选择', '[]♻️ 自动选择', '[]🎯 全球直连', '.*'],
  },
  {
    name: '⛔️ 广告拦截',
    type: 'select',
    members: ['[]🛑 全球拦截', '[]🎯 全球直连', '[]🔰 节点选择'],
  },
  {
    name: '🚫 运营劫持',
    type: 'select',
    members: ['[]🛑 全球拦截', '[]🎯 全球直连', '[]🔰 节点选择'],
  },
  {
    name: '🌍 国外媒体',
    type: 'select',
    members: ['[]🔰 节点选择', '[]♻️ 自动选择', '[]🎯 全球直连', '.*'],
  },
  {
    name: '🌏 国内媒体',
    type: 'select',
    members: ['[]🎯 全球直连', '(HGC|HKBN|PCCW|HKT|深台|彰化|新北|台|hk|港|tw)', '[]🔰 节点选择'],
  },
  {
    name: 'Ⓜ️ 微软服务',
    type: 'select',
    members: ['[]🎯 全球直连', '[]🔰 节点选择', '.*'],
  },
  {
    name: '📲 电报信息',
    type: 'select',
    members: ['[]🔰 节点选择', '[]🎯 全球直连', '.*'],
  },
  {
    name: '🍎 苹果服务',
    type: 'select',
    members: ['[]🔰 节点选择', '[]🎯 全球直连', '[]♻️ 自动选择', '.*'],
  },
  {
    name: '🎯 全球直连',
    type: 'select',
    members: ['[]DIRECT'],
  },
  {
    name: '🛑 全球拦截',
    type: 'select',
    members: ['[]REJECT', '[]DIRECT'],
  },
  {
    name: '🐟 漏网之鱼',
    type: 'select',
    members: ['[]🔰 节点选择', '[]🎯 全球直连', '[]♻️ 自动选择', '.*'],
  },
]

/** Default rulesets — from snippets/rulesets.toml */
export const DEFAULT_RULESETS: RulesetEntry[] = [
  { group: '🎯 全球直连', url: 'rules/LocalAreaNetwork.list' },
  { group: 'Ⓜ️ 微软服务', url: 'rules/MSServices.list' },
  { group: '🎯 全球直连', url: 'rules/DivineEngine/Surge/Ruleset/Unbreak.list' },
  { group: '🛑 全球拦截', url: 'rules/NobyDa/Surge/AdRule.list' },
  { group: '🛑 全球拦截', url: 'rules/DivineEngine/Surge/Ruleset/Guard/Hijacking.list' },
  { group: '🎥 NETFLIX', url: 'rules/DivineEngine/Surge/Ruleset/StreamingMedia/Video/Netflix.list' },
  { group: '🌍 国外媒体', url: 'rules/DivineEngine/Surge/Ruleset/StreamingMedia/Streaming.list' },
  { group: '🌏 国内媒体', url: 'rules/lhie1/Surge/Surge 3/Provider/Media/Bilibili.list' },
  { group: '🌏 国内媒体', url: 'rules/lhie1/Surge/Surge 3/Provider/Media/iQiyi.list' },
  { group: '🌏 国内媒体', url: 'rules/lhie1/Surge/Surge 3/Provider/Media/Letv.list' },
  { group: '🌏 国内媒体', url: 'rules/lhie1/Surge/Surge 3/Provider/Media/MOO.list' },
  { group: '🌏 国内媒体', url: 'rules/lhie1/Surge/Surge 3/Provider/Media/Tencent Video.list' },
  { group: '🌏 国内媒体', url: 'rules/lhie1/Surge/Surge 3/Provider/Media/Youku.list' },
  { group: '📲 电报信息', url: 'rules/DivineEngine/Surge/Ruleset/Extra/Telegram/Telegram.list' },
  { group: '🔰 节点选择', url: 'rules/DivineEngine/Surge/Ruleset/Global.list' },
  { group: '🍎 苹果服务', url: 'rules/DivineEngine/Surge/Ruleset/Extra/Apple/Apple.list' },
  { group: '🎯 全球直连', url: 'rules/DivineEngine/Surge/Ruleset/China.list' },
  { group: '🎯 全球直连', url: 'rules/NobyDa/Surge/Download.list' },
  { group: '🎯 全球直连', url: '[]GEOIP,CN' },
  { group: '🐟 漏网之鱼', url: '[]FINAL' },
]
