import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages では /<repo名>/ 配下で配信される
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/Money-Management-Tool/' : '/',
  plugins: [react()],
});
