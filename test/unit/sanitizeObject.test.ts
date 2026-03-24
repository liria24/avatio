import { describe, expect, it } from 'vitest'

import sanitizeObject from '../../server/utils/sanitizeObject'

describe('sanitizeObject — string input', () => {
    it.each<[string, string, string]>([
        ['strips <script> tags', '<script>alert("xss")</script>', ''],
        ['preserves allowed <p> tag', '<p>Hello</p>', '<p>Hello</p>'],
        [
            'preserves <a> with safe href',
            '<a href="https://example.com">link</a>',
            '<a href="https://example.com">link</a>',
        ],
        // sanitize-html serialises void elements as self-closing
        [
            'preserves <img> with safe src',
            '<img src="https://example.com/img.png">',
            '<img src="https://example.com/img.png" />',
        ],
        ['strips javascript: href', '<a href="javascript:alert()">xss</a>', '<a>xss</a>'],
        ['strips onclick attribute', '<p onclick="alert()">click</p>', '<p>click</p>'],
        [
            'strips disallowed tags, preserves text',
            '<div><marquee>hello</marquee></div>',
            '<div>hello</div>',
        ],
        ['preserves plain text', 'plain text', 'plain text'],
    ])('%s', (_label, input, expected) => {
        expect(sanitizeObject(input)).toBe(expected)
    })
})

describe('sanitizeObject — non-string input', () => {
    it.each([
        [
            'object',
            { text: '<script>xss</script>', safe: '<p>ok</p>' },
            { text: '', safe: '<p>ok</p>' },
        ],
        ['array', ['<script>xss</script>', '<p>ok</p>'], ['', '<p>ok</p>']],
        ['number', 42, 42],
        ['boolean', true, true],
        ['null', null, null],
    ])('%s', (_label, input, expected) => {
        expect(sanitizeObject(input)).toEqual(expected)
    })
})
