import { initBotId } from 'botid/client/core'

export default defineNuxtPlugin({
    enforce: 'pre',
    setup() {
        initBotId({
            protect: [
                { path: '/api/setups', method: 'GET' },
                { path: '/api/setups', method: 'PUT' },
                { path: '/api/setups', method: 'POST' },
                { path: '/api/setups', method: 'DELETE' },
            ],
        })
    },
})
