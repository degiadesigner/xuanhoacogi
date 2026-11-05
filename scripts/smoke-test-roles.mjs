#!/usr/bin/env node
/**
 * XUHO CITY — 7-ROLE RBAC & WORKER API SMOKE TEST SUITE (V4)
 * ============================================================================
 * Kiểm chứng toàn diện cả ALLOWED (200 OK) và DENIED (401/403 Permission denied)
 * cho đúng 7 vai trò / trạng thái:
 *   1. Guest (Chưa đăng nhập)
 *   2. User (Thành viên thường đã đăng nhập)
 *   3. Manager (Quản lý đề xuất địa điểm)
 *   4. Admin (Quản trị viên vận hành)
 *   5. Primary Founder (Dê Già Designer — `primary_founder/$uid === true`)
 *   6. Backup Founder Active (`backup_founder/$uid/active === true`)
 *   7. Backup Founder Inactive (`backup_founder/$uid/active === false` kể cả khi `admins/$uid === true`)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import workerRuntime from '../worker.js';
import { PRIMARY_FOUNDER_VERIFIED_UID } from '../server/founder-security-backend.mjs';
import {
  EXPECTED_PROD_DB_URL,
  resolvePrivilegedProdAuth,
} from './bootstrap-security-roles.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

function b64Url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function createSmokeJwt({ uid, email, authTimeSec }) {
  const nowSec = authTimeSec || Math.floor(Date.now() / 1000);
  return `${b64Url({ alg: 'none', typ: 'JWT' })}.${b64Url({
    iss: 'https://securetoken.google.com/xuanhoacogi',
    aud: 'xuanhoacogi',
    auth_time: nowSec,
    user_id: uid,
    sub: uid,
    iat: nowSec,
    exp: nowSec + 3600,
    email,
    email_verified: true,
  })}.`;
}

export async function runSevenRoleSmokeTests({
  emulatorPort = 9000,
  namespace = `xuanhoacogi-smoke-7role-${Date.now()}`,
} = {}) {
  const baseUrl = `http://127.0.0.1:${emulatorPort}`;
  const rulesRaw = fs.readFileSync(path.join(PROJECT_ROOT, 'database.rules.json'), 'utf8');

  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  const UIDS = {
    PRIMARY_FOUNDER: PRIMARY_FOUNDER_VERIFIED_UID,
    BACKUP_ACTIVE: '6nM9pQ4rT7vW2xY5zB8cD1fG3hJ6',
    BACKUP_INACTIVE: '7bK9mP2xQ5vN8wL4jR6tY3cZaE18',
    ADMIN: '2kL5mN8pQ3rS6tV9wX1yZ4bC7dF2',
    MANAGER: '3pQ6rS9tV2wX5yZ8bC1dF4gH7jK3',
    USER: '9rS2tV5wX8yZ1bC4dF7gH3jK6mN9',
    TARGET_USER: '5mN8pQ3rT6vW9xY2zB4cD7fG1hJ5',
  };

  const TOKENS = {
    OWNER: 'owner',
    GUEST: null,
    PRIMARY_FOUNDER: createSmokeJwt({
      uid: UIDS.PRIMARY_FOUNDER,
      email: 'marcel.vietnam@gmail.com',
      authTimeSec: nowSec - 10,
    }),
    BACKUP_ACTIVE: createSmokeJwt({
      uid: UIDS.BACKUP_ACTIVE,
      email: 'backup.active@gmail.com',
      authTimeSec: nowSec - 10,
    }),
    BACKUP_INACTIVE: createSmokeJwt({
      uid: UIDS.BACKUP_INACTIVE,
      email: 'backup.inactive@gmail.com',
      authTimeSec: nowSec - 10,
    }),
    ADMIN: createSmokeJwt({
      uid: UIDS.ADMIN,
      email: 'admin.ops@gmail.com',
      authTimeSec: nowSec - 10,
    }),
    MANAGER: createSmokeJwt({
      uid: UIDS.MANAGER,
      email: 'manager.maps@gmail.com',
      authTimeSec: nowSec - 10,
    }),
    USER: createSmokeJwt({
      uid: UIDS.USER,
      email: 'member.user@gmail.com',
      authTimeSec: nowSec - 10,
    }),
  };

  async function rtdbReq(method, relPath, token, body) {
    const clean = String(relPath || '').replace(/^\//, '');
    let url = `${baseUrl}/${clean}.json?ns=${namespace}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token === TOKENS.OWNER) {
      headers.Authorization = `Bearer ${token}`;
    } else if (token) {
      url += `&auth=${encodeURIComponent(token)}`;
    }
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  // Seed baseline state first so the Emulator namespace is initialized before applying Rules
  await rtdbReq('PUT', 'xuanhoa_security', TOKENS.OWNER, {
    primary_founder: {
      [UIDS.PRIMARY_FOUNDER]: true,
    },
    backup_founder: {
      [UIDS.BACKUP_ACTIVE]: {
        uid: UIDS.BACKUP_ACTIVE,
        username: 'bf_active_user',
        displayName: 'Backup Founder Active',
        recoveryEmail: 'backup.active@gmail.com',
        emailVerified: true,
        active: true,
        createdByUid: UIDS.PRIMARY_FOUNDER,
        createdAt: now,
        updatedAt: now,
        sessionEpoch: 1,
      },
      [UIDS.BACKUP_INACTIVE]: {
        uid: UIDS.BACKUP_INACTIVE,
        username: 'bf_inactive_user',
        displayName: 'Backup Founder Inactive',
        recoveryEmail: 'backup.inactive@gmail.com',
        emailVerified: true,
        active: false,
        createdByUid: UIDS.PRIMARY_FOUNDER,
        createdAt: now,
        updatedAt: now,
        sessionEpoch: 2,
      },
    },
    admins: {
      [UIDS.PRIMARY_FOUNDER]: true,
      [UIDS.BACKUP_ACTIVE]: true,
      // Intentionally set admins/$uid = true on INACTIVE Backup Founder to verify bypass prevention!
      [UIDS.BACKUP_INACTIVE]: true,
      [UIDS.ADMIN]: true,
    },
    managers: {
      [UIDS.BACKUP_INACTIVE]: true,
      [UIDS.MANAGER]: true,
    },
    locked_uids: {},
  });

  await rtdbReq('PUT', 'xuanhoa_admin', TOKENS.OWNER, {
    members_registry: {
      [UIDS.PRIMARY_FOUNDER]: {
        uid: UIDS.PRIMARY_FOUNDER,
        email: 'marcel.vietnam@gmail.com',
        displayName: 'Dê Già Designer',
        status: 'admin',
        roleTier: 'primary_founder',
      },
      [UIDS.USER]: {
        uid: UIDS.USER,
        email: 'member.user@gmail.com',
        displayName: 'Thành Viên Xuân Hòa',
        status: 'active',
        roleTier: 'user',
      },
    },
    reviews_Store: {
      xh_place_1: {
        rev_seed_1: {
          id: 'rev_seed_1',
          placeId: 'xh_place_1',
          userId: UIDS.USER,
          userName: 'Thành Viên',
          rating: 5,
          comment: 'Rất ngon!',
          timestamp: now,
        },
      },
    },
    global_state: {
      updatedAt: now,
      places: {
        xh_place_1: {
          id: 'xh_place_1',
          name: 'Quán Kiểm Thử 1',
          updatedAt: now,
          version: 1,
        },
      },
      landmarkBindings: {
        nha_minh_huong: {
          landmarkId: 'nha_minh_huong',
          label: 'Nhà Minh Hường',
          placeId: 'xh_landmark_nha_minh_huong',
          anchorType: 'place',
          offsetX: 0,
          offsetY: 0,
          offsetZ: 0,
          rotationY: 0,
          scale: 1,
          visible: true,
          modelVisibilityMode: 'follow_place',
          updatedAt: now,
        },
      },
    },
  });

  // Load rules into the initialized Emulator namespace
  const rulesRes = await fetch(`${baseUrl}/.settings/rules.json?ns=${namespace}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer owner',
    },
    body: rulesRaw,
  });
  if (!rulesRes.ok) {
    throw new Error(`[SMOKE TEST] Không thể nạp database.rules.json (HTTP ${rulesRes.status})`);
  }

  const workerEnv = {
    VITE_FIREBASE_PROJECT_ID: 'xuanhoacogi',
    VITE_FIREBASE_DATABASE_URL: 'https://xuanhoacogi-default-rtdb.firebaseio.com',
    FIREBASE_DATABASE_EMULATOR_URL: baseUrl,
    FIREBASE_DATABASE_NAMESPACE: namespace,
    FIREBASE_EMULATOR_OWNER_TOKEN: TOKENS.OWNER,
    ALLOW_EMULATOR_TOKENS: 'true',
  };

  async function workerApi(endpoint, token, body, method = 'POST') {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = new Request(`https://xuanhoacogi.com/api/founder-security/${endpoint}`, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(body || {}),
    });
    const res = await workerRuntime.fetch(req, workerEnv);
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }

  const results = [];
  function recordCheck(role, operation, expectedStatus, actualStatus, passed) {
    results.push({ role, operation, expectedStatus, actualStatus, status: passed ? 'PASS' : 'FAIL' });
    assert.ok(
      passed,
      `[${role}] ${operation}: expected ${expectedStatus}, got ${actualStatus}`
    );
  }

  try {
    // ------------------------------------------------------------------------
    // 1. GUEST (Unauthenticated)
    // ------------------------------------------------------------------------
    const guestReadPlaces = await rtdbReq('GET', 'xuanhoa_admin/global_state/places', TOKENS.GUEST);
    recordCheck('Guest', 'RTDB GET public places', 200, guestReadPlaces.status, guestReadPlaces.status === 200);

    const guestReadLandmarks = await rtdbReq('GET', 'xuanhoa_admin/global_state/landmarkBindings', TOKENS.GUEST);
    recordCheck('Guest', 'RTDB GET public landmarkBindings', 200, guestReadLandmarks.status, guestReadLandmarks.status === 200);

    const guestReadSecurity = await rtdbReq('GET', 'xuanhoa_security', TOKENS.GUEST);
    recordCheck('Guest', 'RTDB GET private /xuanhoa_security (DENIED)', 401, guestReadSecurity.status, guestReadSecurity.status === 401);

    const guestReadMembers = await rtdbReq('GET', 'xuanhoa_admin/members_registry', TOKENS.GUEST);
    recordCheck('Guest', 'RTDB GET private members_registry (DENIED)', 401, guestReadMembers.status, guestReadMembers.status === 401);

    const guestWritePlace = await rtdbReq('PUT', 'xuanhoa_admin/global_state/places/xh_place_1', TOKENS.GUEST, {
      id: 'xh_place_1',
      updatedAt: now,
      version: 2,
    });
    recordCheck('Guest', 'RTDB PUT places (DENIED)', 401, guestWritePlace.status, guestWritePlace.status === 401);

    const guestApiStatus = await workerApi('status', TOKENS.GUEST, null, 'GET');
    recordCheck('Guest', 'Worker GET /api/founder-security/status (DENIED)', 401, guestApiStatus.status, guestApiStatus.status === 401);

    const guestApiPolicy = await workerApi('policy-version', TOKENS.GUEST, null, 'GET');
    recordCheck('Guest', 'Worker GET /api/founder-security/policy-version (ALLOWED)', 200, guestApiPolicy.status, guestApiPolicy.status === 200);

    // ------------------------------------------------------------------------
    // 2. USER (Authenticated Regular Member)
    // ------------------------------------------------------------------------
    const userReadOwnProfile = await rtdbReq('GET', `xuanhoa_admin/members_registry/${UIDS.USER}`, TOKENS.USER);
    recordCheck('User', 'RTDB GET own members_registry/$uid (ALLOWED)', 200, userReadOwnProfile.status, userReadOwnProfile.status === 200);

    const userReadAllMembers = await rtdbReq('GET', 'xuanhoa_admin/members_registry', TOKENS.USER);
    recordCheck('User', 'RTDB GET all members_registry (DENIED)', 401, userReadAllMembers.status, userReadAllMembers.status === 401);

    const userWriteReview = await rtdbReq('PUT', 'xuanhoa_admin/reviews_Store/xh_place_1/rev_user_2', TOKENS.USER, {
      id: 'rev_user_2',
      placeId: 'xh_place_1',
      userId: UIDS.USER,
      userName: 'Thành Viên',
      rating: 5,
      comment: 'Quán sạch sẽ!',
      timestamp: now,
    });
    recordCheck('User', 'RTDB PUT own review in reviews_Store (ALLOWED)', 200, userWriteReview.status, userWriteReview.status === 200);

    const userWritePlace = await rtdbReq('PUT', 'xuanhoa_admin/global_state/places/xh_place_1', TOKENS.USER, {
      id: 'xh_place_1',
      updatedAt: now,
      version: 2,
    });
    recordCheck('User', 'RTDB PUT places (DENIED)', 401, userWritePlace.status, userWritePlace.status === 401);

    const userApiConsent = await workerApi('consent-record', TOKENS.USER, {
      termsAccepted: true,
      essentialDataNoticeAck: true,
      coreProfileConsent: true,
      optionalTastePersonalization: false,
    });
    recordCheck('User', 'Worker POST /api/founder-security/consent-record (ALLOWED)', 200, userApiConsent.status, userApiConsent.status === 200);

    const userApiRoleUpdate = await workerApi('role-update', TOKENS.USER, {
      targetUid: UIDS.USER,
      role: 'admin',
    });
    recordCheck('User', 'Worker POST /api/founder-security/role-update (DENIED)', 403, userApiRoleUpdate.status, userApiRoleUpdate.status === 403);

    // ------------------------------------------------------------------------
    // 3. MANAGER (Authenticated Place Proposal Submitter)
    // ------------------------------------------------------------------------
    const mgrSubmitProposal = await rtdbReq(
      'PUT',
      'xuanhoa_admin/global_state/placeProposals/prop_mgr_smoke_1',
      TOKENS.MANAGER,
      {
        id: 'prop_mgr_smoke_1',
        placeId: 'xh_place_1',
        placeName: 'Quán Kiểm Thử 1',
        actionType: 'update',
        status: 'pending',
        submittedBy: 'manager.maps@gmail.com',
        submittedByUid: UIDS.MANAGER,
        submittedByEmail: 'manager.maps@gmail.com',
        submittedByName: 'Manager Maps',
        submittedByRole: 'Quản lý Maps',
        submittedAt: Date.now(),
        baseVersion: 1,
        proposedData: {
          name: 'Quán Kiểm Thử 1 (Đề xuất)',
          address: 'Phường Xuân Hòa',
          phone: '',
          openHours: '07:00 - 22:00',
          parentCategoryId: 'an-chinh',
          subcategoryId: 'com',
          lat: 21.285,
          lng: 105.72,
          mapsUrl: '',
          tagline: '',
          coordinateSource: 'manager_proposed',
        },
      }
    );
    recordCheck('Manager', 'RTDB PUT pending placeProposal (ALLOWED)', 200, mgrSubmitProposal.status, mgrSubmitProposal.status === 200);

    const mgrDirectWritePlace = await rtdbReq('PUT', 'xuanhoa_admin/global_state/places/xh_place_1', TOKENS.MANAGER, {
      id: 'xh_place_1',
      updatedAt: Date.now(),
      version: 2,
    });
    recordCheck('Manager', 'RTDB direct PUT places bypass (DENIED)', 401, mgrDirectWritePlace.status, mgrDirectWritePlace.status === 401);

    const mgrDirectWriteLandmark = await rtdbReq(
      'PUT',
      'xuanhoa_admin/global_state/landmarkBindings/nha_minh_huong',
      TOKENS.MANAGER,
      {
        landmarkId: 'nha_minh_huong',
        label: 'Nhà Minh Hường',
        anchorType: 'place',
        offsetX: 1,
        offsetY: 0,
        offsetZ: 1,
        rotationY: 0,
        scale: 1,
        visible: true,
        modelVisibilityMode: 'follow_place',
        updatedAt: Date.now(),
      }
    );
    recordCheck('Manager', 'RTDB direct PUT landmarkBindings (DENIED)', 401, mgrDirectWriteLandmark.status, mgrDirectWriteLandmark.status === 401);

    // ------------------------------------------------------------------------
    // 4. ADMIN (Operational Admin — Not Founder)
    // ------------------------------------------------------------------------
    const admReadMembers = await rtdbReq('GET', 'xuanhoa_admin/members_registry', TOKENS.ADMIN);
    recordCheck('Admin', 'RTDB GET members_registry (ALLOWED)', 200, admReadMembers.status, admReadMembers.status === 200);

    const admWritePlace = await rtdbReq('PUT', 'xuanhoa_admin/global_state/places/xh_place_1', TOKENS.ADMIN, {
      id: 'xh_place_1',
      name: 'Quán Kiểm Thử 1 (Admin duyệt)',
      updatedAt: Date.now(),
      version: 2,
    });
    recordCheck('Admin', 'RTDB PUT places (ALLOWED)', 200, admWritePlace.status, admWritePlace.status === 200);

    const admWriteLandmark = await rtdbReq(
      'PUT',
      'xuanhoa_admin/global_state/landmarkBindings/nha_minh_huong',
      TOKENS.ADMIN,
      {
        landmarkId: 'nha_minh_huong',
        label: 'Nhà Minh Hường',
        placeId: 'xh_landmark_nha_minh_huong',
        anchorType: 'place',
        offsetX: 2.5,
        offsetY: 0,
        offsetZ: -1.5,
        rotationY: 0.2,
        scale: 1,
        visible: true,
        modelVisibilityMode: 'follow_place',
        updatedAt: Date.now(),
      }
    );
    recordCheck('Admin', 'RTDB PUT landmarkBindings (ALLOWED)', 200, admWriteLandmark.status, admWriteLandmark.status === 200);

    const admGrantAdminRtdb = await rtdbReq('PUT', `xuanhoa_security/admins/${UIDS.TARGET_USER}`, TOKENS.ADMIN, true);
    recordCheck('Admin', 'RTDB PUT /xuanhoa_security/admins/$uid (DENIED)', 401, admGrantAdminRtdb.status, admGrantAdminRtdb.status === 401);

    const admApiRoleUpdate = await workerApi('role-update', TOKENS.ADMIN, {
      targetUid: UIDS.TARGET_USER,
      role: 'admin',
    });
    recordCheck('Admin', 'Worker POST /api/founder-security/role-update (DENIED)', 403, admApiRoleUpdate.status, admApiRoleUpdate.status === 403);

    const admApiAuditLogs = await workerApi('audit-logs', TOKENS.ADMIN, {});
    recordCheck('Admin', 'Worker POST /api/founder-security/audit-logs (ALLOWED)', 200, admApiAuditLogs.status, admApiAuditLogs.status === 200);

    // ------------------------------------------------------------------------
    // 5. PRIMARY FOUNDER (Dê Già Designer)
    // ------------------------------------------------------------------------
    const pfReadSec = await rtdbReq('GET', 'xuanhoa_security', TOKENS.PRIMARY_FOUNDER);
    recordCheck('Primary Founder', 'RTDB GET /xuanhoa_security (ALLOWED)', 200, pfReadSec.status, pfReadSec.status === 200);

    const pfApiStatus = await workerApi('status', TOKENS.PRIMARY_FOUNDER, null, 'GET');
    recordCheck('Primary Founder', 'Worker GET /api/founder-security/status (ALLOWED)', 200, pfApiStatus.status, pfApiStatus.status === 200);

    const pfGrantRole = await workerApi('role-update', TOKENS.PRIMARY_FOUNDER, {
      targetUid: UIDS.TARGET_USER,
      role: 'manager',
      canManageMaps: true,
    });
    recordCheck('Primary Founder', 'Worker POST /api/founder-security/role-update (ALLOWED)', 200, pfGrantRole.status, pfGrantRole.status === 200);

    // ------------------------------------------------------------------------
    // 6. BACKUP FOUNDER ACTIVE (`active === true`)
    // ------------------------------------------------------------------------
    const bfActiveReadSec = await rtdbReq('GET', 'xuanhoa_security', TOKENS.BACKUP_ACTIVE);
    recordCheck('Backup Founder Active', 'RTDB GET /xuanhoa_security (ALLOWED)', 200, bfActiveReadSec.status, bfActiveReadSec.status === 200);

    const bfActiveRoleUpdate = await workerApi('role-update', TOKENS.BACKUP_ACTIVE, {
      targetUid: UIDS.TARGET_USER,
      role: 'user',
    });
    recordCheck('Backup Founder Active', 'Worker POST /api/founder-security/role-update (ALLOWED)', 200, bfActiveRoleUpdate.status, bfActiveRoleUpdate.status === 200);

    const bfActiveTouchPrimary = await workerApi('role-update', TOKENS.BACKUP_ACTIVE, {
      targetUid: UIDS.PRIMARY_FOUNDER,
      role: 'user',
    });
    recordCheck('Backup Founder Active', 'Worker POST role-update targeting Primary Founder (DENIED)', 403, bfActiveTouchPrimary.status, bfActiveTouchPrimary.status === 403);

    const bfActiveProvisionTry = await workerApi('provision-backup-founder', TOKENS.BACKUP_ACTIVE, {
      username: 'another_bf',
      password: 'AnotherPassword#2026',
      recoveryEmail: 'another@gmail.com',
    });
    recordCheck('Backup Founder Active', 'Worker POST provision-backup-founder (DENIED — Primary only)', 403, bfActiveProvisionTry.status, bfActiveProvisionTry.status === 403);

    // ------------------------------------------------------------------------
    // 7. BACKUP FOUNDER INACTIVE (`active === false` WITH `admins/$uid === true` & `managers/$uid === true`)
    // ------------------------------------------------------------------------
    const bfInactiveReadSec = await rtdbReq('GET', 'xuanhoa_security', TOKENS.BACKUP_INACTIVE);
    recordCheck('Backup Founder Inactive', 'RTDB GET /xuanhoa_security with admins=true (DENIED)', 401, bfInactiveReadSec.status, bfInactiveReadSec.status === 401);

    const bfInactiveReadMembers = await rtdbReq('GET', 'xuanhoa_admin/members_registry', TOKENS.BACKUP_INACTIVE);
    recordCheck('Backup Founder Inactive', 'RTDB GET members_registry with admins=true (DENIED)', 401, bfInactiveReadMembers.status, bfInactiveReadMembers.status === 401);

    const bfInactiveWritePlace = await rtdbReq('PUT', 'xuanhoa_admin/global_state/places/xh_place_1', TOKENS.BACKUP_INACTIVE, {
      id: 'xh_place_1',
      updatedAt: Date.now(),
      version: 99,
    });
    recordCheck('Backup Founder Inactive', 'RTDB PUT places with admins=true (DENIED)', 401, bfInactiveWritePlace.status, bfInactiveWritePlace.status === 401);

    const bfInactiveApiRole = await workerApi('role-update', TOKENS.BACKUP_INACTIVE, {
      targetUid: UIDS.TARGET_USER,
      role: 'admin',
    });
    recordCheck('Backup Founder Inactive', 'Worker POST /api/founder-security/role-update (DENIED)', 403, bfInactiveApiRole.status, bfInactiveApiRole.status === 403);

    const bfInactiveApiStatus = await workerApi('status', TOKENS.BACKUP_INACTIVE, null, 'GET');
    recordCheck('Backup Founder Inactive', 'Worker GET /api/founder-security/status (DENIED)', 403, bfInactiveApiStatus.status, bfInactiveApiStatus.status === 403);
  } finally {
    await fetch(`${baseUrl}/.json?ns=${namespace}&access_token=owner`, { method: 'DELETE' }).catch(() => {});
  }

  return results;
}

/**
 * 100% READ-ONLY Production Smoke Test (`--prod-read-only` / `--prod-url=...`).
 * TUYỆT ĐỐI KHÔNG GHI THỬ VÀO PLACE THẬT, KHÔNG TẠO DỮ LIỆU PROBE TRONG PRODUCTION.
 */
