import { describe, expect, it } from 'vitest'

import avatarShortName from '../../app/utils/avatarShortName'

describe('avatarShortName', () => {
    it.each<[string, string, string]>([
        ['plain name', 'キャラクター名', 'キャラクター名'],
        ['【】 bracket decoration', '【アバター】キャラクター名', 'キャラクター名'],
        ['『』 bracket decoration', '『キャラクター名』', 'キャラクター名'],
        ['3Dモデル prefix', '3Dモデル キャラクター', 'キャラクター'],
        ['consecutive アバター◆ decoration', 'アバター◆キャラクター', 'キャラクター'],
        ['ギミック搭載アバター prefix', 'ギミック搭載アバター キャラクター', 'キャラクター'],
        ['オリジナル prefix', 'オリジナルアバター キャラクター', 'キャラクター'],
        ['multiple spaces collapsed', 'name  with  extra  spaces', 'name with extra spaces'],
        ['surrounding whitespace trimmed', '  trimmed  ', 'trimmed'],
    ])('%s: "%s" → "%s"', (_label, input, expected) => {
        expect(avatarShortName(input)).toBe(expected)
    })
})
