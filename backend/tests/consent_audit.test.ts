import { describe, it, expect } from 'vitest';
import { verifyAuditChain } from '../src/lib/hash-chain';

describe('Audit Chain & DPDP Privacy Verification Tests', () => {
  it('validates the cryptographic integrity of the append-only audit log chain', async () => {
    const verification = await verifyAuditChain();
    expect(verification.valid).toBe(true);
    expect(verification.totalRecords).toBeGreaterThan(0);
    expect(verification.brokenIndex).toBeUndefined();
  });
});
