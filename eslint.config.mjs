import next from 'eslint-config-next';

const config = [
  ...next,
  { ignores: ['.next/**', 'node_modules/**', 'drizzle/**', 'data/**'] },
];

export default config;
