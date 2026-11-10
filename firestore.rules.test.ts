import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  HEX_REGEX,
  BINARY32_REGEX,
  HTTPS_URL_REGEX,
  WATERMARK_ID_STRING_REGEX,
  MAX_UINT32,
  MAX_URL_LENGTH,
  MIN_URL_LENGTH,
  MAX_TITLE_LENGTH,
  MAX_THUMBNAIL_LENGTH,
} from './lib/watermark-engine';

const ADMIN_EMAIL_REGEX = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;

interface RuleEvalContext {
  auth: {
    uid: string;
    email: string;
    email_verified: boolean;
    isAdminInDb?: boolean;
  } | null;
  requestTime: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  collection: 'watermarks' | 'admins';
  docId: string;
  incoming?: Record<string, unknown>;
  existing?: Record<string, unknown>;
}

const ALLOWED_WATERMARK_KEYS = new Set([
  'id',
  'hex',
  'binary',
  'targetUrl',
  'title',
  'thumbnailDataUrl',
  'delta',
  'createdBy',
  'createdAt',
]);

const ALLOWED_ADMIN_KEYS = new Set(['email', 'displayName', 'role', 'addedBy', 'createdAt']);

function evaluateHardenedRules(ctx: RuleEvalContext): 'ALLOWED' | 'PERMISSION_DENIED' {
  const isSignedIn = ctx.auth !== null;
  const isVerifiedUser = isSignedIn && ctx.auth?.email_verified === true;
  const isSuperAdmin = isVerifiedUser && ctx.auth?.email === 'nahid.main.ai@gmail.com';
  const isAdmin = isSuperAdmin || (isVerifiedUser && ctx.auth?.isAdminInDb === true);

  if (ctx.collection === 'admins') {
    if (
      ctx.docId.length < 5 ||
      ctx.docId.length > 128 ||
      !ADMIN_EMAIL_REGEX.test(ctx.docId)
    ) {
      return 'PERMISSION_DENIED';
    }

    if (ctx.operation === 'get') {
      if (!isVerifiedUser) return 'PERMISSION_DENIED';
      return ctx.auth?.email === ctx.docId || isAdmin ? 'ALLOWED' : 'PERMISSION_DENIED';
    }

    if (ctx.operation === 'delete') {
      if (!isSuperAdmin || ctx.docId === 'nahid.main.ai@gmail.com') return 'PERMISSION_DENIED';
      return 'ALLOWED';
    }

    if (ctx.operation === 'create') {
      if (!isSuperAdmin || !ctx.incoming || ctx.docId === 'nahid.main.ai@gmail.com') {
        return 'PERMISSION_DENIED';
      }
      const keys = Object.keys(ctx.incoming);
      if (keys.length !== ALLOWED_ADMIN_KEYS.size || !keys.every((k) => ALLOWED_ADMIN_KEYS.has(k))) {
        return 'PERMISSION_DENIED';
      }
      if (
        typeof ctx.incoming.email !== 'string' ||
        ctx.incoming.email !== ctx.docId ||
        !ADMIN_EMAIL_REGEX.test(ctx.incoming.email) ||
        typeof ctx.incoming.displayName !== 'string' ||
        ctx.incoming.displayName.length < 1 ||
        ctx.incoming.displayName.length > 80 ||
        ctx.incoming.role !== 'admin' ||
        ctx.incoming.addedBy !== 'nahid.main.ai@gmail.com' ||
        ctx.incoming.addedBy !== ctx.auth?.email ||
        ctx.incoming.createdAt !== ctx.requestTime
      ) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOWED';
    }

    return 'PERMISSION_DENIED';
  }

  if (ctx.collection === 'watermarks') {
    if (!WATERMARK_ID_STRING_REGEX.test(ctx.docId)) {
      return 'PERMISSION_DENIED';
    }
    if (ctx.operation === 'get') {
      return 'ALLOWED';
    }
    if (ctx.operation === 'delete') {
      return isAdmin ? 'ALLOWED' : 'PERMISSION_DENIED';
    }

    if (!isAdmin || !ctx.incoming) {
      return 'PERMISSION_DENIED';
    }

    const data = ctx.incoming;
    const keys = Object.keys(data);
    if (
      keys.length !== ALLOWED_WATERMARK_KEYS.size ||
      !keys.every((k) => ALLOWED_WATERMARK_KEYS.has(k))
    ) {
      return 'PERMISSION_DENIED';
    }

    if (
      typeof data.id !== 'number' ||
      !Number.isInteger(data.id) ||
      data.id < 0 ||
      data.id > MAX_UINT32 ||
      String(data.id) !== ctx.docId
    ) {
      return 'PERMISSION_DENIED';
    }

    if (typeof data.hex !== 'string' || !HEX_REGEX.test(data.hex)) {
      return 'PERMISSION_DENIED';
    }

    if (typeof data.binary !== 'string' || !BINARY32_REGEX.test(data.binary)) {
      return 'PERMISSION_DENIED';
    }

    if (
      typeof data.targetUrl !== 'string' ||
      data.targetUrl.length < MIN_URL_LENGTH ||
      data.targetUrl.length > MAX_URL_LENGTH ||
      !HTTPS_URL_REGEX.test(data.targetUrl)
    ) {
      return 'PERMISSION_DENIED';
    }

    if (
      typeof data.title !== 'string' ||
      data.title.length < 1 ||
      data.title.length > MAX_TITLE_LENGTH
    ) {
      return 'PERMISSION_DENIED';
    }

    if (
      typeof data.thumbnailDataUrl !== 'string' ||
      data.thumbnailDataUrl.length < 10 ||
      data.thumbnailDataUrl.length > MAX_THUMBNAIL_LENGTH
    ) {
      return 'PERMISSION_DENIED';
    }

    if (
      typeof data.delta !== 'number' ||
      !Number.isInteger(data.delta) ||
      data.delta < 1 ||
      data.delta > 64
    ) {
      return 'PERMISSION_DENIED';
    }

    if (typeof data.createdBy !== 'string' || data.createdBy !== ctx.auth?.uid) {
      return 'PERMISSION_DENIED';
    }

    if (ctx.operation === 'create') {
      if (data.createdAt !== ctx.requestTime) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOWED';
    }

    if (ctx.operation === 'update') {
      const existing = ctx.existing;
      if (!existing) return 'PERMISSION_DENIED';
      if (
        data.id !== existing.id ||
        data.hex !== existing.hex ||
        data.binary !== existing.binary ||
        data.createdBy !== existing.createdBy ||
        data.createdAt !== existing.createdAt
      ) {
        return 'PERMISSION_DENIED';
      }
      return 'ALLOWED';
    }
  }

  return 'PERMISSION_DENIED';
}

