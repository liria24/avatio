<script lang="ts" setup>
interface Props {
    url: string;
    shop: Shop;
    price: string | null;
    likes: number | null;
}
const { url, shop, price, likes } = defineProps<Props>();
</script>

<template>
    <div class="pl-0.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <NuxtLink
            :to="url"
            target="_blank"
            class="flex items-center gap-1.5 w-fit"
        >
            <Icon
                name="mingcute:currency-cny-fill"
                :size="18"
                class="shrink-0 text-zinc-600 dark:text-zinc-400"
            />
            <span
                class="pt-px text-xs font-[Geist] font-semibold leading-0 whitespace-nowrap text-zinc-600 dark:text-zinc-400"
            >
                {{ price || 'UNKNOWN' }}
            </span>
        </NuxtLink>

        <NuxtLink
            :to="url"
            target="_blank"
            class="flex items-center gap-1.5 w-fit"
        >
            <Icon
                name="mingcute:heart-fill"
                :size="18"
                class="shrink-0 text-zinc-600 dark:text-zinc-400"
            />
            <p
                class="pt-px text-xs font-[Geist] leading-none whitespace-nowrap text-zinc-600 dark:text-zinc-400"
            >
                {{ likes?.toLocaleString() || '?' }}
            </p>
        </NuxtLink>

        <HovercardShop :shop="shop">
            <NuxtLink
                :to="`https://${shop.id}.booth.pm/`"
                target="_blank"
                class="flex items-center gap-1.5 w-fit"
            >
                <NuxtImg
                    :src="shop.thumbnail ?? ''"
                    :alt="shop.name"
                    :width="20"
                    :height="20"
                    format="webp"
                    fit="cover"
                    class="size-5 rounded-md border border-zinc-300 dark:border-zinc-700"
                />
                <span
                    class="font-semibold text-xs whitespace-nowrap text-zinc-600 dark:text-zinc-400"
                >
                    {{ shop.name }}
                </span>
                <Icon
                    v-if="shop.verified"
                    name="lucide:check"
                    :size="16"
                    class="shrink-0 size-3 text-zinc-700 dark:text-zinc-300"
                />
            </NuxtLink>
        </HovercardShop>
    </div>
</template>
