/**
 * XUHO CITY — FOUNDER V2 & LEGAL COMPLIANCE PRIVILEGED BACKEND (V4 — FIREBASE AUTH STANDARDIZED)
 * Universal Web-Standard / WinterCG Runtime (Cloudflare Workers + Node.js + Vite Middleware)
 * Zero `node:*` imports — uses Web Crypto API (`globalThis.crypto.subtle` & `getRandomValues`) and `fetch`.
 *
 * Architecture:
 * - Standardized 100% on Firebase Authentication (Email/Password + Google OAuth).
 * - Zero custom PBKDF2 passwordHash stored in RTDB; zero custom HMAC session tokens.
 * - Backup Founder logs in on UI with memorable `@username` + `password`; backend resolves
 *   `@username` -> verified `recoveryEmail` and authenticates via Firebase Authentication
 *   (`identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`), returning a real
 *   Firebase Auth session (`uid` 28-char alphanumeric).
 * - Primary Founder (`4ouY5sN8r3P6wQvX2kLm9jBcTd92`) manages Backup Founder (provision,
 *   password reset without old password, lock/unlock, session revocation, recovery email verification)
 *   through Firebase Auth Admin REST API (`projects/xuanhoacogi/accounts:update`) + RTDB `/xuanhoa_security`.
 *
 * Supported Endpoints (`/api/founder-security/*` — 14 routes):
 * 01. `POST /api/founder-security/provision-backup-founder`
 * 02. `POST /api/founder-security/login`
 * 03. `POST /api/founder-security/reset-password`
 * 04. `POST /api/founder-security/set-status` (alias: `lock-unlock`)
 * 05. `POST /api/founder-security/revoke-sessions`
 * 06. `POST /api/founder-security/verify-recovery-email`
 * 07. `POST /api/founder-security/forgot-password`
 * 08. `POST /api/founder-security/role-update`
 * 09. `POST /api/founder-security/consent-record`
 * 10. `POST /api/founder-security/consent-withdrawal`
 * 11. `POST /api/founder-security/data-rights`
 * 12. `GET|POST /api/founder-security/policy-version`
 * 13. `GET|POST /api/founder-security/status`
 * 14. `POST /api/founder-security/audit-logs`
 */

export const PRIMARY_FOUNDER_VERIFIED_UID = '4ouYaH3MRxe78eUNPIcy6cmgTd92';
export const PRIMARY_FOUNDER_EMAIL = 'marcel.vietnam@gmail.com';
export const DEFAULT_FIREBASE_PROJECT_ID = 'xuanhoacogi';
export const DEFAULT_FIREBASE_RTDB_URL = 'https://xuanhoacogi-default-rtdb.firebaseio.com';
export const DEFAULT_FIREBASE_WEB_API_KEY = 'AIzaSyCOiXc2W9oW6R-pycAyQl6iIe_LDCQezNw';
export const MAX_RECENT_AUTH_SECONDS = 300; // 5 minutes
export const RATE_LIMIT_MAX_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export const DEFAULT_POLICY_VERSION_META = {
  version: '2026.11.04-v3.0',
  privacyNoticeVersion: '2026.11.04-v3.0',
  communityGuidelinesVersion: '2026.11.04-v3.0',
  consentUiVersion: 'xuho-consent-ui-v3.0',
  effectiveDate: '2026-11-04',
  publishedAt: 1793750400000,
  requiresReconsent: true,
  title: 'Khung Pháp lý & Bảo vệ Dữ liệu Cá nhân V3.0 (Luật 91/2025/QH15 & NĐ 356/2025/NĐ-CP)',
  changes: [
    'Ban hành 4 trang pháp lý công khai độc lập: /terms, /privacy, /community-guidelines, /data-rights.',
    'Áp dụng cơ chế Google Login Consent tách bạch 4 tầng (A, B, C, D) với tùy chọn không tích sẵn.',
    'Lưu bằng chứng xác nhận (Consent Record) có serverTimestamp và nhật ký bất biến (consent_audit_trail).',
  ],
};

export function isVerified28CharUid(uid) {
  const clean = String(uid || '').trim();
  return /^[A-Za-z0-9]{28}$/.test(clean) && !/^[0-9]+$/.test(clean);
}

export function isStrongBackupFounderPassword(password) {
  const raw = String(password || '');
  if (raw.length < 12 || raw.length > 128) return false;
  return (
    /[A-Z]/.test(raw) &&
    /[a-z]/.test(raw) &&
    /[0-9]/.test(raw) &&
    /[^A-Za-z0-9]/.test(raw)
  );
}

export function isValidRealRecoveryEmail(email) {
  const clean = String(email || '').trim().toLowerCase();
  if (!clean || clean.length > 180) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) return false;
  if (
    clean.endsWith('.internal') ||
    clean.endsWith('.local') ||
    clean.includes('backup-founder.xuanhoacogi') ||
    clean.includes('founder-auth.xuanhoacogi')
  ) {
    return false;
  }
  return true;
}

// ============================================================================
// UNIVERSAL WEB CRYPTO & JWT HELPERS (Works in Cloudflare Workers V8 & Node.js)
// ============================================================================

