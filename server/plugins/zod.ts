import { z } from 'zod'

export default defineNitroPlugin(() => {
    z.config({ jitless: true })
})
