import development from '../deployment/development/wrangler.json' with { type: 'json' }
import production from '../deployment/production/wrangler.json' with { type: 'json' }
import { parseAvatioStage } from './environment.ts'

export const getCloudflareConfig = (stage: string) =>
    ({ development, production })[parseAvatioStage(stage)]

export const getNitroCloudflareConfig = (stage: string) => {
    const { assets, $schema, main, ...rest } = getCloudflareConfig(stage)
    void $schema
    void main
    return {
        ...rest,
        assets: {
            binding: assets.binding,
            run_worker_first: assets.run_worker_first,
        },
    }
}
