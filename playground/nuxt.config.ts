import { fileURLToPath } from "node:url"

export default defineNuxtConfig({
	modules: [
		"@witchcraft/nuxt-logger",
		"../src/module"
	],

	devtools: { enabled: true },
	// alias: {
	// 	"#postgres": fileURLToPath(new URL("server/postgres.js", import.meta.url))
	// },
	future: {
		compatibilityVersion: 4 as const
	},
	compatibilityDate: "2024-09-23",
	postgres: {
		usePgLiteOnServer: process.env.VITEST === "true"
	}
})
