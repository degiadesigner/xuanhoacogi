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

export function isPlausibleFirebaseAuthUid(uid) {
  const clean = String(uid || '').trim();
  if (!clean || clean.length < 10 || clean.length > 128) return false;
  if (/^[0-9]+$/.test(clean)) return false;
  if (/^(uid_|google_|fb_|adm_)/i.test(clean)) return false;
  return /^[A-Za-z0-9_-]{10,128}$/.test(clean);
}

// Export alias maintained for backward compatibility; no longer relies on 28-char regex length
export const isVerified28CharUid = isPlausibleFirebaseAuthUid;

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

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      'pkcs8',
      pemToArrayBuffer(sa.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const requestTokenAtTime = async baseSec => {
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
        iat: baseSec - 30,
        exp: baseSec + 3300,
      };

      const unsignedToken = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(claimSet)}`;
      const sigBuf = await globalThis.crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(unsignedToken)
      );
      const signedJwt = `${unsignedToken}.${base64UrlEncodeBytes(new Uint8Array(sigBuf))}`;

      return fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(signedJwt)}`,
      });
    };

    let resp = await requestTokenAtTime(Math.floor(Date.now() / 1000));
    if (!resp.ok) {
      const dateHeader = resp.headers?.get?.('date');
      if (dateHeader) {
        const serverSec = Math.floor(Date.parse(dateHeader) / 1000);
        if (Number.isFinite(serverSec) && serverSec > 0) {
          resp = await requestTokenAtTime(serverSec);
        }
      }
    }
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.access_token || null;
  } catch {
    return null;
  }
}

export function isGoogleSub21Digit(uid) {
  if (typeof uid !== 'string' || !uid.trim()) return false;
  return /^\d{18,25}$/.test(uid.trim());
}

export function encodeRtdbMemberKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/%/g, '%25')
    .replace(/\./g, '%2E')
    .replace(/#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/\//g, '%2F')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D');
}

