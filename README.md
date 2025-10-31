# @witchcraft/nuxt-postgres

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Nuxt module to connect to postgres with drizzle. Also has support for having a client [PGlite](https://pglite.dev/) db and a server pglite instance for testing.

# Setup

The playground contains this basic setup (note it will NOT work on stackblitz because you need to be running postgres and we can't do that).

- [🏀 Online playground](https://stackblitz.com/github/witchcraftjs/nuxt-postgres?file=playground%2Fapp.vue)
```ts
// nuxt.config.ts
export default defineNuxtConfig({
	modules: [
		"@witchcraft/nuxt-postgres",
		"@witchcraft/nuxt-logger" // optional
	],
	alias: {
		// add alias to where db will be
		// this one is auto created (see aliasServerImport option)
		// "#postgres": fileURLToPath(new URL("server/postgres.js", import.meta.url))
	},
	postgres: {
		connectionsOptions: {
			...
		},
	}
})
```

Set you the password by setting the env `NUXT_POSTGRES_CONNECTION_OPTIONS_PASSWORD`.


Use the included drizzle config if you want, it will ensure you define the right variables:

```ts [drizzleConfig.ts]
//@ts-expect-error careful with imports, esm is borked, see nuxt-postgres/src/drizzleConfig.ts
import { drizzleConfig } from "@witchcraft/nuxt-postgres/drizzleConfig.js"
import { ensureEnv } from "@witchcraft/nuxt-utils/utils/ensureEnv"
import { defineConfig } from "drizzle-kit"
import path from "path"

// you can ensure futher env vars here
ensureEnv(process.env, [
	"ROOT_DIR",
] as const)

export default defineConfig({
	...drizzleConfig,
	schema: path.resolve(process.env.ROOT_DIR, "db/schema.ts"),
	// change if you changed it
	// out: "./db/migrations",
})
```
Setup the database:
```ts [server/postgres.ts]
import {
	createPostgresDb,
	useServerLogger // from @witchcraft/nuxt-logger
} from "#imports"
import * as schema from "~~/db/schema.js"

export const {
	migrate,
	postgres
} = createPostgresDb(schema, useServerLogger)
```

Setup $postgres on event and optionally migrate the db when starting the server:

```ts [server/plugins/init.ts]
import { defineNitroPlugin } from "#imports"
import { migrate, postgres } from "../path/to/instance/or#postgres"

// here or in some global types file
import { PgliteDatabase } from "drizzle-orm/pglite"
import { PostgresJsDatabase } from "drizzle-orm/postgres-js"
import * as schema from "~~/db/schema.js"
declare module 'h3' {
	interface H3EventContext {
		${options.eventContextKeyName}: PgliteDatabase<typeof schema> | PostgresJsDatabase<typeof schema>;
	}
}
export {}


export default defineNitroPlugin((nitroApp) => {
	nitroApp.hooks.hook("request", event => {
		event.context.$postgres = postgres
	})

	// there's no way to await this yet
	// see https://github.com/nitrojs/nitro/issues/915
	void migrate({
		// initialization script
		// e.g. create extensions 
		preMigrationScript: `CREATE EXTENSION IF NOT EXISTS pg_uuidv7;`
	})
})
```

```ts
// in api handler

export default defineEventHandler(async event => {
	const pg = event.context.$postgres
})
	
// or using the alias
import { postgres } from "#postgres"
```

## Local Postgres Client

The module also supports having a local postgres client using PGlite, just enable the `postgres.useClientDb` option.

Then define a `db/client-schema.ts` file and create a `drizzle-client.config.ts` file in the root of your project (there is an equivelant `clientDrizzleConfig` you can import like above).

Modify the package.json scripts:

```json
{
	"scripts": {
		"db:generate": "drizzle-kit generate && drizzle-kit generate --config drizzle-client.config.ts",
		"db:migrate": "drizzle-kit migrate",
	}
}
```
Migrate does not have a client equivalent. The module handles migrations by generating a `clientMigration.json` file which you can then import. 

Now you can use your client side db.

```ts
import * as schema from "~~/db/client-schema.ts"

// note that db is only defined if import.meta.client is true

const db = await useClientDb("client", 
// options only required on the first use
{
	
	// module client postgres options
	schema,
	// the composable does not use runtime config directly
	// is so that it can also be used where nuxt isn't available
	...useRuntimeConfig().public.postgres,
	clientMigrationOptions: {
		migrationJson: (await import("~~/db/client-migrations/clientMigration.json")).default,
		migrationsLogger: useLogger(),
	},
	clientPgliteOptions: {
		// additional pglite options
	}
}, {
	// clientDatabaseManager options
})
await db?.query(...)
// somewhere else

const db = useClientDb(/*"client" by default*/)
// if your db is not named "client", you must use useSwitchDefaultDatabase to have the default useDb use that instance
useSwitchDefaultDatabase("myDb")
const db = useClientDb(/* now "myDb"*/)


// useClientDb also adds window.db and window.sql in dev mode
// for easier debugging
await window.dbs.client?.query(...)
await window.dbs.custom_name?.query(...)
```

By default, the module will automatically migrate the client side db on first use of `useClientDb` if `migrationsJson` is passed, hence the await on `useClientDb`.

To disable this, just don't pass `migrationsJson` to `useClientDb`.

You will then need to migrate manually and make sure nothing tries to use the db before then or that your app can handled the db schema being out of date or non-existent:

```ts
import {migrate} from "#postgres-client"

// only migrate on the client
if (import.meta.client) {
	// careful, you can't use useRuntimeConfig().public.postgres.clientMigrationConfig.migrationJsonPath here
	const migrationjson = (await import("~~/db/client-migrations/clientMigration.json")).default
	await migrate({
		migrationjson
	})
}
const db = useClientDb("client")
```

The local database is not completely typed (with a schema). To properly type it you will need to add in some global type file:

```ts
import * as schema from "~~/db/client-schema.ts"
declare module "#witchcraft/nuxt-postgres/types.js" {
	export interface Register {
		ExtendedLocalPgDbTypes: {
			"client": typeof schema
		}
	}
}
export {}


```

There are several things to keep in mind when using the client side db:

- While the resolved migrationJson location is added to the public runtime config, it cannot be used to import it dynamically since dynamic imports don't work with variables.
- **The client options are exposed to the public runtime config.** There is no such thing as the private runtimeConfig client side.
- `migrate` will try to skip migrations if at all possible. Doing a drizzle migration, even if nothing needs to be done, is expensive (~1500ms), so `migrate` stores a localstorage key `db:lastMigrationHash:[NAME (if  provided)]` (configurable) to prevent unnecessary calls to drizzle's migrate. If the database is configured to use indexedDb, it exists, and the last known hash matches the last migration hash, migration is skipped, reducing the time for non-migrations to around 4-5ms. 

## Using a Local Server Database for Testing

You can change to use an in-memory pglite database by setting `usePgLiteOnServer` to `true`. You can make it local by specifying `serverPgLiteDataDir`.

## Usage in Other Contexts

The client db can be used in electron or other contexts that support it. You will probably need to specify some options differently for those environments:



Electron example using [@witchcraft/nuxt-electron](TODO):
```ts
const db = await useClientDb("NAME", {
	schema,
	clientMigrationOptions: {
		migrationJson,
		migrationsLogger: useElectronLogger(),
	},
	...STATIC.ELECTRON_RUNTIME_CONFIG.postgres,
	// we need to override the filepath so it can write to disk
	clientPgLitePath: (name) => path.join(userDataDir, `${name}.pglite`),
}, {
	logger: useElectronLogger(),
	// import.meta.client is not defined
	bypassEnvCheck: true,
	// there is no window in main
	addToWindowInDev: false,
}

```

### Proxying to Other Contexts

You can use a proxy instead of the default client with the `drizzleProxy` option.

You must do migrations from electron's main, the proxy has issues with migrations, could not get them to work regardless of migrator used.

```ts
await useClientDb("client", {
	...useRuntimeConfig().public.postgres,
	useWebWorker: false,
	...(isElectron()
		? {}
		: {
				autoMigrateClientDb: useRuntimeConfig().public.postgres.autoMigrateClientDb,
				clientMigrationOptions: {
					migrationsLogger: useLogger(),
					migrationJson: (await import("~~/db/client-migrations/clientMigration.json")).default
				}
			}),
	drizzleProxy: isElectron()
		? async (name: string, sql: string, params: any[], method: "all" | "run" | "get" | "values") => {
			// however you choose to proxy it
			const res = await window.electron.api.db(name, sql, params, method)
			return res
			}
		: undefined
})
```

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/@witchcraft/nuxt-postgres/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/@witchcraft/nuxt-postgres

[npm-downloads-src]: https://img.shields.io/npm/dm/@witchcraft/nuxt-postgres.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npmjs.com/package/@witchcraft/nuxt-postgres

[license-src]: https://img.shields.io/npm/l/@witchcraft/nuxt-postgres.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/@witchcraft/nuxt-postgres

[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com

