export interface Register {
}

export type LocalPgDbTypes = Register extends {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	ExtendedLocalPgDbTypes: infer T extends Record<string, Record<string, any>>
} ? T : unknown

