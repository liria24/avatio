import sanitizeHtml from 'sanitize-html'

const sanitizeObject = <T>(obj: T): T => {
    if (typeof obj === 'string')
        return sanitizeHtml(obj, {
            allowedTags: [
                'span',
                'div',
                'ul',
                'ol',
                'li',
                'p',
                'br',
                'b',
                'strong',
                'em',
                'u',
                'h1',
                'h2',
                'h3',
                'h4',
                'h5',
                'h6',
                'ul',
                'ol',
                'li',
                'blockquote',
                'a',
                'img',
                'code',
                'pre',
                'table',
                'thead',
                'tbody',
                'tr',
                'th',
                'td',
            ],
            allowedAttributes: {
                a: ['href', 'target'],
                img: ['src', 'alt', 'title', 'width', 'height'],
            },
            allowedSchemes: ['http', 'https', 'mailto'],
            disallowedTagsMode: 'discard',
        }) as T

    if (Array.isArray(obj)) return obj.map((item) => sanitizeObject(item)) as T

    if (obj && typeof obj === 'object' && obj !== null) {
        const sanitizedObj = {} as Record<string, unknown>
        for (const [key, value] of Object.entries(obj)) sanitizedObj[key] = sanitizeObject(value)

        return sanitizedObj as T
    }

    return obj
}

export default sanitizeObject
