import { run } from "@alanscodelog/utils/run"
import { PGlite } from "@electric-sql/pglite"
import type { BaseLogger } from "@witchcraft/nuxt-logger/shared/createUseLogger"
import { readMigrationFiles } from "drizzle-orm/migrator"
import { drizzle as drizzlePgLite, type PgliteDatabase } from "drizzle-orm/pglite"
import { migrate as drizzleMigratePglite } from "drizzle-orm/pglite/migrator"
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import { migrate as drizzleMigratePostgresJs } from "drizzle-orm/postgres-js/migrator"
import type { RuntimeConfig } from "nuxt/schema"
import pg from "postgres"
import { createStorage } from "unstorage"
import memoryDriver from "unstorage/drivers/memory"

import { useRuntimeConfig } from "#imports"

import { migrate as migrateLocal } from "../../shared/migrate.js"


/**
 * Creates the server database as configured by useRuntimeConfig by default.
 *
 * Returns the database, a migration function, and memoryStorage (where we store migration state).
 */
export function createPostgresDb(
	schema: Record<string, unknown>,
	logger: BaseLogger = console as any,
	config: RuntimeConfig["postgres"] = useRuntimeConfig().postgres
) {
	const memoryStorage = createStorage({
		driver: memoryDriver()
	})

	const useLocal = config.usePgLiteOnServer === true

	logger.info?.({
		ns: "postgres:init",
		usingLocal: useLocal ? "true" : "false"
	})

	const state = {
		attemptedMigration: false,
		skip: false
	}

	const postgresClient
		= useLocal
			? new PGlite(config.serverPgLiteDataDir ?? "memory://pg", config.serverPgliteOptions ?? {})
			: pg("", {
					...config.connectionOptions,
					ssl: true,
					...config.serverPostgresjsOptions
				})

	const postgres = useLocal
		? drizzlePgLite({ client: postgresClient as any, schema })
		: drizzle({ client: postgresClient as any, schema })

	const migrate = async (
		{
			generateMigration = false,
			preMigrationScript
		}: {
		/** Force generate migrations. See also the `devAutoGenerateMigrations` module option. */
			generateMigration?: boolean
			/** A script to run before migrations. For example, to make sure an extension is installed on initialization. */
			preMigrationScript?: string
		} = {}
	): Promise<void> => {
		if (preMigrationScript) {
		// using the regular drizzle client
		// because they try to analyze/build the query
		// unsafe/exec will send the script as is
		// todo properly type
			await (useLocal
				? (postgresClient as any).exec(preMigrationScript)
				: (postgresClient as any).unsafe(preMigrationScript))
				.catch((e: Error) => logger.error?.({ ns: "postgres:migrate:pre-migration", error: e }))
		}

		if (generateMigration || config.devAutoGenerateMigrations) {
			await run(`pnpm drizzle-kit generate`).promise
		}

		if (!state.attemptedMigration) {
			const migrationClient = useLocal
				? drizzlePgLite(postgresClient as any)
				: drizzle(postgresClient as any)
			try {
				const start = performance.now()
				logger.info?.({
					ns: "postgres:migrate:start",
					useLocal,
					serverConfig: config.serverMigrationConfig
				})

				if (useLocal) {
					const folder = config.serverMigrationConfig.migrationsFolder
					const migrationJson = readMigrationFiles({
						migrationsFolder: folder
					})
					logger.info?.({
						ns: "postgres:migrate:local",
						migrationJson,
						preMigrationScript
					})
					await migrateLocal(migrationClient as PgliteDatabase, {
						migrationJson,
						// we already did it above
						preMigrationScript: undefined,
						migrationsLogger: logger,
						storage: memoryStorage
					}, state)
				} else {
					switch (migrationClient.constructor.name) {
						case "PostgresJsDatabase":
							await drizzleMigratePostgresJs(migrationClient as PostgresJsDatabase, config.serverMigrationConfig)
							break
						case "PgliteDatabase":
							await drizzleMigratePglite(migrationClient as PgliteDatabase, config.serverMigrationConfig)
							break
						default:
							throw new Error(`Unsupported migration client: ${migrationClient.constructor.name}`)
					}
				}
				logger.info?.({
					ns: "postgres:migrate:end",
					duration: performance.now() - start
				})
			} catch (error) {
				if (!(error instanceof Error)) { throw error }
				logger.error?.({
					ns: "postgres:migrate:error",
					error: { message: error.message, stack: error.stack }
				})
			}
			state.attemptedMigration = true
		}
	}
	return {
		migrate, postgres, memoryStorage
	}
}
