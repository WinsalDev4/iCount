import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';

import { ApiProblemResponses, zodToOpenApi } from '../../../../shared/interface/http/openapi.js';
import { ZodValidationPipe } from '../../../../shared/interface/http/zod-validation.pipe.js';
import { CreateNote } from '../../application/create-note.use-case.js';
import { GetNote } from '../../application/get-note.use-case.js';
import {
  type CreateNoteRequest,
  createNoteRequestSchema,
  noteIdParamSchema,
  type NoteResponse,
  noteResponseSchema,
  toNoteResponse,
} from './notes.dto.js';

/**
 * Thin adapter: validate input → call one use case → map to the response DTO.
 * Spring analogy: a @RestController that delegates to a @Service.
 */
@ApiTags('notes (template)')
@Controller('notes')
export class NotesController {
  constructor(
    private readonly createNote: CreateNote,
    private readonly getNote: GetNote,
  ) {}

  @Post()
  @ApiBody({ schema: zodToOpenApi(createNoteRequestSchema, 'input') })
  @ApiCreatedResponse({ schema: zodToOpenApi(noteResponseSchema) })
  @ApiProblemResponses(400, 422)
  async create(
    @Body(new ZodValidationPipe(createNoteRequestSchema)) body: CreateNoteRequest,
  ): Promise<NoteResponse> {
    return toNoteResponse(await this.createNote.execute(body));
  }

  @Get(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ schema: zodToOpenApi(noteResponseSchema) })
  @ApiProblemResponses(400, 404)
  async findOne(
    @Param('id', new ZodValidationPipe(noteIdParamSchema)) id: string,
  ): Promise<NoteResponse> {
    return toNoteResponse(await this.getNote.execute(id));
  }
}
