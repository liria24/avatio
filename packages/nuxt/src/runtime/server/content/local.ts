import fs from 'comark-content/sources/fs'

import { createAvatioContentService } from './service'

export const createLocalContentService = (
    directory: string,
    locales: readonly string[],
    fallbackLocale: string,
) =>
    createAvatioContentService({
        source: fs(directory),
        sourceMetadata: (key) => ({ path: `content/${key}` }),
        locales,
        fallbackLocale,
        cache: false,
    })
