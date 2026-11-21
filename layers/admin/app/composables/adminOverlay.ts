import {
    LazyModalAdminBanUser,
    LazyModalAdminChangeItemNiceName,
    LazyModalAdminEmailDetail,
    LazyModalAdminEmailReply,
    LazyModalSetupHide,
    LazyModalSetupUnhide,
} from '#components'

const opts = { destroyOnClose: false } as const

const defineOverlay =
    <T extends Component>(component: T) =>
    (options?: Parameters<ReturnType<typeof useOverlay>['create']>[1]) =>
        useOverlay().create(component, { ...opts, ...options })

export const useSetupHideModal = defineOverlay(LazyModalSetupHide)
export const useSetupUnhideModal = defineOverlay(LazyModalSetupUnhide)
export const useBanUserModal = defineOverlay(LazyModalAdminBanUser)
export const useChangeItemNiceNameModal = defineOverlay(LazyModalAdminChangeItemNiceName)
export const useEmailDetailSlideover = defineOverlay(LazyModalAdminEmailDetail)
export const useEmailReplyModal = defineOverlay(LazyModalAdminEmailReply)
