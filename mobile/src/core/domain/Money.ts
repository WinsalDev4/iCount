/**
 * Value object for monetary amounts.
 *
 * Amounts are stored in minor units (cents) as integers to avoid floating point
 * errors: 0.1 + 0.2 !== 0.3 in IEEE-754. See docs/adr/0007-dinero-en-unidades-menores.md
 */
export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'MXN';

export class Money {
  private constructor(
    readonly amountMinor: number,
    readonly currency: CurrencyCode,
  ) {
    if (!Number.isSafeInteger(amountMinor)) {
      throw new RangeError(
        `Money amount must be a safe integer in minor units, got ${amountMinor}`,
      );
    }
  }

  static ofMinor(amountMinor: number, currency: CurrencyCode): Money {
    return new Money(amountMinor, currency);
  }

  static zero(currency: CurrencyCode): Money {
    return new Money(0, currency);
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  isNegative(): boolean {
    return this.amountMinor < 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  format(locale = 'es-ES'): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: this.currency }).format(
      this.amountMinor / 100,
    );
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
