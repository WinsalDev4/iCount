import type { Clock } from '../../../shared/application/clock.js';
import type { IdGenerator } from '../../../shared/application/id-generator.js';
import { Note, type NoteRepository } from '../domain/note.js';

export interface CreateNoteCommand {
  readonly text: string;
}

/** Use case = one application operation. Framework-free: wired in notes.module.ts. */
export class CreateNote {
  constructor(
    private readonly notes: NoteRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: CreateNoteCommand): Promise<Note> {
    const note = Note.create({
      id: this.ids.next(),
      text: command.text,
      createdAt: this.clock.now(),
    });
    await this.notes.save(note);
    return note;
  }
}
