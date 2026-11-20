import type { DropdownMenuItem } from '@nuxt/ui'

interface UserReportActionTarget {
    reportee: {
        id: string
        username: string
        name: string
        image: string | null
        banned: boolean | null
    }
}

interface SetupReportActionTarget {
    setup: {
        id: string
        hidAt: string | Date | null
    }
}

interface ItemReportActionTarget {
    item: {
        id: string
        displayNameOverride?: string | null
        primarySource?: { canonicalUrl?: string } | null
    }
}

export const useAdminReportActions = (onSuccess: () => void) => {
    const { t } = useI18n()
    const { unbanUser } = useAdmin()
    const banUser = useBanUserModal()
    const setupHide = useSetupHideModal()
    const setupUnhide = useSetupUnhideModal()
    const changeItemNiceName = useChangeItemNiceNameModal()
    const setupPath = useSetupPath()

    const userReportActions = (report: UserReportActionTarget): DropdownMenuItem[][] => [
        [
            {
                label: t('admin.reports.actions.viewUser'),
                icon: 'mingcute:user-3-fill',
                to: `/@${report.reportee.username}`,
                target: '_blank',
            },
        ],
        [
            {
                label: report.reportee.banned
                    ? t('admin.reports.actions.unbanUser')
                    : t('admin.reports.actions.banUser'),
                icon: report.reportee.banned ? 'mingcute:back-fill' : 'mingcute:forbid-circle-fill',
                onSelect: () => {
                    if (report.reportee.banned) {
                        void unbanUser({
                            userId: report.reportee.id,
                            onSuccess,
                        })
                        return
                    }

                    void banUser.open({
                        userId: report.reportee.id,
                        username: report.reportee.username,
                        name: report.reportee.name,
                        image: report.reportee.image,
                        onSuccess,
                    })
                },
            },
        ],
    ]

    const setupReportActions = (report: SetupReportActionTarget): DropdownMenuItem[][] => [
        [
            {
                label: t('admin.reports.actions.viewSetup'),
                icon: 'mingcute:external-link-line',
                to: setupPath(report.setup.id),
                target: '_blank',
            },
        ],
        [
            {
                label: report.setup.hidAt
                    ? t('admin.reports.actions.unhideSetup')
                    : t('admin.reports.actions.hideSetup'),
                icon: report.setup.hidAt ? 'mingcute:eye-fill' : 'mingcute:eye-close-line',
                onSelect: () => {
                    const props = { setupId: report.setup.id, onSuccess }
                    if (report.setup.hidAt) void setupUnhide.open(props)
                    else void setupHide.open(props)
                },
            },
        ],
    ]

    const itemReportActions = (report: ItemReportActionTarget): DropdownMenuItem[][] => [
        [
            {
                label: t('admin.reports.actions.viewSource'),
                icon: 'mingcute:external-link-line',
                to: report.item.primarySource?.canonicalUrl,
                target: '_blank',
                disabled: !report.item.primarySource?.canonicalUrl,
            },
        ],
        [
            {
                label: t('admin.reports.actions.changeItemName'),
                icon: 'mingcute:edit-3-line',
                onSelect: () =>
                    changeItemNiceName.open({
                        itemId: report.item.id,
                        current: report.item.displayNameOverride || '',
                        onSuccess,
                    }),
            },
        ],
    ]

    return {
        userReportActions,
        setupReportActions,
        itemReportActions,
    }
}
