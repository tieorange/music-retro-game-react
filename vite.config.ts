import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import path from "path"
import { readdirSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import type { Plugin } from 'vite'

function musicManifestPlugin(): Plugin {
    const audioExts = ['.mp3', '.ogg', '.wav', '.flac', '.m4a', '.aac']

    const generate = () => {
        const musicDir = path.resolve(__dirname, 'public/music')
        if (!existsSync(musicDir)) {
            mkdirSync(musicDir, { recursive: true })
        }
        const files = readdirSync(musicDir)
            .filter(f => audioExts.some(ext => f.toLowerCase().endsWith(ext)))
        const manifest = files
            .map(f => ({ name: f.replace(/\.[^/.]+$/, ''), file: f }))
            .sort((a, b) => a.name.localeCompare(b.name))
        writeFileSync(
            path.resolve(musicDir, 'manifest.json'),
            JSON.stringify(manifest, null, 2)
        )
        console.log(`[music-manifest] ${manifest.length} songs written to manifest.json`)
    }

    return {
        name: 'music-manifest',
        buildStart: generate,
        configureServer(server) {
            generate()
            const musicDir = path.resolve(__dirname, 'public/music')
            server.watcher.add(musicDir)
            server.watcher.on('add', (p) => {
                if (p.startsWith(musicDir) && audioExts.some(ext => p.toLowerCase().endsWith(ext))) {
                    generate()
                    server.hot.send({ type: 'full-reload' })
                }
            })
            server.watcher.on('unlink', (p) => {
                if (p.startsWith(musicDir)) {
                    generate()
                    server.hot.send({ type: 'full-reload' })
                }
            })
        },
    }
}

// https://vite.dev/config/
export default defineConfig({
    base: "/music-retro-game-react/",
    plugins: [react(), tailwindcss(), musicManifestPlugin()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
})
