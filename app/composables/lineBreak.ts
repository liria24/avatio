import { loadDefaultJapaneseParser } from 'budoux'

export const useLineBreak = (text: string) => {
    const { locale } = useI18n()
    const parser = loadDefaultJapaneseParser()

    if (locale.value === 'ja') return parser.parse(text).join('<wbr>')
    else return text
}
