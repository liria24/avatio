import {
    applicationInsightProvider,
    googleSearchConsoleProvider,
} from '../../server/utils/insightProviders'

export default {
    providers: [applicationInsightProvider, googleSearchConsoleProvider] as const,
} as const