export function decodeRtdbMemberKey(encodedKey) {
  try {
    return decodeURIComponent(String(encodedKey || '')).trim().toLowerCase();
  } catch {
    return String(encodedKey || '')
      .replace(/%2E/gi, '.')
      .replace(/%23/gi, '#')
      .replace(/%24/gi, '$')
      .replace(/%2F/gi, '/')
      .replace(/%5B/gi, '[')
      .replace(/%5D/gi, ']')
      .replace(/%25/gi, '%')
      .trim()
      .toLowerCase();
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

export function createEmulatorFirebaseIdToken({
  uid,
  email,
  authTimeSec,
  googleSub,
  emailVerified = true,
  providerId = 'password',
}) {
  const nowSec = authTimeSec || Math.floor(Date.now() / 1000);
  const header = { alg: 'none', typ: 'JWT' };
  const identities = { email: [email] };
  if (googleSub) {
    identities['google.com'] = [String(googleSub)];
  }
  const payload = {
    iss: `https://securetoken.google.com/${DEFAULT_FIREBASE_PROJECT_ID}`,
    aud: DEFAULT_FIREBASE_PROJECT_ID,
    auth_time: nowSec,
    user_id: uid,
    sub: uid,
    iat: nowSec,
    exp: nowSec + 3600,
    email,
    email_verified: Boolean(emailVerified),
    firebase: {
      identities,
      sign_in_provider: providerId || (googleSub ? 'google.com' : 'password'),
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
  firebaseAuthEmulatorByUid.set(PRIMARY_FOUNDER_VERIFIED_UID, {
    localId: PRIMARY_FOUNDER_VERIFIED_UID,
    email: PRIMARY_FOUNDER_EMAIL,
    displayName: 'Dê Già Designer',
    emailVerified: true,
    disabled: false,
    googleSub: '107693478569085538206',
    providerIds: ['google.com'],
    validSinceSec: 0,
  });
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
    identity_links: {},
    pending_role_assignments: {},
    members_registry: {},
    reconciliation_snapshots: [],
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

  /**
   * Registers or updates a Firebase Auth account in the Emulator store (for testing & reconciliation).
   */
  function registerEmulatorAuthAccount({
    uid,
    email,
    displayName = '',
    googleSub = null,
    emailVerified = true,
    providerId = 'google.com',
    disabled = false,
    validSinceSec = 0,
  }) {
    const cleanUid = String(uid || '').trim();
    if (!cleanUid) return null;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const record = {
      localId: cleanUid,
      email: cleanEmail,
      displayName: String(displayName || cleanEmail),
      googleSub: googleSub ? String(googleSub).trim() : null,
      emailVerified: Boolean(emailVerified),
      providerIds: providerId ? [providerId] : ['google.com'],
      disabled: Boolean(disabled),
      validSinceSec: Number(validSinceSec || 0),
    };
    firebaseAuthEmulatorByUid.set(cleanUid, record);
    return record;
  }

  /**
   * Looks up Firebase Authentication accounts by UIDs, emails, or Google sub IDs.
   * In Production (`!allowEmulatorTokens`), queries Identity Toolkit `accounts:lookup` via Service Account OAuth2 token.
   * In Emulator mode (`allowEmulatorTokens`), queries `firebaseAuthEmulatorByUid`.
   */
  async function lookupFirebaseAuthUsers({ uids = [], emails = [] } = {}) {
    const matchedByUid = new Map();

    if (!allowEmulatorTokens) {
      const adminOAuthToken = await getPrivilegedGoogleAccessToken();
      if (adminOAuthToken) {
        const cleanEmails = Array.from(
          new Set(emails.filter(Boolean).map(e => String(e).trim().toLowerCase()))
        );
        for (let i = 0; i < cleanEmails.length; i += 50) {
          const chunk = cleanEmails.slice(i, i + 50);
          const resp = await fetch(
            `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminOAuthToken}`,
              },
              body: JSON.stringify({ email: chunk }),
            }
          ).catch(() => null);
          if (resp && resp.ok) {
            const data = await resp.json().catch(() => ({}));
            for (const u of data.users || []) {
              if (!u || !u.localId) continue;
              const gProv = (u.providerUserInfo || []).find(p => p.providerId === 'google.com');
              matchedByUid.set(u.localId, {
                localId: u.localId,
                email: String(u.email || '').trim().toLowerCase(),
                displayName: u.displayName || '',
                emailVerified: Boolean(u.emailVerified),
                disabled: Boolean(u.disabled),
                googleSub: gProv?.rawId ? String(gProv.rawId).trim() : null,
                providerIds: (u.providerUserInfo || []).map(p => p.providerId).filter(Boolean),
              });
            }
          }
        }

        const cleanUids = Array.from(
          new Set(uids.filter(Boolean).map(u => String(u).trim()).filter(isVerified28CharUid))
        );
        for (let i = 0; i < cleanUids.length; i += 50) {
          const chunk = cleanUids.slice(i, i + 50);
          const resp = await fetch(
            `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:lookup`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${adminOAuthToken}`,
              },
              body: JSON.stringify({ localId: chunk }),
            }
          ).catch(() => null);
          if (resp && resp.ok) {
            const data = await resp.json().catch(() => ({}));
            for (const u of data.users || []) {
              if (!u || !u.localId) continue;
              const gProv = (u.providerUserInfo || []).find(p => p.providerId === 'google.com');
              matchedByUid.set(u.localId, {
                localId: u.localId,
                email: String(u.email || '').trim().toLowerCase(),
                displayName: u.displayName || '',
                emailVerified: Boolean(u.emailVerified),
                disabled: Boolean(u.disabled),
                googleSub: gProv?.rawId ? String(gProv.rawId).trim() : null,
                providerIds: (u.providerUserInfo || []).map(p => p.providerId).filter(Boolean),
              });
            }
          }
        }
      }
    } else {
      for (const acc of firebaseAuthEmulatorByUid.values()) {
        if (!acc || !acc.localId) continue;
        matchedByUid.set(acc.localId, {
          localId: acc.localId,
          email: String(acc.email || '').trim().toLowerCase(),
          displayName: acc.displayName || '',
          emailVerified: Boolean(acc.emailVerified ?? true),
          disabled: Boolean(acc.disabled),
          googleSub: acc.googleSub ? String(acc.googleSub).trim() : null,
          providerIds: Array.isArray(acc.providerIds) ? acc.providerIds : ['google.com'],
        });
      }
    }

    const users = Array.from(matchedByUid.values());
    const byUid = new Map(users.map(u => [u.localId, u]));
    const byEmail = new Map();
    const byGoogleSub = new Map();
    for (const u of users) {
      if (u.email) {
        const em = u.email.trim().toLowerCase();
        if (!byEmail.has(em)) byEmail.set(em, []);
        byEmail.get(em).push(u);
      }
      if (u.googleSub) {
        const sub = String(u.googleSub).trim();
        if (!byGoogleSub.has(sub)) byGoogleSub.set(sub, []);
        byGoogleSub.get(sub).push(u);
      }
    }
    return { users, byUid, byEmail, byGoogleSub };
  }

  // ==========================================================================
  // RTDB READ / WRITE (Supports both Emulator and Production REST API)
  // ==========================================================================

  async function buildRtdbRequestUrlAndHeaders(cleanPath, callerOrOwnerToken) {
    const encodedPath = String(cleanPath || '')
      .split('/')
      .filter(Boolean)
      .map(seg => encodeURIComponent(seg))
      .join('/');

    if (isEmulatorRtdb) {
      const url = `${rtdbUrl}/${encodedPath}.json?ns=${encodeURIComponent(rtdbNamespace)}`;
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
        url: `${rtdbUrl}/${encodedPath}.json`,
        headers: { Authorization: `Bearer ${saOAuthToken}` },
      };
    }

    // 2. If Database Secret is configured and caller passed defaultOwnerToken
    if (firebaseDatabaseSecret && (!callerOrOwnerToken || callerOrOwnerToken === defaultOwnerToken)) {
      return {
        url: `${rtdbUrl}/${encodedPath}.json?auth=${encodeURIComponent(firebaseDatabaseSecret)}`,
        headers: {},
      };
    }

    // 3. Otherwise pass caller's verified Firebase Auth ID Token via `?auth=<ID_TOKEN>`
    if (callerOrOwnerToken && callerOrOwnerToken !== defaultOwnerToken) {
      return {
        url: `${rtdbUrl}/${encodedPath}.json?auth=${encodeURIComponent(callerOrOwnerToken)}`,
        headers: {},
      };
    }

    return { url: `${rtdbUrl}/${encodedPath}.json`, headers: {} };
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

    let lookupGoogleSub = null;
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
        const gProv = (user.providerUserInfo || []).find(p => p.providerId === 'google.com');
        if (gProv?.rawId) {
          lookupGoogleSub = String(gProv.rawId).trim();
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
    if (!isPlausibleFirebaseAuthUid(uid)) {
      return {
        ok: false,
        status: 403,
        message: 'UID trong token không phải Firebase Auth UID hợp lệ đã xác minh.',
      };
    }

    if (decoded.exp && Number(decoded.exp) < nowSec) {
      return { ok: false, status: 401, message: 'Phiên đăng nhập (ID Token) đã hết hạn.' };
    }

    const emulAcc = firebaseAuthEmulatorByUid.get(uid);
    if (allowEmulatorTokens && emulAcc?.disabled) {
      return {
        ok: false,
        status: 401,
        message: 'Tài khoản Firebase Auth đã bị vô hiệu hóa (disabled=true).',
      };
    }

    const tokenGoogleSub =
      lookupGoogleSub ||
      (Array.isArray(decoded.firebase?.identities?.['google.com'])
        ? String(decoded.firebase.identities['google.com'][0] || '').trim()
        : '') ||
      (emulAcc?.googleSub ? String(emulAcc.googleSub).trim() : '') ||
      null;

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

    const rtdbManager = await rtdbRead(`xuanhoa_security/managers/${uid}`, token);
    const isOperationalManager =
      !isBackupEntryPresent &&
      !isLocked &&
      (rtdbManager === true || stateMirror.managers[uid] === true);

    return {
      ok: true,
      uid,
      email: String(decoded.email || '').trim().toLowerCase(),
      emailVerified: Boolean(decoded.email_verified ?? true),
      googleSub: tokenGoogleSub,
      signInProvider: String(decoded.firebase?.sign_in_provider || 'google.com'),
      authTimeSec,
      isRecentAuth,
      isPrimaryFounder,
      isBackupFounder: !isPrimaryFounder && isBackupActive,
      isFounder: isPrimaryFounder || isBackupActive,
      isOperationalAdmin,
      isOperationalManager,
      isLocked,
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
    //     Unified Role Management V6 (Founder grants/revokes ADMIN or MANAGER
    //     immediately for VERIFIED/AUTO_LINKABLE accounts, or queues
    //     PENDING_ROLE_ACTIVATION for PENDING_VERIFICATION legacy accounts)
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

      const rawAction = String(body.action || 'set').trim().toLowerCase(); // 'set' | 'cancel'
      const targetUid = String(body.targetUid || '').trim();
      const targetEmail = decodeRtdbMemberKey(
        body.targetEmail || body.legacyMemberId || body.legacyKey || ''
      )
        .trim()
        .toLowerCase();
      const legacyKey = encodeRtdbMemberKey(
        body.legacyMemberId || body.legacyKey || targetEmail || targetUid
      );
      const rawRole = String(body.role || body.requestedRole || '').trim().toLowerCase();
      const makeAdminFlag = body.makeAdmin === true || rawRole === 'admin';
      const canManageWeb = makeAdminFlag
        ? true
        : Boolean(body.canManageWeb || rawRole === 'manager_web' || rawRole === 'manager_both');
      const canManageMaps = makeAdminFlag
        ? true
        : Boolean(body.canManageMaps || rawRole === 'manager_maps' || rawRole === 'manager_both');
      const nextRole = makeAdminFlag
        ? 'admin'
        : canManageWeb || canManageMaps || rawRole === 'manager'
        ? 'manager'
        : 'user'; // 'admin' | 'manager' | 'user'
      const detailedRequestedRole = makeAdminFlag
        ? 'admin'
        : canManageWeb && canManageMaps
        ? 'manager_both'
        : canManageWeb
        ? 'manager_web'
        : canManageMaps
        ? 'manager_maps'
        : 'member';

      if (!targetEmail && !targetUid) {
        return {
          ok: false,
          status: 400,
          message: 'Thiếu thông tin định danh thành viên (targetEmail hoặc targetUid).',
        };
      }

      // Protect Primary Founder from any role modification or downgrade
      if (
        targetUid === PRIMARY_FOUNDER_VERIFIED_UID ||
        targetEmail === PRIMARY_FOUNDER_EMAIL ||
        (isVerified28CharUid(targetUid) &&
          (await rtdbRead(`xuanhoa_security/primary_founder/${targetUid}`, caller.rawToken)) ===
            true)
      ) {
        return {
          ok: false,
          status: 403,
          message: 'Tuyệt đối không được hạ quyền hoặc chỉnh sửa tài khoản Primary Founder.',
        };
      }

      // Handle explicit cancellation of a Pending Role Assignment (`action === 'cancel'`)
      if (rawAction === 'cancel') {
        const existingPending =
          (await rtdbRead(
            `xuanhoa_security/pending_role_assignments/${legacyKey}`,
            caller.rawToken
          )) || stateMirror.pending_role_assignments[legacyKey];

        if (!existingPending || typeof existingPending !== 'object') {
          return {
            ok: false,
            status: 404,
            message: 'Không tìm thấy yêu cầu quyền chờ kích hoạt nào cho thành viên này.',
          };
        }

        const cancelledRecord = {
          ...existingPending,
          legacyMemberId: legacyKey,
          legacyKey,
          targetEmail: targetEmail || existingPending.targetEmail || legacyKey,
          requestedScope: existingPending.requestedScope || {
            canManageWeb: Boolean(existingPending.canManageWeb),
            canManageMaps: Boolean(existingPending.canManageMaps),
          },
          requestedByVerifiedFounderUid:
            existingPending.requestedByVerifiedFounderUid ||
            existingPending.requestedByUid ||
            caller.uid,
          requestedByFounderRole:
            existingPending.requestedByFounderRole ||
            existingPending.requestedByRole ||
            (caller.isPrimaryFounder ? 'primary_founder' : 'backup_founder'),
          requestedAtServer:
            existingPending.requestedAtServer || existingPending.requestedAt || now,
          status: 'CANCELLED',
          cancelledAtServer: now,
          cancelledByUid: caller.uid,
          updatedAtServer: now,
          updatedAt: now,
          revision: (Number(existingPending.revision) || 1) + 1,
        };
        stateMirror.pending_role_assignments[legacyKey] = cancelledRecord;
        await rtdbWrite(
          `xuanhoa_security/pending_role_assignments/${legacyKey}`,
          'PUT',
          cancelledRecord,
          caller.rawToken
        );

        const audit = await appendBackendAuditLog({
          actorUid: caller.uid,
          actorRole: caller.isPrimaryFounder ? 'primary_founder' : 'backup_founder',
          action: `Hủy quyền chờ kích hoạt (${String(existingPending.requestedRole || 'user').toUpperCase()})`,
          target: `${targetEmail || legacyKey} (Request: ${existingPending.requestId})`,
          eventCategory: 'role_management',
          refId: existingPending.requestId || legacyKey,
          bearerToken: caller.rawToken,
        });

        return {
          ok: true,
          status: 200,
          mode: 'CANCELLED_PENDING_ROLE',
          message: `Đã hủy yêu cầu cấp quyền chờ kích hoạt của ${targetEmail || legacyKey}.`,
          pendingRoleAssignment: cancelledRecord,
          pendingAssignment: cancelledRecord,
          auditLog: audit,
        };
      }

      if (nextRole === 'admin' && !caller.isRecentAuth) {
        return {
          ok: false,
          status: 403,
          code: 'RECENT_AUTH_REQUIRED',
          error: 'RECENT_AUTH_REQUIRED',
          message: 'Nâng quyền lên ADMIN yêu cầu phiên xác thực gần đây (auth_time <= 5 phút).',
        };
      }

      // Inspect existing member registry, identity links, and Firebase Auth accounts
      const existingMember =
        (legacyKey
          ? await rtdbRead(`xuanhoa_admin/members_registry/${legacyKey}`, caller.rawToken)
          : null) ||
        stateMirror.members_registry[legacyKey] ||
        null;
      const allLinks = {
        ...(stateMirror.identity_links || {}),
        ...((await rtdbRead('xuanhoa_security/identity_links', caller.rawToken)) || {}),
      };
      const existingLink = allLinks[legacyKey] || null;

      const candidateUid =
        targetUid ||
        existingLink?.verifiedFirebaseUid ||
        existingMember?.uid ||
        '';
      const authLookup = await lookupFirebaseAuthUsers({
        uids: isVerified28CharUid(candidateUid) ? [candidateUid] : [],
        emails: targetEmail ? [targetEmail] : [],
      });

      // Classify target account identity
      let identityStatus = 'PENDING_VERIFICATION';
      let resolvedVerifiedUid = null;
      let conflictReason = null;
      let evidenceSource = 'pending_user_login';

      const is28 = isPlausibleFirebaseAuthUid(candidateUid);
      const is21Sub = isGoogleSub21Digit(candidateUid);
      const expectedGoogleSub = is21Sub
        ? candidateUid
        : existingLink?.googleSub ||
          (isGoogleSub21Digit(existingMember?.uid) ? String(existingMember.uid).trim() : null) ||
          (isGoogleSub21Digit(existingMember?.googleSub) ? String(existingMember.googleSub).trim() : null) ||
          (isGoogleSub21Digit(existingMember?.legacyUid) ? String(existingMember.legacyUid).trim() : null);
      const byUidUser = is28 ? authLookup.byUid.get(candidateUid) : null;
      const byEmailUsers = targetEmail ? authLookup.byEmail.get(targetEmail) || [] : [];
      const bySubUsers = expectedGoogleSub ? authLookup.byGoogleSub.get(expectedGoogleSub) || [] : [];

      const isAuthoritativeRbacUid =
        is28 &&
        (stateMirror.primary_founder?.[candidateUid] === true ||
          Boolean(stateMirror.backup_founder?.[candidateUid]) ||
          stateMirror.admins?.[candidateUid] === true ||
          stateMirror.managers?.[candidateUid] === true ||
          (targetEmail === PRIMARY_FOUNDER_EMAIL && candidateUid === PRIMARY_FOUNDER_VERIFIED_UID));

      if (existingLink?.status === 'CONFLICT') {
        identityStatus = 'CONFLICT';
        conflictReason =
          existingLink.conflictReason ||
          'Tài khoản đang bị đánh dấu xung đột danh tính (CONFLICT).';
      } else if (
        existingLink?.status === 'VERIFIED' &&
        isPlausibleFirebaseAuthUid(existingLink.verifiedFirebaseUid) &&
        is28 &&
        candidateUid !== existingLink.verifiedFirebaseUid
      ) {
        identityStatus = 'CONFLICT';
        conflictReason = `Hồ sơ đã liên kết với UID ${existingLink.verifiedFirebaseUid} nhưng yêu cầu gửi UID khác (${candidateUid}).`;
      } else if (byEmailUsers.length > 1 || bySubUsers.length > 1) {
        identityStatus = 'CONFLICT';
        conflictReason = 'Một hồ sơ cũ khớp với nhiều tài khoản Firebase Authentication khác nhau.';
      } else if (byUidUser) {
        if (byUidUser.disabled) {
          identityStatus = 'CONFLICT';
          conflictReason = 'Tài khoản Firebase Authentication đang bị vô hiệu hóa (disabled=true).';
        } else if (
          targetEmail &&
          byUidUser.email &&
          byUidUser.email.trim().toLowerCase() !== targetEmail
        ) {
          identityStatus = 'CONFLICT';
          conflictReason = `UID ${byUidUser.localId} thuộc về email khác (${byUidUser.email} !== ${targetEmail}).`;
        } else if (
          expectedGoogleSub &&
          (!byUidUser.googleSub ||
            byUidUser.googleSub !== expectedGoogleSub ||
            !(byUidUser.providerIds || []).includes('google.com'))
        ) {
          identityStatus = 'CONFLICT';
          conflictReason = `Google sub trên Firebase Auth (${byUidUser.googleSub || 'none'}) không khớp với Google sub gốc của hồ sơ (${expectedGoogleSub}).`;
        } else {
          // Check if any OTHER legacy profile in allLinks is already linked to byUidUser.localId
          const otherLinked = Object.values(allLinks).find(
            l =>
              l &&
              l.verifiedFirebaseUid === byUidUser.localId &&
              (l.legacyMemberId || l.legacyKey) !== legacyKey &&
              (l.targetEmail || l.email) !== targetEmail
          );
          if (otherLinked) {
            identityStatus = 'CONFLICT';
            conflictReason = `Firebase UID ${byUidUser.localId} đã được liên kết với hồ sơ khác (${otherLinked.targetEmail || otherLinked.email}).`;
          } else {
            identityStatus = 'VERIFIED';
            resolvedVerifiedUid = byUidUser.localId;
            evidenceSource = 'firebase_auth_uid_verified';
          }
        }
      } else if (is28 && byEmailUsers.length === 1 && byEmailUsers[0].localId !== candidateUid) {
        identityStatus = 'CONFLICT';
        conflictReason = `UID lưu trong hồ sơ (${candidateUid}) mâu thuẫn với UID thực tế trên Firebase Auth (${byEmailUsers[0].localId}) của cùng email.`;
      } else if (byEmailUsers.length === 1 || bySubUsers.length === 1) {
        const matchedAuth = bySubUsers[0] || byEmailUsers[0];
        if (matchedAuth.disabled) {
          identityStatus = 'CONFLICT';
          conflictReason = 'Tài khoản Firebase Authentication khớp email/sub đang bị vô hiệu hóa (disabled=true).';
        } else if (
          targetEmail &&
          matchedAuth.email &&
          matchedAuth.email.trim().toLowerCase() !== targetEmail
        ) {
          identityStatus = 'CONFLICT';
          conflictReason = `Email trong hồ sơ cũ (${targetEmail}) mâu thuẫn với email trên Firebase Auth (${matchedAuth.email}).`;
        } else if (expectedGoogleSub) {
          // Strict Google sub verification required for any profile with an expected 21-digit Google sub.
          // Never fall back to verified_email_match if googleSub is missing or different!
          if (
            !matchedAuth.googleSub ||
            matchedAuth.googleSub !== expectedGoogleSub ||
            !(matchedAuth.providerIds || []).includes('google.com') ||
            !matchedAuth.emailVerified
          ) {
            identityStatus = 'CONFLICT';
            conflictReason = `Google sub trong hồ sơ cũ (${expectedGoogleSub}) không khớp với Firebase Auth (${matchedAuth.googleSub || 'missing_google_provider'}) — Chặn liên kết qua verified_email_match để chống chiếm quyền.`;
          } else {
            const otherLinked = Object.values(allLinks).find(
              l =>
                l &&
                l.verifiedFirebaseUid === matchedAuth.localId &&
                (l.legacyMemberId || l.legacyKey) !== legacyKey &&
                (l.targetEmail || l.email) !== targetEmail
            );
            if (otherLinked) {
              identityStatus = 'CONFLICT';
              conflictReason = `Firebase UID ${matchedAuth.localId} đã được liên kết với hồ sơ khác (${otherLinked.targetEmail || otherLinked.email}).`;
            } else {
              identityStatus = 'AUTO_LINKABLE';
              resolvedVerifiedUid = matchedAuth.localId;
              evidenceSource = 'identity_toolkit_google_sub_match';
            }
          }
        } else if (!(matchedAuth.providerIds || []).includes('google.com')) {
          identityStatus = 'CONFLICT';
          conflictReason = `Tài khoản Firebase Auth trùng email (${targetEmail}) nhưng không xác thực qua Google OAuth (provider=${(matchedAuth.providerIds || []).join(',') || 'unknown'}) — Chặn chiếm quyền qua verified_email_match.`;
        } else {
          // Profile has only synthetic uid_* (no recorded 21-digit Google sub):
          // Do NOT guess/auto-link solely because email matches! Keep PENDING_VERIFICATION until live user login (reconcile-self).
          identityStatus = 'PENDING_VERIFICATION';
          evidenceSource = 'email_only_requires_live_token_login';
        }
      } else if (
        existingLink?.status === 'VERIFIED' &&
        isPlausibleFirebaseAuthUid(existingLink.verifiedFirebaseUid)
      ) {
        identityStatus = 'VERIFIED';
        resolvedVerifiedUid = existingLink.verifiedFirebaseUid;
        evidenceSource = existingLink.evidenceSource || 'firebase_auth_uid_verified';
      } else if (
        isAuthoritativeRbacUid ||
        (allowEmulatorTokens && !targetEmail && !existingMember && is28)
      ) {
        identityStatus = 'VERIFIED';
        resolvedVerifiedUid = candidateUid;
        evidenceSource = 'firebase_auth_uid_verified';
      }

      // CASE A: CONFLICT -> Block activation and record conflict
      if (identityStatus === 'CONFLICT') {
        const conflictLink = {
          legacyMemberId: legacyKey,
          legacyKey,
          targetEmail: targetEmail || legacyKey,
          email: targetEmail || legacyKey,
          legacyUid: candidateUid || null,
          googleSub: is21Sub ? candidateUid : null,
          verifiedFirebaseUid: null,
          status: 'CONFLICT',
          evidenceSource: 'conflict_detected',
          linkMethod: 'conflict',
          conflictReason,
          linkedAtServer: existingLink?.linkedAtServer || existingLink?.linkedAt || now,
          linkedAt: existingLink?.linkedAt || existingLink?.linkedAtServer || now,
          updatedAtServer: now,
          linkedByUid: caller.uid,
          linkedBy: caller.uid,
        };
        stateMirror.identity_links[legacyKey] = conflictLink;
        await rtdbWrite(
          `xuanhoa_security/identity_links/${legacyKey}`,
          'PUT',
          conflictLink,
          caller.rawToken
        );

        return {
          ok: false,
          status: 409,
          code: 'IDENTITY_CONFLICT',
          error: 'IDENTITY_CONFLICT',
          identityStatus: 'CONFLICT',
          conflictReason,
          message: `Phát hiện xung đột danh tính (CONFLICT) — Đã chặn kích hoạt quyền tự động: ${conflictReason}`,
        };
      }

      const isGrantAdmin = nextRole === 'admin';
      const isGrantManager = nextRole === 'manager' && (canManageWeb || canManageMaps);
      const effectiveRole = isGrantAdmin ? 'admin' : isGrantManager ? 'manager' : 'user';

      // CASE B: VERIFIED or AUTO_LINKABLE -> Link if needed and apply RBAC immediately!
      if (
        (identityStatus === 'VERIFIED' || identityStatus === 'AUTO_LINKABLE') &&
        isVerified28CharUid(resolvedVerifiedUid)
      ) {
        if (
          resolvedVerifiedUid === PRIMARY_FOUNDER_VERIFIED_UID ||
          (await rtdbRead(
            `xuanhoa_security/primary_founder/${resolvedVerifiedUid}`,
            caller.rawToken
          )) === true
        ) {
          return {
            ok: false,
            status: 403,
            message: 'Tuyệt đối không được hạ quyền hoặc chỉnh sửa tài khoản Primary Founder.',
          };
        }

        const targetLocked =
          (await rtdbRead(
            `xuanhoa_security/locked_uids/${resolvedVerifiedUid}`,
            caller.rawToken
          )) === true || stateMirror.locked_uids[resolvedVerifiedUid] === true;
        if (targetLocked && (isGrantAdmin || isGrantManager)) {
          return {
            ok: false,
            status: 403,
            code: 'TARGET_ACCOUNT_LOCKED',
            error: 'TARGET_ACCOUNT_LOCKED',
            message: 'Không thể cấp quyền Admin/Manager cho tài khoản đang bị khóa bảo mật (locked_uids).',
          };
        }

        const targetBackup =
          (await rtdbRead(
            `xuanhoa_security/backup_founder/${resolvedVerifiedUid}`,
            caller.rawToken
          )) ?? stateMirror.backup_founder[resolvedVerifiedUid];
        if (targetBackup !== undefined && targetBackup !== null) {
          if (!caller.isPrimaryFounder) {
            return {
              ok: false,
              status: 403,
              message: 'Chỉ Primary Founder mới được quản lý tài khoản Backup Founder.',
            };
          }
          const isTargetActive = targetBackup === true || targetBackup?.active === true;
          if (!isTargetActive && (isGrantAdmin || isGrantManager)) {
            return {
              ok: false,
              status: 403,
              message:
                'Không thể cấp quyền Admin/Manager cho Backup Founder đang bị khóa (active=false).',
            };
          }
        }

        // Save verified identity link
        if (legacyKey && targetEmail) {
          const verifiedLink = {
            legacyMemberId: legacyKey,
            legacyKey,
            targetEmail,
            email: targetEmail,
            legacyUid:
              existingLink?.legacyUid ||
              (candidateUid && candidateUid !== resolvedVerifiedUid ? candidateUid : null),
            googleSub:
              existingLink?.googleSub || (is21Sub ? candidateUid : null),
            verifiedFirebaseUid: resolvedVerifiedUid,
            status: 'VERIFIED',
            evidenceSource,
            linkMethod:
              identityStatus === 'AUTO_LINKABLE'
                ? 'firebase_auth_reconcile'
                : 'already_verified_28char',
            conflictReason: null,
            linkedAtServer: existingLink?.linkedAtServer || existingLink?.linkedAt || now,
            linkedAt: existingLink?.linkedAt || existingLink?.linkedAtServer || now,
            updatedAtServer: now,
            linkedByUid: caller.uid,
            linkedBy: caller.uid,
          };
          stateMirror.identity_links[legacyKey] = verifiedLink;
          await rtdbWrite(
            `xuanhoa_security/identity_links/${legacyKey}`,
            'PUT',
            verifiedLink,
            caller.rawToken
          );
        }

        stateMirror.admins[resolvedVerifiedUid] = isGrantAdmin;
        stateMirror.managers[resolvedVerifiedUid] = isGrantManager;

        await rtdbWrite(
          `xuanhoa_security/admins/${resolvedVerifiedUid}`,
          'PUT',
          isGrantAdmin,
          caller.rawToken
        );
        await rtdbWrite(
          `xuanhoa_security/managers/${resolvedVerifiedUid}`,
          'PUT',
          isGrantManager,
          caller.rawToken
        );

        // Update member registry record if present so UID and role flags stay in sync
        if (legacyKey && (existingMember || targetEmail)) {
          const updatedMember = {
            ...(existingMember || {
              email: targetEmail,
              displayName: targetEmail,
              createdAt: now,
            }),
            uid: resolvedVerifiedUid,
            identityStatus: 'VERIFIED',
            ...(candidateUid && candidateUid !== resolvedVerifiedUid
              ? { legacyUid: candidateUid }
              : {}),
            email: targetEmail || existingMember?.email,
            status: isGrantAdmin
              ? 'admin'
              : existingMember?.status === 'admin'
              ? 'active'
              : existingMember?.status || 'active',
            canManageWeb: isGrantAdmin ? true : isGrantManager ? canManageWeb : false,
            canManageMaps: isGrantAdmin ? true : isGrantManager ? canManageMaps : false,
            lastActiveAt: existingMember?.lastActiveAt || now,
          };
          stateMirror.members_registry[legacyKey] = updatedMember;
          await rtdbWrite(
            `xuanhoa_admin/members_registry/${legacyKey}`,
            'PUT',
            updatedMember,
            caller.rawToken
          );
        }

        // If there was a pending role assignment for this legacyKey, mark it ACTIVATED/CANCELLED so it is never both ACTIVE and PENDING
        const prevPending =
          (await rtdbRead(
            `xuanhoa_security/pending_role_assignments/${legacyKey}`,
            caller.rawToken
          )) || stateMirror.pending_role_assignments[legacyKey];
        if (prevPending && prevPending.status === 'PENDING_ROLE_ACTIVATION') {
          const resolvedPending = {
            ...prevPending,
            legacyMemberId: legacyKey,
            legacyKey,
            requestedRole: detailedRequestedRole,
            requestedScope: {
              canManageWeb: isGrantAdmin ? true : isGrantManager ? canManageWeb : false,
              canManageMaps: isGrantAdmin ? true : isGrantManager ? canManageMaps : false,
            },
            status: effectiveRole === 'user' ? 'CANCELLED' : 'ACTIVATED',
            activatedAtServer: effectiveRole === 'user' ? null : now,
            activatedAt: effectiveRole === 'user' ? null : now,
            activatedFirebaseUid: effectiveRole === 'user' ? null : resolvedVerifiedUid,
            activatedUid: effectiveRole === 'user' ? null : resolvedVerifiedUid,
            cancelledAtServer: effectiveRole === 'user' ? now : null,
            updatedAtServer: now,
            updatedAt: now,
            revision: (Number(prevPending.revision) || 1) + 1,
          };
          stateMirror.pending_role_assignments[legacyKey] = resolvedPending;
          await rtdbWrite(
            `xuanhoa_security/pending_role_assignments/${legacyKey}`,
            'PUT',
            resolvedPending,
            caller.rawToken
          );
        }

        const audit = await appendBackendAuditLog({
          actorUid: caller.uid,
          actorRole: caller.isPrimaryFounder ? 'primary_founder' : 'backup_founder',
          action: isGrantAdmin
            ? identityStatus === 'AUTO_LINKABLE'
              ? 'Đối soát tự động Firebase UID & Cấp quyền ADMIN'
              : 'Cấp quyền ADMIN'
            : isGrantManager
            ? `${identityStatus === 'AUTO_LINKABLE' ? 'Đối soát tự động Firebase UID & ' : ''}Cấp quyền MANAGER (${[canManageWeb ? 'Web' : '', canManageMaps ? 'Maps' : ''].filter(Boolean).join('+')})`
            : 'Thu hồi quyền về USER',
          target: `${targetEmail || resolvedVerifiedUid} (UID: ${resolvedVerifiedUid.slice(0, 6)}...${resolvedVerifiedUid.slice(-4)})`,
          eventCategory: 'role_management',
          refId: resolvedVerifiedUid,
          bearerToken: caller.rawToken,
        });

        return {
          ok: true,
          status: 200,
          mode: 'ACTIVE_IMMEDIATELY',
          identityStatus: 'VERIFIED',
          wasAutoLinked: identityStatus === 'AUTO_LINKABLE',
          uid: resolvedVerifiedUid,
          verifiedUid: resolvedVerifiedUid,
          verifiedFirebaseUid: resolvedVerifiedUid,
          role: effectiveRole,
          canManageWeb: isGrantAdmin ? true : isGrantManager ? canManageWeb : false,
          canManageMaps: isGrantAdmin ? true : isGrantManager ? canManageMaps : false,
          message:
            identityStatus === 'AUTO_LINKABLE'
              ? `Đã tự động liên kết Firebase Auth UID và cấp quyền (${effectiveRole.toUpperCase()}) có hiệu lực ngay cho ${targetEmail || resolvedVerifiedUid}.`
              : `Đã cập nhật phân quyền (${effectiveRole.toUpperCase()}) có hiệu lực ngay cho ${targetEmail || resolvedVerifiedUid}.`,
          auditLog: audit,
        };
      }

      // CASE C: PENDING_VERIFICATION (Unverified legacy account — 21-digit Google sub or uid_*)
      // Strictly DO NOT write to xuanhoa_security/admins or xuanhoa_security/managers!
      // Strictly DO NOT fabricate a fake 28-char UID!
      const prevPending =
        (await rtdbRead(
          `xuanhoa_security/pending_role_assignments/${legacyKey}`,
          caller.rawToken
        )) || stateMirror.pending_role_assignments[legacyKey];

      if (effectiveRole === 'user') {
        if (prevPending && prevPending.status === 'PENDING_ROLE_ACTIVATION') {
          const cancelledPending = {
            ...prevPending,
            legacyMemberId: legacyKey,
            legacyKey,
            status: 'CANCELLED',
            cancelledAtServer: now,
            cancelledByUid: caller.uid,
            updatedAtServer: now,
            updatedAt: now,
            revision: (Number(prevPending.revision) || 1) + 1,
          };
          stateMirror.pending_role_assignments[legacyKey] = cancelledPending;
          await rtdbWrite(
            `xuanhoa_security/pending_role_assignments/${legacyKey}`,
            'PUT',
            cancelledPending,
            caller.rawToken
          );
        }
        if (legacyKey && existingMember) {
          const cleanedMember = {
            ...existingMember,
            status: existingMember.status === 'admin' ? 'active' : existingMember.status || 'active',
            canManageWeb: false,
            canManageMaps: false,
          };
          stateMirror.members_registry[legacyKey] = cleanedMember;
          await rtdbWrite(
            `xuanhoa_admin/members_registry/${legacyKey}`,
            'PUT',
            cleanedMember,
            caller.rawToken
          );
        }
        return {
          ok: true,
          status: 200,
          mode: 'CANCELLED_PENDING_ROLE',
          identityStatus: 'PENDING_VERIFICATION',
          role: 'user',
          message: `Đã đặt lại vai trò Thành viên và hủy mọi quyền chờ kích hoạt của ${targetEmail || legacyKey}.`,
        };
      }

      // Save Pending Role Assignment (`PENDING_ROLE_ACTIVATION`)
      const nextRevision = (Number(prevPending?.revision) || 0) + 1;
      const pendingRequestId = `pra_${now}_${randomHexBytes(3)}`;
      const pendingRecord = {
        requestId: pendingRequestId,
        legacyMemberId: legacyKey,
        legacyKey,
        targetEmail: targetEmail || legacyKey,
        legacyUid: candidateUid || `uid_${legacyKey}`,
        expectedGoogleSub: is21Sub
          ? candidateUid
          : prevPending?.expectedGoogleSub ||
            (isGoogleSub21Digit(existingMember?.uid) ? String(existingMember.uid).trim() : null),
        requestedRole: detailedRequestedRole,
        effectiveRole,
        makeAdmin: isGrantAdmin,
        canManageWeb: isGrantAdmin ? true : Boolean(canManageWeb),
        canManageMaps: isGrantAdmin ? true : Boolean(canManageMaps),
        requestedScope: {
          canManageWeb: isGrantAdmin ? true : Boolean(canManageWeb),
          canManageMaps: isGrantAdmin ? true : Boolean(canManageMaps),
        },
        status: 'PENDING_ROLE_ACTIVATION',
        requestedByVerifiedFounderUid: caller.uid,
        requestedByUid: caller.uid,
        requestedByFounderRole: caller.isPrimaryFounder ? 'primary_founder' : 'backup_founder',
        requestedByRole: caller.isPrimaryFounder ? 'primary_founder' : 'backup_founder',
        requestedAtServer: now,
        requestedAt: now,
        updatedAtServer: now,
        updatedAt: now,
        activatedAtServer: null,
        activatedAt: null,
        activatedFirebaseUid: null,
        activatedUid: null,
        cancelledAtServer: null,
        cancelledByUid: null,
        conflictReason: null,
        revision: nextRevision,
        policyVersion:
          stateMirror.policy_versions.current?.version || DEFAULT_POLICY_VERSION_META.version,
      };

      const pendingLink = {
        legacyMemberId: legacyKey,
        legacyKey,
        targetEmail: targetEmail || legacyKey,
        email: targetEmail || legacyKey,
        legacyUid: candidateUid || `uid_${legacyKey}`,
        googleSub: pendingRecord.expectedGoogleSub,
        verifiedFirebaseUid: null,
        status: 'PENDING_VERIFICATION',
        evidenceSource: 'pending_user_login',
        linkMethod: 'pending_verification',
        conflictReason: null,
        linkedAtServer: existingLink?.linkedAtServer || existingLink?.linkedAt || now,
        linkedAt: existingLink?.linkedAt || existingLink?.linkedAtServer || now,
        updatedAtServer: now,
        linkedByUid: caller.uid,
        linkedBy: caller.uid,
      };

      stateMirror.identity_links[legacyKey] = pendingLink;
      stateMirror.pending_role_assignments[legacyKey] = pendingRecord;

      await rtdbWrite(
        `xuanhoa_security/identity_links/${legacyKey}`,
        'PUT',
        pendingLink,
        caller.rawToken
      );
      await rtdbWrite(
        `xuanhoa_security/pending_role_assignments/${legacyKey}`,
        'PUT',
        pendingRecord,
        caller.rawToken
      );

      // Ensure member registry does NOT prematurely show active admin/manager flags while pending verification
      if (legacyKey && existingMember) {
        const safePendingMember = {
          ...existingMember,
          status: existingMember.status === 'admin' ? 'active' : existingMember.status || 'active',
          canManageWeb: false,
          canManageMaps: false,
        };
        stateMirror.members_registry[legacyKey] = safePendingMember;
        await rtdbWrite(
          `xuanhoa_admin/members_registry/${legacyKey}`,
          'PUT',
          safePendingMember,
          caller.rawToken
        );
      }

      const scopeLabel = isGrantAdmin
        ? 'ADMIN'
        : `MANAGER (${[canManageWeb ? 'Web' : '', canManageMaps ? 'Maps' : ''].filter(Boolean).join('+')})`;
      const audit = await appendBackendAuditLog({
        actorUid: caller.uid,
        actorRole: caller.isPrimaryFounder ? 'primary_founder' : 'backup_founder',
        action: `Lưu quyền chờ kích hoạt (${scopeLabel}) — Chờ xác minh Firebase Auth UID`,
        target: `${targetEmail || legacyKey} (Legacy ID: ${String(candidateUid || legacyKey).slice(0, 10)}..., rev=${nextRevision})`,
        eventCategory: 'role_management',
        refId: pendingRequestId,
        bearerToken: caller.rawToken,
      });

      return {
        ok: true,
        status: 200,
        mode: 'PENDING_ROLE_ACTIVATION',
        identityStatus: 'PENDING_VERIFICATION',
        role: 'user',
        pendingRoleAssignment: pendingRecord,
        pendingAssignment: pendingRecord,
        message:
          'Đã lưu quyền chờ kích hoạt. Quyền sẽ có hiệu lực sau khi xác minh đúng tài khoản.',
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

    // ------------------------------------------------------------------------
    // 15. POST /api/founder-security/reconcile-self (alias: activate-pending-role)
    //     Automatic Firebase Auth UID Reconciliation + Pending Role Activation
    //     Triggered automatically upon Google login, session restore, or reload.
    //     Strictly verifies Bearer Firebase ID Token — never trusts client body.
    // ------------------------------------------------------------------------
    if (actionName === 'reconcile-self' || actionName === 'activate-pending-role') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) {
        if (caller.status === 403 && String(caller.message || '').includes('locked_uids')) {
          return {
            ...caller,
            status: 401,
            code: 'ACCOUNT_LOCKED',
            error: 'ACCOUNT_LOCKED',
          };
        }
        return {
          ...caller,
          error: caller.code || caller.error || 'UNAUTHORIZED',
        };
      }

      // Reject spoofed identity claims in request body if they contradict the verified ID Token
      if (body.claimedUid && String(body.claimedUid).trim() !== caller.uid) {
        return {
          ok: false,
          status: 403,
          code: 'SPOOFED_IDENTITY_REJECTED',
          error: 'SPOOFED_IDENTITY_REJECTED',
          message: 'Từ chối yêu cầu kích hoạt: UID gửi lên không khớp với Firebase ID Token đã xác minh.',
        };
      }
      if (
        body.claimedEmail &&
        decodeRtdbMemberKey(body.claimedEmail).trim().toLowerCase() !== caller.email
      ) {
        return {
          ok: false,
          status: 403,
          code: 'SPOOFED_IDENTITY_REJECTED',
          error: 'SPOOFED_IDENTITY_REJECTED',
          message: 'Từ chối yêu cầu kích hoạt: Email gửi lên không khớp với Firebase ID Token đã xác minh.',
        };
      }

      if (!caller.email || !caller.email.includes('@')) {
        return {
          ok: false,
          status: 400,
          error: 'INVALID_EMAIL',
          message: 'Token không chứa email hợp lệ để đối soát hồ sơ.',
        };
      }

      if (!caller.emailVerified) {
        return {
          ok: false,
          status: 403,
          code: 'EMAIL_NOT_VERIFIED',
          error: 'EMAIL_NOT_VERIFIED',
          message: 'Email trên Firebase Authentication chưa được xác minh (email_verified=false).',
        };
      }

      const legacyKey = encodeRtdbMemberKey(caller.email);
      const allLinks = {
        ...(stateMirror.identity_links || {}),
        ...((await rtdbRead('xuanhoa_security/identity_links')) || {}),
      };
      const existingLink = allLinks[legacyKey] || null;
      const existingMember =
        (await rtdbRead(`xuanhoa_admin/members_registry/${legacyKey}`)) ||
        stateMirror.members_registry[legacyKey] ||
        null;
      const pendingRole =
        (await rtdbRead(`xuanhoa_security/pending_role_assignments/${legacyKey}`)) ||
        stateMirror.pending_role_assignments[legacyKey] ||
        null;

      // 1. Check for Identity Conflicts (1-to-many or many-to-1 or Google sub mismatch)
      let conflictReason = null;

      // Check if caller.uid is already linked to a DIFFERENT legacyMemberId / email
      const otherLinkedToSameUid = Object.values(allLinks).find(
        l =>
          l &&
          l.verifiedFirebaseUid === caller.uid &&
          (l.legacyMemberId || l.legacyKey) !== legacyKey &&
          (l.targetEmail || l.email) !== caller.email
      );
      if (otherLinkedToSameUid) {
        conflictReason = `Firebase UID ${caller.uid} đã được liên kết với một hồ sơ thành viên khác (${otherLinkedToSameUid.targetEmail || otherLinkedToSameUid.email}).`;
      } else if (
        existingLink?.status === 'VERIFIED' &&
        isVerified28CharUid(existingLink.verifiedFirebaseUid) &&
        existingLink.verifiedFirebaseUid !== caller.uid
      ) {
        conflictReason = `Hồ sơ ${caller.email} đã được xác minh với một Firebase UID khác (${existingLink.verifiedFirebaseUid} !== ${caller.uid}).`;
      } else if (existingLink?.status === 'CONFLICT') {
        conflictReason =
          existingLink.conflictReason ||
          'Hồ sơ đang ở trạng thái xung đột danh tính (CONFLICT) cần Founder kiểm tra.';
      } else if (
        existingMember?.uid &&
        isPlausibleFirebaseAuthUid(existingMember.uid) &&
        existingMember.uid !== caller.uid
      ) {
        conflictReason = `Hồ sơ ${caller.email} đang lưu Firebase UID khác (${existingMember.uid} !== ${caller.uid}).`;
      } else if (!caller.isFounder && caller.signInProvider !== 'google.com') {
        conflictReason = `Phiên đăng nhập (${caller.email}) không xác thực qua Google OAuth (provider=${caller.signInProvider}) — Chặn liên kết/kích hoạt quyền qua verified_email_match để chống chiếm quyền.`;
      } else {
        const expectedSub =
          pendingRole?.expectedGoogleSub ||
          existingLink?.googleSub ||
          (isGoogleSub21Digit(existingMember?.uid) ? String(existingMember.uid).trim() : null) ||
          (isGoogleSub21Digit(existingMember?.googleSub) ? String(existingMember.googleSub).trim() : null) ||
          (isGoogleSub21Digit(existingMember?.legacyUid) ? String(existingMember.legacyUid).trim() : null);
        if (expectedSub && (!caller.googleSub || expectedSub !== caller.googleSub)) {
          conflictReason = `Google sub trong phiên đăng nhập (${caller.googleSub || 'missing_google_sub'}) mâu thuẫn với Google sub gốc của hồ sơ cũ (${expectedSub}).`;
        }
      }

      if (conflictReason) {
        const conflictLink = {
          legacyMemberId: legacyKey,
          legacyKey,
          targetEmail: caller.email,
          email: caller.email,
          legacyUid:
            existingLink?.legacyUid ||
            (existingMember?.uid && existingMember.uid !== caller.uid ? existingMember.uid : null),
          googleSub: caller.googleSub || existingLink?.googleSub || null,
          verifiedFirebaseUid: null,
          status: 'CONFLICT',
          evidenceSource: 'conflict_detected',
          linkMethod: 'conflict',
          conflictReason,
          linkedAtServer: existingLink?.linkedAtServer || existingLink?.linkedAt || now,
          linkedAt: existingLink?.linkedAt || existingLink?.linkedAtServer || now,
          updatedAtServer: now,
          linkedByUid: caller.uid,
          linkedBy: caller.uid,
        };
        stateMirror.identity_links[legacyKey] = conflictLink;
        await rtdbWrite(`xuanhoa_security/identity_links/${legacyKey}`, 'PUT', conflictLink);

        if (pendingRole && pendingRole.status === 'PENDING_ROLE_ACTIVATION') {
          const blockedPending = {
            ...pendingRole,
            legacyMemberId: legacyKey,
            legacyKey,
            targetEmail: pendingRole.targetEmail || caller.email,
            requestedScope: pendingRole.requestedScope || {
              canManageWeb: Boolean(pendingRole.canManageWeb),
              canManageMaps: Boolean(pendingRole.canManageMaps),
            },
            requestedByVerifiedFounderUid:
              pendingRole.requestedByVerifiedFounderUid ||
              pendingRole.requestedByUid ||
              PRIMARY_FOUNDER_VERIFIED_UID,
            requestedByFounderRole:
              pendingRole.requestedByFounderRole ||
              pendingRole.requestedByRole ||
              'primary_founder',
            requestedAtServer: pendingRole.requestedAtServer || pendingRole.requestedAt || now,
            status: 'CONFLICT_BLOCKED',
            conflictReason,
            updatedAtServer: now,
            updatedAt: now,
          };
          stateMirror.pending_role_assignments[legacyKey] = blockedPending;
          await rtdbWrite(
            `xuanhoa_security/pending_role_assignments/${legacyKey}`,
            'PUT',
            blockedPending
          );
        }

        await appendBackendAuditLog({
          actorUid: caller.uid,
          actorRole: 'manager',
          action: 'Chặn liên kết & kích hoạt quyền chờ do xung đột danh tính (CONFLICT)',
          target: `${caller.email}: ${conflictReason}`,
          eventCategory: 'system_security',
          refId: legacyKey,
        });

        return {
          ok: false,
          status: 409,
          code: 'IDENTITY_CONFLICT',
          error: 'IDENTITY_CONFLICT',
          identityStatus: 'CONFLICT',
          conflictReason,
          message: `Phát hiện xung đột danh tính (CONFLICT): ${conflictReason}`,
        };
      }

      // 2. Safe Identity Link & Member Registry UID Synchronization (Preserves 100% member history & stats)
      const preservedLegacyUid =
        existingLink?.legacyUid ||
        existingMember?.legacyUid ||
        (existingMember?.uid && existingMember.uid !== caller.uid ? existingMember.uid : null);

      const verifiedLink = {
        legacyMemberId: legacyKey,
        legacyKey,
        targetEmail: caller.email,
        email: caller.email,
        legacyUid: preservedLegacyUid,
        googleSub:
          caller.googleSub ||
          existingLink?.googleSub ||
          (isGoogleSub21Digit(preservedLegacyUid) ? preservedLegacyUid : null),
        verifiedFirebaseUid: caller.uid,
        status: 'VERIFIED',
        evidenceSource: 'firebase_id_token_login',
        linkMethod: 'google_login_token',
        conflictReason: null,
        linkedAtServer: existingLink?.linkedAtServer || existingLink?.linkedAt || now,
        linkedAt: existingLink?.linkedAt || existingLink?.linkedAtServer || now,
        updatedAtServer: now,
        linkedByUid: caller.uid,
        linkedBy: caller.uid,
      };
      stateMirror.identity_links[legacyKey] = verifiedLink;
      await rtdbWrite(`xuanhoa_security/identity_links/${legacyKey}`, 'PUT', verifiedLink);

      // Update member registry UID while preserving all existing profile data
      const syncedMember = {
        ...(existingMember || {
          email: caller.email,
          displayName: body.displayName || caller.email.split('@')[0],
          nickname: body.nickname || body.displayName || caller.email.split('@')[0],
          avatar: '🐭',
          avatarId: 'm_ty',
          gender: 'male',
          phone: '',
          residentType: 'student_sp2',
          tastePreferences: [],
          spinsCount: 0,
          level: 1,
          reviewsCount: 0,
          status: 'active',
          createdAt: now,
        }),
        uid: caller.uid,
        identityStatus: 'VERIFIED',
        email: caller.email,
        ...(preservedLegacyUid ? { legacyUid: preservedLegacyUid } : {}),
        ...(verifiedLink.googleSub ? { googleSub: verifiedLink.googleSub } : {}),
        lastActiveAt: Math.max(now, Number(existingMember?.lastActiveAt || 0)),
      };

      // 3. Check & Activate Pending Role Assignment (if present and eligible)
      if (!pendingRole) {
        stateMirror.members_registry[legacyKey] = syncedMember;
        await rtdbWrite(`xuanhoa_admin/members_registry/${legacyKey}`, 'PUT', syncedMember);
        return {
          ok: true,
          status: 200,
          identityStatus: 'VERIFIED',
          verifiedUid: caller.uid,
          verifiedFirebaseUid: caller.uid,
          email: caller.email,
          identityLink: verifiedLink,
          legacyUid: preservedLegacyUid,
          roleActivated: false,
          reason: 'NO_PENDING_ROLE',
          effectiveRole: caller.isPrimaryFounder
            ? 'primary_founder'
            : caller.isBackupFounder
            ? 'backup_founder'
            : caller.isOperationalAdmin
            ? 'admin'
            : caller.isOperationalManager
            ? 'manager'
            : 'user',
          canManageWeb: Boolean(
            caller.isOperationalAdmin || (caller.isOperationalManager && syncedMember.canManageWeb)
          ),
          canManageMaps: Boolean(
            caller.isOperationalAdmin || (caller.isOperationalManager && syncedMember.canManageMaps)
          ),
          message: 'Đã xác minh và đồng bộ Firebase Auth UID cho hồ sơ thành viên.',
        };
      }

      if (pendingRole.status === 'CANCELLED') {
        stateMirror.members_registry[legacyKey] = syncedMember;
        await rtdbWrite(`xuanhoa_admin/members_registry/${legacyKey}`, 'PUT', syncedMember);
        return {
          ok: true,
          status: 200,
          identityStatus: 'VERIFIED',
          verifiedUid: caller.uid,
          verifiedFirebaseUid: caller.uid,
          email: caller.email,
          identityLink: verifiedLink,
          legacyUid: preservedLegacyUid,
          roleActivated: false,
          reason: 'PENDING_ROLE_WAS_CANCELLED',
          effectiveRole: 'user',
          canManageWeb: false,
          canManageMaps: false,
          message: 'Đã xác minh Firebase Auth UID (Yêu cầu quyền chờ trước đó đã bị Founder hủy).',
        };
      }

      if (
        pendingRole.status === 'ACTIVATED' &&
        (pendingRole.activatedFirebaseUid === caller.uid || pendingRole.activatedUid === caller.uid)
      ) {
        // Idempotent response across page reloads / repeated logins
        stateMirror.members_registry[legacyKey] = syncedMember;
        await rtdbWrite(`xuanhoa_admin/members_registry/${legacyKey}`, 'PUT', syncedMember);
        return {
          ok: true,
          status: 200,
          identityStatus: 'VERIFIED',
          verifiedUid: caller.uid,
          verifiedFirebaseUid: caller.uid,
          email: caller.email,
          identityLink: verifiedLink,
          legacyUid: preservedLegacyUid,
          roleActivated: false,
          alreadyActivated: true,
          activatedRole: pendingRole.requestedRole,
          activatedScope: pendingRole.requestedScope,
          activatedAssignment: pendingRole,
          pendingRoleAssignment: pendingRole,
          effectiveRole: caller.isOperationalAdmin
            ? 'admin'
            : caller.isOperationalManager
            ? 'manager'
            : 'user',
          canManageWeb: Boolean(
            caller.isOperationalAdmin || (caller.isOperationalManager && syncedMember.canManageWeb)
          ),
          canManageMaps: Boolean(
            caller.isOperationalAdmin || (caller.isOperationalManager && syncedMember.canManageMaps)
          ),
          message: 'Quyền đã được kích hoạt trước đó (Idempotent).',
        };
      }

      if (pendingRole.status !== 'PENDING_ROLE_ACTIVATION') {
        stateMirror.members_registry[legacyKey] = syncedMember;
        await rtdbWrite(`xuanhoa_admin/members_registry/${legacyKey}`, 'PUT', syncedMember);
        return {
          ok: true,
          status: 200,
          identityStatus: 'VERIFIED',
          verifiedUid: caller.uid,
          verifiedFirebaseUid: caller.uid,
          email: caller.email,
          identityLink: verifiedLink,
          roleActivated: false,
          reason: `UNSUPPORTED_PENDING_STATUS_${pendingRole.status}`,
        };
      }

      // Verify that the Founder who requested this Pending Role is STILL an active Founder!
      const reqFounderUid = String(
        pendingRole.requestedByVerifiedFounderUid || pendingRole.requestedByUid || ''
      ).trim();
      const reqFounderIsPrimary =
        reqFounderUid === PRIMARY_FOUNDER_VERIFIED_UID ||
        (await rtdbRead(`xuanhoa_security/primary_founder/${reqFounderUid}`)) === true ||
        stateMirror.primary_founder[reqFounderUid] === true;
      const reqFounderLocked =
        (await rtdbRead(`xuanhoa_security/locked_uids/${reqFounderUid}`)) === true ||
        stateMirror.locked_uids[reqFounderUid] === true;
      const reqFounderBackupEntry =
        (await rtdbRead(`xuanhoa_security/backup_founder/${reqFounderUid}`)) ??
        stateMirror.backup_founder[reqFounderUid];
      const reqFounderIsActiveBackup =
        !reqFounderLocked &&
        (reqFounderBackupEntry === true ||
          (typeof reqFounderBackupEntry === 'object' && reqFounderBackupEntry?.active === true));

      if (!reqFounderIsPrimary && !reqFounderIsActiveBackup) {
        const blockedByRevokedFounder = {
          ...pendingRole,
          legacyMemberId: legacyKey,
          legacyKey,
          targetEmail: pendingRole.targetEmail || caller.email,
          requestedScope: pendingRole.requestedScope || {
            canManageWeb: Boolean(pendingRole.canManageWeb),
            canManageMaps: Boolean(pendingRole.canManageMaps),
          },
          requestedByVerifiedFounderUid: reqFounderUid || PRIMARY_FOUNDER_VERIFIED_UID,
          requestedByFounderRole:
            pendingRole.requestedByFounderRole ||
            pendingRole.requestedByRole ||
            'backup_founder',
          requestedAtServer: pendingRole.requestedAtServer || pendingRole.requestedAt || now,
          status: 'CONFLICT_BLOCKED',
          conflictReason:
            'Tài khoản Founder khởi tạo yêu cầu quyền chờ không còn hiệu lực tại thời điểm kích hoạt.',
          updatedAtServer: now,
          updatedAt: now,
        };
        stateMirror.pending_role_assignments[legacyKey] = blockedByRevokedFounder;
        await rtdbWrite(
          `xuanhoa_security/pending_role_assignments/${legacyKey}`,
          'PUT',
          blockedByRevokedFounder
        );
        stateMirror.members_registry[legacyKey] = syncedMember;
        await rtdbWrite(`xuanhoa_admin/members_registry/${legacyKey}`, 'PUT', syncedMember);

        return {
          ok: true,
          status: 200,
          code: 'REQUESTING_FOUNDER_NO_LONGER_ACTIVE',
          activationBlockedReason: 'REQUESTING_BACKUP_FOUNDER_INACTIVE',
          identityStatus: 'VERIFIED',
          verifiedUid: caller.uid,
          verifiedFirebaseUid: caller.uid,
          email: caller.email,
          identityLink: verifiedLink,
          roleActivated: false,
          message:
            'Không thể tự động kích hoạt quyền chờ vì tài khoản Founder cấp quyền đã bị thu hồi hoặc khóa.',
        };
      }

      // Atomically activate the pending role!
      const rawReqRole = String(pendingRole.requestedRole || '').trim().toLowerCase();
      const isGrantAdmin = rawReqRole === 'admin' || pendingRole.makeAdmin === true;
      const canManageWeb = isGrantAdmin
        ? true
        : Boolean(
            pendingRole.requestedScope?.canManageWeb ??
              pendingRole.canManageWeb ??
              (rawReqRole === 'manager_web' || rawReqRole === 'manager_both')
          );
      const canManageMaps = isGrantAdmin
        ? true
        : Boolean(
            pendingRole.requestedScope?.canManageMaps ??
              pendingRole.canManageMaps ??
              (rawReqRole === 'manager_maps' || rawReqRole === 'manager_both')
          );
      const isGrantManager = !isGrantAdmin && (canManageWeb || canManageMaps);
      const detailedActivatedRole = isGrantAdmin
        ? 'admin'
        : canManageWeb && canManageMaps
        ? 'manager_both'
        : canManageWeb
        ? 'manager_web'
        : canManageMaps
        ? 'manager_maps'
        : 'user';

      stateMirror.admins[caller.uid] = isGrantAdmin;
      stateMirror.managers[caller.uid] = isGrantManager;
      await rtdbWrite(`xuanhoa_security/admins/${caller.uid}`, 'PUT', isGrantAdmin);
      await rtdbWrite(`xuanhoa_security/managers/${caller.uid}`, 'PUT', isGrantManager);

      const activatedMember = {
        ...syncedMember,
        uid: caller.uid,
        identityStatus: 'VERIFIED',
        status: isGrantAdmin ? 'admin' : 'active',
        canManageWeb,
        canManageMaps,
        lastActiveAt: now,
      };
      stateMirror.members_registry[legacyKey] = activatedMember;
      await rtdbWrite(`xuanhoa_admin/members_registry/${legacyKey}`, 'PUT', activatedMember);

      const activatedPending = {
        ...pendingRole,
        legacyMemberId: legacyKey,
        legacyKey,
        targetEmail: pendingRole.targetEmail || caller.email,
        requestedRole: detailedActivatedRole,
        requestedScope: { canManageWeb, canManageMaps },
        requestedByVerifiedFounderUid: reqFounderUid,
        requestedByUid: reqFounderUid,
        requestedByFounderRole: reqFounderIsPrimary ? 'primary_founder' : 'backup_founder',
        requestedByRole: reqFounderIsPrimary ? 'primary_founder' : 'backup_founder',
        requestedAtServer: pendingRole.requestedAtServer || pendingRole.requestedAt || now,
        status: 'ACTIVATED',
        activatedAtServer: now,
        activatedAt: now,
        activatedFirebaseUid: caller.uid,
        activatedUid: caller.uid,
        updatedAtServer: now,
        updatedAt: now,
      };
      stateMirror.pending_role_assignments[legacyKey] = activatedPending;
      await rtdbWrite(
        `xuanhoa_security/pending_role_assignments/${legacyKey}`,
        'PUT',
        activatedPending
      );

      const scopeLabel = isGrantAdmin
        ? 'ADMIN'
        : `MANAGER (${[canManageWeb ? 'Web' : '', canManageMaps ? 'Maps' : ''].filter(Boolean).join('+')})`;
      const audit = await appendBackendAuditLog({
        actorUid: reqFounderUid,
        actorRole: reqFounderIsPrimary ? 'primary_founder' : 'backup_founder',
        action: `Tự động kích hoạt quyền chờ (${scopeLabel}) sau khi xác minh Firebase Auth UID`,
        target: `${caller.email} (UID: ${caller.uid.slice(0, 6)}...${caller.uid.slice(-4)}, Request: ${pendingRole.requestId})`,
        eventCategory: 'role_management',
        refId: caller.uid,
      });

      return {
        ok: true,
        status: 200,
        identityStatus: 'VERIFIED',
        verifiedUid: caller.uid,
        verifiedFirebaseUid: caller.uid,
        email: caller.email,
        identityLink: verifiedLink,
        legacyUid: preservedLegacyUid,
        roleActivated: true,
        activatedRole: detailedActivatedRole,
        activatedScope: { canManageWeb, canManageMaps },
        effectiveRole: isGrantAdmin ? 'admin' : isGrantManager ? 'manager' : 'user',
        canManageWeb,
        canManageMaps,
        activatedAssignment: activatedPending,
        pendingRoleAssignment: activatedPending,
        auditLog: audit,
        message: `Đã xác minh tài khoản và tự động kích hoạt quyền ${scopeLabel} cho ${caller.email}.`,
      };
    }

    // ------------------------------------------------------------------------
    // 16. POST /api/founder-security/reconcile-accounts
    //     Automatic Firebase UID Reconciliation + Dry-Run / Controlled Apply / Rollback
    // ------------------------------------------------------------------------
    if (actionName === 'reconcile-accounts') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;

      const mode = String(body.mode || 'dry_run').trim().toLowerCase(); // 'dry_run' | 'apply' | 'rollback'
      if (mode !== 'dry_run' && !caller.isFounder) {
        return {
          ok: false,
          status: 403,
          message:
            'Chỉ Founder (Primary Founder hoặc Active Backup Founder) mới được thực thi áp dụng đối soát (apply) hoặc hoàn tác (rollback).',
        };
      }
      if (mode === 'dry_run' && !caller.isOperationalAdmin) {
        return {
          ok: false,
          status: 403,
          message: 'Chỉ Founder hoặc Admin mới có quyền chạy kiểm toán đối soát tài khoản (dry_run).',
        };
      }

      // Handle selective or snapshot rollback (`mode === 'rollback'`)
      if (mode === 'rollback') {
        const snapshotId = String(body.snapshotId || '').trim();
        const targetLegacyId = body.legacyMemberId
          ? encodeRtdbMemberKey(body.legacyMemberId)
          : null;
        const snap = snapshotId
          ? stateMirror.reconciliation_snapshots.find(s => s.snapshotId === snapshotId)
          : stateMirror.reconciliation_snapshots[0];
        if (!snap) {
          return {
            ok: false,
            status: 404,
            message: 'Không tìm thấy bản chụp (snapshot) đối soát để hoàn tác.',
          };
        }

        const keysToRestore = targetLegacyId
          ? [targetLegacyId]
          : Object.keys(snap.beforeMembersRegistry || {});
        let restoredCount = 0;
        for (const k of keysToRestore) {
          const prevMem = snap.beforeMembersRegistry?.[k];
          const prevLink = snap.beforeIdentityLinks?.[k];
          if (prevMem !== undefined) {
            stateMirror.members_registry[k] = prevMem;
            await rtdbWrite(
              `xuanhoa_admin/members_registry/${k}`,
              prevMem ? 'PUT' : 'DELETE',
              prevMem || undefined,
              caller.rawToken
            );
            restoredCount++;
          }
          if (prevLink !== undefined) {
            if (prevLink === null) {
              delete stateMirror.identity_links[k];
              await rtdbWrite(
                `xuanhoa_security/identity_links/${k}`,
                'DELETE',
                undefined,
                caller.rawToken
              );
            } else {
              stateMirror.identity_links[k] = prevLink;
              await rtdbWrite(
                `xuanhoa_security/identity_links/${k}`,
                'PUT',
                prevLink,
                caller.rawToken
              );
            }
          }
        }

        const audit = await appendBackendAuditLog({
          actorUid: caller.uid,
          actorRole: caller.isPrimaryFounder ? 'primary_founder' : 'backup_founder',
          action: `Hoàn tác (Rollback) liên kết UID từ snapshot ${snap.snapshotId}`,
          target: targetLegacyId
            ? `Hồ sơ: ${targetLegacyId}`
            : `Toàn bộ ${restoredCount} hồ sơ trong snapshot`,
          eventCategory: 'founder_security',
          refId: snap.snapshotId,
          bearerToken: caller.rawToken,
        });

        return {
          ok: true,
          status: 200,
          mode: 'rollback',
          snapshotId: snap.snapshotId,
          restoredCount,
          auditLog: audit,
          message: `Đã hoàn tác thành công ${restoredCount} hồ sơ về trạng thái trước đối soát.`,
        };
      }

      // Gather member profiles from RTDB / mirror / optional input snapshot
      const rtdbReg =
        (await rtdbRead('xuanhoa_admin/members_registry', caller.rawToken)) || {};
      const rtdbGsMembers =
        (await rtdbRead('xuanhoa_admin/global_state/members', caller.rawToken)) || {};
      const inputMembers =
        body.membersSnapshot && typeof body.membersSnapshot === 'object'
          ? body.membersSnapshot
          : {};

      const combinedRegistry = {};
      for (const src of [rtdbGsMembers, stateMirror.members_registry, rtdbReg, inputMembers]) {
        if (!src || typeof src !== 'object') continue;
        for (const [rawKey, entry] of Object.entries(src)) {
          if (!entry || typeof entry !== 'object') continue;
          const cleanEmail = decodeRtdbMemberKey(entry.email || rawKey);
          if (!cleanEmail || !cleanEmail.includes('@')) continue;
          const encodedKey = encodeRtdbMemberKey(cleanEmail);
          const prev = combinedRegistry[encodedKey] || {};
          const pickUid = () => {
            if (isVerified28CharUid(entry.uid)) return String(entry.uid).trim();
            if (isVerified28CharUid(prev.uid)) return String(prev.uid).trim();
            if (isGoogleSub21Digit(entry.uid)) return String(entry.uid).trim();
            if (isGoogleSub21Digit(prev.uid)) return String(prev.uid).trim();
            return String(entry.uid || prev.uid || `uid_${encodedKey}`).trim();
          };
          combinedRegistry[encodedKey] = {
            ...prev,
            ...entry,
            email: cleanEmail,
            uid: pickUid(),
          };
        }
      }

      const existingLinks = {
        ...(stateMirror.identity_links || {}),
        ...((await rtdbRead('xuanhoa_security/identity_links', caller.rawToken)) || {}),
      };
      const existingPending = {
        ...(stateMirror.pending_role_assignments || {}),
        ...((await rtdbRead('xuanhoa_security/pending_role_assignments', caller.rawToken)) || {}),
      };

      const allEmails = Object.values(combinedRegistry)
        .map(m => m.email)
        .filter(Boolean);
      const all28Uids = Object.values(combinedRegistry)
        .map(m => m.uid)
        .filter(isVerified28CharUid);

      const authLookup = await lookupFirebaseAuthUsers({
        uids: all28Uids,
        emails: allEmails,
      });

      // Detect many-to-1 conflicts across the entire registry (multiple legacy profiles matching the same Firebase Auth UID)
      const profilesByMatchedAuthUid = new Map();
      for (const [legacyKey, member] of Object.entries(combinedRegistry)) {
        const email = member.email;
        const rawUid = String(member.uid || '').trim();
        const is28 = isVerified28CharUid(rawUid);
        const is21 = isGoogleSub21Digit(rawUid);
        const matchedUids = new Set();
        if (is28 && authLookup.byUid.has(rawUid)) matchedUids.add(rawUid);
        for (const u of authLookup.byEmail.get(email) || []) matchedUids.add(u.localId);
        if (is21) {
          for (const u of authLookup.byGoogleSub.get(rawUid) || []) matchedUids.add(u.localId);
        }
        for (const mUid of matchedUids) {
          if (!profilesByMatchedAuthUid.has(mUid)) profilesByMatchedAuthUid.set(mUid, []);
          profilesByMatchedAuthUid.get(mUid).push(legacyKey);
        }
      }

      const summary = {
        totalProfiles: Object.keys(combinedRegistry).length,
        VERIFIED: 0,
        AUTO_LINKABLE: 0,
        PENDING_VERIFICATION: 0,
        CONFLICT: 0,
        pendingRoleCount: 0,
        autoActivatedRolesCount: 0,
      };

      const records = [];
      const beforeMembersRegistry = {};
      const beforeIdentityLinks = {};

      for (const [legacyKey, member] of Object.entries(combinedRegistry)) {
        const email = member.email;
        const rawUid = String(member.uid || '').trim();
        const is28 = isVerified28CharUid(rawUid);
        const is21 = isGoogleSub21Digit(rawUid);
        const prevLink = existingLinks[legacyKey] || null;
        const pend = existingPending[legacyKey] || null;
        if (pend && pend.status === 'PENDING_ROLE_ACTIVATION') {
          summary.pendingRoleCount++;
        }

        const byUidUser = is28 ? authLookup.byUid.get(rawUid) : null;
        const byEmailUsers = authLookup.byEmail.get(email) || [];
        const bySubUsers = is21 ? authLookup.byGoogleSub.get(rawUid) || [] : [];

        const candidateAuthUsersMap = new Map();
        if (byUidUser) candidateAuthUsersMap.set(byUidUser.localId, byUidUser);
        for (const u of byEmailUsers) candidateAuthUsersMap.set(u.localId, u);
        for (const u of bySubUsers) candidateAuthUsersMap.set(u.localId, u);
        const candidateAuthUsers = Array.from(candidateAuthUsersMap.values());

        let status = 'PENDING_VERIFICATION';
        let verifiedFirebaseUid = null;
        let evidenceSource = 'pending_user_login';
        let conflictReason = null;

        if (prevLink?.status === 'CONFLICT') {
          status = 'CONFLICT';
          conflictReason = prevLink.conflictReason || 'Đánh dấu xung đột trước đó.';
        } else if (candidateAuthUsers.length > 1) {
          status = 'CONFLICT';
          conflictReason = `Một hồ sơ cũ khớp với nhiều Firebase Auth UID (${candidateAuthUsers.map(u => u.localId).join(', ')}).`;
        } else if (candidateAuthUsers.length === 1) {
          const authUser = candidateAuthUsers[0];
          const sharedProfiles = profilesByMatchedAuthUid.get(authUser.localId) || [];
          if (sharedProfiles.length > 1) {
            status = 'CONFLICT';
            conflictReason = `Một Firebase Auth UID (${authUser.localId}) trùng cho nhiều hồ sơ cũ (${sharedProfiles.join(', ')}).`;
          } else if (authUser.disabled) {
            status = 'CONFLICT';
            conflictReason = `Tài khoản Firebase Auth (${authUser.localId}) đang bị vô hiệu hóa (disabled=true).`;
          } else if (authUser.email && authUser.email.trim().toLowerCase() !== email) {
            status = 'CONFLICT';
            conflictReason = `Mâu thuẫn email giữa hồ sơ cũ (${email}) và Firebase Auth (${authUser.email}).`;
          } else if (is21 && (!authUser.googleSub || authUser.googleSub !== rawUid || !(authUser.providerIds || []).includes('google.com') || !authUser.emailVerified)) {
            status = 'CONFLICT';
            conflictReason = `Mâu thuẫn Google sub giữa hồ sơ cũ (${rawUid}) và Firebase Auth (${authUser.googleSub || 'missing_google_provider'}) — Chặn tự động liên kết qua email.`;
          } else if (is28 && authUser.localId !== rawUid) {
            status = 'CONFLICT';
            conflictReason = `Mâu thuẫn UID trong hồ sơ (${rawUid}) với Firebase Auth UID thực tế (${authUser.localId}).`;
          } else if (is28 && authUser.localId === rawUid) {
            status = 'VERIFIED';
            verifiedFirebaseUid = authUser.localId;
            evidenceSource = 'firebase_auth_uid_verified';
          } else if (
            is21 &&
            authUser.googleSub === rawUid &&
            authUser.emailVerified &&
            (authUser.providerIds || []).includes('google.com')
          ) {
            status = 'AUTO_LINKABLE';
            verifiedFirebaseUid = authUser.localId;
            evidenceSource = 'identity_toolkit_google_sub_match';
          } else if (!(authUser.providerIds || []).includes('google.com')) {
            status = 'CONFLICT';
            conflictReason = `Tài khoản Firebase Auth trùng email (${email}) nhưng không phải Google OAuth (provider=${(authUser.providerIds || []).join(',') || 'unknown'}) — Chặn chiếm quyền qua verified_email_match.`;
          } else {
            // Synthetic uid_* profile without prior 21-digit Google sub: do NOT guess AUTO_LINKABLE by email alone!
            status = 'PENDING_VERIFICATION';
            evidenceSource = 'email_only_requires_live_token_login';
          }
        } else if (
          prevLink?.status === 'VERIFIED' &&
          isPlausibleFirebaseAuthUid(prevLink.verifiedFirebaseUid)
        ) {
          status = 'VERIFIED';
          verifiedFirebaseUid = prevLink.verifiedFirebaseUid;
          evidenceSource = prevLink.evidenceSource || 'firebase_auth_uid_verified';
        } else if (
          is28 &&
          (stateMirror.primary_founder?.[rawUid] === true ||
            Boolean(stateMirror.backup_founder?.[rawUid]) ||
            stateMirror.admins?.[rawUid] === true ||
            stateMirror.managers?.[rawUid] === true ||
            (email === PRIMARY_FOUNDER_EMAIL && rawUid === PRIMARY_FOUNDER_VERIFIED_UID))
        ) {
          status = 'VERIFIED';
          verifiedFirebaseUid = rawUid;
          evidenceSource =
            email === PRIMARY_FOUNDER_EMAIL && rawUid === PRIMARY_FOUNDER_VERIFIED_UID
              ? 'primary_founder_verified_uid'
              : 'rbac_security_node_verified';
        } else {
          status = 'PENDING_VERIFICATION';
          evidenceSource = 'pending_user_login';
        }

        summary[status] = (summary[status] || 0) + 1;

        let roleAutoActivated = false;
        if (mode === 'apply') {
          beforeMembersRegistry[legacyKey] = rtdbReg[legacyKey]
            ? JSON.parse(JSON.stringify(rtdbReg[legacyKey]))
            : stateMirror.members_registry[legacyKey]
            ? JSON.parse(JSON.stringify(stateMirror.members_registry[legacyKey]))
            : null;
          beforeIdentityLinks[legacyKey] = prevLink
            ? JSON.parse(JSON.stringify(prevLink))
            : null;

          const effectiveLinkStatus =
            status === 'AUTO_LINKABLE' ? 'VERIFIED' : status;
          const linkRecord = {
            legacyMemberId: legacyKey,
            legacyKey,
            targetEmail: email,
            email,
            legacyUid:
              prevLink?.legacyUid ||
              (rawUid && rawUid !== verifiedFirebaseUid ? rawUid : null),
            googleSub:
              prevLink?.googleSub || (is21 ? rawUid : null),
            verifiedFirebaseUid:
              effectiveLinkStatus === 'VERIFIED' ? verifiedFirebaseUid : null,
            status: effectiveLinkStatus,
            evidenceSource:
              status === 'CONFLICT' ? 'conflict_detected' : evidenceSource,
            linkMethod:
              status === 'AUTO_LINKABLE'
                ? 'firebase_auth_reconcile'
                : effectiveLinkStatus === 'VERIFIED'
                ? 'already_verified_28char'
                : status === 'CONFLICT'
                ? 'conflict'
                : 'pending_verification',
            conflictReason: conflictReason || null,
            linkedAtServer: prevLink?.linkedAtServer || prevLink?.linkedAt || now,
            linkedAt: prevLink?.linkedAt || prevLink?.linkedAtServer || now,
            updatedAtServer: now,
            linkedByUid: caller.uid,
            linkedBy: caller.uid,
          };
          stateMirror.identity_links[legacyKey] = linkRecord;
          await rtdbWrite(
            `xuanhoa_security/identity_links/${legacyKey}`,
            'PUT',
            linkRecord,
            caller.rawToken
          );

          if (
            (status === 'VERIFIED' || status === 'AUTO_LINKABLE') &&
            isVerified28CharUid(verifiedFirebaseUid)
          ) {
            const updatedMem = {
              ...member,
              uid: verifiedFirebaseUid,
              identityStatus: 'VERIFIED',
              ...(rawUid && rawUid !== verifiedFirebaseUid ? { legacyUid: rawUid } : {}),
              ...(is21 ? { googleSub: rawUid } : {}),
            };

            // If there is a PENDING_ROLE_ACTIVATION for this newly linked account, activate it!
            if (pend && pend.status === 'PENDING_ROLE_ACTIVATION') {
              const rawReqRole = String(pend.requestedRole || '').trim().toLowerCase();
              const isGrantAdmin = rawReqRole === 'admin' || pend.makeAdmin === true;
              const canManageWeb = isGrantAdmin
                ? true
                : Boolean(
                    pend.requestedScope?.canManageWeb ??
                      pend.canManageWeb ??
                      (rawReqRole === 'manager_web' || rawReqRole === 'manager_both')
                  );
              const canManageMaps = isGrantAdmin
                ? true
                : Boolean(
                    pend.requestedScope?.canManageMaps ??
                      pend.canManageMaps ??
                      (rawReqRole === 'manager_maps' || rawReqRole === 'manager_both')
                  );
              const isGrantManager = !isGrantAdmin && (canManageWeb || canManageMaps);

              stateMirror.admins[verifiedFirebaseUid] = isGrantAdmin;
              stateMirror.managers[verifiedFirebaseUid] = isGrantManager;
              await rtdbWrite(
                `xuanhoa_security/admins/${verifiedFirebaseUid}`,
                'PUT',
                isGrantAdmin,
                caller.rawToken
              );
              await rtdbWrite(
                `xuanhoa_security/managers/${verifiedFirebaseUid}`,
                'PUT',
                isGrantManager,
                caller.rawToken
              );

              updatedMem.status = isGrantAdmin ? 'admin' : 'active';
              updatedMem.canManageWeb = canManageWeb;
              updatedMem.canManageMaps = canManageMaps;

              const activatedPend = {
                ...pend,
                legacyMemberId: legacyKey,
                legacyKey,
                status: 'ACTIVATED',
                activatedAtServer: now,
                activatedAt: now,
                activatedFirebaseUid: verifiedFirebaseUid,
                activatedUid: verifiedFirebaseUid,
                updatedAtServer: now,
                updatedAt: now,
              };
              stateMirror.pending_role_assignments[legacyKey] = activatedPend;
              await rtdbWrite(
                `xuanhoa_security/pending_role_assignments/${legacyKey}`,
                'PUT',
                activatedPend,
                caller.rawToken
              );
              roleAutoActivated = true;
              summary.autoActivatedRolesCount++;
            }

            stateMirror.members_registry[legacyKey] = updatedMem;
            await rtdbWrite(
              `xuanhoa_admin/members_registry/${legacyKey}`,
              'PUT',
              updatedMem,
              caller.rawToken
            );
          }
        }

        records.push({
          legacyMemberId: legacyKey,
          legacyKey,
          email,
          legacyUid: rawUid,
          uidFormat: is28 ? 'FIREBASE_UID_28' : is21 ? 'GOOGLE_SUB_21' : 'SYNTHETIC_UID',
          status: mode === 'apply' && status === 'AUTO_LINKABLE' ? 'VERIFIED' : status,
          preApplyClassification: status,
          verifiedFirebaseUid,
          evidenceSource,
          conflictReason,
          pendingRole: pend ? pend.requestedRole : null,
          pendingStatus: roleAutoActivated ? 'ACTIVATED' : pend?.status || null,
          roleAutoActivated,
        });
      }

      let snapshotId = null;
      if (mode === 'apply') {
        snapshotId = `recon_snap_${now}_${randomHexBytes(3)}`;
        stateMirror.reconciliation_snapshots.unshift({
          snapshotId,
          createdAt: now,
          createdByUid: caller.uid,
          beforeMembersRegistry,
          beforeIdentityLinks,
        });
        if (stateMirror.reconciliation_snapshots.length > 20) {
          stateMirror.reconciliation_snapshots.length = 20;
        }

        await appendBackendAuditLog({
          actorUid: caller.uid,
          actorRole: caller.isPrimaryFounder ? 'primary_founder' : 'backup_founder',
          action: `Đối soát tự động Firebase UID (Apply: VERIFIED=${summary.VERIFIED}, AUTO_LINKABLE=${summary.AUTO_LINKABLE}, PENDING=${summary.PENDING_VERIFICATION}, CONFLICT=${summary.CONFLICT})`,
          target: `Snapshot: ${snapshotId} (Total: ${summary.totalProfiles})`,
          eventCategory: 'founder_security',
          refId: snapshotId,
          bearerToken: caller.rawToken,
        });
      }

      return {
        ok: true,
        status: 200,
        mode,
        snapshotId,
        summary,
        counts: summary,
        records,
        message:
          mode === 'apply'
            ? `Đã hoàn tất đối soát và liên kết tự động (${summary.AUTO_LINKABLE} tài khoản được liên kết, ${summary.autoActivatedRolesCount} quyền chờ được kích hoạt).`
            : `Kết quả kiểm toán đối soát (Dry-Run): ${summary.VERIFIED} đã xác minh, ${summary.AUTO_LINKABLE} có thể tự liên kết, ${summary.PENDING_VERIFICATION} chờ đăng nhập, ${summary.CONFLICT} xung đột.`,
      };
    }

    // ------------------------------------------------------------------------
    // 17. GET | POST /api/founder-security/pending-roles
    //     Returns identity_links and pending_role_assignments
    // ------------------------------------------------------------------------
    if (actionName === 'pending-roles') {
      const caller = await verifyCallerIdentity(authHeader, nowSec);
      if (!caller.ok) return caller;

      const allLinks = {
        ...(stateMirror.identity_links || {}),
        ...((await rtdbRead('xuanhoa_security/identity_links', caller.rawToken)) || {}),
      };
      const allPending = {
        ...(stateMirror.pending_role_assignments || {}),
        ...((await rtdbRead('xuanhoa_security/pending_role_assignments', caller.rawToken)) || {}),
      };

      if (!caller.isOperationalAdmin) {
        const ownKey = encodeRtdbMemberKey(caller.email);
        return {
          ok: true,
          status: 200,
          identityLinks: allLinks[ownKey] ? { [ownKey]: allLinks[ownKey] } : {},
          pendingRoleAssignments: allPending[ownKey] ? { [ownKey]: allPending[ownKey] } : {},
        };
      }

      return {
        ok: true,
        status: 200,
        identityLinks: allLinks,
        pendingRoleAssignments: allPending,
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

    if (
      request.method === 'GET' &&
      (actionName === 'status' || actionName === 'security-status' || actionName === 'pending-roles')
    ) {
      const authorization = request.headers.get('authorization') || '';
      const resData = await handleAction(
        actionName === 'pending-roles' ? 'pending-roles' : 'status',
        {},
        { authorization }
      );
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

    if (
      req.method === 'GET' &&
      (actionName === 'status' || actionName === 'security-status' || actionName === 'pending-roles')
    ) {
      handleAction(
        actionName === 'pending-roles' ? 'pending-roles' : 'status',
        {},
        { authorization: req.headers['authorization'] || '' }
      ).then(result => {
        res.statusCode = result.status || 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(result));
      });
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
    registerEmulatorAuthAccount,
    lookupFirebaseAuthUsers,
    getVaultSnapshotForTest: () => firebaseAuthEmulatorByUid,
    getStateMirror: () => stateMirror,
    getDispatchedRecoveryEmails: () => [...dispatchedRecoveryEmails],
  };
}
