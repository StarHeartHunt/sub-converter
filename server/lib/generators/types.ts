/** Shared options for generators that support external config (groups + rules) */
export interface ExternalGenerateOptions {
  externalGroups?: Array<{
    name: string
    type: string
    proxies: string[]
    url?: string
    interval?: number
    tolerance?: number
  }>
  externalRules?: string[]
}
