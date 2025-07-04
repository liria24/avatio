import { consola } from 'consola'

export default defineNuxtPlugin(async (_nuxtApp) => {
    if (import.meta.dev) {
        try {
            const axeCore = await import('axe-core')
            const results = await axeCore.default.run()
            if (results.violations.length === 0) {
                consola.success(
                    'Congratulations! No accessibility issues found🎉'
                )
            } else {
                consola.warn('a11y issues:', results.violations)
            }
        } catch (error) {
            consola.error('error running axe-core:', error)
        }
    }
})
