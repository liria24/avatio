export default (hex: string) => {
    const { r, g, b } = hexToRgb(hex)
    // 明度計算（WCAG基準）
    return (0.2126 * r) / 255 + (0.7152 * g) / 255 + (0.0722 * b) / 255
}
