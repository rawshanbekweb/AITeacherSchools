import next from 'eslint-config-next';

const config = [
  ...next,
  { ignores: ['.next/**', 'node_modules/**', 'drizzle/**', 'data/**', 'public/mediapipe/**'] },
];

export default config;
