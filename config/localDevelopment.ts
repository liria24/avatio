import { randomBytes } from 'node:crypto'
import { linkSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const getLocalAuthSecret = (rootDirectory = process.cwd()) => {
    const dataDirectory = join(rootDirectory, '.data')
    const secretPath = join(dataDirectory, 'local-auth-secret')
    mkdirSync(dataDirectory, { recursive: true })

    let secret: string
    try {
        secret = readFileSync(secretPath, 'utf8').trim()
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        secret = randomBytes(32).toString('hex')
        const temporaryPath = `${secretPath}.${process.pid}.${randomBytes(8).toString('hex')}`
        writeFileSync(temporaryPath, secret, { encoding: 'utf8', mode: 0o600 })
        try {
            try {
                linkSync(temporaryPath, secretPath)
            } catch (writeError) {
                if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') throw writeError
                secret = readFileSync(secretPath, 'utf8').trim()
            }
        } finally {
            unlinkSync(temporaryPath)
        }
    }
    if (secret.length < 32) throw new Error('The local Better Auth secret is invalid.')
    return secret
}
