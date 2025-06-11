// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
    // Your custom configs here
    {
        rules: {
            'vue/html-self-closing': 'off',
            'vue/attributes-order': 'off',
            'vue/valid-v-for': 'off',
            'vue/first-attribute-linebreak': 'off',
            'vue/multi-word-component-names': 'off',
            'vue/require-default-prop': 'off',
        },
    }
)
