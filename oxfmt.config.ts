import { defineConfig } from 'oxfmt'

export default defineConfig({
    tabWidth: 4,
    semi: false,
    singleQuote: true,
    printWidth: 100,
    sortTailwindcss: {
        functions: ['cn'],
    },
    sortImports: {},
    sortPackageJson: {},
    ignorePatterns: [],
    overrides: [{ files: ['**/*.yml', '**/*.yaml', '**/*.md'], options: { tabWidth: 2 } }],
})
