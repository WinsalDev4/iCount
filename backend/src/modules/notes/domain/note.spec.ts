import { Note } from './note.js';
import { InvalidNoteTextError } from './note.errors.js';

const createdAt = new Date('2026-10-13T10:00:00Z');

describe('Note', () => {
  it('trims the text', () => {
    expect(Note.create({ id: 'n1', text: '  pagar luz  ', createdAt }).text).toBe('pagar luz');
  });

  it.each(['', '   ', 'x'.repeat(Note.MAX_TEXT_LENGTH + 1)])('rejects invalid text %#', (text) => {
    expect(() => Note.create({ id: 'n1', text, createdAt })).toThrow(InvalidNoteTextError);
  });

  it('accepts text at the maximum length', () => {
    const text = 'x'.repeat(Note.MAX_TEXT_LENGTH);
    expect(Note.create({ id: 'n1', text, createdAt }).text).toHaveLength(Note.MAX_TEXT_LENGTH);
  });
});
