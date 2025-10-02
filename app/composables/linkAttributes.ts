import { parseURL } from 'ufo'

export default (url: string) => {
    const { links } = useAppConfig()

    const parsed = parseURL(url)
    if (!parsed.host) return { label: null, icon: 'lucide:link', iconSize: 20 }

    const host = parsed.host.toLowerCase()
    const mapping = links.find((link) => link.pattern.test(host))

    return {
        label: mapping?.label || null,
        icon: mapping?.icon || 'lucide:link',
        iconSize: mapping?.iconSize || 20,
    }
}
