import { last, unreachable } from "@alanscodelog/utils"
import { PGlite, type PGliteOptions } from "@electric-sql/pglite"
import { PGliteWorker } from "@electric-sql/pglite/worker"
import type { BaseLogger } from "@witchcraft/nuxt-logger/shared/createUseLogger"
import { drizzle as drizzleProxy, type PgRemoteDatabase } from "drizzle-orm/pg-proxy"
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite"
import { sql } from "drizzle-orm/sql"
import type { Storage } from "unstorage"
import { createStorage } from "unstorage"
import localStorageDriver from "unstorage/drivers/localstorage"
import { z } from "zod"

import type { ClientPostgresOptions } from "../../module.js"

export const zMigrationJson = z.array(z.object({
	sql: z.array(z.string()),
	bps: z.boolean(),
	folderMillis: z.number(),
	hash: z.string()
}))

export type MigrationJson = z.infer<typeof zMigrationJson>
export type MigrationOptions = {
	/**
	 * This is type checked by zod, but doesn't prevent the sql statements from being invalid, etc.
	 */
	migrationJson?: MigrationJson
	/**
	 * A script to run before migrations. For example, to make sure an extension is installed on initialization.
	 *
	 *
	 * Note that it will not run if the function determines migrations are up to date.
	 */
	preMigrationScript?: string
	/**
	 * Force migration to run, skip checks to skip migrations.
	 */
	force?: boolean
	/**
	 * The key to use for storing the last migration hash in storage.
	 *
	 * @default "db:lastMigrationHash:[NAME(if provided)]"
	 */
	storageMigrationHashKey?: string
	/**
	 * The unstorage storage to use for storing the last migration hash. If you privided it while setting up the database, there's no need to provide it again.
	 *
	 * @default window.localStorage if available, otherwise none
	 */
	storage?: Storage<any> | undefined
	migrationsLogger?: BaseLogger
}

export type ClientMigrationState = {
	attemptedMigration: boolean
	skip: boolean
	storage?: Storage<any>
}
type AllOptions = Partial<Omit<ClientPostgresOptions, "clientMigrationConfig"> & {
	clientMigrationOptions: MigrationOptions
	clientPgliteOptions: ClientPostgresOptions["clientPgliteOptions"] & {
		extensions?: PGliteOptions["extensions"]
	}
	/** Custom proxy function, in this case a drizzleProxy is created instead of a client, and the database manager passes a wrapper so you can also get the name of the database you're proxying to, the rest of the params are just like the ones in the drizzle proxy docs. */
	drizzleProxy: (name: string, sql: string, params: any[], method: "all" | "run" | "get" | "values") => Promise<any>
	/** The schema to use for the client side database. This must be defined unless a proxy is being used. */
	schema?: any
}>
type InitOptions = {
	bypassEnvCheck?: boolean
	addToWindowInDev?: boolean
	logger?: {
		info: (...args: any[]) => void
		error: (...args: any[]) => void
		debug: (...args: any[]) => void
	}
}
export type ClientDatabaseEntry = {
	client?: PGlite | PGliteWorker
	db: PgliteDatabase | PgRemoteDatabase
	migrationState: ClientMigrationState
	path?: string
	options: AllOptions
	initOptions: InitOptions
}

export class ClientDatabaseManager {
	databases: Map<string, ClientDatabaseEntry> = new Map()

	static defaultMigrationState: ClientMigrationState = {
		attemptedMigration: false,
		skip: false
	}

	defaultDatabaseName = "client"

