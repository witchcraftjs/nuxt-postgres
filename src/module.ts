/* eslint-disable jsdoc/check-tag-names */
import type { PGliteOptions } from "@electric-sql/pglite"
import {
	addImportsDir,
	addServerScanDir,
	addTypeTemplate,
	createResolver,
	defineNuxtModule,
	resolveAlias,
	useLogger } from "@nuxt/kit"
import { ensureEnv } from "@witchcraft/nuxt-utils/utils/ensureEnv"
import { defu } from "defu"
import type { MigrationConfig } from "drizzle-orm/migrator"
import { readMigrationFiles } from "drizzle-orm/migrator"
import fs from "node:fs/promises"
import path from "node:path"
import type { Options } from "postgres"
import topLevelAwait from "vite-plugin-top-level-await"
import wasm from "vite-plugin-wasm"


type ConnectionOptions = {
	host: string
	port: number
	password?: string
	database?: string
	username?: string
}
export type PostgresOptions = {
	/**
	 * @experimental
	 *
	 * On ther server, use pglite with a local database instead of connecting to a remote database on the server.
	 *
	 * This is meant for testing and development purposes. This can be set to true.
	 *
	 * connectionOptions and additionalOptions will be ignored. Use pgliteAdditionalOptions to pass options to the pglite instance.
	 */
	usePgLiteOnServer?: boolean
	/**
	 * @experimental
	 *
	 * The folder to use for the local pglite database when usePgLiteOnServer is true.
	 *
	 * By default none is specified so the database will just be created in memory.
	 *
	 * @default undefined
	 */
	serverPgLiteDataDir?: string
	/**
	 * Server's migration config.
	 *
	 * migrationsFolder will get resolved by the module to be relative to nuxt's rootDir.
	 *
	 * @default { migrationsFolder: "~~/db/migrations" }
	 */
	serverMigrationConfig: MigrationConfig
	/**
	 * See usePgLiteOnServer for more info.
	 *
	 * @experimental
	 */
	serverPgliteOptions?: PGliteOptions
	/** postgres.js specific options. */
	serverPostgresjsOptions: Options<any>
	/**
	 * These should not need to be set here. These can be mostly set by env variables (except the password) and not through nuxt since drizzle also needs to be able to see them for migrations.
	 *
	 * Note they will get baked into the output unless you use NUXT_POSTGRES_CONNECTION_OPTIONS_ variables to override them.
	 */
	connectionOptions: Omit<ConnectionOptions, "password">
	/**
	 * Whether to automatically attempt to generate migrations in dev mode.
	 *
	 * @default false
	 */
	devAutoGenerateMigrations: boolean
}

export type ClientPostgresOptions = {

	/**
	 * Whether to use a web worker to run the client side database.
	 *
	 * Use the `webWorkerUrl` option to specify a custom script, see it for why you might need to and how to write the script.
	 *
	 * @default false
	 */
	useWebWorker: boolean
	/**
	 * The url to use for the web worker script (do `new URL("./worker.js", import.meta.url).toString())`.
	 *
	 * You will only need to create your own worker if you need to pass additional extensions to Pglite (most can only be configured from the web worker, only live can currently be set via options.extensions.live).
	 *
	 * Call Pglite as follows to get the module's options to be passed correctly:
	 *
	 * ```ts
	 * import { PGlite } from "@electric-sql/pglite"
	 * import { worker } from "@electric-sql/pglite/worker"
	 *
	 * void worker({
	 * 	async init(options) {
	 * 	const meta = options.meta
	 * 		return new PGlite(options.dataDir, meta.options)
	 * 	},
	 * })
	 * ```
	 *
	 * @default undefined
	 */
	webWorkerUrl?: string
	/**
	 * Whether to setup things for use with a client side PGlite database (e.g. migrations, exposes config via useRuntimeConfig().public.postgres). This will auto add `vite-plugin-wasm` if it doesn't already exist.
	 *
	 * @default false
	 */
	useClientDb: boolean

	/**
	 * Whether to generate a client migrations json file for use with the client side PGlite database.
	 *
	 * There also optionally a script you can use instead:
	 * ```ts
	 * node node_modules/@witchcraft/nuxt-postgres/src/runtime/build/createMigrationJson.js
	 * ```
	 *
	 * @default value of `useClientDb` option
	 */
	generateDrizzleClientMigrationsJson: boolean
	/**
	 * The drizzle migration config, but for the client side PGlite database. migrationsFolder will get resolved by the module to be relative to nuxt's rootDir.
	 *
	 * @default { migrationsFolder: "~~/db/client-migrations" }
	 */
	clientMigrationConfig: MigrationConfig
	/**
	 * Where to generate the migration json file if `generateClientMigrationsJson` is true.
	 *
	 * @default clientMigrationConfig.migrationsFolder + /clientMigrations.json
	 */
	clientMigrationJsonOutpath: string
	/**
	 * Whether to automatically migrate the client side db on first use of useClientDb().
	 *
	 * @default true
	 */
	autoMigrateClientDb: boolean
	clientPgliteOptions?: Omit<PGliteOptions, "dataDir" | "extensions" | "parsers" | "serializers">
}

declare module "@nuxt/schema" {
	interface RuntimeConfig {
		postgres: Omit<PostgresOptions, "connectionOptions"> & {
			connectionOptions: ConnectionOptions
		}
	}

	interface PublicRuntimeConfig {
		postgres: ClientPostgresOptions
	}
}

export interface ModuleOptions extends PostgresOptions, ClientPostgresOptions {
	/**
	 * Where the postgres instance is (no extension needed), to set the #postgres alias autimatically.
	 *
	 * Pass false to disable.
	 *
	 * @default ~~/server/postgres
	 */
	aliasServerImport: string | false
}

