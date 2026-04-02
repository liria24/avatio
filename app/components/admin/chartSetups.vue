<script lang="ts" setup>
const { data } = await useFetch('/api/admin/setups', {
    query: {
        hidden: false,
    },
    transform: (res) => {
        const now = new Date()

        const monthCounts = new Map<string, number>()
        for (const item of res) {
            const d = new Date(item.createdAt)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1)
        }

        if (monthCounts.size === 0) return []

        const startKey =
            [...monthCounts.keys()].sort()[0] ??
            `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const parts = startKey.split('-')
        const endYear = now.getFullYear()
        const endMonth = now.getMonth() + 1

        const result: { period: string; value: number }[] = []
        let cumulative = 0
        let year = Number(parts[0])
        let month = Number(parts[1])

        while (year < endYear || (year === endYear && month <= endMonth)) {
            const key = `${year}-${String(month).padStart(2, '0')}`
            cumulative += monthCounts.get(key) ?? 0
            result.push({
                period: `${year}/${String(month).padStart(2, '0')}`,
                value: cumulative,
            })
            month++
            if (month > 12) {
                month = 1
                year++
            }
        }

        return result
    },
    dedupe: 'defer',
})
const dateRange = computed(() => {
    if (!data.value || data.value.length === 0) return ''

    const start = data.value[0]?.period
    const end = data.value[data.value.length - 1]?.period
    return `${start} - ${end}`
})
</script>

<template>
    <ChartSparkLine :dataset="data || []" :config="{ style: { title: { text: dateRange } } }" />
</template>
