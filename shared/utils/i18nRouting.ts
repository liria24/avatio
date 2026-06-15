export const defaultI18nLocale = 'ja'
export const prefixedI18nLocales = ['en'] as const
export const i18nRoutingStrategy = 'prefix_except_default'

export type PrefixedI18nLocale = (typeof prefixedI18nLocales)[number]
