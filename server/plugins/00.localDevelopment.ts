import { getDatabaseBinding } from '../utils/database'

export default defineNitroPlugin(() => {
    // Nitro does not await plugin promises; throw synchronously if its proxy fell back to a stub.
    if (import.meta.dev) getDatabaseBinding()
})