export async function runProductionReadOnlySmokeTest({
  rtdbBaseUrl = EXPECTED_PROD_DB_URL,
  nsQuery = '',
  workerBaseUrl = 'https://xuanhoacogi.com',
  founderIdToken = '',
  privilegedHeaders = {},
  privilegedQuerySuffix = '',
  expectedFounderUid = PRIMARY_FOUNDER_VERIFIED_UID,
  skipWorkerChecks = false,
} = {}) {
  const cleanRtdb = rtdbBaseUrl.replace(/\/$/, '');
  const cleanWorker = skipWorkerChecks ? '' : (workerBaseUrl || '').replace(/\/$/, '');
  const checks = [];

  function addCheck(label, expectedStatus, actualStatus, ok, detail = '') {
    checks.push({
      label,
      expectedStatus,
      actualStatus,
      status: ok ? 'PASS' : 'FAIL',
      detail,
    });
    if (!ok) {
      throw new Error(
        `[PROD READ-ONLY SMOKE FAILED] ${label}: expected ${expectedStatus}, got ${actualStatus} ${detail}`
      );
    }
  }

  const buildRtdbUrl = (relPath, authQuery = '') => {
    const clean = String(relPath || '').replace(/^\//, '');
    const parts = [nsQuery, authQuery].filter(Boolean).join('&');
    return `${cleanRtdb}/${clean}.json${parts ? `?${parts}` : ''}`;
  };

  // 1. Guest (Unauthenticated) READS public map data (places & landmarkBindings) -> 200 OK
  const [guestPlacesRes, guestLandmarksRes] = await Promise.all([
    fetch(buildRtdbUrl('xuanhoa_admin/global_state/places')),
    fetch(buildRtdbUrl('xuanhoa_admin/global_state/landmarkBindings')),
  ]);
  const guestPlacesData = await guestPlacesRes.json().catch(() => null);
  addCheck(
    'Guest GET /xuanhoa_admin/global_state/places (READ-ONLY)',
    200,
    guestPlacesRes.status,
    guestPlacesRes.status === 200 && guestPlacesData && typeof guestPlacesData === 'object'
  );
  addCheck(
    'Guest GET /xuanhoa_admin/global_state/landmarkBindings (READ-ONLY)',
    200,
    guestLandmarksRes.status,
    guestLandmarksRes.status === 200
  );

  // 2. Guest (Unauthenticated) CANNOT read security or private admin branches -> 401 DENIED
  const [guestSecRes, guestPfRes, guestMembersRes, guestConsentsRes] = await Promise.all([
    fetch(buildRtdbUrl('xuanhoa_security')),
    fetch(buildRtdbUrl('xuanhoa_security/primary_founder')),
    fetch(buildRtdbUrl('xuanhoa_admin/members_registry')),
    fetch(buildRtdbUrl('xuanhoa_admin/user_consents')),
  ]);
  addCheck('Guest GET /xuanhoa_security (DENIED)', 401, guestSecRes.status, guestSecRes.status === 401);
  addCheck(
    'Guest GET /xuanhoa_security/primary_founder (DENIED)',
    401,
    guestPfRes.status,
    guestPfRes.status === 401
  );
  addCheck(
    'Guest GET /xuanhoa_admin/members_registry (DENIED)',
    401,
    guestMembersRes.status,
    guestMembersRes.status === 401
  );
  addCheck(
    'Guest GET /xuanhoa_admin/user_consents (DENIED)',
    401,
    guestConsentsRes.status,
    guestConsentsRes.status === 401
  );

  // 3. Privileged verification of active Firebase Rules & Primary Founder UID bootstrap
  const hasPrivilegedCreds =
    Object.keys(privilegedHeaders || {}).length > 0 || Boolean(privilegedQuerySuffix);
  if (hasPrivilegedCreds) {
    const privQuery = privilegedQuerySuffix.replace(/^\?/, '');
    const [rulesRes, privSecRes] = await Promise.all([
      fetch(buildRtdbUrl('.settings/rules', privQuery), { headers: privilegedHeaders }),
      fetch(buildRtdbUrl('xuanhoa_security', privQuery), { headers: privilegedHeaders }),
    ]);
    const rulesText = await rulesRes.text();
    const hasExpectedRuleset =
      rulesRes.status === 200 &&
      rulesText.includes('primary_founder') &&
      rulesText.includes('backup_founder') &&
      rulesText.includes('consent_audit_trail');
    addCheck(
      'Privileged GET /.settings/rules (Active Production Rules match V4)',
      200,
      rulesRes.status,
      hasExpectedRuleset
    );

    const secObj = await privSecRes.json().catch(() => null);
    const pfBootstrappedOk =
      privSecRes.status === 200 &&
      secObj?.primary_founder?.[expectedFounderUid] === true &&
      secObj?.admins?.[expectedFounderUid] === true;
    addCheck(
      `Privileged Verify Primary Founder UID (${expectedFounderUid.slice(0, 4)}...${expectedFounderUid.slice(-4)})`,
      200,
      privSecRes.status,
      pfBootstrappedOk
    );
  }

  // 4. Authenticated Primary Founder (Dê Già Designer) READ-ONLY checks (RTDB + Founder Dashboard API)
  if (founderIdToken) {
    const authQ = `auth=${encodeURIComponent(founderIdToken)}`;
    const [pfSecRes, pfMembersRes, pfPropsRes] = await Promise.all([
      fetch(buildRtdbUrl('xuanhoa_security', authQ)),
      fetch(buildRtdbUrl('xuanhoa_admin/members_registry', authQ)),
      fetch(buildRtdbUrl('xuanhoa_admin/global_state/placeProposals', authQ)),
    ]);
    const pfSecData = await pfSecRes.json().catch(() => null);
    addCheck(
      'Primary Founder GET /xuanhoa_security (Authenticated READ)',
      200,
      pfSecRes.status,
      pfSecRes.status === 200 && pfSecData?.primary_founder?.[expectedFounderUid] === true
    );
    addCheck(
      'Primary Founder GET /xuanhoa_admin/members_registry (Authenticated READ)',
      200,
      pfMembersRes.status,
      pfMembersRes.status === 200
    );
    addCheck(
      'Primary Founder GET /xuanhoa_admin/global_state/placeProposals (Authenticated READ)',
      200,
      pfPropsRes.status,
      pfPropsRes.status === 200
    );
  }

  // 5. Worker API Read-Only checks (Guest vs Primary Founder Dashboard non-lockout)
  if (cleanWorker) {
    const [homeRes, guestStatusRes, policyRes] = await Promise.all([
      fetch(`${cleanWorker}/`),
      fetch(`${cleanWorker}/api/founder-security/status`),
      fetch(`${cleanWorker}/api/founder-security/policy-version`),
    ]);
    addCheck('Worker GET / (Homepage 200 OK)', 200, homeRes.status, homeRes.status === 200);
    addCheck(
      'Guest GET /api/founder-security/status (DENIED 401)',
      401,
      guestStatusRes.status,
      guestStatusRes.status === 401
    );
    addCheck(
      'Public GET /api/founder-security/policy-version (ALLOWED 200)',
      200,
      policyRes.status,
      policyRes.status === 200
    );

    if (founderIdToken) {
      const pfStatusRes = await fetch(`${cleanWorker}/api/founder-security/status`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${founderIdToken}` },
      });
      const pfStatusData = await pfStatusRes.json().catch(() => null);
      addCheck(
        'Primary Founder GET /api/founder-security/status (No Dashboard Lockout)',
        200,
        pfStatusRes.status,
        pfStatusRes.status === 200 &&
          pfStatusData?.callerRole === 'primary_founder' &&
          pfStatusData?.passwordHashInRtdb === false
      );
    }
  }

  return checks;
}

async function main() {
  const args = process.argv.slice(2);
  const portArg =
    args.find(a => a.startsWith('--emulator-port='))?.split('=')[1] ||
    args.find(a => a.startsWith('--port='))?.split('=')[1];
  const emulatorPort = portArg ? Number(portArg) : 9000;
  const prodUrlArg = args.find(a => a.startsWith('--prod-url='))?.split('=')[1];
  const isProdReadOnly = args.includes('--prod-read-only') || Boolean(prodUrlArg);
  const founderIdToken =
    args.find(a => a.startsWith('--founder-id-token='))?.split('=')[1] ||
    process.env.FOUNDER_ID_TOKEN ||
    '';

  if (isProdReadOnly) {
    const cleanProd = (prodUrlArg || 'https://xuanhoacogi.com').replace(/\/$/, '');
    const skipWorkerChecks = args.includes('--skip-worker') || args.includes('--rtdb-only');
    let privAuth = { headers: {}, querySuffix: '' };
    try {
      privAuth = await resolvePrivilegedProdAuth(args);
    } catch {
      // Optional if only running Guest + Founder ID Token checks
    }

    console.log(
      `[PRODUCTION READ-ONLY SMOKE CHECK] Verifying ${skipWorkerChecks ? 'RTDB ONLY' : cleanProd} & ${EXPECTED_PROD_DB_URL} (0 writes, 0 probe data)...`
    );
    const prodChecks = await runProductionReadOnlySmokeTest({
      rtdbBaseUrl: EXPECTED_PROD_DB_URL,
      workerBaseUrl: cleanProd,
      founderIdToken,
      privilegedHeaders: privAuth.headers,
      privilegedQuerySuffix: privAuth.querySuffix,
      skipWorkerChecks,
    });
    console.log('============================================================================');
    console.log(
      `XUHO CITY — PRODUCTION READ-ONLY SMOKE TEST (${prodChecks.length}/${prodChecks.length} PASSED — ZERO WRITES)`
    );
    console.log('============================================================================');
    for (const c of prodChecks) {
      console.log(`  [${c.status}] ${c.label.padEnd(68)} | HTTP ${c.actualStatus}`);
    }
    return;
  }

  const results = await runSevenRoleSmokeTests({ emulatorPort });
  console.log('============================================================================');
  console.log(`XUHO CITY — 7-ROLE RBAC & WORKER API SMOKE TEST (${results.length}/${results.length} PASSED)`);
  console.log('============================================================================');
  for (const r of results) {
    console.log(
      `  [${r.status}] ${r.role.padEnd(24)} | ${r.operation.padEnd(54)} | HTTP ${r.actualStatus}`
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}
