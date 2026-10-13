/** Cursor pagination, independent of HTTP (mirrors `Page` in @icount/contracts). */
export interface PageRequest {
  /** Opaque: pass back the `nextCursor` of the previous page; omit for the first one. */
  readonly cursor?: string;
  readonly limit?: number;
}

export interface Page<Item> {
  readonly items: readonly Item[];
  /** `null` on the last page. */
  readonly nextCursor: string | null;
}
