import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    browserName: 'chromium',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'api', grepInvert: /simulador local permite/, use: { baseURL: 'http://127.0.0.1:4173' } },
    { name: 'simulador', grep: /simulador local permite/, use: { baseURL: 'http://127.0.0.1:4174' } },
  ],
  webServer: [4173, 4174].map(porta => ({
    command: 'npm run dev -- --host 127.0.0.1 --port ' + porta,
    url: 'http://127.0.0.1:' + porta,
    env: { VITE_API_URL: 'http://127.0.0.1:' + porta, VITE_LOCAL_SIMULATOR: String(porta === 4174) },
    reuseExistingServer: false,
  })),
})
