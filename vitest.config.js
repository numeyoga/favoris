import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom fournit localStorage/URL pour les modules pensés « navigateur ».
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['public/assets/**/*.js'],
      // Code purement réseau / SDK lazy-loadé : non couvert par les tests unitaires.
      exclude: ['public/assets/sync/adapter-appwrite.js', 'public/assets/sync/index.js'],
      reporter: ['text', 'html'],
    },
  },
});
