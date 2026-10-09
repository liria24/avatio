import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import type { SendEmailInput } from './email'

export const saveLocalEmail = async (message: SendEmailInput) => {
    const messageId = randomUUID()
    const directory = join(process.cwd(), '.data', 'mail')
    await mkdir(directory, { recursive: true })
    await writeFile(
        join(directory, `${messageId}.json`),
        JSON.stringify(
            {
                ...message,
                attachments: message.attachments?.map(({ content, ...attachment }) => ({
                    ...attachment,
                    size:
                        typeof content === 'string'
                            ? Buffer.byteLength(content)
                            : content.byteLength,
                })),
            },
            null,
            2,
        ),
        { encoding: 'utf8', mode: 0o600 },
    )
    return { messageId }
}
