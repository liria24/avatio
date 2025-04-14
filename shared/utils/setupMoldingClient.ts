export default (setup: SetupDB): SetupClient => {
    const items: Record<ItemCategory, SetupItem[]> = {
        avatar: [],
        cloth: [],
        accessory: [],
        hair: [],
        texture: [],
        shader: [],
        tool: [],
        other: [],
    };

    for (const i of setup.items) {
        if (!i.data) continue;

        const item = {
            ...i.data,
            note: i.note,
            unsupported: i.unsupported,
            shapekeys: i.shapekeys,
        };

        items[item.category].push(item);
    }

    return {
        id: setup.id,
        created_at: setup.created_at,
        name: setup.name,
        description: setup.description,
        author: {
            id: setup.author!.id,
            name: setup.author!.name || 'Unknown',
            avatar: setup.author!.avatar,
            badges: setup.author!.badges,
        },
        tags: setup.tags.map((t) => t.tag),
        co_authors: setup.co_authors.map((c) => ({
            id: c.user.id,
            name: c.user.name,
            avatar: c.user.avatar,
            badges: c.user.badges,
            note: c.note,
        })),
        unity: setup.unity,
        images: setup.images,
        items: items,
    };
};
