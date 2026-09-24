import { logger } from '../logger';

export interface SmsMessage {
  to: string;
  templateCode: string;
  variables: Record<string, string>;
  messageText: string;
}

export interface SmsProvider {
  sendSms(msg: SmsMessage): Promise<{ success: boolean; messageId: string }>;
}

export class MockConsoleSmsProvider implements SmsProvider {
  async sendSms(msg: SmsMessage): Promise<{ success: boolean; messageId: string }> {
    const maskedPhone = msg.to.slice(0, 3) + '******' + msg.to.slice(-2);
    logger.info({ to: maskedPhone, template: msg.templateCode, text: msg.messageText }, 'MOCK SMS SENT:');
    return {
      success: true,
      messageId: `mock-msg-${Date.now()}`
    };
  }
}

// Singleton SMS provider
export const smsProvider: SmsProvider = new MockConsoleSmsProvider();
