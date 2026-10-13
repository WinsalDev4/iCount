import { z } from 'zod';

import { Note } from '../../domain/note.js';

/**
 * HTTP contract of the module. Real modules take these schemas from
 * @icount/contracts so the app validates exactly the same shapes.
 */
export const createNoteRequestSchema = z.strictObject({
  text: z.string().trim().min(1).max(Note.MAX_TEXT_LENGTH),
});

export const noteIdParamSchema = z.uuid();

export const noteResponseSchema = z.object({
  id: z.uuid(),
  text: z.string(),
  createdAt: z.iso.datetime(),
});

export type CreateNoteRequest = z.infer<typeof createNoteRequestSchema>;
export type NoteResponse = z.infer<typeof noteResponseSchema>;

export function toNoteResponse(note: Note): NoteResponse {
  return { id: note.id, text: note.text, createdAt: note.createdAt.toISOString() };
}
