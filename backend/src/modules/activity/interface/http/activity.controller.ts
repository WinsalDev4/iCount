import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  type ActivityItemDto,
  activityItemDtoSchema,
  type ActivityPage,
  activityPageSchema,
  type ActivityQuery,
  activityQuerySchema,
  type ApprovalDecisionRequest,
  approvalDecisionRequestSchema,
  type CommentDto,
  commentDtoSchema,
  type CreateCommentRequest,
  createCommentRequestSchema,
} from '@icount/contracts';
import { z } from 'zod';

import type { AuthenticatedUser } from '../../../../shared/auth/authenticated-user.js';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator.js';
import { ApiProblemResponses, zodToOpenApi } from '../../../../shared/interface/http/openapi.js';
import { ZodValidationPipe } from '../../../../shared/interface/http/zod-validation.pipe.js';
import {
  AddComment,
  DecideOnTransaction,
  ListActivity,
  ListComments,
} from '../../application/activity.use-cases.js';
import type { ActivityItem, Comment } from '../../domain/activity.js';

const uuidParam = new ZodValidationPipe(z.uuid());

@ApiTags('activity')
@ApiBearerAuth()
@Controller()
export class ActivityController {
  constructor(
    private readonly listActivity: ListActivity,
    private readonly decideOnTransaction: DecideOnTransaction,
    private readonly listComments: ListComments,
    private readonly addComment: AddComment,
  ) {}

  @Get('households/:householdId/activity')
  @ApiOkResponse({ schema: zodToOpenApi(activityPageSchema) })
  @ApiProblemResponses(400, 401, 404)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', uuidParam) householdId: string,
    @Query(new ZodValidationPipe(activityQuerySchema)) query: ActivityQuery,
  ): Promise<ActivityPage> {
    const page = await this.listActivity.execute(user.userId, householdId, query.filter, {
      cursor: query.cursor,
      limit: query.limit,
    });
    return { items: page.items.map(toActivityItemDto), nextCursor: page.nextCursor };
  }

  @Post('transactions/:id/approval')
  @HttpCode(HttpStatus.OK)
  @ApiBody({ schema: zodToOpenApi(approvalDecisionRequestSchema, 'input') })
  @ApiOkResponse({ schema: zodToOpenApi(activityItemDtoSchema) })
  @ApiProblemResponses(400, 401, 403, 404, 409, 422)
  async decide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(approvalDecisionRequestSchema)) body: ApprovalDecisionRequest,
  ): Promise<ActivityItemDto> {
    return toActivityItemDto(
      await this.decideOnTransaction.execute(user.userId, id, body.decision, body.reason ?? null),
    );
  }

  @Get('transactions/:id/comments')
  @ApiOkResponse({ schema: zodToOpenApi(z.array(commentDtoSchema)) })
  @ApiProblemResponses(400, 401, 404)
  async comments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam) id: string,
  ): Promise<CommentDto[]> {
    return (await this.listComments.execute(user.userId, id)).map(toCommentDto);
  }

  @Post('transactions/:id/comments')
  @ApiBody({ schema: zodToOpenApi(createCommentRequestSchema, 'input') })
  @ApiCreatedResponse({ schema: zodToOpenApi(commentDtoSchema) })
  @ApiProblemResponses(400, 401, 404)
  async comment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(createCommentRequestSchema)) body: CreateCommentRequest,
  ): Promise<CommentDto> {
    return toCommentDto(await this.addComment.execute(user.userId, id, body.body));
  }
}

function toActivityItemDto(item: ActivityItem): ActivityItemDto {
  return activityItemDtoSchema.parse({
    id: item.id,
    householdId: item.householdId,
    type: item.type,
    actorId: item.actorId,
    occurredAt: item.occurredAt.toISOString(),
    transactionId: item.transactionId,
    settlementId: item.settlementId,
    amount:
      item.amountMinor !== null && item.currency !== null
        ? { amountMinor: item.amountMinor, currency: item.currency }
        : null,
    description: item.description,
    approval: item.approval && {
      status: item.approval.status,
      decidedBy: item.approval.decidedBy,
      decidedAt: item.approval.decidedAt?.toISOString() ?? null,
      reason: item.approval.reason,
    },
    commentCount: item.commentCount,
  });
}

function toCommentDto(comment: Comment): CommentDto {
  return commentDtoSchema.parse({ ...comment, createdAt: comment.createdAt.toISOString() });
}
