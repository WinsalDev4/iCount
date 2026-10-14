/** A person with an account. Created the first time they verify a magic link. */
export class User {
  private constructor(
    readonly id: string,
    /** Already normalised (trimmed, lower case) by the contract schema. */
    readonly email: string,
    readonly displayName: string | null,
    readonly createdAt: Date,
  ) {}

  static register(props: { id: string; email: string; createdAt: Date }): User {
    return new User(props.id, props.email, null, props.createdAt);
  }

  static restore(props: {
    id: string;
    email: string;
    displayName: string | null;
    createdAt: Date;
  }): User {
    return new User(props.id, props.email, props.displayName, props.createdAt);
  }
}

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  /** Inserts the user, or returns the existing one if the email was registered concurrently. */
  abstract register(user: User): Promise<User>;
}
