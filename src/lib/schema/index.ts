/**
 * The content model.
 *
 * Every TypeScript type in here is inferred from a Zod schema, so the validator
 * that guards `content/` and the types the app compiles against can never drift
 * apart. Import types from here; never redeclare them.
 */
export * from './primitives.ts'
export * from './taxonomy.ts'
export * from './resource.ts'
export * from './path.ts'
export * from './project.ts'
export * from './glossary.ts'
