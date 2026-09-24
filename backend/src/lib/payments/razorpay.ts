import crypto from 'crypto';
import { config } from '../../config';

export interface CreateOrderParams {
  amountPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export class RazorpayService {
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;

  constructor() {
    this.keyId = config.RAZORPAY_KEY_ID;
    this.keySecret = config.RAZORPAY_KEY_SECRET;
    this.webhookSecret = config.RAZORPAY_WEBHOOK_SECRET;
  }

  async createOrder(params: CreateOrderParams): Promise<{
    id: string;
    amount: number;
    currency: string;
    receipt: string;
  }> {
    // In test/mock mode or real mode:
    const mockOrderId = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    return {
      id: mockOrderId,
      amount: params.amountPaise,
      currency: params.currency || 'INR',
      receipt: params.receipt
    };
  }

  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const text = `${orderId}|${paymentId}`;
    const generated = crypto.createHmac('sha256', this.keySecret).update(text).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(signature));
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const generated = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(signature));
  }
}

export const razorpayService = new RazorpayService();
