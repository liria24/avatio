/** Native Preview identity is supplied by deployment configuration, never request headers. */
export const getPreviewKind = (stage?: string, name?: string): 'development' | 'pr' | undefined => {
    if (!name) return undefined
    if (stage !== 'development') throw new Error('Previews require the development stage.')
    if (name === 'development') return 'development'
    if (/^pr-[1-9]\d*$/.test(name)) return 'pr'
    throw new Error('Preview name must be development or pr-<positive number>.')
}

/** Separate authored-content entries in a shared Preview KV; retain existing production keys. */
export const getPreviewCachePrefix = (base: string, stage?: string, name?: string) =>
    getPreviewKind(stage, name) ? `${base}:preview:${name}` : base
