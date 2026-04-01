import { Unosend } from '@unosend/node'

export const useUnosend = () => {
    const config = useRuntimeConfig()
    return new Unosend(config.unosend.apiKey)
}
