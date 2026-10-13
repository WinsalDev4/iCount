import { DomainError } from '../../../shared/domain/domain-error.js';

export class InvalidNoteTextError extends DomainError {
  readonly kind = 'invalid';
  readonly code = 'invalid-note-text';
  readonly title = 'Invalid note text';

  constructor(maxLength: number) {
    super(`A note needs between 1 and ${maxLength} characters.`);
  }
}

export class NoteNotFoundError extends DomainError {
  readonly kind = 'not_found';
  readonly code = 'note-not-found';
  readonly title = 'Note not found';

  constructor(id: string) {
    super(`Note ${id} does not exist.`);
  }
}
