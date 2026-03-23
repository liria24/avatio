import type { Component } from 'vue'

import {
    LazyModalLogin,
    LazyModalFeedback,
    LazyModalPublishSetupComplete,
    LazyModalSetupDelete,
    LazyModalSetupHide,
    LazyModalSetupUnhide,
    LazyModalReportSetup,
    LazyModalReportItem,
    LazyModalReportUser,
    LazyModalAdminBanUser,
    LazyModalAdminChangeItemNiceName,
    LazyModalAdminModalFlags,
    LazyImageViewer,
    LazyModalAgreeTerms,
} from '#components'

interface ModalSetupDelete {
    setupId: Setup['id']
}

interface ModalSetupHide {
    setupId: Setup['id']
}

interface ModalSetupUnhide {
    setupId: Setup['id']
}

interface ModalReportSetup {
    setupId: Setup['id']
}

interface ModalReportItem {
    itemId: Item['id']
}

interface ModalReportUser {
    userId: User['id']
}

interface ModalBanUser {
    userId: User['id']
    name: string
    image?: string | null
}

interface ModalChangeItemNiceName {
    itemId: Item['id']
    current: string
}

interface ModalAgreeTerms {
    needsTerms: boolean
    needsPrivacyPolicy: boolean
}

interface ModalImageViewer {
    src: string
    alt?: string
}

interface ModalWrapper<T = void> {
    open: T extends void ? () => void : (props: T) => void
    close: () => void
}

export const useAppOverlay = () => {
    const overlay = useOverlay()

    const createModalWrapper = <T = void>(LazyComponent: Component): ModalWrapper<T> => {
        let instance: { open: () => void; close: () => void } | null = null

        return {
            open: (props?: T) => {
                if (instance) instance.close()

                instance = overlay.create(
                    LazyComponent as unknown as Parameters<typeof overlay.create>[0],
                    props && typeof props === 'object' ? { props } : undefined,
                )
                instance.open()
            },
            close: () => {
                if (instance) {
                    instance.close()
                    instance = null
                }
            },
        } as ModalWrapper<T>
    }

    return {
        agreeTerms: createModalWrapper<ModalAgreeTerms>(LazyModalAgreeTerms),
        login: createModalWrapper<void>(LazyModalLogin),
        feedback: createModalWrapper<void>(LazyModalFeedback),
        publishSetupComplete: createModalWrapper<void>(LazyModalPublishSetupComplete),
        setupDelete: createModalWrapper<ModalSetupDelete>(LazyModalSetupDelete),
        setupHide: createModalWrapper<ModalSetupHide>(LazyModalSetupHide),
        setupUnhide: createModalWrapper<ModalSetupUnhide>(LazyModalSetupUnhide),
        reportSetup: createModalWrapper<ModalReportSetup>(LazyModalReportSetup),
        reportItem: createModalWrapper<ModalReportItem>(LazyModalReportItem),
        reportUser: createModalWrapper<ModalReportUser>(LazyModalReportUser),
        banUser: createModalWrapper<ModalBanUser>(LazyModalAdminBanUser),
        changeItemNiceName: createModalWrapper<ModalChangeItemNiceName>(
            LazyModalAdminChangeItemNiceName,
        ),
        modalFlags: createModalWrapper<void>(LazyModalAdminModalFlags),
        imageViewer: createModalWrapper<ModalImageViewer>(LazyImageViewer),
    }
}
