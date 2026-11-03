import { defineConfig } from 'vite';

// Relative assets allow the same build to run at localhost and under GitHub Pages.
export default defineConfig({ base: './' });
