import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'succeeded' | 'canceled';
  metadata: Record<string, string>;
  clientSecret: string;
  createdAt: Date;
}

export interface Refund {
  id: string;
  paymentIntentId: string;
  amount: number;
  status: 'succeeded' | 'pending' | 'failed';
  createdAt: Date;
}

const paymentIntents = new Map<string, PaymentIntent>();
const refunds = new Map<string, Refund>();

/**
 * Mock Stripe SDK that simulates payment gateway operations.
 * Replace with the real Stripe SDK (`stripe` npm package) in production.
 */
export class StripeService {
  static async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    metadata: Record<string, string> = {}
  ): Promise<PaymentIntent> {
    await this.simulateLatency();

    const intent: PaymentIntent = {
      id: `pi_${crypto.randomBytes(12).toString('hex')}`,
      amount: Math.round(amount * 100),
      currency,
      status: 'requires_confirmation',
      metadata,
      clientSecret: `pi_${crypto.randomBytes(12).toString('hex')}_secret_${crypto.randomBytes(8).toString('hex')}`,
      createdAt: new Date(),
    };

    paymentIntents.set(intent.id, intent);
    logger.info(`[Stripe Mock] Payment intent created: ${intent.id} for ${currency} ${amount}`);
    return intent;
  }

  static async confirmPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    await this.simulateLatency();

    const intent = paymentIntents.get(paymentIntentId);
    if (!intent) {
      throw new Error(`Payment intent ${paymentIntentId} not found`);
    }

    if (intent.status === 'canceled') {
      throw new Error('Cannot confirm a canceled payment intent');
    }

    if (intent.status === 'succeeded') {
      throw new Error('Payment intent has already succeeded');
    }

    intent.status = 'succeeded';
    paymentIntents.set(paymentIntentId, intent);
    logger.info(`[Stripe Mock] Payment intent confirmed: ${paymentIntentId}`);
    return intent;
  }

  static async cancelPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    await this.simulateLatency();

    const intent = paymentIntents.get(paymentIntentId);
    if (!intent) {
      throw new Error(`Payment intent ${paymentIntentId} not found`);
    }

    if (intent.status === 'succeeded') {
      throw new Error('Cannot cancel a succeeded payment intent — create a refund instead');
    }

    intent.status = 'canceled';
    paymentIntents.set(paymentIntentId, intent);
    logger.info(`[Stripe Mock] Payment intent canceled: ${paymentIntentId}`);
    return intent;
  }

  static async createRefund(
    paymentIntentId: string,
    amount?: number
  ): Promise<Refund> {
    await this.simulateLatency();

    const intent = paymentIntents.get(paymentIntentId);
    if (!intent) {
      throw new Error(`Payment intent ${paymentIntentId} not found`);
    }

    if (intent.status !== 'succeeded') {
      throw new Error('Can only refund a succeeded payment intent');
    }

    const refundAmount = amount ?? intent.amount;

    const refund: Refund = {
      id: `re_${crypto.randomBytes(12).toString('hex')}`,
      paymentIntentId,
      amount: refundAmount,
      status: 'succeeded',
      createdAt: new Date(),
    };

    refunds.set(refund.id, refund);
    logger.info(`[Stripe Mock] Refund created: ${refund.id} for payment ${paymentIntentId}`);
    return refund;
  }

  static async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | null> {
    return paymentIntents.get(paymentIntentId) ?? null;
  }

  private static simulateLatency(): Promise<void> {
    const delay = 50 + Math.random() * 150;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
