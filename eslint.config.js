// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

/**
 * Style props that should reference tokens from @/constants/theme
 * instead of raw numeric literals.
 */
const TOKENIZED_STYLE_PROPS = [
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingEnd',
  'margin',
  'marginHorizontal',
  'marginVertical',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  'gap',
  'rowGap',
  'columnGap',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'fontSize',
]

const tokenPropSelector = `Property[key.name=/^(${TOKENIZED_STYLE_PROPS.join('|')})$/][value.type='Literal'][value.value!=0]`

/**
 * Files where raw hexes / numeric literals are acceptable:
 * - the token source files themselves
 * - shareable-widget designs (intentional fixed palette for social share cards)
 * - onboarding / auth hero screens (often use one-off gradients)
 */
const TOKEN_RULE_IGNORES = [
  'constants/**',
  'components/shareable-widgets/**',
  'styles/**',
  'temp*.tsx',
]

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'ios/*'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: TOKEN_RULE_IGNORES,
    rules: {
      'no-restricted-syntax': [
        'warn',
        {
          selector: tokenPropSelector,
          message:
            'Use a token from @/constants/theme (Spacing / Radius / FontSize / Layout) instead of a raw number.',
        },
        {
          selector:
            "Literal[value=/^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?([0-9A-Fa-f]{2})?$/]",
          message:
            'Use a color token from @/constants/colors (via useThemedColors) instead of a raw hex literal.',
        },
      ],
    },
  },
])
