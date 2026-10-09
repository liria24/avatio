/** Native development identity comes from configuration, never request headers. */
export const getPreviewKind = (stage?: string, name?: string): 'development' | undefined => {
    if (!name) return undefined
    if (stage !== 'development') throw new Error('Previews require the development stage.')
    if (name !== 'development') throw new Error('Preview name must be development.')
    return 'development'
}

/** Keep development authored-content keys separate from the retained production keys. */
export const getPreviewCachePrefix = (base: string, stage?: string, name?: string) =>
    getPreviewKind(stage, name) ? `${base}:preview:development` : base
