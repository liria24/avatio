import { loadDefaultJapaneseParser } from 'budoux';

export interface Toast {
    id: string;
    title: string;
    description?: string;
}
export const toasts = ref<Toast[]>([]);

export const useToast = () => {
    const add = (title: string, description?: string) => {
        toasts.value.push({ id: useId(), title, description });
    };
    const remove = (id: string) => {
        toasts.value = toasts.value.filter((toast) => toast.id !== id);
    };

    const clear = () => {
        toasts.value = [];
    };

    return { add, remove, clear };
};

export const useSentence = (text: string) =>
    loadDefaultJapaneseParser().parse(text).join('\u200b');

export const useLineBreak = (text: string) =>
    text.replace(/(\r\n){3,}|\r{3,}|\n{3,}/, '\n\n');

export const useLocaledDate = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
};

export const useWriteClipboard = (text: string) =>
    navigator.clipboard.writeText(text);

export const useAvatarName = (text: string) => {
    return text
        .replace(
            /(オリジナル|3Dモデル|ギミック搭載|アバター|◆|\/|「|」|【|】|『|』){1,}| {2,}/g,
            ' '
        )
        .trim();
};

export const useDateElapsed = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor(
        (now.getTime() - date.getTime()) / (1000 * 60)
    );
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInMonths = Math.floor(diffInDays / 30);
    const diffInYears = Math.floor(diffInMonths / 12);

    if (diffInMinutes < 60) return `${diffInMinutes}分前`;
    if (diffInHours < 24) return `${diffInHours}時間前`;
    if (diffInDays < 30) return `${diffInDays}日前`;
    if (diffInMonths < 12) return `${diffInMonths}ヶ月前`;
    return `${diffInYears}年前`;
};

export const useOGP = ({
    url,
    type,
    title,
    titleTemplate,
    description,
    image,
    twitterCard,
}: {
    url?: string | null;
    type?: 'website' | 'article' | null;
    title: string;
    titleTemplate?: string | null;
    description?: string | null;
    image?: 'https://avatio.me/ogp.png' | string | null;
    twitterCard?: 'summary' | 'summary_large_image' | null;
}) => {
    const meta: object[] = [
        {
            property: 'og:url',
            content: url ?? useBrowserLocation().value.href!,
        },
        { property: 'og:title', content: title },
        {
            property: 'og:image',
            content: image ?? 'https://avatio.me/ogp.png',
        },
        { name: 'twitter:card', content: twitterCard ?? 'summary' },
        { name: 'twitter:site', content: '@liria_work' },
        { property: 'og:type', content: type ?? 'article' },
    ];

    if (description?.length) {
        meta.push({
            name: 'description',
            content: description,
        });
        meta.push({
            property: 'og:description',
            content: description,
        });
    }

    return useHead({
        title: title,
        titleTemplate: titleTemplate ?? '%s | Avatio',
        meta: meta,
    });
};
