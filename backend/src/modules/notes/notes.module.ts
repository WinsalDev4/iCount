import { Module } from '@nestjs/common';

import { Clock } from '../../shared/application/clock.js';
import { IdGenerator } from '../../shared/application/id-generator.js';
import { CreateNote } from './application/create-note.use-case.js';
import { GetNote } from './application/get-note.use-case.js';
import { NoteRepository } from './domain/note.js';
import { DrizzleNoteRepository } from './infrastructure/persistence/drizzle-note.repository.js';
import { NotesController } from './interface/http/notes.controller.js';

/**
 * TEMPLATE MODULE (see docs/backend/arquitectura.md). Copy its layout for new
 * bounded contexts. It is not mounted in production (see AppModule).
 *
 * Composition: port → adapter, and framework-free use cases built with
 * factories (Spring analogy: @Bean methods in a @Configuration class).
 */
@Module({
  controllers: [NotesController],
  providers: [
    { provide: NoteRepository, useClass: DrizzleNoteRepository },
    {
      provide: CreateNote,
      inject: [NoteRepository, Clock, IdGenerator],
      useFactory: (notes: NoteRepository, clock: Clock, ids: IdGenerator) =>
        new CreateNote(notes, clock, ids),
    },
    {
      provide: GetNote,
      inject: [NoteRepository],
      useFactory: (notes: NoteRepository) => new GetNote(notes),
    },
  ],
})
export class NotesModule {}
