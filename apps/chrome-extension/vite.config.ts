import { defineConfig } from 'vite';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'extn',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup.ts'),
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
        // Inline dynamic imports for Chrome extension compatibility
        inlineDynamicImports: false,
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: [
            'src/manifest.json',
            'src/popup.html',
            'src/styles.css',
          ],
          dest: '.',
        },
      ],
    }),
  ],
});
