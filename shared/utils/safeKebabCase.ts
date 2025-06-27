import { kebabCase } from 'scule'

export default (str: string) => {
    return kebabCase(str)
        .trim()
        .replace(/(?:\s+|[^a-zA-Z0-9])+/g, '-')
        .replace(/^-|-$/g, '')
}
