<script setup lang="ts">
import { cn } from 'cn'

defineProps<{
    points: SetupPoint[]
    entryById: ReadonlyMap<string, SetupEntryView>
    expanded: boolean
    highlightedPointId?: string
}>()

const emit = defineEmits<{ select: [point: SetupPoint] }>()
</script>

<template>
    <svg
        v-if="expanded"
        class="pointer-events-none absolute inset-0 size-full overflow-visible"
        aria-hidden="true"
    >
        <line
            v-for="(point, pointIndex) in points"
            :key="`line-${point.id}`"
            :x1="`${point.x * 100}%`"
            :y1="`${point.y * 100}%`"
            :x2="`${setupExpandedPointPosition(pointIndex, points.length).x * 100}%`"
            :y2="`${setupExpandedPointPosition(pointIndex, points.length).y * 100}%`"
            class="stroke-primary"
            stroke-width="2"
        />
    </svg>

    <button
        v-for="point in points"
        :key="point.id"
        type="button"
        :style="setupPointStyle(point)"
        :aria-label="entryById.get(point.entryId)?.catalogItem.name ?? point.entryId"
        :class="
            cn(
                'ring-default absolute z-10 -translate-1/2 overflow-hidden rounded-full shadow-lg ring-2 transition-transform',
                expanded ? 'bg-primary size-3' : 'size-9 bg-white',
                highlightedPointId === point.id && 'ring-primary scale-125',
            )
        "
        @click.stop="emit('select', point)"
    >
        <NuxtImg
            v-if="!expanded && entryById.get(point.entryId)?.catalogItem.image"
            :src="entryById.get(point.entryId)?.catalogItem.image || undefined"
            alt=""
            width="40"
            height="40"
            class="size-full object-cover"
        />
        <Icon v-else-if="!expanded" name="mingcute:package-2-fill" size="18" />
    </button>

    <button
        v-for="(point, pointIndex) in expanded ? points : []"
        :key="`expanded-${point.id}`"
        type="button"
        :style="setupPointStyle(setupExpandedPointPosition(pointIndex, points.length))"
        :aria-label="entryById.get(point.entryId)?.catalogItem.name ?? point.entryId"
        class="ring-default absolute z-10 size-16 -translate-1/2 overflow-hidden rounded-xl bg-white shadow-xl ring-2"
        @click.stop="emit('select', point)"
    >
        <NuxtImg
            v-if="entryById.get(point.entryId)?.catalogItem.image"
            :src="entryById.get(point.entryId)?.catalogItem.image || undefined"
            alt=""
            width="72"
            height="72"
            class="size-full object-cover"
        />
        <Icon v-else name="mingcute:package-2-fill" size="28" />
    </button>
</template>
