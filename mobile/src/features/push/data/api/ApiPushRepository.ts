import { z } from 'zod';

import type { HttpClient, RequestOptions } from '@/core/network/httpClient';
import { describeHttpError } from '@/core/network/HttpError';

import type { PushPlatform, PushRepository } from '../../domain/PushRepository';

/** PushRepository over the API (`http` is the authenticated client). */
export class ApiPushRepository implements PushRepository {
  constructor(private readonly http: HttpClient) {}

  async register(token: string, platform: PushPlatform, deviceName?: string): Promise<void> {
    await this.call('/v1/me/push-tokens', {
      method: 'PUT',
      body: { token, platform, ...(deviceName ? { deviceName: deviceName.slice(0, 80) } : {}) },
      schema: z.undefined(),
    });
  }

  async unregister(token: string): Promise<void> {
    await this.call('/v1/me/push-tokens', {
      method: 'DELETE',
      body: { token },
      schema: z.undefined(),
    });
  }

  private async call<S extends z.ZodType>(path: string, options: RequestOptions<S>) {
    const result = await this.http.request(path, options);
    // Callers (PushRegistration) only need to know it failed: they retry later.
    if (!result.ok) throw new Error(describeHttpError(result.error));
    return result.value;
  }
}
