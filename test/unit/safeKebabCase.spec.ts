import { describe, expect, it } from 'vitest'

import safeKebabCase from '../../shared/utils/safeKebabCase'

describe('safeKebabCase', () => {
    it.each<[string, string, string]>([
        ['space-separated string', 'Hello World', 'hello-world'],
        ['already kebab-case', 'hello-world', 'hello-world'],
        ['underscores', 'foo_bar_baz', 'foo-bar-baz'],
        ['leading and trailing spaces', '  leading and trailing  ', 'leading-and-trailing'],
        ['leading and trailing hyphens', '--already-kebab--', 'already-kebab'],
        ['empty string', '', ''],
        ['consecutive special characters', 'foo!!bar', 'foo-bar'],
        ['mixed case and special characters', 'HelloWorld!!foo', 'hello-world-foo'],
    ])('%s: "%s" → "%s"', (_label, input, expected) => {
        expect(safeKebabCase(input)).toBe(expected)
    })
})
