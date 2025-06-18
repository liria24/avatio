export default (): Record<string, { label: string; icon: string }> => ({
    avatar: {
        label: 'ベースアバター',
        icon: 'lucide:person-standing',
    },
    hair: {
        label: 'ヘア',
        icon: 'mingcute:hair-line',
    },
    cloth: {
        label: '衣装',
        icon: 'lucide:shirt',
    },
    accessory: {
        label: 'アクセサリー',
        icon: 'mingcute:bow-tie-line',
    },
    texture: {
        label: 'テクスチャ',
        icon: 'lucide:image',
    },
    shader: {
        label: 'シェーダー',
        icon: 'mingcute:shadow-line',
    },
    tool: {
        label: 'ツール',
        icon: 'lucide:wrench',
    },
    other: {
        label: 'その他',
        icon: 'lucide:package',
    },
})
