export default defineEventHandler(() => {
    const event = useEvent()
    return getAuth(event).handler(toWebRequest(event))
})
