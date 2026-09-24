import fs from 'fs';
import path from 'path';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'CareSmart Hospital Management System API',
    version: '1.0.0',
    description: 'Production REST API for CareSmart - Transparent, Paperless Hospital System in India.'
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Current CareSmart API Base URL'
    }
  ],
  paths: {
    '/auth/staff/login': {
      post: {
        summary: 'Staff authentication with argon2 and optional TOTP',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  totpToken: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Successful login with JWT token and staff metadata' },
          '401': { description: 'Invalid credentials or failed TOTP' }
        }
      }
    },
    '/auth/patient/otp/request': {
      post: {
        summary: 'Request 6-digit OTP for patient portal mobile login',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone'],
                properties: { phone: { type: 'string' } }
              }
            }
          }
        },
        responses: {
          '200': { description: 'OTP dispatched (or uniform response)' }
        }
      }
    },
    '/auth/patient/otp/verify': {
      post: {
        summary: 'Verify mobile OTP and establish patient session',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['phone', 'otp'],
                properties: {
                  phone: { type: 'string' },
                  otp: { type: 'string' },
                  isSharedDevice: { type: 'boolean', default: false }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Patient access token and family group account' }
        }
      }
    },
    '/patients/search': {
      get: {
        summary: 'Search patients by name, phone or code',
        tags: ['Patients'],
        parameters: [
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'phone', in: 'query', schema: { type: 'string' } },
          { name: 'code', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'List of matching patients' }
        }
      }
    },
    '/appointments/slots': {
      get: {
        summary: 'Query available doctor consultation time slots for a date',
        tags: ['Appointments'],
        parameters: [
          { name: 'doctorId', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'date', in: 'query', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'List of 15-minute slots and availability status' }
        }
      }
    },
    '/pharmacy/queue': {
      get: {
        summary: 'Pharmacy prescription dispense queue',
        tags: ['Pharmacy'],
        responses: {
          '200': { description: 'Active prescriptions pending dispensing' }
        }
      }
    },
    '/ipd/bed-board': {
      get: {
        summary: 'Live bed occupancy board across hospital wards',
        tags: ['IPD'],
        responses: {
          '200': { description: 'Ward layouts and current bed occupancy status' }
        }
      }
    },
    '/billing/public-prices': {
      get: {
        summary: 'Public hospital transparent price list',
        tags: ['Billing'],
        responses: {
          '200': { description: 'List of active service prices across OPD, Lab, and IPD' }
        }
      }
    },
    '/analytics/dashboard': {
      get: {
        summary: 'Manager and Admin aggregate hospital KPIs and 30-day history',
        tags: ['Analytics'],
        responses: {
          '200': { description: 'Aggregate KPIs and trend charts' }
        }
      }
    }
  }
};

const outputPath = path.resolve(__dirname, 'openapi.json');
fs.writeFileSync(outputPath, JSON.stringify(openApiSpec, null, 2));
console.log(`Generated OpenAPI spec written to ${outputPath}`);
