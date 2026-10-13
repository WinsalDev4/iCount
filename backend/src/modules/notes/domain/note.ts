import { InvalidNoteTextError } from './note.errors.js';

export type NoteId = string & { readonly __brand: 'NoteId' };

/**
 * Template entity. Pure TypeScript: no Nest, no Drizzle, no HTTP.
 * Invariants live here, so every way of creating a Note respects them.
 */
export class Note {
  static readonly MAX_TEXT_LENGTH = 500;

  private constructor(
    readonly id: NoteId,
    readonly text: string,
    readonly createdAt: Date,
  ) {}

  static create(props: { id: string; text: string; createdAt: Date }): Note {
    const text = props.text.trim();
    if (text.length === 0 || text.length > Note.MAX_TEXT_LENGTH) {
      throw new InvalidNoteTextError(Note.MAX_TEXT_LENGTH);
    }
    return new Note(props.id as NoteId, text, props.createdAt);
  }

  /** Rebuilds an already-validated note from persistence. */
  static restore(props: { id: string; text: string; createdAt: Date }): Note {
    return new Note(props.id as NoteId, props.text, props.createdAt);
  }
}

/** Port (Dependency Inversion): implemented in infrastructure, injected by Nest. */
export abstract class NoteRepository {
  abstract save(note: Note): Promise<void>;
  abstract findById(id: NoteId): Promise<Note | null>;
}
