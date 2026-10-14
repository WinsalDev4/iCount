import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  type CategoryDto,
  categoryDtoSchema,
  type CreateCategoryRequest,
  createCategoryRequestSchema,
} from '@icount/contracts';
import { z } from 'zod';

import type { AuthenticatedUser } from '../../../../shared/auth/authenticated-user.js';
import { CurrentUser } from '../../../../shared/auth/current-user.decorator.js';
import { ApiProblemResponses, zodToOpenApi } from '../../../../shared/interface/http/openapi.js';
import { ZodValidationPipe } from '../../../../shared/interface/http/zod-validation.pipe.js';
import { CreateCategory, ListCategories } from '../../application/categories.use-cases.js';
import type { Category } from '../../domain/category.js';

const householdIdParam = new ZodValidationPipe(z.uuid());

@ApiTags('categories')
@ApiBearerAuth()
@Controller('households/:householdId/categories')
export class CategoriesController {
  constructor(
    private readonly listCategories: ListCategories,
    private readonly createCategory: CreateCategory,
  ) {}

  @Get()
  @ApiOkResponse({ schema: zodToOpenApi(z.array(categoryDtoSchema)) })
  @ApiProblemResponses(401, 404)
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', householdIdParam) householdId: string,
  ): Promise<CategoryDto[]> {
    return (await this.listCategories.execute(user.userId, householdId)).map(toCategoryDto);
  }

  @Post()
  @ApiBody({ schema: zodToOpenApi(createCategoryRequestSchema, 'input') })
  @ApiCreatedResponse({ schema: zodToOpenApi(categoryDtoSchema) })
  @ApiProblemResponses(400, 401, 404)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('householdId', householdIdParam) householdId: string,
    @Body(new ZodValidationPipe(createCategoryRequestSchema)) body: CreateCategoryRequest,
  ): Promise<CategoryDto> {
    return toCategoryDto(await this.createCategory.execute(user.userId, householdId, body));
  }
}

export function toCategoryDto(category: Category): CategoryDto {
  return categoryDtoSchema.parse(category);
}
