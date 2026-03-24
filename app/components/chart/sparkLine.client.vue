<script lang="ts" setup>
import type { VueUiSparklineConfig, VueUiSparklineDatasetItem } from 'vue-data-ui'
import { mergeConfigs } from 'vue-data-ui'
import VueUiSparkLine from 'vue-data-ui/vue-ui-sparkline'

interface Props {
    dataset: VueUiSparklineDatasetItem[]
    config?: VueUiSparklineConfig
}
const { dataset, config } = defineProps<Props>()

const defaultConfig: VueUiSparklineConfig = {
    responsive: false,
    style: {
        animation: { show: false },
        backgroundColor: 'transparent',
        area: {
            color: '#CFCFCF',
            useGradient: false,
            opacity: 5,
        },
        dataLabel: {
            offsetX: -12,
            fontSize: 24,
            color: '#CCCCCC',
            bold: false,
        },
        line: {
            color: '#CFCFCF',
            smooth: true,
        },
        title: {
            fontSize: 12,
            bold: false,
            color: '#6A6A6A',
        },
        verticalIndicator: {
            strokeDasharray: 0,
            color: 'oklch(0.985 0 0)',
        },
        padding: {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
        },
    },
}

const mergedConfig = computed(() => mergeConfigs({ defaultConfig, userConfig: config || {} }))
</script>

<template>
    <VueUiSparkLine :config="mergedConfig" :dataset class="*:font-mono" />
</template>

<style>
.vue-ui-sparkline-title span {
    padding: 0 !important;
    letter-spacing: 0.04rem;
}
</style>