const VALID_PAYLOAD = {
  id: 10425,
  hex: '0x000028B9',
  binary: '00000000000000000010100010111001',
  targetUrl: 'https://official.veriimg.org/assets/10425',
  title: 'Chronograph Series I',
  thumbnailDataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/',
  delta: 14,
  createdBy: 'admin_uid_1',
  createdAt: '2026-11-09T05:38:00Z',
};

const SUPER_ADMIN_AUTH = {
  uid: 'admin_uid_1',
  email: 'nahid.main.ai@gmail.com',
  email_verified: true,
};

const DELEGATED_ADMIN_AUTH = {
  uid: 'delegated_uid_2',
  email: 'editor@veriimg.org',
  email_verified: true,
  isAdminInDb: true,
};

test('firestore.rules file contains all required 8-pillar primitives and Super Admin invariants', () => {
  const rulesText = fs.readFileSync('./firestore.rules', 'utf8');
  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes('allow read, write: if false;'));
  assert.ok(rulesText.includes('function isValidWatermarkAsset(data)'));
  assert.ok(rulesText.includes('function isSuperAdmin()'));
  assert.ok(rulesText.includes('request.auth.token.email_verified == true'));
  assert.ok(rulesText.includes("request.auth.token.email == 'nahid.main.ai@gmail.com'"));
  assert.ok(rulesText.includes('exists(/databases/$(database)/documents/admins/$(request.auth.token.email))'));
  assert.ok(rulesText.includes('incoming().createdAt == request.time'));
});

