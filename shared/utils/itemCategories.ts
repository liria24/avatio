export default () => {
    const categories = {
        avatar: {
            id: 'avatar',
            label: 'ベースアバター',
            icon: 'lucide:person-standing',
        },
        hair: {
            id: 'hair',
            label: 'ヘア',
            icon: 'mingcute:hair-line',
        },
        cloth: {
            id: 'cloth',
            label: '衣装',
            icon: 'lucide:shirt',
        },
        accessory: {
            id: 'accessory',
            label: 'アクセサリー',
            icon: 'mingcute:bow-tie-line',
        },
        texture: {
            id: 'texture',
            label: 'テクスチャ',
            icon: 'lucide:image',
        },
        shader: {
            id: 'shader',
            label: 'シェーダー',
            icon: 'mingcute:shadow-line',
        },
        tool: {
            id: 'tool',
            label: 'ツール',
            icon: 'lucide:wrench',
        },
        other: {
            id: 'other',
            label: 'その他',
            icon: 'lucide:package',
        },
    }
    return categories
}
