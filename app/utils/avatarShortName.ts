export default (text: string) =>
    text
        .replace(
            /(オリジナル|3Dモデル|ギミック搭載|アバター|◆|\/|「|」|【|】|『|』){1,}| {2,}/g,
            ' '
        )
        .trim()
