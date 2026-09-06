import type { NuxtInsightServerConfig } from 'insight-ts/nuxt'

import {
    applicationInsightProvider,
    googleSearchConsoleProvider,
} from '../../server/utils/insightProviders'

export default {
    providers: [applicationInsightProvider, googleSearchConsoleProvider] as const,
} satisfies NuxtInsightServerConfig
