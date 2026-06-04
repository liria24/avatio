type NitroStorage = ReturnType<typeof useStorage>

export type OgImageStorage = Pick<
    NitroStorage,
    'getItem' | 'getItemRaw' | 'setItem' | 'setItemRaw' | 'hasItem' | 'getKeys' | 'removeItem'
>

export const getOgImageStorage = () => useStorage('og-image')
