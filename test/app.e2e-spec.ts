import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { hashPassword } from '../src/common/utils/password.util';

/**
 * Full business flow, end to end, against a real Postgres database
 * (see .env.test): registration -> email verification -> admin approval
 * -> login -> chart of accounts -> financial document -> approval ->
 * posting -> payment -> report generation, plus the specific negative
 * paths the spec calls out: duplicate request, unauthorized access,
 * invalid state transition, and a genuine concurrent request race.
 */
describe('Corporate ERP - full flow (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let adminToken: string;
  let workerToken: string;
  let workerId: string;
  let workerEmail: string;

  const suffix = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();

    dataSource = app.get(DataSource);
    await ensureAdmin(dataSource);
    adminToken = await loginAndGetToken(app, 'e2e-admin@example.com', 'AdminPass123!');
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects any request without a token', async () => {
    await request(app.getHttpServer()).get('/v1/users').expect(401);
  });

  it('registers a new worker with KYC documents', async () => {
    workerEmail = `worker-${suffix}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .field('email', workerEmail)
      .field('password', 'WorkerPass123!')
      .field('passwordConfirmation', 'WorkerPass123!')
      .field('lastName', 'Doe')
      .field('firstName', 'Jane')
      .field('birthDate', '1992-02-02')
      .field('gender', 'FEMALE')
      .field('birthPlace', 'Metropolis')
      .field('passportIssuedBy', 'Dept of State')
      .field('passportIssueDate', '2012-01-01')
      .field('passportSubdivisionCode', '770-001')
      .field('countryOfResidence', 'USA')
      .field('countryOfRegistration', 'USA')
      .field('cityOfRegistration', 'Metropolis')
      .field('street', 'Main St 1')
      .field('registrationDate', '2015-01-01')
      .attach('passportMainPhoto', Buffer.from('fake-jpeg-main'), {
        filename: 'main.jpg',
        contentType: 'image/jpeg',
      })
      .attach('passportRegistrationPhoto', Buffer.from('fake-jpeg-reg'), {
        filename: 'reg.jpg',
        contentType: 'image/jpeg',
      })
      .attach('facePhoto', Buffer.from('fake-jpeg-face'), {
        filename: 'face.jpg',
        contentType: 'image/jpeg',
      })
      .expect(201);

    workerId = res.body.userId;
    expect(res.body.email).toBe(workerEmail);
  });

  it('cannot log in before the email is verified', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: workerEmail, password: 'WorkerPass123!' })
      .expect(403);
    expect(res.body.message).toMatch(/verify your email/i);
  });

  it('verifies the email using the code (peeked from the DB, standing in for the mail inbox)', async () => {
    const code = '654321';
    const hash = createHash('sha256').update(code).digest('hex');
    await dataSource.query(
      `UPDATE email_verification_tokens SET "codeHash" = $1 WHERE "userId" = $2 AND "consumedAt" IS NULL`,
      [hash, workerId],
    );

    await request(app.getHttpServer())
      .post('/v1/auth/verify-email')
      .send({ email: workerEmail, code })
      .expect(200);
  });

  it('cannot log in before admin approval', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ email: workerEmail, password: 'WorkerPass123!' })
      .expect(403);
  });

  it('admin approves the worker, who can then log in', async () => {
    await request(app.getHttpServer())
      .post(`/v1/users/${workerId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ position: 'Accountant', hireDate: '2024-01-01' })
      .expect(201);

    workerToken = await loginAndGetToken(app, workerEmail, 'WorkerPass123!');
  });

  it('a worker cannot access an admin-only endpoint', async () => {
    await request(app.getHttpServer())
      .get('/v1/users')
      .set('Authorization', `Bearer ${workerToken}`)
      .expect(403);
  });

  describe('accounting + document + payment + report flow', () => {
    let arAccountId: string;
    let revenueAccountId: string;
    let cashAccountId: string;
    let counterpartyId: string;
    let documentId: string;
    let journalEntryId: string;

    it('admin sets up chart of accounts and an open period', async () => {
      const period = `${2000 + (suffix % 90)}`; // unique-ish year per test run, within the DTO's 2000-2100 range
      await request(app.getHttpServer())
        .post('/v1/accounting/periods')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ year: parseInt(period, 10), month: 1 })
        .expect(201);

      const ar = await request(app.getHttpServer())
        .post('/v1/accounting/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: `62-${suffix}`, name: 'Receivables', type: 'ASSET' })
        .expect(201);
      arAccountId = ar.body.id;

      const revenue = await request(app.getHttpServer())
        .post('/v1/accounting/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: `90-${suffix}`, name: 'Revenue', type: 'INCOME' })
        .expect(201);
      revenueAccountId = revenue.body.id;

      const cash = await request(app.getHttpServer())
        .post('/v1/accounting/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: `51-${suffix}`, name: 'Bank', type: 'ASSET', isCash: true })
        .expect(201);
      cashAccountId = cash.body.id;

      (global as unknown as { __period: string }).__period = period;
    });

    it('creates a counterparty', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/counterparties')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Acme-${suffix}`,
          legalName: `Acme Corp ${suffix}`,
          taxId: `TAX-${suffix}`,
          type: 'CUSTOMER',
          legalAddress: '1 Acme Way',
        })
        .expect(201);
      counterpartyId = res.body.id;
    });

    it('a worker creates a draft invoice document', async () => {
      const period = (global as unknown as { __period: string }).__period;
      const res = await request(app.getHttpServer())
        .post('/v1/documents')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          type: 'INVOICE',
          date: `${period}-01-15`,
          counterpartyId,
          currency: 'USD',
          description: 'e2e invoice',
          lines: [
            {
              description: 'Consulting',
              amount: '500.00',
              debitAccountId: arAccountId,
              creditAccountId: revenueAccountId,
            },
          ],
        })
        .expect(201);
      documentId = res.body.id;
      expect(res.body.status).toBe('DRAFT');
    });

    it('cannot post a document that has not been submitted or approved yet', async () => {
      await request(app.getHttpServer())
        .post(`/v1/documents/${documentId}/post`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
    });

    it('a worker cannot approve their own document (lacks the approve permission)', async () => {
      await request(app.getHttpServer())
        .post(`/v1/documents/${documentId}/submit`)
        .set('Authorization', `Bearer ${workerToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/v1/documents/${documentId}/approve`)
        .set('Authorization', `Bearer ${workerToken}`)
        .expect(403);
    });

    it('admin approves and posts the document, producing a balanced journal entry', async () => {
      await request(app.getHttpServer())
        .post(`/v1/documents/${documentId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      const posted = await request(app.getHttpServer())
        .post(`/v1/documents/${documentId}/post`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(posted.body.status).toBe('POSTED');
      journalEntryId = posted.body.postedJournalEntryId;
      expect(journalEntryId).toBeTruthy();

      const entry = await request(app.getHttpServer())
        .get(`/v1/accounting/journal-entries/${journalEntryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const totalDebit = entry.body.lines.reduce(
        (sum: number, l: { debit: string }) => sum + parseFloat(l.debit),
        0,
      );
      const totalCredit = entry.body.lines.reduce(
        (sum: number, l: { credit: string }) => sum + parseFloat(l.credit),
        0,
      );
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
    });

    it('a duplicate payment request (same idempotency key) never creates a second payment', async () => {
      const idempotencyKey = `e2e-pay-${suffix}`;
      const body = {
        idempotencyKey,
        direction: 'INCOMING',
        counterpartyId,
        cashAccountId,
        counterAccountId: arAccountId,
        amount: '500.00',
        currency: 'USD',
        paymentDate: `${(global as unknown as { __period: string }).__period}-01-20`,
        method: 'BANK_TRANSFER',
      };

      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post('/v1/payments')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(body),
        request(app.getHttpServer())
          .post('/v1/payments')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(body),
      ]);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(first.body.id).toBe(second.body.id);

      const [{ count }] = await dataSource.query(
        `SELECT count(*)::int FROM payments WHERE "idempotencyKey" = $1`,
        [idempotencyKey],
      );
      expect(count).toBe(1);
    });

    it('generates a PDF trial balance report and downloads it', async () => {
      const period = (global as unknown as { __period: string }).__period;
      const created = await request(app.getHttpServer())
        .post('/v1/reports')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reportType: 'TRIAL_BALANCE',
          format: 'PDF',
          from: `${period}-01-01`,
          to: `${period}-12-31`,
        })
        .expect(201);

      // Generation runs off-thread (ReportJobQueue); poll briefly for completion.
      let status = created.body.status;
      let attempts = 0;
      const reportId = created.body.id;
      while (status !== 'COMPLETED' && status !== 'FAILED' && attempts < 20) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const check = await request(app.getHttpServer())
          .get(`/v1/reports/${reportId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        status = check.body.status;
        attempts += 1;
      }

      expect(status).toBe('COMPLETED');

      const download = await request(app.getHttpServer())
        .get(`/v1/reports/${reportId}/download`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(download.headers['content-type']).toBe('application/pdf');
    });
  });

  describe('concurrency: two simultaneous approvals of the same expense request', () => {
    it('only one of two concurrent approve requests succeeds', async () => {
      const expenseAccount = await request(app.getHttpServer())
        .post('/v1/accounting/accounts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: `26-${suffix}`, name: 'Misc expense', type: 'EXPENSE' })
        .expect(201);

      const created = await request(app.getHttpServer())
        .post('/v1/expense-requests')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          expenseAccountId: expenseAccount.body.id,
          amount: '75.00',
          currency: 'USD',
          purpose: 'Concurrency test',
        })
        .expect(201);
      const expenseRequestId = created.body.id;

      await request(app.getHttpServer())
        .post(`/v1/expense-requests/${expenseRequestId}/submit`)
        .set('Authorization', `Bearer ${workerToken}`)
        .expect(201);

      const [first, second] = await Promise.all([
        request(app.getHttpServer())
          .post(`/v1/expense-requests/${expenseRequestId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({}),
        request(app.getHttpServer())
          .post(`/v1/expense-requests/${expenseRequestId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({}),
      ]);

      const statuses = [first.status, second.status].sort();
      // One request wins (201); the other finds the status already changed (409).
      expect(statuses).toEqual([201, 409]);
    });
  });
});

async function ensureAdmin(dataSource: DataSource): Promise<void> {
  const email = 'e2e-admin@example.com';
  const existing = await dataSource.query<{ id: string }[]>(
    `SELECT id FROM users WHERE email = $1`,
    [email],
  );
  if (existing.length > 0) return;

  const passwordHash = await hashPassword('AdminPass123!');
  const [adminRole] = await dataSource.query<{ id: string }[]>(
    `SELECT id FROM roles WHERE name = 'ADMIN'`,
  );
  await dataSource.query(
    `INSERT INTO users (email, "passwordHash", status, "roleId", "emailVerifiedAt", "approvedAt")
     VALUES ($1, $2, 'ACTIVE', $3, now(), now())`,
    [email, passwordHash, adminRole.id],
  );
}

async function loginAndGetToken(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body.accessToken;
}