export default defineNuxtModule<ModuleOptions>({
	meta: {
		name: "postgres",
		configKey: "postgres"
	},
	defaults: {
		serverPostgresjsOptions: {
			max: 1
		},
		serverMigrationConfig: {
			migrationsFolder: "~~/db/migrations"
		},
		clientMigrationConfig: {
			migrationsFolder: "~~/db/client-migrations"
		},
		connectionOptions: {
			// during build these are undefined
			host: process.env.POSTGRES_HOST!,
			port: "POSTGRES_PORT" in process.env ? Number.parseInt(process.env.POSTGRES_PORT!, 10) : 5432,
			database: process.env.POSTGRES_NAME,
			username: process.env.POSTGRES_USER
		},
		generateDrizzleClientMigrationsJson: undefined as any as boolean,
		useClientDb: false,
		devAutoGenerateMigrations: false,
		autoMigrateClientDb: true,
		aliasServerImport: "~~/server/postgres"
	},
	async setup(options, nuxt) {
		const { resolve } = createResolver(import.meta.url)

		ensureEnv(process.env, [
			"POSTGRES_HOST",
			"POSTGRES_USER",
			"POSTGRES_NAME",
			"POSTGRES_PORT",
			"NUXT_POSTGRES_CONNECTION_OPTIONS_PASSWORD"
		] as const, process.env.DISABLE_POSTGRES_ENSURE_ENV === "true")

		const moduleName = "@witchcraft/nuxt-postgres"

		const logger = useLogger(moduleName)
		if (options.useClientDb && options.generateDrizzleClientMigrationsJson === undefined) {
			options.generateDrizzleClientMigrationsJson = true
		}

		nuxt.options.runtimeConfig.postgres = defu(
			nuxt.options.runtimeConfig.postgres as any,
			options,
			{
				connectionOptions: {
					...options.connectionOptions,
					password: ""
				}
			}
		)
		nuxt.options.nitro.esbuild ??= {}
		nuxt.options.nitro.esbuild.options ??= {}
		nuxt.options.nitro.esbuild.options.target ??= "es2022"

		const privateOptions = nuxt.options.runtimeConfig.postgres as any
		delete privateOptions.clientMigrationConfig
		delete privateOptions.useClientDb
		delete privateOptions.useWebWorker
		delete privateOptions.generateClientMigrationsJson

		const serverConfig = nuxt.options.runtimeConfig.postgres.serverMigrationConfig
		serverConfig.migrationsFolder = path.relative(nuxt.options.rootDir, resolveAlias(serverConfig.migrationsFolder, nuxt.options.alias))

		nuxt.options.build.transpile.push(resolve("runtime/server/plugins/initServerPostgresDb"))
		nuxt.options.build.transpile.push(resolve("runtime/server/postgres"))

		if (options.useClientDb) {
			nuxt.options.runtimeConfig.public.postgres = defu(
				nuxt.options.runtimeConfig.public.postgres as any,
				{
					clientMigrationConfig: options.clientMigrationConfig,
					autoMigrateClientDb: options.autoMigrateClientDb
				}
			)

			const config = nuxt.options.runtimeConfig.public.postgres
			const clientMigrationConfig = config.clientMigrationConfig
			clientMigrationConfig.migrationsFolder = path.relative(nuxt.options.rootDir, resolveAlias(clientMigrationConfig.migrationsFolder, nuxt.options.alias))

			if (options.generateDrizzleClientMigrationsJson) {
				// https://github.com/drizzle-team/drizzle-orm/discussions/2532#discussioncomment-10780523
				const clientMigrationJsonPath = options.clientMigrationJsonOutpath
					? resolveAlias(path.resolve(options.clientMigrationJsonOutpath), nuxt.options.alias)
					: resolveAlias(path.resolve(clientMigrationConfig.migrationsFolder, "clientMigration.json"), nuxt.options.alias)
				logger.info(`Generating client migrations json file at: ${clientMigrationJsonPath}`)

				const migrations = readMigrationFiles(clientMigrationConfig)

				if (!migrations.length) {
					logger.error(`No migrations found in: ${clientMigrationConfig.migrationsFolder}`)
				}
				await fs.writeFile(clientMigrationJsonPath, JSON.stringify(migrations))

				nuxt.hook("vite:extendConfig", conf => {
					// @ts-expect-error -- new type says it's readonly but also that it might be undefined :/
					conf.plugins ??= []
					let foundWasm = false
					let foundTopLevelAwait = false
					for (const plugin of conf.plugins) {
						if ((plugin as any).name === "vite-plugin-wasm") {
							foundWasm = true
						}
						if ((plugin as any).name === "vite-plugin-top-level-await") {
							foundTopLevelAwait = true
						}
					}
					if (!foundWasm) {
						conf.plugins.push(wasm())
					}
					if (!foundTopLevelAwait) {
						conf.plugins.push(topLevelAwait() as any)
					}
					const optimizeDeps = conf.optimizeDeps ?? {}
					const exclude = optimizeDeps.exclude ?? []
					exclude.push("@electric-sql/pglite")
				})
			}
		}
		addServerScanDir(resolve("runtime/server"))
		logger.info("plugged")
		addImportsDir(resolve("runtime/composables"))
		nuxt.options.alias["#postgres-client"] = resolve("runtime/composables/useClientDb")
		if (options.aliasServerImport) {
			nuxt.options.alias["#postgres"] = resolveAlias(options.aliasServerImport, nuxt.options.alias)
		}

		nuxt.hook("vite:extendConfig", config => {
			// https:// pglite.dev/docs/bundler-support#vite
			// @ts-expect-error - same as above
			config.optimizeDeps ??= {}
			config.optimizeDeps.exclude ??= []
			config.optimizeDeps.exclude.push("@electric-sql/pglite")
		})
	}
})