test('Super Admin and Delegated Admin can manage watermarks, while only Super Admin can add or revoke admins', () => {
  const now = '2026-11-09T05:38:00Z';

  // Super Admin creates watermark
  assert.equal(
    evaluateHardenedRules({
      auth: SUPER_ADMIN_AUTH,
      requestTime: now,
      operation: 'create',
      collection: 'watermarks',
      docId: '10425',
      incoming: VALID_PAYLOAD,
    }),
    'ALLOWED'
  );

  // Delegated Admin creates watermark
  assert.equal(
    evaluateHardenedRules({
      auth: DELEGATED_ADMIN_AUTH,
      requestTime: now,
      operation: 'create',
      collection: 'watermarks',
      docId: '10425',
      incoming: { ...VALID_PAYLOAD, createdBy: 'delegated_uid_2' },
    }),
    'ALLOWED'
  );

  // Super Admin authorizes a new delegated admin
  assert.equal(
    evaluateHardenedRules({
      auth: SUPER_ADMIN_AUTH,
      requestTime: now,
      operation: 'create',
      collection: 'admins',
      docId: 'editor@veriimg.org',
      incoming: {
        email: 'editor@veriimg.org',
        displayName: 'Editorial Lead',
        role: 'admin',
        addedBy: 'nahid.main.ai@gmail.com',
        createdAt: now,
      },
    }),
    'ALLOWED'
  );

  // Delegated Admin CANNOT authorize another admin (Super Admin only)
  assert.equal(
    evaluateHardenedRules({
      auth: DELEGATED_ADMIN_AUTH,
      requestTime: now,
      operation: 'create',
      collection: 'admins',
      docId: 'other@veriimg.org',
      incoming: {
        email: 'other@veriimg.org',
        displayName: 'Another User',
        role: 'admin',
        addedBy: 'nahid.main.ai@gmail.com',
        createdAt: now,
      },
    }),
    'PERMISSION_DENIED'
  );

  // Delegated Admin CANNOT delete an admin
  assert.equal(
    evaluateHardenedRules({
      auth: DELEGATED_ADMIN_AUTH,
      requestTime: now,
      operation: 'delete',
      collection: 'admins',
      docId: 'editor@veriimg.org',
    }),
    'PERMISSION_DENIED'
  );

  // Super Admin CAN delete a delegated admin
  assert.equal(
    evaluateHardenedRules({
      auth: SUPER_ADMIN_AUTH,
      requestTime: now,
      operation: 'delete',
      collection: 'admins',
      docId: 'editor@veriimg.org',
    }),
    'ALLOWED'
  );
});

