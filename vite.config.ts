import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.API_PROXY_TARGET || 'http://localhost:8000'
  const proxy = Object.fromEntries(
    ['/usuarios', '/espacos', '/projetos', '/solicitacoes', '/agendamentos']
      .map(caminho => [caminho, { target, changeOrigin: true }]),
  )
  return {
    plugins: [react()],
    server: { port: 5173, strictPort: true, proxy },
  }
})
