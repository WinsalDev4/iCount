/**
 * Branded identifiers shared across features: at runtime they are plain strings,
 * but the compiler will not accept a HouseholdId where a UserId is expected.
 * Kotlin analogy: `@JvmInline value class UserId(val value: String)`.
 */
export type UserId = string & { readonly __brand: 'UserId' };
export type HouseholdId = string & { readonly __brand: 'HouseholdId' };