test('All 12 Dirty Dozen adversarial payloads return PERMISSION_DENIED', () => {
  const now = '2026-11-09T05:38:00Z';

  // 1. Unauthenticated Write
  assert.equal(
    evaluateHardenedRules({
      auth: null,
      requestTime: now,
      operation: 'create',
      collection: 'watermarks',
      docId: '10425',
      incoming: VALID_PAYLOAD,
    }),
    'PERMISSION_DENIED'
  );

  // 2. Unverified Email Spoof
  assert.equal(
    evaluateHardenedRules({
      auth: { ...SUPER_ADMIN_AUTH, email_verified: false },
      requestTime: now,
      operation: 'create',
      collection: 'watermarks',
      docId: '10425',
      incoming: VALID_PAYLOAD,
    }),
    'PERMISSION_DENIED'
  );

  // 3. Non-Admin Authenticated Write
  assert.equal(
    evaluateHardenedRules({
      auth: { uid: 'user_99', email: 'attacker@example.com', email_verified: true },
      requestTime: now,
      operation: 'create',
      collection: 'watermarks',
      docId: '10425',
      incoming: { ...VALID_PAYLOAD, createdBy: 'user_99' },
    }),
    'PERMISSION_DENIED'
  );

  // 4. Shadow / Ghost Field Injection
  assert.equal(
    evaluateHardenedRules({
      auth: SUPER_ADMIN_AUTH,
      requestTime: now,
      operation: 'create',
      collection: 'watermarks',
      docId: '10425',
      incoming: { ...VALID_PAYLOAD, isSuperVerified: true },
    }),
    'PERMISSION_DENIED'
  );

  // 5. Insecure HTTP / Javascript URI Injection
  assert.equal(
    evaluateHardenedRules({
      auth: SUPER_ADMIN_AUTH,
      requestTime: now,
      operation: 'create',
      collection: 'watermarks',
      docId: '10425',
      incoming: { ...VALID_PAYLOAD, targetUrl: 'http://insecure.example.com/item' },
    }),
    'PERMISSION_DENIED'
  );

  // 6. Out-of-Range 32-bit Integer
  assert.equal(
    evaluateHardenedRules({
      auth: SUPER_ADMIN_AUTH,
      requestTime: now,
      operation: 'create',
      collection: 'watermarks',
      docId: '4294967296',
      incoming: { ...VALID_PAYLOAD, id: 4294967296 },
    }),
    'PERMISSION_DENIED'
  );

  // 7. ID / Payload Mismatch Poisoning
  assert.equal(
    evaluateHardenedRules({
      auth: SUPER_ADMIN_AUTH,
      requestTime: now,
      operation: 'create',
      collection: 'watermarks',
      docId: '10425',
      incoming: { ...VALID_PAYLOAD, id: 99999 },
    }),
    'PERMISSION_DENIED'
  );

  // 8. Identity Spoofing on createdBy
  assert.equal(
    evaluateHardenedRules({
      auth: SUPER_ADMIN_AUTH,
      requestTime: now,
      operation: 'create',
      collection: 'watermarks',
      docId: '10425',
      incoming: { ...VALID_PAYLOAD, createdBy: 'spoofed_uid' },
    }),
    'PERMISSION_DENIED'
  );

  // 9. Forged Client Timestamp
  assert.equal(
    evaluateHardenedRules({
      auth: SUPER_ADMIN_AUTH,
      requestTime: now,
      operation: 'create',
      collection: 'watermarks',
      docId: '10425',
      incoming: { ...VALID_PAYLOAD, createdAt: '1999-01-01T00:00:00Z' },
    }),
    'PERMISSION_DENIED'
  );

  // 10. Immutable Field Mutation on Update
  assert.equal(
    evaluateHardenedRules({
      auth: SUPER_ADMIN_AUTH,
      requestTime: now,
      operation: 'update',
      collection: 'watermarks',
      docId: '10425',
      existing: VALID_PAYLOAD,
      incoming: { ...VALID_PAYLOAD, hex: '0xFFFFFFFF' },
    }),
    'PERMISSION_DENIED'
  );

  // 11. Denial-of-Wallet Oversized Thumbnail
  assert.equal(
    evaluateHardenedRules({
      auth: SUPER_ADMIN_AUTH,
      requestTime: now,
      operation: 'create',
      collection: 'watermarks',
      docId: '10425',
      incoming: { ...VALID_PAYLOAD, thumbnailDataUrl: 'x'.repeat(150001) },
    }),
    'PERMISSION_DENIED'
  );

  // 12. Self-Assigned Admin Privilege Escalation
  assert.equal(
    evaluateHardenedRules({
      auth: { uid: 'user_99', email: 'attacker@example.com', email_verified: true },
      requestTime: now,
      operation: 'create',
      collection: 'admins',
      docId: 'attacker@example.com',
      incoming: {
        email: 'attacker@example.com',
        displayName: 'Attacker',
        role: 'admin',
        addedBy: 'nahid.main.ai@gmail.com',
        createdAt: now,
      },
    }),
    'PERMISSION_DENIED'
  );
});
