import { auth } from '@@/better-auth'

export default defineEventHandler(() => {
    return auth.handler(toWebRequest(useEvent()))
})