	init(
		name: string,
		opts: AllOptions = {},
		initOptions: InitOptions = {}
	): ClientDatabaseEntry | undefined {
		const exists = this.databases.has(name)
		if (!exists) {
			if (!opts) {
				throw new Error("No config or client passed to useClientDb. Config/client must be passed at least once for each database name.")
			}

			const clientPgliteOptions = opts.clientPgliteOptions ?? {}
			if (opts.useWebWorker && clientPgliteOptions.extensions) {
				const unsupported = Object.keys(clientPgliteOptions.extensions).filter(_ => _ !== "live")
				if (unsupported.length) {
					throw new Error(`clientPgliteOptions.extensions contains unsupported extensions, if you need these, you'll need to create a custom worker, see options.webWorkerUrl.\nUnsupported: ${unsupported.join(", ")}`)
				}
			}
			if (!opts.schema && !opts.drizzleProxy) {
				// eslint-disable-next-line no-console
				console.warn("No schema for a client side database was provided. This is not recommended. Drizzle will not be able to do db.query type queries. Schema can only safely not be defined if using drizzleProxy (as it would be defined on the real instance).")
			}

			const client = opts.drizzleProxy
				? undefined
				: (opts.useWebWorker
						? new PGliteWorker(
							new Worker(opts.webWorkerUrl ?? new URL("./../worker.js", import.meta.url), { type: "module" }),
							{
								dataDir: opts.clientPgLitePath ?? `idb:// ${name}`,
								meta: { options: clientPgliteOptions }
								// extensions
							}
						)
						: new PGlite(opts.clientPgLitePath ?? `idb://${name}`, clientPgliteOptions))

			const migrationOptions = opts.clientMigrationOptions ?? {}

			const entry = {
				options: opts,
				initOptions,
				client,
				db: opts.drizzleProxy
					? drizzleProxy(async (...params: [any, any, any]) => opts.drizzleProxy!(name, ...params))
					: drizzle({ client: client as any, schema: opts.schema }),
				migrationState: {
					...ClientDatabaseManager.defaultMigrationState,
					storage: migrationOptions.storage ?? ClientDatabaseManager.useDefaultStorage()
				},
				path: opts?.clientPgLitePath ?? `idb://${name}`

			}
			this.databases.set(name, entry)
			return entry
		}
		return this.databases.get(name)
	}

	switchDatabase(name: string) {
		this.getEntry(name, { errorIfNotFound: true })
		this.defaultDatabaseName = name
	}

	getEntry(name: string, { errorIfNotFound = true } = {}): ClientDatabaseEntry | undefined {
		const entry = this.databases.get(name)
		if (errorIfNotFound && !entry) {
			throw new Error(`No database found by the name of ${name}.`)
		}
		return entry
	}

	deleteEntry(name: string, { errorIfNotFound = true } = {}): void {
		const entry = this.databases.get(name)
		if (errorIfNotFound && !entry) {
			throw new Error(`No database found by the name of ${name}.`)
		}
		this.databases.delete(name)
	}

	getDb(name: string, { errorIfNotFound = true } = {}): ClientDatabaseEntry["db"] | undefined {
		return this.getEntry(name, { errorIfNotFound })?.db
	}

	async useRawClientDb(
		name: string = this.defaultDatabaseName
	): Promise<PGlite | PGliteWorker | undefined> {
		const entry = this.getEntry(name, { errorIfNotFound: true })!
		return entry.client
	}

	/**
	 * Deletes the client database from the global client database manager and reinits it with the same options. This assumes the ACTUAL db was already deleted (either via deleteIndexedDbDb or other methods).
	 */
	async reinitClientDb(
		name: string = this.defaultDatabaseName
	): Promise<void> {
		const entry = this.getEntry(name, { errorIfNotFound: true })!

		this.deleteEntry(name, { errorIfNotFound: false })
		await this.useClientDb(name, entry.options, entry.initOptions)
	}

	async useClientDb(
		name: string = this.defaultDatabaseName,
		opts: AllOptions = {},
		{
			bypassEnvCheck = false,
			addToWindowInDev = true,
			logger = typeof console !== "undefined" ? console as any : {}
		}: InitOptions = {}
	): Promise<PgliteDatabase | PgRemoteDatabase> {
		if (!bypassEnvCheck && !import.meta.client) {
			return {} as any
		}

		const entry = this.init(name, opts)
		const conf = opts ?? entry?.options ?? {}
		if (!entry || !conf) unreachable()
		if (addToWindowInDev) {
			if (bypassEnvCheck || (import.meta.dev && import.meta.client)) {
				window.dbs ??= {}
				window.sql = sql
				window.dbs[name] = entry
				window.quickSql = (query: TemplateStringsArray, ...params: any[]) => {
					const q = sql(query, ...params)
					void entry.db.execute(q).then((res: any) => {
						// eslint-disable-next-line no-console
						console.log(res)
					})
				}
			}
		}
		const migrationOpts = opts.clientMigrationOptions ?? {}
		if (conf.autoMigrateClientDb && migrationOpts.migrationJson) {
			await ClientDatabaseManager.migrate(entry.db, opts.clientMigrationOptions ?? {}, entry.migrationState, name)
		} else if (!entry.migrationState.skip) {
			logger.debug({
				ns: "postgres:client:migrate:skip",
				msg: "Skipping migration because no migrationJson passed or autoMigrateClientDb is false.",
				migrationJson: !!migrationOpts.migrationJson,
				autoMigrateClientDb: conf.autoMigrateClientDb
			})
			entry.migrationState.skip = true
		}
		return entry.db
	}

