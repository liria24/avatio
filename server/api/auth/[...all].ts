export default defineEventHandler(() => {
    return auth.handler(toWebRequest(useEvent()))
})
