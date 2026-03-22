import request from 'supertest';
import 'dotenv/config';
import app from '../../src/app.js';

export { request, app };

export async function getToken() {
  var res = await request(app).post('/api/v1/auth/login').send({
    email:    process.env.ADMIN_EMAIL    || 'admin@test.com',
    password: process.env.ADMIN_PASSWORD || 'testpass',
  });
  return res.body.data && res.body.data.token;
}

export function auth(token) { return 'Bearer ' + token; }
