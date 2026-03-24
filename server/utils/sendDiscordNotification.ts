import { joinURL } from 'ufo'

interface DiscordField {
    name: string
    value: string
    inline?: boolean
}

interface DiscordAuthor {
    name: string
    url?: string
    icon_url?: string
}

interface DiscordFooter {
    text: string
}

export interface DiscordEmbed {
    title?: string
    description?: string
    color?: number
    timestamp?: string
    fields?: DiscordField[]
    author?: DiscordAuthor
    footer?: DiscordFooter
}

interface CheckOptions {
    endpoint?: string
    accessToken?: string
}
interface SendOptions extends CheckOptions {
    embeds: DiscordEmbed[]
}

const resolveDiscordConfig = (options: CheckOptions) => {
    if (options.endpoint && options.accessToken)
        return { endpoint: options.endpoint, accessToken: options.accessToken }
    const { liria } = useRuntimeConfig()
    return { endpoint: liria.discord.endpoint, accessToken: liria.discord.accessToken }
}

export const sendDiscordNotification = async ({ embeds, ...options }: SendOptions) => {
    const { endpoint, accessToken } = resolveDiscordConfig(options)
    await $fetch(joinURL(endpoint, 'admin/message'), {
        method: 'POST',
        body: { embeds },
        headers: { authorization: `Bearer ${accessToken}` },
    })
}

export const checkDiscordNotification = async (options: CheckOptions) => {
    const { endpoint, accessToken } = resolveDiscordConfig(options)
    await $fetch(joinURL(endpoint, 'admin/check'), {
        method: 'GET',
        headers: { authorization: `Bearer ${accessToken}` },
    })
}
