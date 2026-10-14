import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = Symbol('IS_PUBLIC');

/**
 * Every route requires an access token unless marked `@Public()` (secure by
 * default, like `anyRequest().authenticated()` in Spring Security).
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
