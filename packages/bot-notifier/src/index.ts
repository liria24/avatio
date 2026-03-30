import { ofetch } from 'ofetch'

export interface NotifierOptions {
    baseUrl?: string
    apiKey?: string
}

export interface EmbedField {
    name: string
    value: string
    inline?: boolean
}

export interface EmbedImage {
    url: string
}

export interface EmbedAuthor {
    name: string
    url?: string
    icon_url?: string
}

export interface EmbedFooter {
    text: string
    icon_url?: string
}

export interface Embed {
    title?: string
    description?: string
    color?: number
    url?: string
    timestamp?: string
    thumbnail?: EmbedImage
    image?: EmbedImage
    author?: EmbedAuthor
    fields?: EmbedField[]
    footer?: EmbedFooter
}

export interface MessageData extends NotifierOptions {
    content?: string
    embeds?: Embed[]
}

const createClient = ({ baseUrl, apiKey }: NotifierOptions = {}) =>
    ofetch.create({
        baseURL:
            baseUrl?.replace(/\/$/, '') ||
            process.env.LIRIA_DISCORD_ENDPOINT ||
            'https://discord.liria.me',
        headers: { Authorization: `Bearer ${apiKey || process.env.LIRIA_DISCORD_ACCESS_TOKEN}` },
    })

export const sendMessage = (data: MessageData) =>
    createClient({ baseUrl: data.baseUrl, apiKey: data.apiKey })('/admin/message', {
        method: 'POST',
        body: { embeds: data.embeds, content: data.content },
    })

export const checkConnection = (options?: NotifierOptions) =>
    createClient(options)<{ status: string }>('/admin/check', { method: 'GET' })
