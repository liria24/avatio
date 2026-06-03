import { getOgImageEnv, getWaitUntil } from '@src/cloudflare'
import { issueAvatioImage } from '@src/worker'
import { defineEventHandler, getRequestURL, readBody } from 'h3'

export default defineEventHandler(async (event) => {
    return issueAvatioImage({
        body: await readBody(event).catch(() => null),
        origin: getRequestURL(event).origin,
        env: getOgImageEnv(event) ?? {},
        waitUntil: getWaitUntil(event),
    })
})
