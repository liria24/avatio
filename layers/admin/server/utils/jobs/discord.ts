export const sendAdminDiscordMessage = async (message: { content?: string; embeds?: object[] }) => {
    if (import.meta.dev || !getRuntimeStageConfig().features.discord) return
    const endpoint = getRuntimeEnvString('LIRIA_DISCORD_ENDPOINT')?.replace(/\/+$/, '')
    const token = getRuntimeEnvString('LIRIA_DISCORD_ACCESS_TOKEN')
    if (!endpoint || !token) return
    await $fetch('/admin/message', {
        baseURL: endpoint,
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: message,
    })
}
