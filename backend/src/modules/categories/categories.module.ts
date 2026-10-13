import { Module } from '@nestjs/common';

import { IdGenerator } from '../../shared/application/id-generator.js';
import { HouseholdAccess } from '../households/application/household-access.js';
import { HouseholdsModule } from '../households/households.module.js';
import { CreateCategory, ListCategories } from './application/categories.use-cases.js';
import { CategoryRepository } from './domain/category.js';
import { DrizzleCategoryRepository } from './infrastructure/persistence/drizzle-category.repository.js';
import { CategoriesController } from './interface/http/categories.controller.js';

@Module({
  imports: [HouseholdsModule],
  controllers: [CategoriesController],
  providers: [
    { provide: CategoryRepository, useClass: DrizzleCategoryRepository },
    {
      provide: ListCategories,
      inject: [HouseholdAccess, CategoryRepository],
      useFactory: (...deps: ConstructorParameters<typeof ListCategories>) =>
        new ListCategories(...deps),
    },
    {
      provide: CreateCategory,
      inject: [HouseholdAccess, CategoryRepository, IdGenerator],
      useFactory: (...deps: ConstructorParameters<typeof CreateCategory>) =>
        new CreateCategory(...deps),
    },
  ],
  exports: [CategoryRepository],
})
export class CategoriesModule {}
