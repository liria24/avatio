import {
    LazyModalLogin,
    LazyModalFeedback,
    LazyModalPublishSetupComplete,
    LazyModalSetupDelete,
    LazyModalReportSetup,
    LazyModalReportItem,
    LazyModalReportUser,
    LazyImageViewer,
    LazyModalAgreeTerms,
} from '#components'

const opts = { destroyOnClose: false } as const

const defineOverlay =
    <T extends Component>(component: T) =>
    (options?: Parameters<ReturnType<typeof useOverlay>['create']>[1]) =>
        useOverlay().create(component, { ...opts, ...options })

export const useAgreeTermsModal = defineOverlay(LazyModalAgreeTerms)
export const useLoginModal = defineOverlay(LazyModalLogin)
export const useFeedbackModal = defineOverlay(LazyModalFeedback)
export const usePublishSetupCompleteModal = defineOverlay(LazyModalPublishSetupComplete)
export const useSetupDeleteModal = defineOverlay(LazyModalSetupDelete)
export const useReportSetupModal = defineOverlay(LazyModalReportSetup)
export const useReportItemModal = defineOverlay(LazyModalReportItem)
export const useReportUserModal = defineOverlay(LazyModalReportUser)
export const useImageViewerModal = defineOverlay(LazyImageViewer)
