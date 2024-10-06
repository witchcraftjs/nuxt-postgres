export default defineNuxtConfig({
	devtools: { enabled: true },
	compatibilityDate: "2024-09-23",
	future: {
		compatibilityVersion: 4 as const
	},
	modules: [
		"@witchcraft/nuxt-logger",
		"../src/module",
		// the below also works, just remember to run the update-dep script and uncomment ../src/module above before attempting to use the file: linked module
		// "@witchcraft/nuxt-postgres",
	],
	postgres: {
		usePgLiteOnServer: process.env.VITEST === "true",
	},
})
