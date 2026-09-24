import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 25 },  // Ramp up to 25 users
    { duration: '1m', target: 100 },  // Sustained 100 concurrent users
    { duration: '30s', target: 0 },   // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300'], // 95% of requests under 300ms
    http_req_failed: ['rate<0.01'],   // Error rate below 1%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:4000/api/v1';

export default function () {
  // 1. Health check & ready check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
  });

  // 2. Public Price List (Open transparent access)
  const pricesRes = http.get(`${BASE_URL}/prices`);
  check(pricesRes, {
    'prices list returns 200': (r) => r.status === 200,
  });

  // 3. Lab Catalog endpoint
  const labRes = http.get(`${BASE_URL}/lab/catalog`);
  check(labRes, {
    'lab catalog returns 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  // 4. Inpatient Bed Board status
  const bedsRes = http.get(`${BASE_URL}/ipd/beds`);
  check(bedsRes, {
    'beds list returns 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}
