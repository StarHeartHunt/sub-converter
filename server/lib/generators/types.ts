import type { ResolvedProxyGroup } from '../config'

/** Shared options for generators that support external config (groups + rules) */
export interface ExternalGenerateOptions {
  externalGroups?: ResolvedProxyGroup[]
  externalRules?: string[]
}
