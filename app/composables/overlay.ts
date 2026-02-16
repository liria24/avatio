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
} from '#components'

interface ModalSetupDelete {
    setupId: number
}

interface ModalSetupHide {
    setupId: number
}

interface ModalSetupUnhide {
    setupId: number
}

interface ModalReportSetup {
    setupId: number
}

interface ModalReportItem {
    itemId: string
}

interface ModalReportUser {
    userId: string
}

interface ModalBanUser {
    userId: string
    name: string
    image?: string | null
}

interface ModalChangeItemNiceName {
    itemId: string
    current: string
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
