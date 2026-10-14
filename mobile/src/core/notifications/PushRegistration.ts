import type { NotificationsGateway, PushPlatform } from './NotificationsGateway';

/** Where the token goes (the push feature's PushRepository fits it). */
export interface PushTokenRegistry {
  register(token: string, platform: PushPlatform, deviceName?: string): Promise<void>;
  unregister(token: string): Promise<void>;
}

/** Why push is not on, so the UI can explain it (or say nothing). */
export type PushStatus =
  | { readonly kind: 'enabled'; readonly token: string }
  | { readonly kind: 'denied' }
  /** Emulator, web, or no EAS project yet: push is not possible here. */
  | { readonly kind: 'unsupported'; readonly reason: 'not-a-device' | 'no-project' }
  /** Permission not asked yet: show the in-context prompt when it makes sense. */
  | { readonly kind: 'not-asked' }
  /** Offline or API error: try again later (next start or next sign-in). */
  | { readonly kind: 'failed'; readonly error: unknown };

/**
 * Registers this device for push (ADR-0017). Two entry points on purpose:
 * - `enable()` asks for permission: call it **in context** (the user switched on
 *   "avisarme de gastos compartidos" or just joined a household), never at launch.
 * - `syncAfterSignIn()` never prompts: if permission was already granted it
 *   (re)registers the token, e.g. after signing in or when the app starts.
 * `signOut()` unregisters, so this device stops getting the user's notifications.
 */
export class PushRegistration {
  private registeredToken: string | null = null;

  constructor(
    private readonly gateway: NotificationsGateway,
    private readonly repository: PushTokenRegistry,
  ) {}

  enable(): Promise<PushStatus> {
    return this.register(true);
  }

  syncAfterSignIn(): Promise<PushStatus> {
    return this.register(false);
  }

  /** Best effort: signing out must work offline too. */
  async signOut(): Promise<void> {
    const token = this.registeredToken;
    this.registeredToken = null;
    if (!token) return;
    try {
      await this.repository.unregister(token);
    } catch {
      // The server also drops it when Expo reports the token as dead.
    }
  }

  private async register(prompt: boolean): Promise<PushStatus> {
    const { gateway } = this;
    if (!gateway.isPhysicalDevice || gateway.platform === 'other') {
      return { kind: 'unsupported', reason: 'not-a-device' };
    }
    if (!gateway.projectId) return { kind: 'unsupported', reason: 'no-project' };

    try {
      // Android 13+: the prompt only appears once a channel exists.
      await gateway.ensureDefaultChannel();
      let permission = await gateway.getPermission();
      if (permission === 'undetermined' && prompt) permission = await gateway.requestPermission();
      if (permission === 'denied') return { kind: 'denied' };
      if (permission === 'undetermined') return { kind: 'not-asked' };

      const token = await gateway.getExpoPushToken(gateway.projectId);
      await this.repository.register(token, gateway.platform, gateway.deviceName ?? undefined);
      this.registeredToken = token;
      return { kind: 'enabled', token };
    } catch (error) {
      return { kind: 'failed', error };
    }
  }
}
