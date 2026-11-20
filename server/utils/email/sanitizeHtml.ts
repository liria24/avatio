import sanitizeHtml from 'sanitize-html'

export const sanitizeEmailHtml = (html: string) =>
    sanitizeHtml(html, {
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
            'blockquote',
            'a',
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
        },
        allowedSchemes: ['http', 'https', 'mailto'],
        disallowedTagsMode: 'discard',
    })
