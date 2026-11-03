// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'artifacts/*', 'scripts/tmp/*'],
  },
  {
    // The React Compiler is not enabled (app.json has no experiments.reactCompiler), and
    // the game loop deliberately keeps mutable state in refs and plain objects (camera,
    // effects, sim controller) that render reads every frame. These compiler-only checks
    // don't apply.
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
]);
