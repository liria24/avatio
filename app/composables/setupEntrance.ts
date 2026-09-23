export type SetupEntranceTab = 'latest' | 'owned' | 'bookmarked'
export type SetupEntranceBatch = { delay: number; appended: boolean }

// Owned by one index page instance; taking an assignment survives Masonry remounts.
export function useSetupEntrance() {
    const tabs = Object.fromEntries(
        (['latest', 'owned', 'bookmarked'] as const).map((tab) => [
            tab,
            {
                visited: false,
                assigned: new Set<string>(),
                pending: new Map<string, SetupEntranceBatch>(),
            },
        ]),
    ) as Record<
        SetupEntranceTab,
        { visited: boolean; assigned: Set<string>; pending: Map<string, SetupEntranceBatch> }
    >
    let active: SetupEntranceTab = 'latest'
    function assign(tab: SetupEntranceTab, ids: string[], appended: boolean) {
        const state = tabs[tab]
        const fresh = [...new Set(ids)].filter((id) => !state.assigned.has(id))
        const step = Math.min(32, 180 / Math.max(1, fresh.length - 1))
        fresh.forEach((id, rank) => {
            state.assigned.add(id)
            state.pending.set(id, { delay: rank * step, appended })
        })
    }
    return {
        tabs,
        display(tab: SetupEntranceTab, success: boolean, ids: string[]) {
            if (active !== tab) tabs[active].pending.clear()
            active = tab
            if (success && !tabs[tab].visited) {
                tabs[tab].visited = true
                assign(tab, ids, false)
            }
            return tabs[tab].pending
        },
        append(tab: SetupEntranceTab, ids: string[]) {
            if (active === tab && tabs[tab].visited) assign(tab, ids, true)
        },
    }
}
