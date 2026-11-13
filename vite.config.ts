import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' permet de déployer aussi bien à la racine que dans un sous-chemin GitLab Pages.
export default defineConfig({
  plugins: [react()],
  base: './',
})
