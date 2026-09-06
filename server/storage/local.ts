import { Files } from 'files-sdk'
import { fs } from 'files-sdk/fs'

export const createLocalStorage = (root: string) =>
    new Files({
        adapter: fs({ root, urlBaseUrl: 'http://localhost:3000/api/_local/files' }),
    })
