import { Clock } from '../../../shared/application/clock.js';
import { IdGenerator } from '../../../shared/application/id-generator.js';
import { type Note, type NoteId, NoteRepository } from '../domain/note.js';
import { InvalidNoteTextError, NoteNotFoundError } from '../domain/note.errors.js';
import { CreateNote } from './create-note.use-case.js';
import { GetNote } from './get-note.use-case.js';

class InMemoryNoteRepository extends NoteRepository {
  readonly notes = new Map<NoteId, Note>();

  async save(note: Note): Promise<void> {
    this.notes.set(note.id, note);
  }

  async findById(id: NoteId): Promise<Note | null> {
    return this.notes.get(id) ?? null;
  }
}

const now = new Date('2026-10-13T10:00:00Z');
const fixedClock: Clock = { now: () => now };
const fixedIds: IdGenerator = { next: () => 'note-1' };

describe('notes use cases', () => {
  let repository: InMemoryNoteRepository;

  beforeEach(() => {
    repository = new InMemoryNoteRepository();
  });

  it('creates and stores a note with the injected id and clock', async () => {
    const note = await new CreateNote(repository, fixedClock, fixedIds).execute({ text: 'hola' });

    expect(note).toMatchObject({ id: 'note-1', text: 'hola', createdAt: now });
    expect(repository.notes.get(note.id)).toBe(note);
  });

  it('does not store invalid notes', async () => {
    const create = new CreateNote(repository, fixedClock, fixedIds).execute({ text: ' ' });

    await expect(create).rejects.toThrow(InvalidNoteTextError);
    expect(repository.notes.size).toBe(0);
  });

  it('gets an existing note and fails with a domain error otherwise', async () => {
    const created = await new CreateNote(repository, fixedClock, fixedIds).execute({
      text: 'hola',
    });
    const getNote = new GetNote(repository);

    await expect(getNote.execute(created.id)).resolves.toBe(created);
    await expect(getNote.execute('missing')).rejects.toThrow(NoteNotFoundError);
  });
});
