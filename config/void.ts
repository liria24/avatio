import development from '../deployment/development/void.config.ts'
import production from '../deployment/production/void.config.ts'
import { parseAvatioStage } from './environment.ts'

export const getVoidConfig = (stage: string) =>
    ({ development, production })[parseAvatioStage(stage)]
