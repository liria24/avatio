type NitroStorage = ReturnType<typeof useStorage>

export type OgImageStorage = Pick<NitroStorage, 'getItem' | 'getItemRaw' | 'setItem' | 'setItemRaw'>

export const getOgImageStorage = () => useStorage('og-image')
