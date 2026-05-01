import { Unosend } from '@unosend/node'

export const useUnosend = () => {
    const config = useRuntimeConfig()
    return new Unosend({ apiKey: config.unosend.apiKey })
}
