<script setup lang="ts">
const { changelogs } = useChangelogs()

const formattedChangelogs = computed(() =>
    changelogs.value.map((changelog) => ({
        title: changelog.title,
        description: '',
        date: changelog.createdAt,
        content: changelog.markdown,
    })),
)
</script>

<template>
    <UChangelogVersions>
        <UChangelogVersion
            v-for="(changelog, index) in formattedChangelogs"
            :key="index"
            v-bind="changelog"
            :ui="{ container: 'ml-40 mr-0 max-w-full' }"
        >
            <template #title>
                <h2
                    :class="
                        cn(
                            'sentence text-3xl font-bold',
                            'before:text-muted before:font-[Geist] before:font-light before:content-[\'//_\']',
                        )
                    "
                >
                    {{ changelog.title }}
                </h2>
            </template>

            <template #description>
                <USeparator class="mt-5" />
                <MDC
                    v-if="changelog.content"
                    :value="changelog.content"
                    :parser-options="{
                        toc: false,
                        contentHeading: false,
                    }"
                    class="sentence w-full max-w-full *:first:mt-6"
                />
            </template>
        </UChangelogVersion>
    </UChangelogVersions>
</template>
