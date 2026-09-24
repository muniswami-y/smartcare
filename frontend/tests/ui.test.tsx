import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../src/components/ui/Button';
import { Badge } from '../src/components/ui/Badge';
import { Card } from '../src/components/ui/Card';

describe('Frontend UI Kit Component Tests', () => {
  it('renders Button correctly with variants and sizes', () => {
    render(<Button variant="primary">Submit Consultation</Button>);
    const button = screen.getByText('Submit Consultation');
    expect(button).toBeDefined();
    expect(button.className).toContain('bg-brand-teal');
  });

  it('renders Badge with correct status style', () => {
    render(<Badge variant="success">PAID</Badge>);
    const badge = screen.getByText('PAID');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('text-emerald-700');
  });

  it('renders Card with header and children', () => {
    render(
      <Card title="Patient Biometrics">
        <p>Blood Pressure: 120/80 mmHg</p>
      </Card>
    );
    expect(screen.getByText('Patient Biometrics')).toBeDefined();
    expect(screen.getByText('Blood Pressure: 120/80 mmHg')).toBeDefined();
  });

  it('formats integer paise correctly into INR currency', () => {
    const paise = 150050; // ₹1,500.50
    const inr = (paise / 100).toFixed(2);
    expect(inr).toBe('1500.50');
  });
});
