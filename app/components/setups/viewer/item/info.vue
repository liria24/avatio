<script lang="ts" setup>
interface Props {
    url: string
    shop: Shop
    price: string | null
    likes: number | null
}
const props = defineProps<Props>()
</script>

<template>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-0.5">
        <NuxtLink
            :to="props.url"
            target="_blank"
            class="flex w-fit items-center gap-1.5"
        >
            <Icon
                name="mingcute:currency-cny-fill"
                :size="18"
                class="shrink-0 text-zinc-600 dark:text-zinc-400"
            />
            <span
                class="pt-px font-[Geist] text-xs leading-0 font-semibold whitespace-nowrap text-zinc-600 dark:text-zinc-400"
            >
                {{ props.price || 'UNKNOWN' }}
            </span>
        </NuxtLink>

        <NuxtLink
            :to="props.url"
            target="_blank"
            class="flex w-fit items-center gap-1.5"
        >
            <Icon
                name="mingcute:heart-fill"
                :size="18"
                class="shrink-0 text-zinc-600 dark:text-zinc-400"
            />
            <p
                class="pt-px font-[Geist] text-xs leading-none font-semibold whitespace-nowrap text-zinc-600 dark:text-zinc-400"
            >
                {{ props.likes?.toLocaleString() || '?' }}
            </p>
        </NuxtLink>

        <HovercardShop :shop="props.shop">
            <NuxtLink
                :to="`https://${props.shop.id}.booth.pm/`"
                target="_blank"
                class="flex w-fit items-center gap-1.5"
            >
                <NuxtImg
                    :src="props.shop.thumbnail ?? ''"
                    :alt="props.shop.name"
                    :width="20"
                    :height="20"
                    format="webp"
                    fit="cover"
                    class="size-5 rounded-md border border-zinc-300 dark:border-zinc-700"
                />
                <span
                    class="text-xs font-semibold whitespace-nowrap text-zinc-600 dark:text-zinc-400"
                >
                    {{ props.shop.name }}
                </span>
                <Icon
                    v-if="props.shop.verified"
                    name="lucide:check"
                    :size="16"
                    class="size-3 shrink-0 text-zinc-700 dark:text-zinc-300"
                />
            </NuxtLink>
        </HovercardShop>
    </div>
</template>
