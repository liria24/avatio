import { parseURL } from 'ufo'

export default (url: string) => {
    const { links } = useAppConfig()

    const parsed = parseURL(url)
    if (!parsed.host) return { label: null, icon: 'mingcute:link-fill', iconSize: 20 }

    const host = parsed.host.toLowerCase()
    const mapping = links.find((link) => link.pattern.test(host))

    return {
        label: mapping?.label || null,
        icon: mapping?.icon || 'mingcute:link-fill',
        iconSize: mapping?.iconSize || 20,
    }
}
