import { revoke } from '@liria24/og-image'

export default adminSessionEventHandler(async () => {
    return await revoke({ preset: 'avatio' })
})
