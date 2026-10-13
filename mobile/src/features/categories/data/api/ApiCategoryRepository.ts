import { type CategoryDto, categoryDtoSchema } from '@icount/contracts';
import { z } from 'zod';

import type { CategoryId } from '@/core/domain/Category';
import type { HttpClient } from '@/core/network/httpClient';

import type { Category, NewCategory } from '../../domain/Category';
import type { CategoryRepository } from '../../domain/CategoryRepository';

/** CategoryRepository over the API. `http` is the authenticated client. */
export class ApiCategoryRepository implements CategoryRepository {
  constructor(private readonly http: HttpClient) {}

  async list(householdId: string): Promise<readonly Category[]> {
    const result = await this.http.request(`/v1/households/${householdId}/categories`, {
      schema: z.array(categoryDtoSchema),
    });
    if (!result.ok) throw new Error(`Could not load categories (${result.error.kind})`);
    return result.value.map(toCategory);
  }

  async create(householdId: string, input: NewCategory): Promise<Category> {
    const result = await this.http.request(`/v1/households/${householdId}/categories`, {
      method: 'POST',
      body: input,
      schema: categoryDtoSchema,
    });
    if (!result.ok) throw new Error(`Could not create the category (${result.error.kind})`);
    return toCategory(result.value);
  }
}

export function toCategory(dto: CategoryDto): Category {
  return {
    id: dto.id as CategoryId,
    name: dto.name,
    icon: dto.icon,
    kind: dto.kind,
    isDefault: dto.isDefault,
  };
}