function randomHexBytes(byteLength = 16) {
  const arr = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlEncodeJson(obj) {
  const enc = new TextEncoder();
  return base64UrlEncodeBytes(enc.encode(JSON.stringify(obj)));
}

function pemToArrayBuffer(pem) {
  const b64 = String(pem || '')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Mints a short-lived Google OAuth2 Access Token from a Service Account JSON
 * using standard Web Crypto RSASSA-PKCS1-v1_5 SHA-256 (works in Cloudflare Workers & Node.js).
 */
export async function mintServiceAccountAccessToken(serviceAccountInput) {
  try {
    const sa =
      typeof serviceAccountInput === 'string'
        ? JSON.parse(serviceAccountInput)
        : serviceAccountInput;
    if (!sa || !sa.client_email || !sa.private_key) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS256', typ: 'JWT' };
    const claimSet = {
      iss: sa.client_email,
      sub: sa.client_email,
      scope: [
        'https://www.googleapis.com/auth/firebase.database',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/identitytoolkit',
        'https://www.googleapis.com/auth/cloud-platform',
      ].join(' '),
      aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
      iat: nowSec,
      exp: nowSec + 3600,
    };

    const unsignedToken = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(claimSet)}`;
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'pkcs8',
      pemToArrayBuffer(sa.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await globalThis.crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      new TextEncoder().encode(unsignedToken)
    );
    const signedJwt = `${unsignedToken}.${base64UrlEncodeBytes(new Uint8Array(sigBuf))}`;

    const resp = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(signedJwt)}`,
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.access_token || null;
  } catch {
    return null;
  }
}

function decodeJwtPayloadUniversal(token) {
  try {
    const parts = String(token || '').trim().split('.');
    if (parts.length < 2) return null;
    const decodePart = part => {
      const base64 = part.replace(/-/g, '+').replace(/\//g, '/').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return JSON.parse(new TextDecoder('utf-8').decode(bytes));
    };
    const header = decodePart(parts[0]);
    const payload = decodePart(parts[1]);
    return {
      ...payload,
      alg: header?.alg || payload?.alg,
    };
  } catch {
    return null;
  }
}

function createEmulatorFirebaseIdToken({ uid, email, authTimeSec }) {
  const nowSec = authTimeSec || Math.floor(Date.now() / 1000);
  const header = { alg: 'none', typ: 'JWT' };
  const payload = {
    iss: `https://securetoken.google.com/${DEFAULT_FIREBASE_PROJECT_ID}`,
    aud: DEFAULT_FIREBASE_PROJECT_ID,
    auth_time: nowSec,
    user_id: uid,
    sub: uid,
    iat: nowSec,
    exp: nowSec + 3600,
    email,
    email_verified: true,
    firebase: {
      identities: { email: [email] },
      sign_in_provider: 'password',
    },
  };
  return `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}.`;
}

function sanitizeAuditString(input, maxLen = 280) {
  const raw = String(input || '')
    .replace(/password\s*[:=]\s*\S+/gi, '[REDACTED]')
    .replace(/token\s*[:=]\s*\S+/gi, '[REDACTED]')
    .replace(/secret\s*[:=]\s*\S+/gi, '[REDACTED]')
    .trim();
  return raw.slice(0, maxLen);
}

function getSafeEnv() {
  try {
    if (typeof process !== 'undefined' && process && process.env) {
      return process.env;
    }
  } catch {}
  return {};
}

/**
 * Creates a self-contained Founder Security & Legal Compliance Backend instance.
 * Standardized on Firebase Authentication (Identity Toolkit Email/Password + Google OAuth).
 */
export function createFounderSecurityBackend(options = {}) {
  const procEnv = getSafeEnv();
  const projectId =
    options.projectId || procEnv.VITE_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID;
  const rtdbUrl = (
    options.rtdbUrl ||
    options.rtdbBaseUrl ||
    procEnv.FIREBASE_DATABASE_EMULATOR_URL ||
    procEnv.VITE_FIREBASE_DATABASE_URL ||
    DEFAULT_FIREBASE_RTDB_URL
  ).replace(/\/$/, '');

  const isEmulatorRtdb = rtdbUrl.includes('127.0.0.1') || rtdbUrl.includes('localhost');
  const rtdbNamespace = options.rtdbNamespace || 'xuanhoacogi-default-rtdb';
  const defaultOwnerToken = options.emulatorOwnerToken || 'owner';
  const firebaseApiKey =
    options.firebaseApiKey || procEnv.VITE_FIREBASE_API_KEY || DEFAULT_FIREBASE_WEB_API_KEY;
  const serviceAccountJson =
    options.serviceAccountJson || procEnv.FIREBASE_SERVICE_ACCOUNT_JSON || '';
  const firebaseAccessToken =
    options.firebaseAccessToken || procEnv.FIREBASE_ACCESS_TOKEN || '';
  const firebaseDatabaseSecret =
    options.firebaseDatabaseSecret || procEnv.FIREBASE_DATABASE_SECRET || '';
  const allowEmulatorTokens =
    options.allowEmulatorTokens !== undefined
      ? Boolean(options.allowEmulatorTokens)
      : isEmulatorRtdb;

  let cachedSaToken = { token: null, expiresAt: 0 };

  async function getPrivilegedGoogleAccessToken() {
    if (firebaseAccessToken) return firebaseAccessToken;
    if (!serviceAccountJson) return null;
    const now = Date.now();
    if (cachedSaToken.token && cachedSaToken.expiresAt > now + 60000) {
      return cachedSaToken.token;
    }
    const minted = await mintServiceAccountAccessToken(serviceAccountJson);
    if (minted) {
      cachedSaToken = { token: minted, expiresAt: now + 50 * 60 * 1000 };
    }
    return minted;
  }

  // In-memory Firebase Identity Toolkit Emulator Store (used ONLY when allowEmulatorTokens === true)
  // Never persisted to RTDB, LocalStorage, or Git.
  const firebaseAuthEmulatorByUid = new Map();
  const rateLimitBuckets = new Map();
  const dispatchedRecoveryEmails = [];

  // Mirror state for fast access when RTDB is not reachable or in local test mode
  const stateMirror = {
    primary_founder: {
      [PRIMARY_FOUNDER_VERIFIED_UID]: true,
    },
    backup_founder: {},
    admins: {
      [PRIMARY_FOUNDER_VERIFIED_UID]: true,
    },
    managers: {},
    locked_uids: {},
    auditLogs: [],
    user_consents: {},
    consent_audit_trail: {},
    data_rights_requests: {},
    policy_versions: {
      current: { ...DEFAULT_POLICY_VERSION_META },
      changelog: [{ ...DEFAULT_POLICY_VERSION_META }],
    },
  };

  // ==========================================================================
  // FIREBASE IDENTITY TOOLKIT ADAPTER (Real Firebase Auth in Prod / Emulator in Test)
  // ==========================================================================

  async function firebaseAuthProvisionOrUpdateUser({
    uid,
    email,
    password,
    displayName,
    emailVerified = true,
    now = Date.now(),
  }) {
    if (!allowEmulatorTokens) {
      const adminOAuthToken = await getPrivilegedGoogleAccessToken();
      if (adminOAuthToken) {
        // Privileged Admin Identity Toolkit API: create or update Firebase Auth user with exact UID/email/password
        const updateResp = await fetch(
          `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:update`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminOAuthToken}`,
            },
            body: JSON.stringify({
              localId: uid,
              email,
              password,
              displayName,
              emailVerified: Boolean(emailVerified),
              disableUser: false,
            }),
          }
        ).catch(() => null);

        if (updateResp && updateResp.ok) {
          return { ok: true, uid, email, provider: 'firebase_auth_admin_api' };
        }

        const signUpResp = await fetch(
          `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminOAuthToken}`,
            },
            body: JSON.stringify({
              localId: uid,
              email,
              password,
              displayName,
              emailVerified: Boolean(emailVerified),
              disabled: false,
            }),
          }
        ).catch(() => null);

        if (signUpResp && signUpResp.ok) {
          const data = await signUpResp.json();
          return {
            ok: true,
            uid: data.localId || uid,
            email,
            provider: 'firebase_auth_admin_api',
          };
        }
      }

      if (firebaseApiKey) {
        // Fallback to public Identity Toolkit signUp if client has not already created the user
        const resp = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(firebaseApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              password,
              displayName,
              returnSecureToken: true,
            }),
          }
        ).catch(() => null);
        if (resp && resp.ok) {
          const data = await resp.json();
          if (data.idToken) {
            await fetch(
              `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(firebaseApiKey)}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  requestType: 'VERIFY_EMAIL',
                  idToken: data.idToken,
                }),
              }
            ).catch(() => null);
          }
          return {
            ok: true,
            uid: data.localId || uid,
            email,
            provider: 'firebase_auth_rest_api',
          };
        }
      }
    }

    // Emulator mode: store in Firebase Auth Identity Toolkit Emulator memory
    firebaseAuthEmulatorByUid.set(uid, {
      localId: uid,
      email: String(email || '').toLowerCase(),
      password: String(password || ''),
      displayName: String(displayName || ''),
      emailVerified: Boolean(emailVerified),
      disabled: false,
      validSinceSec: Math.floor(now / 1000),
      passwordUpdatedAt: now,
    });
    return { ok: true, uid, email, provider: 'firebase_auth_emulator' };
  }

  async function firebaseAuthAdminUpdateUser({
    uid,
    newPassword,
    disabled,
    validSinceSec,
    email,
    emailVerified,
    now = Date.now(),
  }) {
    if (!allowEmulatorTokens) {
      const adminOAuthToken = await getPrivilegedGoogleAccessToken();
      if (adminOAuthToken) {
        const updatePayload = { localId: uid };
        if (newPassword !== undefined) updatePayload.password = newPassword;
        if (disabled !== undefined) updatePayload.disableUser = Boolean(disabled);
        if (validSinceSec !== undefined) updatePayload.validSince = Number(validSinceSec);
        if (email !== undefined) updatePayload.email = email;
        if (emailVerified !== undefined) updatePayload.emailVerified = Boolean(emailVerified);

        const resp = await fetch(
          `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:update`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${adminOAuthToken}`,
            },
            body: JSON.stringify(updatePayload),
          }
        ).catch(() => null);
        if (resp && resp.ok) {
          return { ok: true, provider: 'firebase_auth_admin_api' };
        }
      }
    }

    const existing = firebaseAuthEmulatorByUid.get(uid) || {
      localId: uid,
      email: email || '',
      password: '',
      displayName: 'Backup Founder',
      emailVerified: true,
      disabled: false,
      validSinceSec: Math.floor(now / 1000),
    };
    if (newPassword !== undefined) {
      existing.password = String(newPassword);
      existing.passwordUpdatedAt = now;
    }
    if (disabled !== undefined) {
      existing.disabled = Boolean(disabled);
    }
    if (validSinceSec !== undefined) {
      existing.validSinceSec = Number(validSinceSec);
    }
    if (email !== undefined) {
      existing.email = String(email).toLowerCase();
    }
    if (emailVerified !== undefined) {
      existing.emailVerified = Boolean(emailVerified);
    }
    firebaseAuthEmulatorByUid.set(uid, existing);
    return { ok: true, provider: 'firebase_auth_emulator' };
  }

  async function firebaseAuthSignInWithPassword({ email, password, expectedUid, now = Date.now() }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!allowEmulatorTokens && firebaseApiKey) {
      try {
        const resp = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(firebaseApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: cleanEmail,
              password: String(password || ''),
              returnSecureToken: true,
            }),
          }
        );
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          const errCode = String(errData?.error?.message || '');
          if (errCode.includes('USER_DISABLED')) {
            return { ok: false, status: 403, code: 'USER_DISABLED' };
          }
          return { ok: false, status: 401, code: errCode || 'INVALID_LOGIN_CREDENTIALS' };
        }
        const data = await resp.json();
        return {
          ok: true,
          uid: data.localId || expectedUid,
          email: data.email || cleanEmail,
          idToken: data.idToken,
          refreshToken: data.refreshToken,
          expiresIn: Number(data.expiresIn || 3600),
        };
      } catch {
        return { ok: false, status: 500, code: 'AUTH_NETWORK_ERROR' };
      }
    }

    // Emulator mode: verify against Firebase Auth Emulator account
    let targetAcc = expectedUid ? firebaseAuthEmulatorByUid.get(expectedUid) : null;
    if (!targetAcc) {
      for (const acc of firebaseAuthEmulatorByUid.values()) {
        if (acc.email === cleanEmail) {
          targetAcc = acc;
          break;
        }
      }
    }
    if (!targetAcc || !targetAcc.password || targetAcc.password !== String(password || '')) {
      return { ok: false, status: 401, code: 'INVALID_LOGIN_CREDENTIALS' };
    }
    if (targetAcc.disabled) {
      return { ok: false, status: 403, code: 'USER_DISABLED' };
    }
    const idToken = createEmulatorFirebaseIdToken({
      uid: targetAcc.localId,
      email: targetAcc.email,
      authTimeSec: Math.floor(now / 1000),
    });
    return {
      ok: true,
      uid: targetAcc.localId,
      email: targetAcc.email,
      idToken,
      refreshToken: `emul_refresh_${targetAcc.localId}`,
      expiresIn: 3600,
    };
  }

  async function firebaseAuthSendPasswordResetEmail({ email, uid, username, now = Date.now() }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!allowEmulatorTokens && firebaseApiKey) {
      try {
        await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(firebaseApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requestType: 'PASSWORD_RESET',
              email: cleanEmail,
            }),
          }
        );
      } catch {}
    }
    dispatchedRecoveryEmails.push({
      uid,
      username,
      recoveryEmail: cleanEmail,
      requestType: 'PASSWORD_RESET',
      provider: allowEmulatorTokens ? 'firebase_auth_emulator_oob' : 'firebase_auth_sendOobCode',
      dispatchedAt: now,
    });
    return true;
  }

  // ==========================================================================
  // RTDB READ / WRITE (Supports both Emulator and Production REST API)
  // ==========================================================================

  async function buildRtdbRequestUrlAndHeaders(cleanPath, callerOrOwnerToken) {
    if (isEmulatorRtdb) {
      const url = `${rtdbUrl}/${cleanPath}.json?ns=${encodeURIComponent(rtdbNamespace)}`;
      const headers = callerOrOwnerToken
        ? { Authorization: `Bearer ${callerOrOwnerToken}` }
        : {};
      return { url, headers };
    }

    // Production Firebase RTDB (`https://xuanhoacogi-default-rtdb.firebaseio.com`):
    // 1. Prefer Service Account OAuth2 Access Token if available for backend operations
    const saOAuthToken = await getPrivilegedGoogleAccessToken();
    if (saOAuthToken) {
      return {
        url: `${rtdbUrl}/${cleanPath}.json`,
        headers: { Authorization: `Bearer ${saOAuthToken}` },
      };
    }

    // 2. If Database Secret is configured and caller passed defaultOwnerToken
    if (firebaseDatabaseSecret && (!callerOrOwnerToken || callerOrOwnerToken === defaultOwnerToken)) {
      return {
        url: `${rtdbUrl}/${cleanPath}.json?auth=${encodeURIComponent(firebaseDatabaseSecret)}`,
        headers: {},
      };
    }

    // 3. Otherwise pass caller's verified Firebase Auth ID Token via `?auth=<ID_TOKEN>`
    if (callerOrOwnerToken && callerOrOwnerToken !== defaultOwnerToken) {
      return {
        url: `${rtdbUrl}/${cleanPath}.json?auth=${encodeURIComponent(callerOrOwnerToken)}`,
        headers: {},
      };
    }

    return { url: `${rtdbUrl}/${cleanPath}.json`, headers: {} };
  }

  async function rtdbRead(path, bearerToken = defaultOwnerToken) {
    const cleanPath = String(path || '').replace(/^\//, '');
    if (options.useLocalMirrorOnly) {
      const parts = cleanPath.split('/').filter(Boolean);
      let cur = stateMirror;
      for (const p of parts) {
        if (cur == null || typeof cur !== 'object') return null;
        cur = cur[p];
      }
      return cur ?? null;
    }
    try {
      const { url, headers } = await buildRtdbRequestUrlAndHeaders(cleanPath, bearerToken);
      const res = await fetch(url, { method: 'GET', headers });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function rtdbWrite(path, method, value, bearerToken = defaultOwnerToken) {
    const cleanPath = String(path || '').replace(/^\//, '');
    if (!options.useLocalMirrorOnly) {
      try {
        const { url, headers } = await buildRtdbRequestUrlAndHeaders(cleanPath, bearerToken);
        await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: value === undefined ? undefined : JSON.stringify(value),
        });
      } catch {
        // Fallback to mirror update
      }
    }
  }

  function checkRateLimit(bucketKey, now = Date.now()) {
    const existing = rateLimitBuckets.get(bucketKey);
    if (!existing) {
      return { blocked: false, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS, retryAfterSeconds: 0 };
    }
    if (existing.lockedUntil && existing.lockedUntil > now) {
      return {
        blocked: true,
        remainingAttempts: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.lockedUntil - now) / 1000)),
      };
    }
    if (now - existing.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
      rateLimitBuckets.delete(bucketKey);
      return { blocked: false, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS, retryAfterSeconds: 0 };
    }
    return {
      blocked: false,
      remainingAttempts: Math.max(0, RATE_LIMIT_MAX_ATTEMPTS - existing.attempts),
      retryAfterSeconds: 0,
    };
  }

  function recordFailedAttempt(bucketKey, now = Date.now()) {
    const existing = rateLimitBuckets.get(bucketKey);
    if (!existing || now - existing.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
      const next = { attempts: 1, firstAttemptAt: now, lockedUntil: 0 };
      rateLimitBuckets.set(bucketKey, next);
      return { blocked: false, attempts: 1, retryAfterSeconds: 0 };
    }
    existing.attempts += 1;
    if (existing.attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
      existing.lockedUntil = now + RATE_LIMIT_WINDOW_MS;
      rateLimitBuckets.set(bucketKey, existing);
      return {
        blocked: true,
        attempts: existing.attempts,
        retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000),
      };
    }
    rateLimitBuckets.set(bucketKey, existing);
    return { blocked: false, attempts: existing.attempts, retryAfterSeconds: 0 };
  }

  function clearRateLimit(bucketKey) {
    rateLimitBuckets.delete(bucketKey);
  }

  /**
   * Verifies the caller's Firebase ID Token and resolves their verified UID, email, auth_time, and role.
   * Never trusts client-supplied uid or role in body.
   * In Production (`!allowEmulatorTokens`), strictly rejects `alg === "none"` and verifies via Identity Toolkit `accounts:lookup`.
   */
  async function verifyCallerIdentity(authHeader, nowSec = Math.floor(Date.now() / 1000)) {
    const rawHeader = String(authHeader || '').trim();
    if (!rawHeader.toLowerCase().startsWith('bearer ')) {
      return {
        ok: false,
        status: 401,
        message: 'Thiếu Firebase ID Token xác thực (Authorization Bearer).',
      };
    }
    const token = rawHeader.slice(7).trim();
    if (!token) {
      return { ok: false, status: 401, message: 'Firebase ID Token rỗng.' };
    }

    let decoded = decodeJwtPayloadUniversal(token);
    if (!decoded) {
      return { ok: false, status: 401, message: 'Định dạng Firebase ID Token không hợp lệ.' };
    }

    // CRITICAL PRODUCTION SAFETY: Reject unsigned alg=none tokens when allowEmulatorTokens is false
    if (!allowEmulatorTokens && (!decoded.alg || String(decoded.alg).toLowerCase() === 'none')) {
      return {
        ok: false,
        status: 401,
        message: 'Token không chữ ký (alg=none) bị từ chối trên môi trường Production.',
      };
    }

    // In Production mode, verify token against Firebase Authentication Identity Toolkit accounts:lookup
    if (!allowEmulatorTokens && firebaseApiKey) {
      try {
        const resp = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: token }),
          }
        );
        if (!resp.ok) {
          return {
            ok: false,
            status: 401,
            message: 'Firebase ID Token không hợp lệ hoặc đã hết hạn.',
          };
        }
        const data = await resp.json();
        const user = data?.users?.[0];
        if (!user || !user.localId || user.disabled) {
          return {
            ok: false,
            status: 401,
            message: 'Tài khoản Firebase Auth không tồn tại hoặc đã bị vô hiệu hóa.',
          };
        }
        const validSinceSec = Number(user.validSince || 0);
        const tokenAuthTime = Number(decoded.auth_time || decoded.iat || 0);
        if (validSinceSec > 0 && tokenAuthTime > 0 && tokenAuthTime < validSinceSec) {
          return {
            ok: false,
            status: 401,
            message: 'Phiên đăng nhập Firebase Auth đã bị thu hồi (validSince).',
          };
        }
        decoded = {
          ...decoded,
          sub: user.localId,
          user_id: user.localId,
          email: user.email || decoded.email || '',
          email_verified: Boolean(user.emailVerified ?? decoded.email_verified),
        };
      } catch {
        return {
          ok: false,
          status: 401,
          message: 'Lỗi xác minh Firebase ID Token với máy chủ xác thực.',
        };
      }
    }

    const uid = String(decoded.user_id || decoded.sub || decoded.uid || '').trim();
    if (!isVerified28CharUid(uid)) {
      return {
        ok: false,
        status: 403,
        message: 'UID trong token không phải Firebase Auth UID 28 ký tự đã xác minh.',
      };
    }

    if (decoded.exp && Number(decoded.exp) < nowSec) {
      return { ok: false, status: 401, message: 'Phiên đăng nhập (ID Token) đã hết hạn.' };
    }

    const authTimeSec = Number(decoded.auth_time || decoded.iat || 0);
    const isRecentAuth = authTimeSec > 0 && nowSec - authTimeSec <= MAX_RECENT_AUTH_SECONDS;

    // Check RTDB / mirror for Primary Founder & Backup Founder & Admin & Locked status
    const rtdbPrimary = await rtdbRead(`xuanhoa_security/primary_founder/${uid}`, token);
    const isPrimaryFounder =
      rtdbPrimary === true ||
      stateMirror.primary_founder[uid] === true ||
      (uid === PRIMARY_FOUNDER_VERIFIED_UID &&
        String(decoded.email || '').toLowerCase() === PRIMARY_FOUNDER_EMAIL);

    const rtdbLocked = await rtdbRead(`xuanhoa_security/locked_uids/${uid}`, token);
    const isLocked = rtdbLocked === true || stateMirror.locked_uids[uid] === true;

    const rtdbBackup = await rtdbRead(`xuanhoa_security/backup_founder/${uid}`, token);
    const mirrorBackup = stateMirror.backup_founder[uid];
    const backupEntry = rtdbBackup !== null ? rtdbBackup : mirrorBackup;
    const isBackupEntryPresent = backupEntry !== undefined && backupEntry !== null;
    const isBackupActive =
      !isLocked &&
      (backupEntry === true || (typeof backupEntry === 'object' && backupEntry?.active === true));

    // Check session revocation timestamp (tokensValidAfterTime)
    const emulAcc = firebaseAuthEmulatorByUid.get(uid);
    const validAfterMs = Number(
      (emulAcc?.validSinceSec ? emulAcc.validSinceSec * 1000 : 0) ||
        (typeof backupEntry === 'object' ? backupEntry?.tokensValidAfterTime : 0) ||
        0
    );
    if (validAfterMs > 0 && authTimeSec * 1000 < validAfterMs - 1000) {
      return {
        ok: false,
        status: 401,
        message: 'Phiên đăng nhập này đã bị thu hồi (Session Revoked). Vui lòng đăng nhập lại.',
      };
    }

    // Critical Disable Bypass check: if uid is in backup_founder with active !== true, deny all roles
    if (!isPrimaryFounder && isBackupEntryPresent && !isBackupActive) {
      return {
        ok: false,
        status: 403,
        message:
          'Tài khoản Backup Founder đã bị khóa hoặc vô hiệu hóa (active=false). Mọi quyền đã bị chặn.',
      };
    }

    if (!isPrimaryFounder && isLocked) {
      return {
        ok: false,
        status: 403,
        message: 'Tài khoản đã bị khóa bảo mật (locked_uids).',
      };
    }

    const rtdbAdmin = await rtdbRead(`xuanhoa_security/admins/${uid}`, token);
    const isOperationalAdmin =
      isPrimaryFounder ||
      isBackupActive ||
      (!isBackupEntryPresent &&
        !isLocked &&
        (rtdbAdmin === true || stateMirror.admins[uid] === true));

    return {
      ok: true,
      uid,
      email: String(decoded.email || '').trim().toLowerCase(),
      authTimeSec,
      isRecentAuth,
      isPrimaryFounder,
      isBackupFounder: !isPrimaryFounder && isBackupActive,
      isFounder: isPrimaryFounder || isBackupActive,
      isOperationalAdmin,
      rawToken: token,
    };
  }

  async function appendBackendAuditLog({
    actorUid,
    actorRole,
    action,
    target,
    eventCategory = 'founder_security',
    refId = 'founder_security',
    bearerToken = defaultOwnerToken,
  }) {
    const now = Date.now();
    const logId = `audit_srv_${now}_${randomHexBytes(3)}`;
    const entry = {
      id: logId,
      action: sanitizeAuditString(action, 280),
      target: sanitizeAuditString(target, 280),
      type: 'user',
      actorUid,
      actorRole,
      eventCategory,
      verificationSource: 'backend_admin_verified',
      refId: sanitizeAuditString(refId, 120),
      timestamp: now,
    };
    stateMirror.auditLogs.unshift(entry);
    if (stateMirror.auditLogs.length > 200) {
      stateMirror.auditLogs.length = 200;
    }
    await rtdbWrite(`xuanhoa_admin/global_state/auditLogs/${logId}`, 'PUT', entry, bearerToken);
    return entry;
  }

  /**
   * Core API dispatcher: handles all `/api/founder-security/*` routes.
   */
  async function handleAction(actionName, body = {}, context = {}) {
    const now = context.now || Date.now();
    const nowSec = Math.floor(now / 1000);
    const clientIp = String(context.ip || '127.0.0.1').trim();
    const authHeader = context.authorization || '';

    // ------------------------------------------------------------------------
    // 01. POST /api/founder-security/provision-backup-founder
    // ------------------------------------------------------------------------
    if (actionName === 'provision-backup-founder') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;
      if (!caller.isPrimaryFounder) {
        return {
          ok: false,
          status: 403,
          message:
            'Chỉ Primary Founder (Dê Già Designer) mới có quyền khởi tạo hoặc thay thế Backup Founder.',
        };
      }
      if (!caller.isRecentAuth) {
        return {
          ok: false,
          status: 403,
          code: 'RECENT_AUTH_REQUIRED',
          message: 'Thao tác nhạy cảm yêu cầu xác thực lại phiên gần đây (auth_time <= 5 phút).',
        };
      }

      const cleanUsername = String(body.username || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, '');
      if (cleanUsername.length < 4 || cleanUsername.length > 48) {
        return {
          ok: false,
          status: 400,
          message: 'Tên đăng nhập Backup Founder phải từ 4–48 ký tự (a-z, 0-9, ., _, -).',
        };
      }

      const rawPassword = String(body.password || '');
      if (!isStrongBackupFounderPassword(rawPassword)) {
        return {
          ok: false,
          status: 400,
          message:
            'Mật khẩu Backup Founder phải có ít nhất 12 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.',
        };
      }

      const cleanRecoveryEmail = String(body.recoveryEmail || '').trim().toLowerCase();
      if (!isValidRealRecoveryEmail(cleanRecoveryEmail)) {
        return {
          ok: false,
          status: 400,
          message:
            'Email khôi phục phải là địa chỉ email thực tế hợp lệ (không dùng email nội bộ giả).',
        };
      }

      // Generate or use provided verified 28-char Firebase Auth UID
      let backupUid = String(body.uid || '').trim();
      if (!isVerified28CharUid(backupUid) || backupUid === caller.uid) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let generated = 'Bf';
        const randBytes = new Uint8Array(26);
        globalThis.crypto.getRandomValues(randBytes);
        for (let i = 0; i < 26; i++) {
          generated += chars[randBytes[i] % chars.length];
        }
        backupUid = generated;
      }

      const displayName = String(body.displayName || `Backup Founder (@${cleanUsername})`).trim();

      // Provision or update account in Firebase Authentication (Email/Password managed by Firebase Auth)
      const fbProvision = await firebaseAuthProvisionOrUpdateUser({
        uid: backupUid,
        email: cleanRecoveryEmail,
        password: rawPassword,
        displayName,
        emailVerified: Boolean(body.emailVerified ?? true),
        now,
      });
      if (fbProvision?.uid && isVerified28CharUid(fbProvision.uid)) {
        backupUid = fbProvision.uid;
      }

      // Disable any previous Backup Founder accounts and remove their residual admin/manager flags
      const existingBackups =
        (await rtdbRead('xuanhoa_security/backup_founder', caller.rawToken)) ||
        stateMirror.backup_founder ||
        {};
      for (const [oldUid, oldVal] of Object.entries(existingBackups)) {
        if (oldUid !== backupUid && isVerified28CharUid(oldUid)) {
          const oldObj =
            typeof oldVal === 'object' && oldVal ? oldVal : { uid: oldUid, username: 'old_backup' };
          const deactivated = {
            ...oldObj,
            uid: oldUid,
            active: false,
            updatedAt: now,
            sessionEpoch: Number(oldObj.sessionEpoch || 1) + 1,
            tokensValidAfterTime: now,
          };
          stateMirror.backup_founder[oldUid] = deactivated;
          delete stateMirror.admins[oldUid];
          delete stateMirror.managers[oldUid];
          await firebaseAuthAdminUpdateUser({
            uid: oldUid,
            disabled: true,
            validSinceSec: nowSec,
            now,
          });
          await rtdbWrite(
            `xuanhoa_security/backup_founder/${oldUid}`,
            'PUT',
            deactivated,
            caller.rawToken
          );
          await rtdbWrite(`xuanhoa_security/admins/${oldUid}`, 'PUT', false, caller.rawToken);
          await rtdbWrite(`xuanhoa_security/managers/${oldUid}`, 'PUT', false, caller.rawToken);
        }
      }

      // Record in RTDB contains ONLY metadata — NEVER password, passwordHash, or secret
      const record = {
        uid: backupUid,
        username: cleanUsername,
        displayName,
        recoveryEmail: cleanRecoveryEmail,
        emailVerified: Boolean(body.emailVerified ?? true),
        active: true,
        createdByUid: caller.uid,
        createdAt: now,
        updatedAt: now,
        lastPasswordResetAt: now,
        tokensValidAfterTime: now,
        sessionEpoch: 1,
      };

      stateMirror.backup_founder[backupUid] = record;
      stateMirror.admins[backupUid] = true;
      delete stateMirror.locked_uids[backupUid];

      await rtdbWrite(
        `xuanhoa_security/backup_founder/${backupUid}`,
        'PUT',
        record,
        caller.rawToken
      );
      await rtdbWrite(`xuanhoa_security/admins/${backupUid}`, 'PUT', true, caller.rawToken);
      await rtdbWrite(`xuanhoa_security/locked_uids/${backupUid}`, 'PUT', false, caller.rawToken);

      const audit = await appendBackendAuditLog({
        actorUid: caller.uid,
        actorRole: 'primary_founder',
        action: 'Khởi tạo Backup Founder (Firebase Auth Email/Password)',
        target: `@${cleanUsername} (UID: ${backupUid.slice(0, 6)}...${backupUid.slice(-4)})`,
        eventCategory: 'founder_security',
        refId: backupUid,
        bearerToken: caller.rawToken,
      });

      return {
        ok: true,
        status: 200,
        authProvider: fbProvision.provider,
        message: `Đã khởi tạo Backup Founder (@${cleanUsername}) qua Firebase Authentication thành công.`,
        record,
        auditLog: audit,
      };
    }

    // ------------------------------------------------------------------------
    // 02. POST /api/founder-security/reset-password
    //     Primary Founder sets a new password for Backup Founder WITHOUT old password via Firebase Auth Admin
    // ------------------------------------------------------------------------
    if (actionName === 'reset-password') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;
      if (!caller.isPrimaryFounder) {
        return {
          ok: false,
          status: 403,
          message: 'Chỉ Primary Founder mới được đặt lại mật khẩu cho Backup Founder.',
        };
      }
      if (!caller.isRecentAuth) {
        return {
          ok: false,
          status: 403,
          code: 'RECENT_AUTH_REQUIRED',
          message:
            'Vui lòng xác thực lại phiên Primary Founder gần đây (auth_time <= 5 phút) trước khi đặt lại mật khẩu.',
        };
      }

      const targetUid = String(body.backupUid || '').trim();
      const newPassword = String(body.newPassword || '');
      const confirmPassword = String(body.confirmPassword ?? newPassword);

      if (!isVerified28CharUid(targetUid)) {
        return { ok: false, status: 400, message: 'UID Backup Founder không hợp lệ.' };
      }
      if (newPassword !== confirmPassword) {
        return { ok: false, status: 400, message: 'Mật khẩu xác nhận không khớp.' };
      }
      if (!isStrongBackupFounderPassword(newPassword)) {
        return {
          ok: false,
          status: 400,
          message:
            'Mật khẩu mới phải có ít nhất 12 ký tự, gồm chữ hoa, chữ thường, chữ số và ký tự đặc biệt.',
        };
      }

      const existingRtdb =
        (await rtdbRead(`xuanhoa_security/backup_founder/${targetUid}`, caller.rawToken)) ||
        stateMirror.backup_founder[targetUid];
      if (!existingRtdb || typeof existingRtdb !== 'object') {
        return { ok: false, status: 404, message: 'Không tìm thấy hồ sơ Backup Founder.' };
      }

      const nextEpoch = Number(existingRtdb.sessionEpoch || 1) + 1;
      const updatedRecord = {
        ...existingRtdb,
        uid: targetUid,
        updatedAt: now,
        lastPasswordResetAt: now,
        tokensValidAfterTime: now,
        sessionEpoch: nextEpoch,
      };
      delete updatedRecord.mfaRequired;

      // Update password & validSince directly in Firebase Authentication
      await firebaseAuthAdminUpdateUser({
        uid: targetUid,
        email: updatedRecord.recoveryEmail,
        newPassword,
        validSinceSec: nowSec,
        now,
      });

      stateMirror.backup_founder[targetUid] = updatedRecord;
      clearRateLimit(`user:${String(updatedRecord.username || '').toLowerCase()}`);

      await rtdbWrite(
        `xuanhoa_security/backup_founder/${targetUid}`,
        'PUT',
        updatedRecord,
        caller.rawToken
      );

      const audit = await appendBackendAuditLog({
        actorUid: caller.uid,
        actorRole: 'primary_founder',
        action: 'Đặt lại mật khẩu Backup Founder & Thu hồi phiên cũ (Firebase Auth)',
        target: `@${updatedRecord.username} (Epoch #${nextEpoch})`,
        eventCategory: 'founder_security',
        refId: targetUid,
        bearerToken: caller.rawToken,
      });

      return {
        ok: true,
        status: 200,
        message: `Đã đặt mật khẩu mới cho Backup Founder (@${updatedRecord.username}) trên Firebase Authentication và thu hồi phiên cũ.`,
        sessionEpoch: nextEpoch,
        lastPasswordResetAt: now,
        record: updatedRecord,
        auditLog: audit,
      };
    }

    // ------------------------------------------------------------------------
    // 03. POST /api/founder-security/set-status (or lock-unlock)
    // ------------------------------------------------------------------------
    if (actionName === 'set-status' || actionName === 'lock-unlock') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;
      if (!caller.isPrimaryFounder) {
        return {
          ok: false,
          status: 403,
          message:
            'Chỉ Primary Founder mới có quyền khóa hoặc mở khóa tài khoản Backup Founder.',
        };
      }
      if (!caller.isRecentAuth) {
        return {
          ok: false,
          status: 403,
          code: 'RECENT_AUTH_REQUIRED',
          message: 'Thao tác khóa/mở khóa Backup Founder yêu cầu phiên xác thực gần đây.',
        };
      }

      const targetUid = String(body.backupUid || '').trim();
      const nextActive = Boolean(body.active);
      if (!isVerified28CharUid(targetUid)) {
        return { ok: false, status: 400, message: 'UID Backup Founder không hợp lệ.' };
      }

      const existingRtdb =
        (await rtdbRead(`xuanhoa_security/backup_founder/${targetUid}`, caller.rawToken)) ||
        stateMirror.backup_founder[targetUid];
      if (!existingRtdb || typeof existingRtdb !== 'object') {
        return { ok: false, status: 404, message: 'Không tìm thấy hồ sơ Backup Founder.' };
      }

      const nextEpoch = Number(existingRtdb.sessionEpoch || 1) + 1;
      const updatedRecord = {
        ...existingRtdb,
        uid: targetUid,
        active: nextActive,
        updatedAt: now,
        tokensValidAfterTime: now,
        sessionEpoch: nextEpoch,
      };
      delete updatedRecord.mfaRequired;

      // Sync disableUser & validSince to Firebase Authentication
      await firebaseAuthAdminUpdateUser({
        uid: targetUid,
        disabled: !nextActive,
        validSinceSec: nowSec,
        now,
      });

      stateMirror.backup_founder[targetUid] = updatedRecord;
      if (!nextActive) {
        stateMirror.admins[targetUid] = false;
        stateMirror.managers[targetUid] = false;
        stateMirror.locked_uids[targetUid] = Boolean(body.lockUid ?? true);
        await rtdbWrite(`xuanhoa_security/admins/${targetUid}`, 'PUT', false, caller.rawToken);
        await rtdbWrite(`xuanhoa_security/managers/${targetUid}`, 'PUT', false, caller.rawToken);
        await rtdbWrite(
          `xuanhoa_security/locked_uids/${targetUid}`,
          'PUT',
          Boolean(body.lockUid ?? true),
          caller.rawToken
        );
      } else {
        stateMirror.admins[targetUid] = true;
        stateMirror.locked_uids[targetUid] = false;
        await rtdbWrite(`xuanhoa_security/admins/${targetUid}`, 'PUT', true, caller.rawToken);
        await rtdbWrite(`xuanhoa_security/locked_uids/${targetUid}`, 'PUT', false, caller.rawToken);
      }

      await rtdbWrite(
        `xuanhoa_security/backup_founder/${targetUid}`,
        'PUT',
        updatedRecord,
        caller.rawToken
      );

      const audit = await appendBackendAuditLog({
        actorUid: caller.uid,
        actorRole: 'primary_founder',
        action: nextActive
          ? 'Mở khóa / Kích hoạt lại Backup Founder'
          : 'Khóa / Vô hiệu hóa Backup Founder',
        target: `@${updatedRecord.username} (active=${nextActive}, Epoch #${nextEpoch})`,
        eventCategory: 'founder_security',
        refId: targetUid,
        bearerToken: caller.rawToken,
      });

      return {
        ok: true,
        status: 200,
        message: nextActive
          ? `Đã mở khóa và kích hoạt lại Backup Founder (@${updatedRecord.username}).`
          : `Đã khóa tài khoản Backup Founder (@${updatedRecord.username}) và thu hồi mọi quyền/phiên.`,
        active: nextActive,
        sessionEpoch: nextEpoch,
        record: updatedRecord,
        auditLog: audit,
      };
    }

    // ------------------------------------------------------------------------
    // 04. POST /api/founder-security/revoke-sessions
    // ------------------------------------------------------------------------
    if (actionName === 'revoke-sessions') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;
      if (!caller.isPrimaryFounder) {
        return {
          ok: false,
          status: 403,
          message:
            'Chỉ Primary Founder mới có quyền thu hồi phiên đăng nhập của Backup Founder.',
        };
      }

      const targetUid = String(body.backupUid || '').trim();
      if (!isVerified28CharUid(targetUid)) {
        return { ok: false, status: 400, message: 'UID Backup Founder không hợp lệ.' };
      }

      const existingRtdb =
        (await rtdbRead(`xuanhoa_security/backup_founder/${targetUid}`, caller.rawToken)) ||
        stateMirror.backup_founder[targetUid];
      if (!existingRtdb || typeof existingRtdb !== 'object') {
        return { ok: false, status: 404, message: 'Không tìm thấy hồ sơ Backup Founder.' };
      }

      const nextEpoch = Number(existingRtdb.sessionEpoch || 1) + 1;
      const updatedRecord = {
        ...existingRtdb,
        uid: targetUid,
        updatedAt: now,
        tokensValidAfterTime: now,
        sessionEpoch: nextEpoch,
      };
      delete updatedRecord.mfaRequired;

      // Revoke refresh tokens in Firebase Authentication by advancing validSince
      await firebaseAuthAdminUpdateUser({
        uid: targetUid,
        validSinceSec: nowSec,
        now,
      });

      stateMirror.backup_founder[targetUid] = updatedRecord;
      await rtdbWrite(
        `xuanhoa_security/backup_founder/${targetUid}`,
        'PUT',
        updatedRecord,
        caller.rawToken
      );

      const audit = await appendBackendAuditLog({
        actorUid: caller.uid,
        actorRole: 'primary_founder',
        action: 'Thu hồi toàn bộ phiên đăng nhập Backup Founder (Revoke Firebase Refresh Tokens)',
        target: `@${updatedRecord.username} (Epoch #${nextEpoch})`,
        eventCategory: 'founder_security',
        refId: targetUid,
        bearerToken: caller.rawToken,
      });

      return {
        ok: true,
        status: 200,
        message: `Đã thu hồi toàn bộ phiên đăng nhập của Backup Founder (@${updatedRecord.username}) — Epoch #${nextEpoch}.`,
        active: Boolean(updatedRecord.active),
        sessionEpoch: nextEpoch,
        record: updatedRecord,
        auditLog: audit,
      };
    }

    // ------------------------------------------------------------------------
    // 05. POST /api/founder-security/verify-recovery-email
    // ------------------------------------------------------------------------
    if (actionName === 'verify-recovery-email') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;
      if (!caller.isPrimaryFounder) {
        return {
          ok: false,
          status: 403,
          message: 'Chỉ Primary Founder mới có quyền cập nhật/xác minh email khôi phục.',
        };
      }

      const targetUid = String(body.backupUid || '').trim();
      const recoveryEmail = String(body.recoveryEmail || '').trim().toLowerCase();
      if (!isVerified28CharUid(targetUid)) {
        return { ok: false, status: 400, message: 'UID Backup Founder không hợp lệ.' };
      }
      if (!isValidRealRecoveryEmail(recoveryEmail)) {
        return {
          ok: false,
          status: 400,
          message:
            'Email khôi phục phải là email thật, có thể nhận thư xác minh (không dùng email nội bộ).',
        };
      }

      const existingRtdb =
        (await rtdbRead(`xuanhoa_security/backup_founder/${targetUid}`, caller.rawToken)) ||
        stateMirror.backup_founder[targetUid];
      if (!existingRtdb || typeof existingRtdb !== 'object') {
        return { ok: false, status: 404, message: 'Không tìm thấy hồ sơ Backup Founder.' };
      }

      const updatedRecord = {
        ...existingRtdb,
        uid: targetUid,
        recoveryEmail,
        emailVerified: true,
        recoveryEmailVerified: true,
        updatedAt: now,
      };
      delete updatedRecord.mfaRequired;

      // Sync verified recoveryEmail to Firebase Authentication account
      await firebaseAuthAdminUpdateUser({
        uid: targetUid,
        email: recoveryEmail,
        emailVerified: true,
        now,
      });

      stateMirror.backup_founder[targetUid] = updatedRecord;
      await rtdbWrite(
        `xuanhoa_security/backup_founder/${targetUid}`,
        'PUT',
        updatedRecord,
        caller.rawToken
      );

      const audit = await appendBackendAuditLog({
        actorUid: caller.uid,
        actorRole: 'primary_founder',
        action: 'Xác minh Email khôi phục Backup Founder (Firebase Auth)',
        target: `@${updatedRecord.username} (${recoveryEmail})`,
        eventCategory: 'founder_security',
        refId: targetUid,
        bearerToken: caller.rawToken,
      });

      return {
        ok: true,
        status: 200,
        message: `Đã xác minh email khôi phục (${recoveryEmail}) cho Backup Founder (@${updatedRecord.username}).`,
        record: updatedRecord,
        auditLog: audit,
      };
    }

    // ------------------------------------------------------------------------
    // 06. POST /api/founder-security/login
    //     Authenticates Backup Founder via memorable `@username` + `password`
    //     by resolving `@username` -> `recoveryEmail` and verifying password with Firebase Auth!
    // ------------------------------------------------------------------------
    if (actionName === 'login') {
      const rawIdentifier = String(body.username || body.identifier || '')
        .trim()
        .toLowerCase()
        .replace(/^@/, '');
      const rawPassword = String(body.password || '');

      const ipKey = `ip:${clientIp}`;
      const userKey = `user:${rawIdentifier}`;

      const ipLimit = checkRateLimit(ipKey, now);
      if (ipLimit.blocked) {
        return {
          ok: false,
          status: 429,
          retryAfterSeconds: ipLimit.retryAfterSeconds,
          message: `Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau ${ipLimit.retryAfterSeconds} giây.`,
        };
      }
      const userLimit = checkRateLimit(userKey, now);
      if (userLimit.blocked) {
        return {
          ok: false,
          status: 429,
          retryAfterSeconds: userLimit.retryAfterSeconds,
          message: `Tài khoản tạm khóa đăng nhập do nhập sai nhiều lần. Vui lòng thử lại sau ${userLimit.retryAfterSeconds} giây.`,
        };
      }

      if (!rawIdentifier || !rawPassword) {
        recordFailedAttempt(ipKey, now);
        return {
          ok: false,
          status: 401,
          message: 'Thông tin đăng nhập hoặc mật khẩu không chính xác.',
        };
      }

      // Resolve username or recoveryEmail from /xuanhoa_security/backup_founder
      const allBackups = {
        ...(stateMirror.backup_founder || {}),
        ...((await rtdbRead('xuanhoa_security/backup_founder')) || {}),
      };

      let matchedRecord = null;
      for (const [candidateUid, entry] of Object.entries(allBackups)) {
        if (!entry || typeof entry !== 'object') continue;
        const uname = String(entry.username || '').trim().toLowerCase();
        const remail = String(entry.recoveryEmail || '').trim().toLowerCase();
        if (uname === rawIdentifier || remail === rawIdentifier) {
          matchedRecord = { ...entry, uid: entry.uid || candidateUid };
          break;
        }
      }

      if (!matchedRecord || !matchedRecord.uid) {
        recordFailedAttempt(ipKey, now);
        recordFailedAttempt(userKey, now);
        return {
          ok: false,
          status: 401,
          message: 'Thông tin đăng nhập hoặc mật khẩu không chính xác.',
        };
      }

      // Verify password via Firebase Authentication (Identity Toolkit signInWithPassword)
      const fbSignIn = await firebaseAuthSignInWithPassword({
        email: matchedRecord.recoveryEmail,
        password: rawPassword,
        expectedUid: matchedRecord.uid,
        now,
      });

      if (!fbSignIn.ok && fbSignIn.status === 401) {
        recordFailedAttempt(ipKey, now);
        recordFailedAttempt(userKey, now);
        return {
          ok: false,
          status: 401,
          message: 'Thông tin đăng nhập hoặc mật khẩu không chính xác.',
        };
      }

      const rtdbRecord =
        (await rtdbRead(`xuanhoa_security/backup_founder/${matchedRecord.uid}`)) ||
        stateMirror.backup_founder[matchedRecord.uid] ||
        matchedRecord;
      const isLocked =
        (await rtdbRead(`xuanhoa_security/locked_uids/${matchedRecord.uid}`)) === true ||
        stateMirror.locked_uids[matchedRecord.uid] === true;

      if (!fbSignIn.ok || isLocked || rtdbRecord?.active !== true) {
        return {
          ok: false,
          status: 403,
          message:
            'Tài khoản Backup Founder hiện đang bị khóa hoặc tạm ngưng bởi Primary Founder.',
        };
      }

      clearRateLimit(ipKey);
      clearRateLimit(userKey);

      return {
        ok: true,
        status: 200,
        authProvider: 'firebase_auth_email_password',
        uid: matchedRecord.uid,
        username: rtdbRecord.username || matchedRecord.username,
        displayName: rtdbRecord.displayName || matchedRecord.displayName,
        authEmail: rtdbRecord.recoveryEmail || matchedRecord.recoveryEmail,
        recoveryEmail: rtdbRecord.recoveryEmail || matchedRecord.recoveryEmail,
        emailVerified: Boolean(rtdbRecord.emailVerified ?? matchedRecord.emailVerified),
        idToken: fbSignIn.idToken,
        refreshToken: fbSignIn.refreshToken,
        expiresIn: fbSignIn.expiresIn,
        sessionEpoch: Number(rtdbRecord.sessionEpoch || matchedRecord.sessionEpoch || 1),
        tokensValidAfterTime: Number(
          rtdbRecord.tokensValidAfterTime || matchedRecord.tokensValidAfterTime || now
        ),
        message: `Đăng nhập Backup Founder (@${rtdbRecord.username || matchedRecord.username}) qua Firebase Authentication thành công.`,
      };
    }

    // ------------------------------------------------------------------------
    // 07. POST /api/founder-security/forgot-password
    //     Safe password recovery flow via Firebase Auth `sendOobCode` (PASSWORD_RESET)
    //     to the verified real recoveryEmail (anti-enumeration + rate limited)
    // ------------------------------------------------------------------------
    if (actionName === 'forgot-password') {
      const rawIdentifier = String(
        body.identifier || body.usernameOrEmail || body.username || body.email || ''
      )
        .trim()
        .toLowerCase()
        .replace(/^@/, '');
      const ipKey = `forgot_ip:${clientIp}`;
      const limit = checkRateLimit(ipKey, now);
      if (limit.blocked) {
        return {
          ok: false,
          status: 429,
          retryAfterSeconds: limit.retryAfterSeconds,
          message: `Vui lòng đợi ${limit.retryAfterSeconds} giây trước khi gửi lại yêu cầu khôi phục mật khẩu.`,
        };
      }
      recordFailedAttempt(ipKey, now);

      if (!rawIdentifier || rawIdentifier.length < 3) {
        return {
          ok: false,
          status: 400,
          message: 'Vui lòng nhập Tên đăng nhập dự phòng hoặc Email khôi phục.',
        };
      }

      const allBackups = {
        ...(stateMirror.backup_founder || {}),
        ...((await rtdbRead('xuanhoa_security/backup_founder')) || {}),
      };
      let matched = null;
      for (const val of Object.values(allBackups)) {
        if (
          val &&
          typeof val === 'object' &&
          (val.username?.toLowerCase() === rawIdentifier ||
            val.recoveryEmail?.toLowerCase() === rawIdentifier)
        ) {
          matched = val;
          break;
        }
      }

      if (
        matched &&
        matched.active === true &&
        matched.recoveryEmail &&
        isValidRealRecoveryEmail(matched.recoveryEmail)
      ) {
        await firebaseAuthSendPasswordResetEmail({
          email: matched.recoveryEmail,
          uid: matched.uid,
          username: matched.username,
          now,
        });
      }

      return {
        ok: true,
        status: 200,
        message:
          'Nếu tài khoản dự phòng tồn tại và đã xác minh email khôi phục, thư đặt lại mật khẩu từ Firebase Authentication đã được gửi tới email khôi phục của bạn (hoặc liên hệ Primary Founder để đặt lại trực tiếp trên Bảng Bảo mật).',
      };
    }

    // ------------------------------------------------------------------------
    // 08. POST /api/founder-security/role-update
    //     Fast Role Management (Founder grants/revokes ADMIN or MANAGER)
    // ------------------------------------------------------------------------
    if (actionName === 'role-update') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;

      if (!caller.isFounder) {
        return {
          ok: false,
          status: 403,
          message:
            'Chỉ Founder (Primary Founder hoặc Active Backup Founder) mới có quyền cấp/thu hồi quyền quản trị.',
        };
      }

      const targetUid = String(body.targetUid || '').trim();
      const targetEmail = String(body.targetEmail || '').trim().toLowerCase();
      const nextRole = String(body.role || 'user').trim().toLowerCase(); // 'admin' | 'manager' | 'user'
      const canManageWeb = Boolean(body.canManageWeb);
      const canManageMaps = Boolean(body.canManageMaps);

      if (!isVerified28CharUid(targetUid)) {
        return {
          ok: false,
          status: 400,
          message:
            'Không thể cấp quyền cho tài khoản chưa có Firebase Auth UID 28 ký tự đã xác minh.',
        };
      }

      if (
        targetUid === PRIMARY_FOUNDER_VERIFIED_UID ||
        (await rtdbRead(`xuanhoa_security/primary_founder/${targetUid}`, caller.rawToken)) === true
      ) {
        return {
          ok: false,
          status: 403,
          message: 'Tuyệt đối không được hạ quyền hoặc chỉnh sửa tài khoản Primary Founder.',
        };
      }

      const targetBackup =
        (await rtdbRead(`xuanhoa_security/backup_founder/${targetUid}`, caller.rawToken)) ??
        stateMirror.backup_founder[targetUid];
      if (targetBackup !== undefined && targetBackup !== null) {
        if (!caller.isPrimaryFounder) {
          return {
            ok: false,
            status: 403,
            message: 'Chỉ Primary Founder mới được quản lý tài khoản Backup Founder.',
          };
        }
        const isTargetActive = targetBackup === true || targetBackup?.active === true;
        if (!isTargetActive && (nextRole === 'admin' || nextRole === 'manager')) {
          return {
            ok: false,
            status: 403,
            message:
              'Không thể cấp quyền Admin/Manager cho Backup Founder đang bị khóa (active=false).',
          };
        }
      }

      if (nextRole === 'admin' && !caller.isRecentAuth) {
        return {
          ok: false,
          status: 403,
          code: 'RECENT_AUTH_REQUIRED',
          message: 'Nâng quyền lên ADMIN yêu cầu phiên xác thực gần đây (auth_time <= 5 phút).',
        };
      }

      const isGrantAdmin = nextRole === 'admin';
      const isGrantManager = nextRole === 'manager' && (canManageWeb || canManageMaps);

      stateMirror.admins[targetUid] = isGrantAdmin;
      stateMirror.managers[targetUid] = isGrantManager;

      await rtdbWrite(
        `xuanhoa_security/admins/${targetUid}`,
        'PUT',
        isGrantAdmin,
        caller.rawToken
      );
      await rtdbWrite(
        `xuanhoa_security/managers/${targetUid}`,
        'PUT',
        isGrantManager,
        caller.rawToken
      );

      const audit = await appendBackendAuditLog({
        actorUid: caller.uid,
        actorRole: caller.isPrimaryFounder ? 'primary_founder' : 'backup_founder',
        action: isGrantAdmin
          ? 'Cấp quyền ADMIN'
          : isGrantManager
          ? `Cấp quyền MANAGER (${[canManageWeb ? 'Web' : '', canManageMaps ? 'Maps' : ''].filter(Boolean).join('+')})`
          : 'Thu hồi quyền về USER',
        target: `${targetEmail || targetUid} (UID: ${targetUid.slice(0, 6)}...${targetUid.slice(-4)})`,
        eventCategory: 'role_management',
        refId: targetUid,
        bearerToken: caller.rawToken,
      });

      return {
        ok: true,
        status: 200,
        message: `Đã cập nhật phân quyền (${nextRole.toUpperCase()}) cho ${targetEmail || targetUid}.`,
        auditLog: audit,
      };
    }

    // ------------------------------------------------------------------------
    // 09. POST /api/founder-security/consent-record
    // ------------------------------------------------------------------------
    if (actionName === 'consent-record') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;

      if (body.firebaseAuthUid && String(body.firebaseAuthUid).trim() !== caller.uid) {
        return {
          ok: false,
          status: 403,
          message: 'Không được phép ghi bản ghi xác nhận (Consent Record) thay cho UID khác.',
        };
      }

      const termsAccepted = Boolean(body.termsAccepted);
      const essentialDataNoticeAck = Boolean(body.essentialDataNoticeAck);
      const coreProfileConsent = Boolean(body.coreProfileConsent);

      if (!termsAccepted || !essentialDataNoticeAck || !coreProfileConsent) {
        return {
          ok: false,
          status: 400,
          message:
            'Cần xác nhận Điều khoản sử dụng (A), Thông báo xử lý dữ liệu thiết yếu (B) và Đồng ý hồ sơ cơ bản (C).',
        };
      }

      const activePolicy =
        stateMirror.policy_versions.current || DEFAULT_POLICY_VERSION_META;
      const policyVersion = String(body.policyVersion || activePolicy.version).trim();
      const privacyNoticeVersion = String(
        body.privacyNoticeVersion || activePolicy.privacyNoticeVersion
      ).trim();
      const communityGuidelinesVersion = String(
        body.communityGuidelinesVersion || activePolicy.communityGuidelinesVersion
      ).trim();
      const consentUiVersion = String(
        body.consentUiVersion || activePolicy.consentUiVersion || 'xuho-consent-ui-v3.0'
      ).trim();

      const optTaste = Boolean(body.optionalTastePersonalization);
      const optAnalytics = Boolean(body.optionalAnalytics);
      const optMarketing = Boolean(body.optionalMarketing);

      const record = {
        firebaseAuthUid: caller.uid,
        email: caller.email || undefined,
        policyVersion,
        privacyNoticeVersion,
        communityGuidelinesVersion,
        consentUiVersion,
        source: 'web',
        termsAccepted: true,
        essentialDataNoticeAck: true,
        coreProfileConsent: true,
        purposes: {
          essential_auth: {
            purpose: 'essential_auth',
            label: 'Xác thực đăng nhập Google & Bảo mật tài khoản',
            required: true,
            status: 'granted',
            updatedAt: now,
            withdrawalTimestamp: null,
          },
          profile_and_ugc: {
            purpose: 'profile_and_ugc',
            label: 'Hồ sơ thành viên cơ bản & Đóng góp cộng đồng',
            required: true,
            status: 'granted',
            updatedAt: now,
            withdrawalTimestamp: null,
          },
          optional_taste_phone: {
            purpose: 'optional_taste_phone',
            label: 'Tùy chọn lưu SĐT & Cá nhân hóa gợi ý khẩu vị',
            required: false,
            status: optTaste ? 'granted' : 'denied',
            updatedAt: now,
            withdrawalTimestamp: null,
          },
          optional_analytics: {
            purpose: 'optional_analytics',
            label: 'Tùy chọn phân tích thống kê trải nghiệm không thiết yếu',
            required: false,
            status: optAnalytics ? 'granted' : 'denied',
            updatedAt: now,
            withdrawalTimestamp: null,
          },
          optional_marketing: {
            purpose: 'optional_marketing',
            label: 'Tùy chọn nhận thông báo sự kiện & địa điểm mới',
            required: false,
            status: optMarketing ? 'granted' : 'denied',
            updatedAt: now,
            withdrawalTimestamp: null,
          },
        },
        consentStatus: 'active',
        serverTimestamp: now,
        withdrawalTimestamp: null,
        verificationSource: 'backend_verified',
      };

      const auditId = `ca_srv_${now}_${randomHexBytes(3)}`;
      const auditEntry = {
        recordId: auditId,
        firebaseAuthUid: caller.uid,
        action: 'consent_granted',
        policyVersion,
        privacyNoticeVersion,
        consentUiVersion,
        consentPurpose: `essential+profile(taste=${optTaste},analytics=${optAnalytics},marketing=${optMarketing})`,
        consentStatus: 'active',
        serverTimestamp: now,
        withdrawalTimestamp: null,
        source: 'web',
        verificationSource: 'backend_verified',
      };

      stateMirror.user_consents[caller.uid] = record;
      if (!stateMirror.consent_audit_trail[caller.uid]) {
        stateMirror.consent_audit_trail[caller.uid] = {};
      }
      stateMirror.consent_audit_trail[caller.uid][auditId] = auditEntry;

      await rtdbWrite(
        `xuanhoa_admin/user_consents/${caller.uid}`,
        'PUT',
        record,
        caller.rawToken
      );
      await rtdbWrite(
        `xuanhoa_admin/consent_audit_trail/${caller.uid}/${auditId}`,
        'PUT',
        auditEntry,
        caller.rawToken
      );

      return {
        ok: true,
        status: 200,
        message: 'Đã lưu bằng chứng xác nhận điều khoản và quyền riêng tư phía máy chủ.',
        record,
        auditEntry,
      };
    }

    // ------------------------------------------------------------------------
    // 10. POST /api/founder-security/consent-withdrawal
    // ------------------------------------------------------------------------
    if (actionName === 'consent-withdrawal') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;

      const purpose = String(body.consentPurpose || body.purpose || '').trim();
      const nextStatus =
        String(body.consentStatus || body.newStatus || 'withdrawn').trim().toLowerCase() === 'granted'
          ? 'granted'
          : 'withdrawn';

      const allowedPurposes = [
        'optional_taste_phone',
        'optional_analytics',
        'optional_marketing',
        'profile_and_ugc',
      ];
      if (!allowedPurposes.includes(purpose)) {
        return {
          ok: false,
          status: 400,
          message: `Mục đích đồng ý không hợp lệ hoặc là xử lý thiết yếu không thể tắt: ${purpose}`,
        };
      }

      const existing =
        (await rtdbRead(`xuanhoa_admin/user_consents/${caller.uid}`, caller.rawToken)) ||
        stateMirror.user_consents[caller.uid];
      if (!existing || typeof existing !== 'object') {
        return {
          ok: false,
          status: 404,
          message: 'Chưa tìm thấy bản ghi xác nhận (Consent Record) của tài khoản này.',
        };
      }

      const updatedPurposes = {
        ...(existing.purposes || {}),
        [purpose]: {
          ...(existing.purposes?.[purpose] || {
            purpose,
            label: purpose,
            required: purpose === 'profile_and_ugc',
          }),
          status: nextStatus,
          updatedAt: now,
          withdrawalTimestamp: nextStatus === 'withdrawn' ? now : null,
        },
      };

      const isCoreWithdrawn = purpose === 'profile_and_ugc' && nextStatus === 'withdrawn';
      const updatedRecord = {
        ...existing,
        firebaseAuthUid: caller.uid,
        coreProfileConsent: isCoreWithdrawn ? false : Boolean(existing.coreProfileConsent ?? true),
        purposes: updatedPurposes,
        consentStatus: isCoreWithdrawn
          ? 'withdrawn'
          : nextStatus === 'withdrawn'
          ? 'partially_withdrawn'
          : 'active',
        serverTimestamp: now,
        withdrawalTimestamp:
          nextStatus === 'withdrawn' ? now : existing.withdrawalTimestamp ?? null,
        verificationSource: 'backend_verified',
      };

      const auditId = `ca_srv_${now}_${randomHexBytes(3)}`;
      const auditEntry = {
        recordId: auditId,
        firebaseAuthUid: caller.uid,
        action: nextStatus === 'withdrawn' ? 'consent_withdrawn' : 'consent_updated',
        policyVersion: updatedRecord.policyVersion,
        privacyNoticeVersion: updatedRecord.privacyNoticeVersion,
        consentUiVersion: updatedRecord.consentUiVersion || 'xuho-consent-ui-v3.0',
        consentPurpose: purpose,
        consentStatus: nextStatus,
        serverTimestamp: now,
        withdrawalTimestamp: nextStatus === 'withdrawn' ? now : null,
        source: 'web',
        verificationSource: 'backend_verified',
      };

      stateMirror.user_consents[caller.uid] = updatedRecord;
      if (!stateMirror.consent_audit_trail[caller.uid]) {
        stateMirror.consent_audit_trail[caller.uid] = {};
      }
      stateMirror.consent_audit_trail[caller.uid][auditId] = auditEntry;

      await rtdbWrite(
        `xuanhoa_admin/user_consents/${caller.uid}`,
        'PUT',
        updatedRecord,
        caller.rawToken
      );
      await rtdbWrite(
        `xuanhoa_admin/consent_audit_trail/${caller.uid}/${auditId}`,
        'PUT',
        auditEntry,
        caller.rawToken
      );

      return {
        ok: true,
        status: 200,
        message:
          nextStatus === 'withdrawn'
            ? `Đã rút lại sự đồng ý đối với mục đích (${purpose}) và ghi nhận withdrawalTimestamp.`
            : `Đã cấp lại sự đồng ý đối với mục đích (${purpose}).`,
        record: updatedRecord,
        auditEntry,
      };
    }

    // ------------------------------------------------------------------------
    // 11. POST /api/founder-security/data-rights
    // ------------------------------------------------------------------------
    if (actionName === 'data-rights') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;

      const subAction = String(body.action || 'submit').trim().toLowerCase();

      if (subAction === 'submit') {
        const rawReqType = String(body.requestType || 'access').trim().toLowerCase();
        const requestType = rawReqType === 'export_data' ? 'export' : rawReqType;
        const allowedTypes = [
          'access',
          'rectification',
          'withdrawal',
          'restriction',
          'deletion',
          'export',
          'complaint',
        ];
        if (!allowedTypes.includes(requestType)) {
          return { ok: false, status: 400, message: 'Loại yêu cầu quyền dữ liệu không hợp lệ.' };
        }
        const details = sanitizeAuditString(body.details || '', 1500);
        if (details.length < 3) {
          return {
            ok: false,
            status: 400,
            message: 'Vui lòng mô tả chi tiết yêu cầu quyền dữ liệu cá nhân (tối thiểu 3 ký tự).',
          };
        }

        const requestId = `drr_${now}_${randomHexBytes(3)}`;
        const reqRecord = {
          requestId,
          firebaseAuthUid: caller.uid,
          userEmail: caller.email || String(body.userEmail || 'member@xuanhoacogi.com'),
          userDisplayName: sanitizeAuditString(
            body.userDisplayName || caller.email || caller.uid,
            100
          ),
          requestType,
          details,
          status: 'pending',
          submittedAt: now,
          updatedAt: now,
          legalRetentionNotice:
            'Các bản ghi bằng chứng xác nhận (consent_audit_trail) và nhật ký bảo mật (auditLogs) được lưu giữ theo nghĩa vụ pháp lý bắt buộc của Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15.',
          source: 'web',
        };

        stateMirror.data_rights_requests[requestId] = reqRecord;
        await rtdbWrite(
          `xuanhoa_admin/data_rights_requests/${requestId}`,
          'PUT',
          reqRecord,
          caller.rawToken
        );

        return {
          ok: true,
          status: 200,
          message: `Đã tiếp nhận yêu cầu quyền dữ liệu cá nhân (#${requestId}).`,
          request: reqRecord,
        };
      }

      if (subAction === 'list') {
        if (!caller.isOperationalAdmin) {
          const ownList = Object.values(stateMirror.data_rights_requests).filter(
            r => r && r.firebaseAuthUid === caller.uid
          );
          return {
            ok: true,
            status: 200,
            requests: ownList,
            activePolicy: stateMirror.policy_versions.current,
          };
        }

        const allConsentsObj =
          (await rtdbRead('xuanhoa_admin/user_consents', caller.rawToken)) ||
          stateMirror.user_consents ||
          {};
        const allConsents = Object.values(allConsentsObj).filter(Boolean);
        const curVer = stateMirror.policy_versions.current?.version || DEFAULT_POLICY_VERSION_META.version;

        const consentStats = {
          totalConsentedUsers: allConsents.length,
          currentVersionCount: allConsents.filter(c => c.policyVersion === curVer).length,
          optionalTasteGranted: allConsents.filter(
            c => c.purposes?.optional_taste_phone?.status === 'granted'
          ).length,
          optionalAnalyticsGranted: allConsents.filter(
            c => c.purposes?.optional_analytics?.status === 'granted'
          ).length,
          optionalMarketingGranted: allConsents.filter(
            c => c.purposes?.optional_marketing?.status === 'granted'
          ).length,
          withdrawnCount: allConsents.filter(
            c => c.consentStatus === 'withdrawn' || c.consentStatus === 'partially_withdrawn'
          ).length,
        };

        const allReqsObj =
          (await rtdbRead('xuanhoa_admin/data_rights_requests', caller.rawToken)) ||
          stateMirror.data_rights_requests ||
          {};
        const requests = Object.values(allReqsObj)
          .filter(Boolean)
          .sort((a, b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0));

        return {
          ok: true,
          status: 200,
          requests,
          consentStats,
          activePolicy: stateMirror.policy_versions.current,
        };
      }

      if (subAction === 'resolve') {
        if (!caller.isOperationalAdmin) {
          return {
            ok: false,
            status: 403,
            message: 'Chỉ Founder hoặc Admin mới có quyền xử lý yêu cầu quyền dữ liệu cá nhân.',
          };
        }
        const requestId = String(body.requestId || '').trim();
        const nextStatus = String(body.status || 'completed').trim();
        const resolutionNote = sanitizeAuditString(body.resolutionNote || '', 500);

        const existingReq =
          (await rtdbRead(`xuanhoa_admin/data_rights_requests/${requestId}`, caller.rawToken)) ||
          stateMirror.data_rights_requests[requestId];
        if (!existingReq || typeof existingReq !== 'object') {
          return { ok: false, status: 404, message: 'Không tìm thấy yêu cầu quyền dữ liệu.' };
        }

        const updatedReq = {
          ...existingReq,
          status: nextStatus,
          resolutionNote,
          processedByUid: caller.uid,
          processedByRole: caller.isPrimaryFounder
            ? 'primary_founder'
            : caller.isBackupFounder
            ? 'backup_founder'
            : 'admin',
          updatedAt: now,
        };

        stateMirror.data_rights_requests[requestId] = updatedReq;
        await rtdbWrite(
          `xuanhoa_admin/data_rights_requests/${requestId}`,
          'PUT',
          updatedReq,
          caller.rawToken
        );

        const audit = await appendBackendAuditLog({
          actorUid: caller.uid,
          actorRole: caller.isPrimaryFounder
            ? 'primary_founder'
            : caller.isBackupFounder
            ? 'backup_founder'
            : 'admin',
          action: `Xử lý yêu cầu quyền dữ liệu (${existingReq.requestType} -> ${nextStatus})`,
          target: `Request #${requestId} (UID: ${existingReq.firebaseAuthUid.slice(0, 6)}...)`,
          eventCategory: 'data_rights_processing',
          refId: requestId,
          bearerToken: caller.rawToken,
        });

        return {
          ok: true,
          status: 200,
          message: `Đã cập nhật trạng thái yêu cầu #${requestId} thành ${nextStatus}.`,
          request: updatedReq,
          auditLog: audit,
        };
      }

      return { ok: false, status: 400, message: `Hành động data-rights không hợp lệ: ${subAction}` };
    }

    // ------------------------------------------------------------------------
    // 12. GET | POST /api/founder-security/policy-version
    // ------------------------------------------------------------------------
    if (actionName === 'policy-version') {
      if (!authHeader || String(body.action || '').toLowerCase() === 'get') {
        return {
          ok: true,
          status: 200,
          policy: stateMirror.policy_versions.current,
          changelog: stateMirror.policy_versions.changelog,
        };
      }

      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;
      if (!caller.isPrimaryFounder) {
        return {
          ok: false,
          status: 403,
          message: 'Chỉ Primary Founder mới có quyền phát hành phiên bản chính sách pháp lý mới.',
        };
      }

      const version = sanitizeAuditString(body.version || '', 40);
      const title = sanitizeAuditString(body.title || '', 200);
      if (!version || !title) {
        return {
          ok: false,
          status: 400,
          message: 'Vui lòng cung cấp đầy đủ mã phiên bản (version) và tiêu đề (title).',
        };
      }

      const newPolicyEntry = {
        version,
        privacyNoticeVersion: sanitizeAuditString(body.privacyNoticeVersion || version, 40),
        communityGuidelinesVersion: sanitizeAuditString(
          body.communityGuidelinesVersion || version,
          40
        ),
        consentUiVersion: sanitizeAuditString(
          body.consentUiVersion || 'xuho-consent-ui-v3.0',
          40
        ),
        effectiveDate: sanitizeAuditString(
          body.effectiveDate || new Date(now).toISOString().slice(0, 10),
          20
        ),
        publishedAt: now,
        publishedByUid: caller.uid,
        requiresReconsent: Boolean(body.requiresReconsent),
        title,
        changes: Array.isArray(body.changes)
          ? body.changes.map(c => sanitizeAuditString(c, 240))
          : [sanitizeAuditString(body.changes || title, 240)],
      };

      stateMirror.policy_versions.current = newPolicyEntry;
      stateMirror.policy_versions.changelog.unshift(newPolicyEntry);

      await rtdbWrite(
        'xuanhoa_admin/policy_versions/current',
        'PUT',
        newPolicyEntry,
        caller.rawToken
      );

      const audit = await appendBackendAuditLog({
        actorUid: caller.uid,
        actorRole: 'primary_founder',
        action: `Phát hành phiên bản chính sách pháp lý mới (${version})`,
        target: `${title} (requiresReconsent=${newPolicyEntry.requiresReconsent})`,
        eventCategory: 'policy_version_update',
        refId: version,
        bearerToken: caller.rawToken,
      });

      return {
        ok: true,
        status: 200,
        message: `Đã phát hành phiên bản chính sách ${version} thành công.`,
        policy: newPolicyEntry,
        changelog: stateMirror.policy_versions.changelog,
        auditLog: audit,
      };
    }

    // ------------------------------------------------------------------------
    // 13. GET | POST /api/founder-security/status (alias: security-status)
    //     Returns Founder Security & Firebase Auth Architecture status (Founder only)
    // ------------------------------------------------------------------------
    if (actionName === 'status' || actionName === 'security-status') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;
      if (!caller.isFounder) {
        return {
          ok: false,
          status: 403,
          message: 'Chỉ Primary Founder hoặc Active Backup Founder mới được xem trạng thái bảo mật Founder.',
        };
      }

      const allBackups =
        (await rtdbRead('xuanhoa_security/backup_founder', caller.rawToken)) ||
        stateMirror.backup_founder ||
        {};
      const sanitizedBackups = {};
      for (const [bUid, bVal] of Object.entries(allBackups)) {
        if (bVal && typeof bVal === 'object') {
          const copy = { ...bVal };
          delete copy.password;
          delete copy.passwordHash;
          delete copy.passwordDigest;
          delete copy.secret;
          sanitizedBackups[bUid] = copy;
        }
      }

      return {
        ok: true,
        status: 200,
        projectId,
        rtdbUrl,
        authArchitecture: 'firebase_auth_email_password_standardized',
        passwordHashInRtdb: false,
        customHmacSession: false,
        callerRole: caller.isPrimaryFounder ? 'primary_founder' : 'backup_founder',
        backupFounders: sanitizedBackups,
        activePolicyVersion: stateMirror.policy_versions.current?.version,
      };
    }

    // ------------------------------------------------------------------------
    // 14. POST /api/founder-security/audit-logs
    //     Returns recent security audit logs (Founder or Operational Admin only)
    // ------------------------------------------------------------------------
    if (actionName === 'audit-logs') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;
      if (!caller.isOperationalAdmin) {
        return {
          ok: false,
          status: 403,
          message: 'Chỉ Founder hoặc Admin mới có quyền truy xuất nhật ký bảo mật hệ thống.',
        };
      }

      const rtdbLogsObj =
        (await rtdbRead('xuanhoa_admin/global_state/auditLogs', caller.rawToken)) || {};
      const combined = [
        ...Object.values(rtdbLogsObj).filter(Boolean),
        ...stateMirror.auditLogs,
      ];
      const seenIds = new Set();
      const deduped = [];
      for (const item of combined) {
        if (!item || !item.id || seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        deduped.push(item);
      }
      deduped.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));

      return {
        ok: true,
        status: 200,
        count: deduped.length,
        auditLogs: deduped.slice(0, 100),
      };
    }

    return { ok: false, status: 404, message: `Endpoint bảo mật không tồn tại: ${actionName}` };
  }

  /**
   * Cloudflare Workers / Standard Web Fetch API Handler (`Request` -> `Response`)
   */
  async function handleFetchRequest(request) {
    const urlObj = new URL(request.url);
    const pathname = urlObj.pathname;
    if (!pathname.startsWith('/api/founder-security/')) {
      return null;
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': urlObj.origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    const actionName = pathname.replace(/^\/api\/founder-security\//, '').split('/')[0];

    if (request.method === 'GET' && actionName === 'policy-version') {
      const resData = await handleAction('policy-version', { action: 'get' }, {});
      return new Response(JSON.stringify(resData), {
        status: resData.status || 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    if (request.method === 'GET' && (actionName === 'status' || actionName === 'security-status')) {
      const authorization = request.headers.get('authorization') || '';
      const resData = await handleAction('status', {}, { authorization });
      return new Response(JSON.stringify(resData), {
        status: resData.status || 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ ok: false, status: 405, message: 'Method Not Allowed' }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

    let parsedBody = {};
    try {
      const rawText = await request.text();
      parsedBody = rawText ? JSON.parse(rawText) : {};
    } catch {
      return new Response(
        JSON.stringify({ ok: false, status: 400, message: 'JSON body không hợp lệ.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

    const ip =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      '127.0.0.1';
    const authorization = request.headers.get('authorization') || '';

    const result = await handleAction(actionName, parsedBody, {
      authorization,
      ip,
    });

    return new Response(JSON.stringify(result), {
      status: result.status || (result.ok ? 200 : 400),
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }

  /**
   * Connect/Vite/Node HTTP middleware handler for `/api/founder-security/*`
   */
  function middleware(req, res, next) {
    const url = String(req.url || '');
    if (!url.startsWith('/api/founder-security/')) {
      return next();
    }
    const actionName = url.replace(/^\/api\/founder-security\//, '').split('?')[0];

    if (req.method === 'GET' && actionName === 'policy-version') {
      handleAction('policy-version', { action: 'get' }, {}).then(result => {
        res.statusCode = result.status || 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(result));
      });
      return;
    }

    if (req.method === 'GET' && (actionName === 'status' || actionName === 'security-status')) {
      handleAction('status', {}, { authorization: req.headers['authorization'] || '' }).then(
        result => {
          res.statusCode = result.status || 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(result));
        }
      );
      return;
    }

    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, status: 405, message: 'Method Not Allowed' }));
      return;
    }

    let rawBody = '';
    req.on('data', chunk => {
      rawBody += chunk;
      if (rawBody.length > 65536) {
        req.destroy();
      }
    });
    req.on('end', async () => {
      let parsed = {};
      try {
        parsed = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, status: 400, message: 'JSON body không hợp lệ.' }));
        return;
      }

      const ip =
        req.headers['cf-connecting-ip'] ||
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        '127.0.0.1';
      const result = await handleAction(actionName, parsed, {
        authorization: req.headers['authorization'] || '',
        ip,
      });

      res.statusCode = result.status || (result.ok ? 200 : 400);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(result));
    });
  }

  return {
    handleAction,
    handleFetchRequest,
    middleware,
    verifyCallerIdentity,
    getVaultSnapshotForTest: () => firebaseAuthEmulatorByUid,
    getStateMirror: () => stateMirror,
    getDispatchedRecoveryEmails: () => [...dispatchedRecoveryEmails],
  };
}
