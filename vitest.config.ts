import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
    plugins: [react()],
    test: {
        browser: {
            enabled: true,
            provider: playwright(),
            instances: [
                { browser: 'chromium' }
            ]
        },
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
})
