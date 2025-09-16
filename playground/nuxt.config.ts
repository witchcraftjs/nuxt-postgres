import { fileURLToPath } from "node:url"

export default defineNuxtConfig({
	modules: [
		"@witchcraft/nuxt-logger",
		"../src/module"
		// the below also works, just remember to run the update-dep script and uncomment ../src/module above before attempting to use the file: linked module
		// "@witchcraft/nuxt-postgres",
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