	static useDefaultStorage(): Storage<any> | undefined {
		if (typeof window !== "undefined") {
			return createStorage({
				driver: localStorageDriver({})
			})
		}
		return undefined
	}

	/**
	 * Deletes indexedDB databases and any stored migration state. Note that this won't take proper effect until the user navigates away from the page if the request gets blocked.
	 *
	 * PGlite does not have a close method yet, see [pglite#142](https://github.com/electric-sql/pglite/issues/142).
	 *
	 * This is a hackish solution and is only meant to work before page navigation as something is causing issues and not letting the db be deleted. See code.
	 */
	async deleteIndexedDbDb(
		name: string = this.defaultDatabaseName
	): Promise<boolean> {
		const entry = this.getEntry(name, { errorIfNotFound: true })!

		if (entry.migrationState.storage) {
			await entry.migrationState.storage.removeItem(`db:lastMigrationHash:${name}`)
		}
		const db = entry.client
		if (!db) throw new Error("No client found. deleteIndexedDbDb can only be used with a client side, non-electron db.")
		if (!entry.path?.startsWith("idb://")) throw new Error("Not an indexedDB database.")
		const dbPath = `/pglite/${entry.path.slice("idb://".length)}`

		if (!db.closed) await db.close()
		return new Promise<boolean>((resolve, reject) => {
			const req = indexedDB.deleteDatabase(dbPath)

			req.onsuccess = () => { resolve(true) }

			req.onerror = () => {
				reject(req.error ?? "An unknown error occurred.")
			}

			req.onblocked = () => {
				// this will delete it anyways when the user is navigated away
				// retrying here seems to never call any of the handlers again :/
				resolve(true)
			}
		})
	}

	static async migrate(
		db: PgliteDatabase | PgRemoteDatabase,
		opts: MigrationOptions,
		/** State will be mutated by the function. */
		state: Partial<ClientMigrationState> = {},
		name?: string
	): Promise<void> {
		opts.storage ??= ClientDatabaseManager.useDefaultStorage()
		const {
			migrationJson,
			preMigrationScript,
			force,
			storageMigrationHashKey = "db:lastMigrationHash",
			migrationsLogger = console,
			storage = undefined
		} = opts

		if (!state.attemptedMigration && !force) {
			try {
				const start = performance.now()
				migrationsLogger.debug({
					ns: "postgres:pglite:migrate:start"
				})

				const migration = zMigrationJson.parse(migrationJson)
				const lastItem = last(migration)

				const lastMigrationHash = !force && await storage?.getItem(storageMigrationHashKey + (name ? `:${name}` : ""))

				if (!force && lastItem.hash === lastMigrationHash && !state.skip) {
					migrationsLogger.debug({
						ns: "postgres:pglite:migrate:skip",
						msg: "Skipping migration because hash in storage matches migrationJson hash.",
						hash: lastItem.hash,
						opts
					})
					state.attemptedMigration = true
					state.skip = true
				}

				if (!state.skip) {
					if (preMigrationScript) {
						await (db as any).dialect.exec(preMigrationScript)
					}
					switch (db.constructor.name) {
						case "PgliteDatabase":
							await (db as any).dialect.migrate(migrationJson, (db as any).session, { })
							break
						case "PgRemoteDatabase":
							throw new Error("Migrations don't work with a proxy, migration must be done at the proxy target.")
						default:
							throw new Error(`Unsupported migration client: ${db.constructor.name}`)
					}
					// console.log(db.dialect)
					await storage?.setItem(storageMigrationHashKey, lastItem.hash)
				}

				migrationsLogger.debug({
					ns: "postgres:pglite:migrate:end",
					hash: lastItem.hash,
					duration: performance.now() - start
				})
			} catch (error) {
				if (!(error instanceof Error)) { throw error }
				migrationsLogger.error({
					ns: "postgres:pglite:migrate:error",
					error: { message: error.message, stack: error.stack, opts }
				})
				throw error
			}
			state.attemptedMigration = true
		}
	}
}

declare global {

	interface Window {
		/** Defined by useClientDb when import.meta.client and import.meta.dev are true. */
		dbs: Record<string, ClientDatabaseEntry>
		/** Defined by useClientDb when import.meta.client and import.meta.dev are true. */
		sql?: typeof sql
		/**
		 * Executes the given query and logs the result.
		 *
		 * ```ts
		 * quickSql(`select * from users`)
		 * ```
		 *
		 * Defined by useClientDb when import.meta.client and import.meta.dev are true.
		 */
		quickSql?: (query: TemplateStringsArray, ...params: any[]) => void
	}
}
