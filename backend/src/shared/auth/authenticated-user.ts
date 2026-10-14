/** Who is calling, as established by JwtAuthGuard from the access token. */
export interface AuthenticatedUser {
  readonly userId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by JwtAuthGuard on authenticated routes. */
    auth?: AuthenticatedUser;
  }
}
