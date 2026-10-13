import { Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DATABASE, type Database } from '../../../../shared/database/database.tokens.js';
import { Note, type NoteId, NoteRepository } from '../../domain/note.js';
import { type NoteRow, notesTable } from './notes.schema.js';

/** Adapter: maps rows ↔ domain entities. Nothing outside infrastructure sees a row. */
export class DrizzleNoteRepository extends NoteRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {
    super();
  }

  async save(note: Note): Promise<void> {
    await this.db
      .insert(notesTable)
      .values({ id: note.id, text: note.text, createdAt: note.createdAt })
      .onConflictDoUpdate({ target: notesTable.id, set: { text: note.text } });
  }

  async findById(id: NoteId): Promise<Note | null> {
    const [row] = await this.db.select().from(notesTable).where(eq(notesTable.id, id)).limit(1);
    return row ? toDomain(row) : null;
  }
}

function toDomain(row: NoteRow): Note {
  return Note.restore({ id: row.id, text: row.text, createdAt: row.createdAt });
}
