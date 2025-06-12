export default defineEventHandler(async () => {
    return $fetch('/api/admin/report', {
        method: 'POST',
        headers: {
            authorization: `Bearer ${useRuntimeConfig().adminKey}`,
        },
    })
})
