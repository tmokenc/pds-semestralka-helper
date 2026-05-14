import { defineConfig } from 'vite';

// Base path:
//   - In CI we read VITE_BASE (set by the GitHub Actions workflow to "/<repo-name>/")
//   - Locally we fall back to "./" so the dist build works when opened from the filesystem.
const base = process.env.VITE_BASE || './';

export default defineConfig({
  root: '.',
  base,
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Single bundled JS file
        manualChunks: undefined,
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
