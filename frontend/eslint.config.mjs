import next from 'eslint-config-next';

const config = [
  ...next,
  { ignores: ['.next/**', 'node_modules/**'] },
  {
    rules: {
      // data-loading effects legitimately call setState
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
];

export default config;
