import type { Note, NoteId, NoteRepository } from '../domain/note.js';
import { NoteNotFoundError } from '../domain/note.errors.js';

export class GetNote {
  constructor(private readonly notes: NoteRepository) {}

  async execute(id: string): Promise<Note> {
    const note = await this.notes.findById(id as NoteId);
    if (!note) throw new NoteNotFoundError(id);
    return note;
  }
}
