import { loadDefaultJapaneseParser } from 'budoux'

export default (text: string) => {
    const parser = loadDefaultJapaneseParser()
    return parser.parse(text).join('\u200b')
}
