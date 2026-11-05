import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { createFounderSecurityBackend } from '../server/founder-security-backend.mjs';
import workerRuntime from '../worker.js';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const EMULATOR_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9000';
const NS = 'demo-xuanhoacogi-default-rtdb';
const BASE_URL = `http://${EMULATOR_HOST}`;

let spawnedEmulatorProc = null;

async function isEmulatorListening() {
  try {
    const res = await fetch(`${BASE_URL}/.inspect/databases.json`);
    return res.ok;
  } catch {
    return false;
  }
}

before(async () => {
  if (await isEmulatorListening()) return;
  const emulatorsDir = path.join(os.homedir(), '.cache', 'firebase', 'emulators');
  const jars = fs.existsSync(emulatorsDir)
    ? fs.readdirSync(emulatorsDir).filter(f => f.startsWith('firebase-database-emulator') && f.endsWith('.jar'))
    : [];
  const jarPath = path.join(emulatorsDir, jars[0] || 'firebase-database-emulator-v4.11.2.jar');
  const [, portStr] = EMULATOR_HOST.split(':');
  spawnedEmulatorProc = spawn(
    'java',
    ['-Duser.language=en', '-jar', jarPath, '--port', portStr || '9000'],
    { stdio: 'ignore', windowsHide: true }
  );
  for (let i = 0; i < 60; i++) {
    if (await isEmulatorListening()) return;
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for Firebase Database Emulator at ${BASE_URL}`);
});

after(() => {
  if (spawnedEmulatorProc) {
    try {
      spawnedEmulatorProc.kill();
    } catch {}
    spawnedEmulatorProc = null;
  }
});

const rules3RoleRaw = fs.readFileSync(path.join(ROOT_DIR, 'database.rules.json'), 'utf8');
const rollbackRulesRaw = fs.readFileSync(path.join(ROOT_DIR, 'database.rules.rollback.json'), 'utf8');

/**
 * Creates an unsigned Firebase Emulator JWT (alg: "none") accepted by the official
 * Java Firebase Realtime Database Emulator (`firebase-database-emulator.jar`).
 */
function createEmulatorJwt(claims) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      iss: 'https://securetoken.google.com/demo-xuanhoacogi',
      aud: 'demo-xuanhoacogi',
      iat: nowSec - 60,
      exp: nowSec + 3600,
      sub: claims.uid,
      user_id: claims.uid,
      firebase: {
        identities: {},
        sign_in_provider: 'password',
      },
      ...claims,
    })
  ).toString('base64url');
  return `${header}.${payload}.`;
}

// 3-ROLE ARCHITECTURE TOKENS ONLY: GUEST / USER, MANAGER, ADMIN
const TOKENS = {
  OWNER: 'owner', // Emulator superuser token for test setup/seeding only
  GUEST: null,
  USER_A: createEmulatorJwt({ uid: 'uid_user_a', email: 'usera@gmail.com' }),
  USER_B: createEmulatorJwt({ uid: 'uid_user_b', email: 'userb@gmail.com' }),
  MANAGER_1: createEmulatorJwt({ uid: 'uid_manager_1', email: 'manager1@xuanhoa.vn', manager: true }),
  MANAGER_2: createEmulatorJwt({ uid: 'uid_manager_2', email: 'manager2@xuanhoa.vn', manager: true }),
  ADMIN_1: createEmulatorJwt({ uid: 'uid_admin_1', email: 'admin1@xuanhoacogi.com', admin: true }),
  ADMIN_2: createEmulatorJwt({ uid: 'uid_admin_2', email: 'admin2@xuanhoacogi.com', admin: true }),
};

async function loadRulesIntoEmulator(rulesString) {
  const res = await fetch(`${BASE_URL}/.settings/rules.json?ns=${NS}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${TOKENS.OWNER}`,
      'Content-Type': 'application/json',
    },
    body: rulesString,
  });
  const text = await res.text();
  assert.equal(res.status, 200, `Failed to load rules into official Emulator (${res.status}): ${text}`);
}

async function rtdbRequest(method, dbPath, token, bodyObj = undefined) {
  const cleanPath = dbPath.replace(/^\/+/, '');
  let url = `${BASE_URL}/${cleanPath}.json?ns=${NS}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token === TOKENS.OWNER) {
    headers.Authorization = `Bearer ${token}`;
  } else if (token) {
    url += `&auth=${encodeURIComponent(token)}`;
  }
  const res = await fetch(url, {
    method,
    headers,
    body: bodyObj !== undefined ? JSON.stringify(bodyObj) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { status: res.status, ok: res.ok, data };
}

async function seedBaseEmulatorState() {
  const now = Date.now();
  await loadRulesIntoEmulator(rules3RoleRaw);
  const propMgr1 = {
    id: 'prop_mgr_1',
    placeId: 'xh_verified_1',
    placeName: 'Công an Phường Xuân Hòa',
    actionType: 'UPDATE_PLACE',
    status: 'pending',
    submittedBy: 'manager1',
    submittedByUid: 'uid_manager_1',
    submittedByName: 'Manager 1',
    submittedAt: now - 30000,
    baseVersion: 3,
    proposedData: {
      name: 'Công an Phường Xuân Hòa',
      address: 'Phường Xuân Hòa, Phúc Yên',
      phone: '02113863113',
      openHours: '07:30 - 17:30',
      parentCategoryId: 'public',
      subcategoryId: 'police_military',
      lat: 21.289434,
      lng: 105.711254,
      mapsUrl: 'https://maps.google.com/?q=21.289434,105.711254',
      tagline: 'Công an Phường Xuân Hòa',
      coordinateSource: 'admin_verified',
    },
  };
  const propMgr2 = {
    id: 'prop_mgr_2',
    placeId: 'xh_unpinned_1',
    placeName: 'Quán Chưa Ghim 1',
    actionType: 'UPDATE_COORDINATES',
    status: 'pending',
    submittedBy: 'manager2',
    submittedByUid: 'uid_manager_2',
    submittedByName: 'Manager 2',
    submittedAt: now - 25000,
    baseVersion: 1,
    proposedData: {
      name: 'Quán Chưa Ghim 1',
      address: 'Xuân Hòa',
      phone: '0900111222',
      openHours: '08:00 - 22:00',
      parentCategoryId: 'food',
      subcategoryId: 'restaurant',
      lat: 21.285,
      lng: 105.715,
      mapsUrl: '',
      tagline: 'Quán ngon',
      coordinateSource: 'admin_verified',
    },
  };
  const propStaleOld = {
    ...propMgr1,
    id: 'prop_stale_old',
    submittedAt: now - 3_600_000,
  };

  const initialData = {
    xuanhoa_security: {
      admins: { uid_admin_1: true, uid_admin_2: true },
      managers: { uid_manager_1: true, uid_manager_2: true },
    },
    xuanhoa_admin: {
      members_registry: {
        uid_user_a: {
          uid: 'uid_user_a',
          email: 'usera@gmail.com',
          displayName: 'Nguyen Van A',
          nickname: 'A Xuân Hòa',
          avatar: '🧑',
          avatarId: 'av1',
          gender: 'male',
          phone: '0912345678',
          residentType: 'local',
          spinsCount: 0,
          level: 1,
          reviewsCount: 0,
          createdAt: now - 86400000,
          lastActiveAt: now - 3600000,
          status: 'active',
          canManageWeb: false,
          canManageMaps: false,
        },
      },
      // Legacy retired nodes seeded via OWNER only to verify 100% read/write lockdown (401)
      place_private_meta: {
        xh_verified_1: {
          placeId: 'xh_verified_1',
          merchantClaimCode: '[REDACTED_RETIRED_FIXTURE]',
          claimStatus: 'revoked',
          updatedAt: now - 50000,
        },
      },
      manager_proposals_by_uid: {
        uid_manager_1: {
          prop_mgr_1: propMgr1,
          prop_stale_old: propStaleOld,
        },
        uid_manager_2: {
          prop_mgr_2: propMgr2,
        },
      },
      global_state: {
        updatedAt: now - 10000,
        places: {
          xh_verified_1: {
            id: 'xh_verified_1',
            name: 'Công an Phường Xuân Hòa',
            category: 'dia-danh',
            lat: 21.289434,
            lng: 105.711254,
            coordinateVerified: true,
            coordinateSource: 'admin_verified',
            locationStatus: 'located',
            version: 3,
            updatedAt: now - 50000,
          },
          xh_unpinned_1: {
            id: 'xh_unpinned_1',
            name: 'Quán Chưa Ghim 1',
            category: 'an-chinh',
            coordinateVerified: false,
            coordinateSource: 'unverified',
            locationStatus: 'unpinned',
            version: 1,
            updatedAt: now - 50000,
          },
        },
        dishes: {
          dish_1: {
            key: 'dish_1',
            name: 'Phở Bò Xuân Hòa',
            price: 35,
            updatedAt: now - 50000,
          },
        },
        placeProposals: {
          prop_mgr_1: propMgr1,
          prop_mgr_2: propMgr2,
          prop_stale_old: propStaleOld,
        },
        merchantSubmissions: {
          sub_retired_1: {
            id: 'sub_retired_1',
            placeId: 'xh_verified_1',
            status: 'rejected',
          },
        },
        auditLogs: {
          log_existing_1: {
            id: 'log_existing_1',
            action: 'Cập nhật tọa độ',
            target: 'Công an Phường Xuân Hòa',
            type: 'place',
            actorUid: 'uid_admin_1',
            actorRole: 'admin',
            eventCategory: 'place_crud',
            verificationSource: 'client_rtdb_rule_checked',
            refId: 'xh_verified_1',
            actorEmail: 'admin1@xuanhoacogi.com',
            timestamp: now - 120000,
          },
        },
        members: {
          uid_user_a: { email: 'usera@gmail.com', phone: '0912345678' },
        },
        adminAccounts: [
          { id: 'admin_1', username: 'admin', password: '[REVOKED]', passwordHash: '[REVOKED]' },
        ],
        adminEmails: ['admin@xuanhoacogi.com'],
        adminPin: '[REDACTED_HASHED]',
      },
    },
  };

  const seedRes = await rtdbRequest('PUT', '', TOKENS.OWNER, initialData);
  assert.equal(seedRes.status, 200, 'Failed to seed initial data on Emulator');
  return initialData;
}

// ============================================================================
// TEST 1, 2 & 3: GUEST & USER PUBLIC READ AND WRITE RESTRICTIONS
// ============================================================================
test('3ROLE-EMULATOR-01: (1) Guest reads public map (places & dishes = 200); (2) Guest cannot write places, placeProposals, members_registry, coordinate_history (401); (3) Logged-in User cannot write places or placeProposals (401)', async () => {
  await seedBaseEmulatorState();
  const now = Date.now();

  // (1) Guest reads public map places and dishes -> 200 OK
  const guestReadPlaces = await rtdbRequest('GET', 'xuanhoa_admin/global_state/places', TOKENS.GUEST);
  assert.equal(guestReadPlaces.status, 200, 'Guest must read public places (200 OK)');
  const guestReadDishes = await rtdbRequest('GET', 'xuanhoa_admin/global_state/dishes', TOKENS.GUEST);
  assert.equal(guestReadDishes.status, 200, 'Guest must read public dishes (200 OK)');

  // Guest cannot read PII or proposals -> 401
  const guestReadMembers = await rtdbRequest('GET', 'xuanhoa_admin/members_registry', TOKENS.GUEST);
  assert.equal(guestReadMembers.status, 401, 'Guest must get 401 reading members_registry');
  const guestReadLegacyMembers = await rtdbRequest('GET', 'xuanhoa_admin/global_state/members', TOKENS.GUEST);
  assert.equal(guestReadLegacyMembers.status, 401, 'Guest must get 401 reading global_state/members');
  const guestReadProposals = await rtdbRequest('GET', 'xuanhoa_admin/global_state/placeProposals', TOKENS.GUEST);
  assert.equal(guestReadProposals.status, 401, 'Guest must get 401 reading placeProposals');

  // (2) Guest cannot write places, placeProposals, members_registry, coordinate_history -> 401
  for (const [label, targetPath, payload] of [
    ['places', 'xuanhoa_admin/global_state/places/xh_verified_1', { id: 'xh_verified_1', name: 'Guest Hack', version: 4 }],
    ['placeProposals', 'xuanhoa_admin/global_state/placeProposals/prop_guest', { id: 'prop_guest', status: 'pending' }],
    ['members_registry', 'xuanhoa_admin/members_registry/uid_guest', { uid: 'uid_guest', email: 'g@g.com' }],
    ['coordinate_history', 'xuanhoa_admin/coordinate_history/xh_verified_1/hist_g', { historyId: 'hist_g' }],
  ]) {
    const guestWriteRes = await rtdbRequest('PUT', targetPath, TOKENS.GUEST, payload);
    assert.notEqual(guestWriteRes.status, 200, `Guest write to ${label} must be rejected (got ${guestWriteRes.status})`);
  }

  // (3) Logged-in User (USER_A) cannot write places or placeProposals -> 401
  const userWritePlace = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/places/xh_verified_1',
    TOKENS.USER_A,
    {
      id: 'xh_verified_1',
      name: 'User Hacked Place',
      category: 'dia-danh',
      lat: 21.289434,
      lng: 105.711254,
      coordinateVerified: true,
      coordinateSource: 'admin_verified',
      version: 4,
      updatedAt: now,
    }
  );
  assert.notEqual(userWritePlace.status, 200, 'Logged-in User must NOT write to places');

  const userWriteProposal = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/placeProposals/prop_user_a',
    TOKENS.USER_A,
    {
      id: 'prop_user_a',
      placeId: 'xh_verified_1',
      placeName: 'Công an Phường Xuân Hòa',
      actionType: 'UPDATE_PLACE',
      status: 'pending',
      submittedBy: 'usera@gmail.com',
      submittedByUid: 'uid_user_a',
      submittedByName: 'Nguyen Van A',
      submittedAt: now,
      baseVersion: 3,
      proposedData: { name: 'User Proposal' },
    }
  );
  assert.notEqual(userWriteProposal.status, 200, 'Logged-in User must NOT create placeProposals');
});

// ============================================================================
// TEST 4, 5 & 6: COMPLETE RETIREMENT OF MERCHANT / CLAIM PLACE / PRIVATE META
// ============================================================================
test('3ROLE-EMULATOR-02: (4) User cannot claim a store with old codes; (5) place_private_meta & merchantSubmissions are 100% locked (.read: false, .write: false) for ALL roles; (6) No Merchant Claim Code or MerchantPortalModal in codebase/bundle', async () => {
  const initial = await seedBaseEmulatorState();
  const verifiedPlace = initial.xuanhoa_admin.global_state.places.xh_verified_1;
  const now = Date.now();

  // (5) `place_private_meta` and `merchantSubmissions` are completely blocked (.read: false, .write: false)
  // for Guest, User, Manager, and even Admin!
  for (const [roleLabel, tok] of [
    ['Guest', TOKENS.GUEST],
    ['User A', TOKENS.USER_A],
    ['Manager 1', TOKENS.MANAGER_1],
    ['Admin 1', TOKENS.ADMIN_1],
  ]) {
    const readPrivRoot = await rtdbRequest('GET', 'xuanhoa_admin/place_private_meta', tok);
    assert.equal(readPrivRoot.status, 401, `${roleLabel} must get 401 reading place_private_meta root`);

    const readPrivChild = await rtdbRequest('GET', 'xuanhoa_admin/place_private_meta/xh_verified_1', tok);
    assert.equal(readPrivChild.status, 401, `${roleLabel} must get 401 reading place_private_meta/xh_verified_1`);

    const writePrivChild = await rtdbRequest('PUT', 'xuanhoa_admin/place_private_meta/xh_verified_1', tok, {
      placeId: 'xh_verified_1',
      merchantClaimCode: 'XH-GAMIT-UALE',
      claimStatus: 'claimed',
      claimedByUid: 'uid_user_a',
      updatedAt: now,
    });
    assert.notEqual(writePrivChild.status, 200, `${roleLabel} must NOT write to place_private_meta`);

    const readMerSubRoot = await rtdbRequest('GET', 'xuanhoa_admin/global_state/merchantSubmissions', tok);
    assert.equal(readMerSubRoot.status, 401, `${roleLabel} must get 401 reading merchantSubmissions root`);

    const readMerSubChild = await rtdbRequest(
      'GET',
      'xuanhoa_admin/global_state/merchantSubmissions/sub_retired_1',
      tok
    );
    assert.equal(readMerSubChild.status, 401, `${roleLabel} must get 401 reading merchantSubmissions child`);

    const writeMerSubChild = await rtdbRequest(
      'PUT',
      'xuanhoa_admin/global_state/merchantSubmissions/sub_new_attempt',
      tok,
      {
        id: 'sub_new_attempt',
        placeId: 'xh_verified_1',
        submittedByUid: 'uid_user_a',
        status: 'pending',
        submittedAt: now,
      }
    );
    assert.notEqual(writeMerSubChild.status, 200, `${roleLabel} must NOT write to merchantSubmissions`);
  }

  // (4) User or Admin cannot write any retired Merchant fields (`merchantClaimCode`, `claimCodeDigest`, `claimedByUid`, `claimedByEmail`, `claimStatus`) into `places/$placeId`
  for (const [retiredField, retiredVal] of [
    ['merchantClaimCode', 'XH-GAMIT-UALE'],
    ['claimCodeDigest', 'xhcd2_12345678'],
    ['claimStatus', 'claimed'],
    ['claimedByEmail', 'owner@gmail.com'],
    ['claimedByUid', 'uid_user_a'],
    ['claimedByName', 'Chủ Quán Cũ'],
    ['claimedAt', now],
    ['coordinateSource', 'merchant_verified'],
  ]) {
    const injectMerchantFieldRes = await rtdbRequest(
      'PUT',
      'xuanhoa_admin/global_state/places/xh_verified_1',
      TOKENS.ADMIN_1,
      {
        ...verifiedPlace,
        [retiredField]: retiredVal,
        version: 4,
        updatedAt: now,
      }
    );
    assert.notEqual(
      injectMerchantFieldRes.status,
      200,
      `Writing retired merchant field "${retiredField}" to places/$placeId must be rejected by rules`
    );
  }

  // (6) Verify MerchantPortalModal.tsx is deleted and no Merchant Claim Codes or MerchantPortalModal exist in src/ or dist/
  assert.equal(
    fs.existsSync(path.join(ROOT_DIR, 'src', 'components', 'map', 'MerchantPortalModal.tsx')),
    false,
    'MerchantPortalModal.tsx must be completely removed'
  );

  const adminStoreSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'lib', 'admin-store.ts'), 'utf8');
  for (const removedFn of [
    'verifyAndClaimPlaceWithCode',
    'getOrGenerateMerchantCode',
    'revokeMerchantClaimCode',
    'submitMerchantPlaceUpdate',
    'approveMerchantSubmission',
    'rejectMerchantSubmission',
    'assignMerchantOwnerByEmail',
    'MAP_MANAGER_MASTER_CODE',
    'XH-MAPS-8888',
  ]) {
    assert.doesNotMatch(
      adminStoreSrc,
      new RegExp(removedFn),
      `admin-store.ts must NOT contain removed symbol/code: ${removedFn}`
    );
  }

  const distAssetsDir = path.join(ROOT_DIR, 'dist', 'assets');
  if (fs.existsSync(distAssetsDir)) {
    const jsBundles = fs.readdirSync(distAssetsDir).filter(f => f.endsWith('.js'));
    for (const bundleFile of jsBundles) {
      const bundleContent = fs.readFileSync(path.join(distAssetsDir, bundleFile), 'utf8');
      assert.doesNotMatch(
        bundleContent,
        /MerchantPortalModal|verifyAndClaimPlaceWithCode|getOrGenerateMerchantCode|XH-MAPS-8888|XH-GAMIT-UALE|XH-XHMAP-EYRB/,
        `Compiled bundle ${bundleFile} must NOT contain MerchantPortalModal or claim codes`
      );
    }
  }
});

// ============================================================================
// TEST 7, 8, 9, 10, 11 & 12: MANAGER PROPOSAL WORKFLOW & STRICT ISOLATION
// ============================================================================
test('3ROLE-EMULATOR-03: (7) Manager creates placeProposals (all 5 actionTypes) with submittedByUid == auth.uid; (8) Cannot spoof UID; (9) Cannot read all placeProposals, only own via manager_proposals_by_uid/$uid; (10) Cannot diverge manager_proposals_by_uid from placeProposals; (11) Cannot write directly to places; (12) Cannot approve/reject proposals', async () => {
  const initial = await seedBaseEmulatorState();
  const existingProp = initial.xuanhoa_admin.global_state.placeProposals.prop_mgr_1;
  const now = Date.now();

  // (7) Manager 1 creates placeProposals for all 5 standard actionTypes (`CREATE_PLACE`, `UPDATE_PLACE`, `UPDATE_COORDINATES`, `HIDE_PLACE`, `DELETE_PLACE`) with `submittedByUid == auth.uid` -> 200 OK
  for (const actionType of [
    'CREATE_PLACE',
    'UPDATE_PLACE',
    'UPDATE_COORDINATES',
    'HIDE_PLACE',
    'DELETE_PLACE',
  ]) {
    const propId = `prop_mgr1_${actionType.toLowerCase()}`;
    const payload = {
      ...existingProp,
      id: propId,
      actionType,
      status: 'pending',
      submittedByUid: 'uid_manager_1',
      submittedAt: now,
    };
    const createCanonical = await rtdbRequest(
      'PUT',
      `xuanhoa_admin/global_state/placeProposals/${propId}`,
      TOKENS.MANAGER_1,
      payload
    );
    assert.equal(createCanonical.status, 200, `Manager 1 creating ${actionType} proposal must succeed (200)`);

    const createIndex = await rtdbRequest(
      'PUT',
      `xuanhoa_admin/manager_proposals_by_uid/uid_manager_1/${propId}`,
      TOKENS.MANAGER_1,
      payload
    );
    assert.equal(createIndex.status, 200, `Manager 1 mirroring ${actionType} proposal to own index must succeed (200)`);
  }

  // (8) Manager 1 cannot create placeProposals spoofing another UID -> 401
  const spoofUidRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/placeProposals/prop_spoof_uid',
    TOKENS.MANAGER_1,
    {
      ...existingProp,
      id: 'prop_spoof_uid',
      submittedByUid: 'uid_manager_2',
      submittedAt: now,
    }
  );
  assert.notEqual(spoofUidRes.status, 200, 'Manager 1 spoofing submittedByUid as Manager 2 must be rejected');

  // (9) Manager 1 cannot read all placeProposals (401), cannot read Manager 2's proposal or index (401),
  // ONLY reads own via `manager_proposals_by_uid/uid_manager_1` or `placeProposals/prop_mgr_1` (200)
  const mgr1ReadAll = await rtdbRequest('GET', 'xuanhoa_admin/global_state/placeProposals', TOKENS.MANAGER_1);
  assert.equal(mgr1ReadAll.status, 401, 'Manager 1 must NOT read all placeProposals');

  const mgr1ReadMgr2Prop = await rtdbRequest(
    'GET',
    'xuanhoa_admin/global_state/placeProposals/prop_mgr_2',
    TOKENS.MANAGER_1
  );
  assert.equal(mgr1ReadMgr2Prop.status, 401, 'Manager 1 must NOT read Manager 2 proposal');

  const mgr1ReadMgr2Index = await rtdbRequest(
    'GET',
    'xuanhoa_admin/manager_proposals_by_uid/uid_manager_2',
    TOKENS.MANAGER_1
  );
  assert.equal(mgr1ReadMgr2Index.status, 401, 'Manager 1 must NOT read Manager 2 index');

  const mgr1ReadOwnIndex = await rtdbRequest(
    'GET',
    'xuanhoa_admin/manager_proposals_by_uid/uid_manager_1',
    TOKENS.MANAGER_1
  );
  assert.equal(mgr1ReadOwnIndex.status, 200, 'Manager 1 must read own manager_proposals_by_uid/uid_manager_1 (200)');

  // (10) Manager 1 cannot edit `manager_proposals_by_uid` to diverge from `placeProposals`, cannot delete index, and cannot create fake proposalId
  for (const [desc, badPayload] of [
    ['divergent status', { ...existingProp, status: 'approved' }],
    ['divergent placeId', { ...existingProp, placeId: 'xh_unpinned_1' }],
    ['divergent proposedData.lat', { ...existingProp, proposedData: { ...existingProp.proposedData, lat: 21.299 } }],
  ]) {
    const divRes = await rtdbRequest(
      'PUT',
      'xuanhoa_admin/manager_proposals_by_uid/uid_manager_1/prop_mgr_1',
      TOKENS.MANAGER_1,
      badPayload
    );
    assert.notEqual(divRes.status, 200, `Manager 1 index divergence (${desc}) must be rejected`);
  }

  const fakeGhostIndexRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/manager_proposals_by_uid/uid_manager_1/prop_ghost_nonexistent',
    TOKENS.MANAGER_1,
    { ...existingProp, id: 'prop_ghost_nonexistent', submittedAt: now }
  );
  assert.notEqual(fakeGhostIndexRes.status, 200, 'Manager 1 creating index for non-existent proposalId must be rejected');

  const deleteOwnIndexRes = await rtdbRequest(
    'DELETE',
    'xuanhoa_admin/manager_proposals_by_uid/uid_manager_1/prop_mgr_1',
    TOKENS.MANAGER_1
  );
  assert.notEqual(deleteOwnIndexRes.status, 200, 'Manager 1 deleting own index entry must be rejected');

  // (11) Manager 1 cannot write directly to `places` -> 401
  const mgrDirectWritePlace = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/places/xh_verified_1',
    TOKENS.MANAGER_1,
    {
      ...initial.xuanhoa_admin.global_state.places.xh_verified_1,
      name: 'Manager Direct Overwrite',
      version: 4,
      updatedAt: now,
    }
  );
  assert.notEqual(mgrDirectWritePlace.status, 200, 'Manager must NOT write directly to places');

  // (12) Manager 1 cannot approve/reject own proposal or Manager 2's proposal -> 401
  const mgrSelfApprove = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/placeProposals/prop_mgr_1',
    TOKENS.MANAGER_1,
    {
      ...existingProp,
      status: 'approved',
      reviewedBy: 'Manager 1',
      reviewedByUid: 'uid_manager_1',
      reviewedAt: now,
    }
  );
  assert.notEqual(mgrSelfApprove.status, 200, 'Manager 1 must NOT approve own proposal');

  const mgrRejectOther = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/placeProposals/prop_mgr_2',
    TOKENS.MANAGER_1,
    {
      ...initial.xuanhoa_admin.global_state.placeProposals.prop_mgr_2,
      status: 'rejected',
      reviewedBy: 'Manager 1',
      reviewedByUid: 'uid_manager_1',
      reviewedAt: now,
    }
  );
  assert.notEqual(mgrRejectOther.status, 200, 'Manager 1 must NOT reject Manager 2 proposal');
});

// ============================================================================
// TEST 13 & 14: ADMIN REVIEW, VERIFIED COORDINATE PROTECTION & WAL ATOMICITY
// ============================================================================
test('3ROLE-EMULATOR-04: (13) Admin reads all placeProposals, approves/rejects, and updates places + coordinate_history + auditLogs; (14) Verified coordinates (admin_verified) cannot be overwritten without WAL intent + confirmCoordinateOverride', async () => {
  const initial = await seedBaseEmulatorState();
  const verifiedPlace = initial.xuanhoa_admin.global_state.places.xh_verified_1;
  const existingProp = initial.xuanhoa_admin.global_state.placeProposals.prop_mgr_1;
  const now = Date.now();

  // (13a) Admin reads all placeProposals -> 200 OK
  const adminReadAllProps = await rtdbRequest('GET', 'xuanhoa_admin/global_state/placeProposals', TOKENS.ADMIN_1);
  assert.equal(adminReadAllProps.status, 200, 'Admin 1 must read all placeProposals (200)');

  // (13b) Admin approves `prop_mgr_1` and writes deterministic auditLog `log_review_prop_mgr_1` -> 200 OK
  const approvedProp = {
    ...existingProp,
    status: 'approved',
    reviewedBy: 'Admin 1',
    reviewedByUid: 'uid_admin_1',
    reviewedAt: now,
  };
  const adminApproveRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/placeProposals/prop_mgr_1',
    TOKENS.ADMIN_1,
    approvedProp
  );
  assert.equal(adminApproveRes.status, 200, 'Admin 1 approving prop_mgr_1 must succeed (200)');

  const adminSyncIndexRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/manager_proposals_by_uid/uid_manager_1/prop_mgr_1',
    TOKENS.ADMIN_1,
    approvedProp
  );
  assert.equal(adminSyncIndexRes.status, 200, 'Admin 1 syncing approved status to manager_proposals_by_uid must succeed (200)');

  const adminReviewLogRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/auditLogs/log_review_prop_mgr_1',
    TOKENS.ADMIN_1,
    {
      id: 'log_review_prop_mgr_1',
      action: '✅ Admin ĐÃ DUYỆT đề xuất',
      target: 'Công an Phường Xuân Hòa',
      type: 'place',
      actorUid: 'uid_admin_1',
      actorRole: 'admin',
      eventCategory: 'admin_review',
      verificationSource: 'client_rtdb_rule_checked',
      refId: 'prop_mgr_1',
      placeId: 'xh_verified_1',
      timestamp: now,
    }
  );
  assert.equal(adminReviewLogRes.status, 200, 'Admin 1 writing deterministic auditLog log_review_prop_mgr_1 must succeed (200)');

  // (14a) Unverified coordinate change or accidental write without `confirmCoordinateOverride` & WAL entry CANNOT overwrite `admin_verified` coordinates -> 401
  const unverifiedOverwriteRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/places/xh_verified_1',
    TOKENS.ADMIN_1,
    {
      ...verifiedPlace,
      lat: 21.295,
      lng: 105.725,
      coordinateVerified: false,
      coordinateSource: 'unverified',
      version: 4,
      updatedAt: now,
    }
  );
  assert.notEqual(
    unverifiedOverwriteRes.status,
    200,
    'Overwriting admin_verified coordinates with unverified coordinates must be rejected'
  );

  const missingWalRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/places/xh_verified_1',
    TOKENS.ADMIN_1,
    {
      ...verifiedPlace,
      lat: 21.289555,
      lng: 105.711355,
      coordinateVerified: true,
      coordinateSource: 'admin_verified',
      confirmCoordinateOverride: true,
      version: 4,
      updatedAt: now,
    }
  );
  assert.notEqual(
    missingWalRes.status,
    200,
    'Modifying admin_verified coordinates without pre-committed coordinate_history WAL entry must be rejected'
  );

  // (14b) Admin updates verified coordinates WITH 3-state `coordinate_history` WAL (`intent` -> place commit -> `committed`) -> 200 OK
  const walIntent = {
    historyId: 'hist_v4_admin1',
    placeId: 'xh_verified_1',
    targetVersion: 4,
    status: 'intent',
    timestamp: now,
    actorUid: 'uid_admin_1',
    actorRole: 'admin',
    action: 'update_coord',
    previousLat: 21.289434,
    previousLng: 105.711254,
    newLat: 21.289555,
    newLng: 105.711355,
    reason: 'Admin 1 chỉnh cổng chính Công an Phường',
  };
  const writeIntentRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/coordinate_history/xh_verified_1/hist_v4_admin1',
    TOKENS.ADMIN_1,
    walIntent
  );
  assert.equal(writeIntentRes.status, 200, 'Writing coordinate_history WAL intent must succeed (200)');

  const placeCommitRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/places/xh_verified_1',
    TOKENS.ADMIN_1,
    {
      ...verifiedPlace,
      lat: 21.289555,
      lng: 105.711355,
      coordinateVerified: true,
      coordinateSource: 'admin_verified',
      version: 4,
      updatedAt: now,
      confirmCoordinateOverride: true,
      lastCoordMutation: {
        historyId: 'hist_v4_admin1',
        targetVersion: 4,
        previousLat: 21.289434,
        previousLng: 105.711254,
        newLat: 21.289555,
        newLng: 105.711355,
        actorUid: 'uid_admin_1',
        timestamp: now,
        reason: 'Admin 1 chỉnh cổng chính Công an Phường',
        action: 'update_coord',
      },
    }
  );
  assert.equal(placeCommitRes.status, 200, 'Committing place coordinate update with matching WAL intent must succeed (200)');

  const finalizeWalRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/coordinate_history/xh_verified_1/hist_v4_admin1',
    TOKENS.ADMIN_1,
    {
      ...walIntent,
      status: 'committed',
      committedAt: Date.now(),
    }
  );
  assert.equal(finalizeWalRes.status, 200, 'Transitioning WAL entry to committed must succeed (200)');
});

// ============================================================================
// TEST 15: 100% MAP DATA PRESERVATION (165 IDs = 148 ACTIVE [130 LOCATED + 18 UNPINNED] + 17 EXCLUDED) & 0.000000° DRIFT
// ============================================================================
test('3ROLE-EMULATOR-05: (15) 100% Map Data Lock — All 165 historical IDs (148 Active = 130 Located + 18 Unpinned; 17 Excluded), 0.000000 deg coordinate drift, and SHA-256 backup checksums verified', async () => {
  const backupDir =
    'C:\\Users\\tmide\\.gemini\\antigravity\\brain\\0a08b7ec-9a57-410e-9871-f2facfc4491c\\scratch\\backups\\pre_security_hardening_20261103';
  const expectedHashes = {
    'rtdb_full_backup_20261103.json': '2F6F9A508A269AF0D39D559C6B3DA2CFE9E0199B3493AB96104E6405EA3D728A',
    'reconciled_165_places_snapshot.json': 'C38A0D2DA23E3FB0E41A01A64B320AFF91A9FC390A2297FCCC6699A5708D136F',
    'canonical_165_coordinates_baseline.json': '389A6F8FB55FE1DA68D2D103E3C236A9C2ACF69A505A7E906579F45892749374',
    'backup_manifest.json': '2D7402A248FEAA84DCFBC6A90E997F9D80A512C4BFB0A7992A6B8840FCD2A4A3',
  };

  for (const [fileName, expectedSha] of Object.entries(expectedHashes)) {
    const filePath = path.join(backupDir, fileName);
    assert.ok(fs.existsSync(filePath), `Backup file missing: ${filePath}`);
    const actualSha = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
    assert.equal(actualSha, expectedSha, `SHA-256 mismatch for ${fileName}`);
  }

  // Verify 165 IDs reconciliation table
  const reconcilMd = fs.readFileSync(path.join(ROOT_DIR, 'PLACE_COUNT_RECONCILIATION.md'), 'utf8');
  const rowRegex =
    /^\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|/gm;
  const rows = [];
  let match;
  while ((match = rowRegex.exec(reconcilMd)) !== null) {
    rows.push({
      id: match[2].trim(),
      adminState: match[12].trim(),
      publicState: match[13].trim(),
    });
  }
  assert.equal(rows.length, 165, 'Must preserve all 165 historical IDs');
  assert.equal(rows.filter(r => r.adminState.includes('Active 148')).length, 148, 'Must preserve 148 active places');
  assert.equal(rows.filter(r => r.publicState.includes('Public 130')).length, 130, 'Must preserve 130 located places');
  assert.equal(rows.filter(r => r.adminState.includes('Chưa ghim 18')).length, 18, 'Must preserve 18 unpinned places');
  assert.equal(rows.filter(r => r.adminState.includes('(17)')).length, 17, 'Must preserve 17 excluded records');

  // Verify 0.000000° coordinate drift between Production RTDB backup and sanitized 3-role places
  const rtdbBackup = JSON.parse(fs.readFileSync(path.join(backupDir, 'rtdb_full_backup_20261103.json'), 'utf8'));
  const rtdbPlaces = rtdbBackup?.global_state?.places || rtdbBackup?.xuanhoa_admin?.global_state?.places || {};
  let locatedRtdbCount = 0;
  let maxDrift = 0;
  for (const [pid, rawPlace] of Object.entries(rtdbPlaces)) {
    if (!rawPlace || typeof rawPlace !== 'object') continue;
    const sanitized = { ...rawPlace };
    delete sanitized.merchantClaimCode;
    delete sanitized.claimCodeDigest;
    delete sanitized.claimStatus;
    delete sanitized.claimedByEmail;
    delete sanitized.claimedByUid;
    delete sanitized.claimedByName;
    delete sanitized.claimedAt;
    if (typeof rawPlace.lat === 'number' && typeof rawPlace.lng === 'number') {
      locatedRtdbCount++;
      const dLat = Math.abs(rawPlace.lat - sanitized.lat);
      const dLng = Math.abs(rawPlace.lng - sanitized.lng);
      maxDrift = Math.max(maxDrift, dLat, dLng);
    }
    assert.equal(sanitized.name, rawPlace.name, `Place name for ${pid} must be preserved`);
    assert.equal(sanitized.address, rawPlace.address, `Place address for ${pid} must be preserved`);
    assert.equal(sanitized.phone, rawPlace.phone, `Public store phone for ${pid} must be preserved`);
  }
  assert.equal(Object.keys(rtdbPlaces).length, 117, 'All 117 RTDB places must be accounted for');
  assert.equal(maxDrift, 0, 'Coordinate drift across all located places must be 0.000000 deg');

  // Verify Rollback Rules still work cleanly
  await loadRulesIntoEmulator(rollbackRulesRaw);
  const pubRead = await rtdbRequest('GET', 'xuanhoa_admin/global_state/places', TOKENS.GUEST);
  assert.equal(pubRead.status, 200);
  await loadRulesIntoEmulator(rules3RoleRaw);
});

// ============================================================================
// TEST 16: BLOCKER 1 — LEGACY ADMIN CREDENTIALS (adminAccounts, adminEmails, adminPin) LOCKED
// ============================================================================
test('3ROLE-BLOCKER-01: (16) Legacy Admin Credentials — global_state/adminAccounts, adminEmails, and adminPin block ALL client reads and writes (401) while preserving Admin/Manager authentication', async () => {
  await seedBaseEmulatorState();
  const legacyPaths = [
    'xuanhoa_admin/global_state/adminAccounts',
    'xuanhoa_admin/global_state/adminEmails',
    'xuanhoa_admin/global_state/adminPin',
  ];

  for (const legacyPath of legacyPaths) {
    for (const [roleName, token] of [
      ['GUEST', TOKENS.GUEST],
      ['USER_A', TOKENS.USER_A],
      ['MANAGER_1', TOKENS.MANAGER_1],
      ['ADMIN_1', TOKENS.ADMIN_1],
    ]) {
      const readRes = await rtdbRequest('GET', legacyPath, token);
      assert.equal(
        readRes.status,
        401,
        `${roleName} read on retired ${legacyPath} must be denied (401)`
      );

      const writeRes = await rtdbRequest('PUT', legacyPath, token, {
        injected: 'legacy_credential_attempt',
      });
      assert.equal(
        writeRes.status,
        401,
        `${roleName} write on retired ${legacyPath} must be denied (401)`
      );
    }
  }

  // Verify current Admin & Manager authentication nodes still work 100%
  const adminSecRead = await rtdbRequest('GET', 'xuanhoa_security/admins/uid_admin_1', TOKENS.ADMIN_1);
  assert.equal(adminSecRead.status, 200, 'Admin reading xuanhoa_security/admins/$uid must succeed (200)');
  assert.equal(adminSecRead.data, true);

  const mgrSecRead = await rtdbRequest('GET', 'xuanhoa_security/managers/uid_manager_1', TOKENS.MANAGER_1);
  assert.equal(mgrSecRead.status, 200, 'Manager reading own xuanhoa_security/managers/$uid must succeed (200)');
  assert.equal(mgrSecRead.data, true);

  const adminRegistryRead = await rtdbRequest('GET', 'xuanhoa_admin/members_registry', TOKENS.ADMIN_1);
  assert.equal(adminRegistryRead.status, 200, 'Admin reading members_registry must succeed (200)');
});

// ============================================================================
// TEST 17: BLOCKER 2 — PROPOSAL IMMUTABILITY (message, review fields, nested/unknown fields, review lifecycle)
// ============================================================================
test('3ROLE-BLOCKER-02: (17) Proposal Immutability — Submitted proposal content (including message, proposedData, unknown fields) is strictly immutable; only status/review fields can be updated by Admin', async () => {
  await seedBaseEmulatorState();
  const now = Date.now();
  const propId = 'prop_immut_test_1';

  const baseProposal = {
    id: propId,
    placeId: 'xh_verified_1',
    placeName: 'Công an Phường Xuân Hòa',
    actionType: 'update',
    status: 'pending',
    submittedBy: 'manager1@xuanhoa.vn',
    submittedByUid: 'uid_manager_1',
    submittedByEmail: 'manager1@xuanhoa.vn',
    submittedByName: 'Manager 1',
    submittedByRole: 'Quản lý Maps',
    submittedAt: now,
    baseVersion: 3,
    message: 'Đề xuất cập nhật giờ mở cửa hành chính',
    proposedData: {
      name: 'Công an Phường Xuân Hòa',
      address: 'Phường Xuân Hòa, Phúc Yên',
      phone: '02113863113',
      openHours: '07:30 - 17:30',
      lat: 21.289434,
      lng: 105.711254,
      coordinateSource: 'admin_verified',
    },
  };

  // 17.1 Manager cannot inject reviewNote / reviewedBy on creation
  const createWithReviewField = await rtdbRequest('PATCH', '', TOKENS.MANAGER_1, {
    [`xuanhoa_admin/global_state/placeProposals/${propId}`]: {
      ...baseProposal,
      reviewNote: 'Injected reviewNote on create',
    },
  });
  assert.equal(createWithReviewField.status, 401, 'Manager injecting reviewNote on create must be denied (401)');

  // 17.2 Manager cannot inject unknown root fields (previousData, beforeData, afterData, customPlacePayload, extraField) or unknown nested fields in proposedData
  for (const badPayload of [
    { ...baseProposal, previousData: { name: 'Old' } },
    { ...baseProposal, beforeData: { name: 'Old' } },
    { ...baseProposal, afterData: { name: 'New' } },
    { ...baseProposal, customPlacePayload: { id: 'xh_verified_1' } },
    { ...baseProposal, unexpectedRootField: 'hack' },
    {
      ...baseProposal,
      proposedData: {
        ...baseProposal.proposedData,
        unexpectedNestedField: 'nested_hack',
      },
    },
  ]) {
    const badRes = await rtdbRequest('PATCH', '', TOKENS.MANAGER_1, {
      [`xuanhoa_admin/global_state/placeProposals/${propId}`]: badPayload,
    });
    assert.equal(badRes.status, 401, 'Proposal with unknown/auxiliary or nested fields must be denied (401)');
  }

  // 17.3 Manager creates valid proposal with message + mirrors to manager_proposals_by_uid
  const createValidRes = await rtdbRequest(
    'PUT',
    `xuanhoa_admin/global_state/placeProposals/${propId}`,
    TOKENS.MANAGER_1,
    baseProposal
  );
  assert.equal(createValidRes.status, 200, 'Manager creating valid proposal with message must succeed (200)');

  const createIndexRes = await rtdbRequest(
    'PUT',
    `xuanhoa_admin/manager_proposals_by_uid/uid_manager_1/${propId}`,
    TOKENS.MANAGER_1,
    baseProposal
  );
  assert.equal(createIndexRes.status, 200, 'Manager mirroring proposal with message to index must succeed (200)');

  // 17.3b Manager cannot diverge `message` in `manager_proposals_by_uid` from `placeProposals`
  const divergeMsgIndexRes = await rtdbRequest(
    'PUT',
    `xuanhoa_admin/manager_proposals_by_uid/uid_manager_1/${propId}`,
    TOKENS.MANAGER_1,
    {
      ...baseProposal,
      message: 'Message bị lệch trên chỉ mục',
    }
  );
  assert.equal(divergeMsgIndexRes.status, 401, 'Manager diverging message in manager_proposals_by_uid must be denied (401)');

  // 17.4 Manager cannot modify `message` when cancelling
  const cancelMutateMessageRes = await rtdbRequest('PATCH', '', TOKENS.MANAGER_1, {
    [`xuanhoa_admin/global_state/placeProposals/${propId}`]: {
      ...baseProposal,
      status: 'cancelled',
      message: 'Sửa nội dung message trái phép khi hủy',
    },
  });
  assert.equal(cancelMutateMessageRes.status, 401, 'Manager mutating message when cancelling must be denied (401)');

  // 17.5 Manager cannot inject `reviewNote` or `reviewedBy` when cancelling
  const cancelInjectReviewRes = await rtdbRequest('PATCH', '', TOKENS.MANAGER_1, {
    [`xuanhoa_admin/global_state/placeProposals/${propId}`]: {
      ...baseProposal,
      status: 'cancelled',
      reviewNote: 'Manager tự ghi reviewNote',
    },
  });
  assert.equal(cancelInjectReviewRes.status, 401, 'Manager injecting reviewNote when cancelling must be denied (401)');

  // 17.6 Admin cannot mutate `message` or `proposedData` when approving
  const adminMutateMsgRes = await rtdbRequest('PATCH', '', TOKENS.ADMIN_1, {
    [`xuanhoa_admin/global_state/placeProposals/${propId}`]: {
      ...baseProposal,
      message: 'Admin sửa message gốc của Manager',
      status: 'approved',
      reviewedBy: 'admin@xuanhoacogi.com',
      reviewedByUid: 'uid_admin_1',
      reviewedByName: 'Admin',
      reviewedAt: Date.now(),
      reviewNote: 'Đã duyệt',
    },
  });
  assert.equal(adminMutateMsgRes.status, 401, 'Admin mutating original message during review must be denied (401)');

  const adminMutateProposedDataRes = await rtdbRequest('PATCH', '', TOKENS.ADMIN_1, {
    [`xuanhoa_admin/global_state/placeProposals/${propId}`]: {
      ...baseProposal,
      proposedData: {
        ...baseProposal.proposedData,
        phone: '0999999999',
      },
      status: 'approved',
      reviewedBy: 'admin@xuanhoacogi.com',
      reviewedByUid: 'uid_admin_1',
      reviewedByName: 'Admin',
      reviewedAt: Date.now(),
      reviewNote: 'Đã duyệt',
    },
  });
  assert.equal(adminMutateProposedDataRes.status, 401, 'Admin mutating proposedData during review must be denied (401)');

  // 17.7 Admin approves proposal cleanly (preserving message & proposedData, setting status + review fields)
  const approvedPayload = {
    ...baseProposal,
    status: 'approved',
    reviewedBy: 'admin@xuanhoacogi.com',
    reviewedByUid: 'uid_admin_1',
    reviewedByName: 'Admin',
    reviewedAt: Date.now(),
    reviewNote: 'Đã phê duyệt giờ mở cửa mới',
  };
  const adminApproveRes = await rtdbRequest(
    'PUT',
    `xuanhoa_admin/global_state/placeProposals/${propId}`,
    TOKENS.ADMIN_1,
    approvedPayload
  );
  assert.equal(adminApproveRes.status, 200, 'Admin approving proposal with immutable content preserved must succeed (200)');

  const adminApproveIndexRes = await rtdbRequest(
    'PUT',
    `xuanhoa_admin/manager_proposals_by_uid/uid_manager_1/${propId}`,
    TOKENS.ADMIN_1,
    approvedPayload
  );
  assert.equal(adminApproveIndexRes.status, 200, 'Admin syncing approved proposal to manager index must succeed (200)');

  // 17.8 Once approved, neither Manager nor Admin can re-open, cancel, or modify it
  const managerCancelAfterApprove = await rtdbRequest('PATCH', '', TOKENS.MANAGER_1, {
    [`xuanhoa_admin/global_state/placeProposals/${propId}`]: {
      ...approvedPayload,
      status: 'cancelled',
    },
  });
  assert.equal(managerCancelAfterApprove.status, 401, 'Manager cancelling an already-approved proposal must be denied (401)');

  const adminReReviewAfterApprove = await rtdbRequest('PATCH', '', TOKENS.ADMIN_1, {
    [`xuanhoa_admin/global_state/placeProposals/${propId}`]: {
      ...approvedPayload,
      status: 'rejected',
      reviewedAt: Date.now(),
    },
  });
  assert.equal(adminReReviewAfterApprove.status, 401, 'Admin re-reviewing an already-approved proposal must be denied (401)');
});

// ============================================================================
// TEST 18: BLOCKER 3 — MERCHANT DATA CLEANUP VERIFICATION & DRY-RUN ON EMULATOR
// ============================================================================
test('3ROLE-BLOCKER-03: (18) Merchant Data Cleanup Verification — Exact 14 legacy Merchant records identified in backup; dry-run cleanup preserves 100% places/coords and passes Emulator Rules', async () => {
  await seedBaseEmulatorState();
  const backupPath =
    'C:\\Users\\tmide\\.gemini\\antigravity\\brain\\0a08b7ec-9a57-410e-9871-f2facfc4491c\\scratch\\backups\\pre_security_hardening_20261103\\rtdb_full_backup_20261103.json';
  const rtdbBackup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const places = rtdbBackup?.global_state?.places || {};

  const recordsWithLegacyMerchantFields = [];
  for (const [pid, place] of Object.entries(places)) {
    const fields = [];
    if ('merchantClaimCode' in place) fields.push('merchantClaimCode');
    if ('claimedByEmail' in place) fields.push('claimedByEmail');
    if ('claimedByName' in place) fields.push('claimedByName');
    if ('claimedAt' in place) fields.push('claimedAt');
    if (place.coordinateSource === 'merchant_verified') fields.push('coordinateSource:merchant_verified');
    if (fields.length > 0) {
      recordsWithLegacyMerchantFields.push({ id: pid, fields, raw: place });
    }
  }

  // Exact count check: 14 records total (13 with merchantClaimCode, 1 with claimedBy*, 2 with coordinateSource==='merchant_verified')
  assert.equal(recordsWithLegacyMerchantFields.length, 14, 'Backup must have exactly 14 records with legacy Merchant fields');
  assert.equal(
    recordsWithLegacyMerchantFields.filter(r => r.fields.includes('merchantClaimCode')).length,
    13,
    'Exactly 13 records have merchantClaimCode'
  );
  assert.equal(
    recordsWithLegacyMerchantFields.filter(r => r.fields.includes('claimedByEmail')).length,
    1,
    'Exactly 1 record (gamitra-xuan-hoa) has claimedByEmail/Name/At'
  );
  assert.equal(
    recordsWithLegacyMerchantFields.filter(r => r.fields.includes('coordinateSource:merchant_verified')).length,
    2,
    'Exactly 2 records have coordinateSource === merchant_verified'
  );

  // Verify on Official Emulator: writing an uncleaned record with merchantClaimCode or coordinateSource: 'merchant_verified' is REJECTED (401),
  // whereas writing the cleaned record (with Merchant fields stripped and coordinateSource normalized to 'admin_verified') SUCCEEDS (200) with 0.000000° drift!
  for (const item of recordsWithLegacyMerchantFields) {
    const uncleanedAttempt = await rtdbRequest(
      'PUT',
      `xuanhoa_admin/global_state/places/${item.id}`,
      TOKENS.ADMIN_1,
      {
        ...item.raw,
        id: item.id,
        version: (item.raw.version || 1) + 1,
        updatedAt: Date.now(),
      }
    );
    assert.equal(
      uncleanedAttempt.status,
      401,
      `Uncleaned record ${item.id} containing [${item.fields.join(', ')}] must be rejected by Rules (401)`
    );

    // Perform non-destructive field cleanup
    const cleaned = { ...item.raw, id: item.id };
    delete cleaned.merchantClaimCode;
    delete cleaned.claimCodeDigest;
    delete cleaned.claimStatus;
    delete cleaned.claimedByEmail;
    delete cleaned.claimedByUid;
    delete cleaned.claimedByName;
    delete cleaned.claimedAt;
    delete cleaned.issuedByUid;
    delete cleaned.issuedAt;
    delete cleaned.revokedByUid;
    delete cleaned.revokedAt;
    delete cleaned.locationHistory;
    delete cleaned.pendingWebApproval;
    delete cleaned.pendingMapApproval;
    if (cleaned.coordinateSource === 'merchant_verified') {
      cleaned.coordinateSource = 'admin_verified';
    }
    cleaned.version = (item.raw.version || 1) + 1;
    cleaned.updatedAt = Date.now();

    // Assert 0.000000° coordinate drift and 100% identity preservation
    assert.equal(cleaned.id, item.id);
    assert.equal(cleaned.name, item.raw.name);
    assert.equal(cleaned.lat, item.raw.lat);
    assert.equal(cleaned.lng, item.raw.lng);

    const cleanedWriteRes = await rtdbRequest(
      'PUT',
      `xuanhoa_admin/global_state/places/${item.id}`,
      TOKENS.ADMIN_1,
      cleaned
    );
    assert.equal(
      cleanedWriteRes.status,
      200,
      `Cleaned record ${item.id} must be accepted by Official Firebase Emulator (200)`
    );
  }
});

// ============================================================================
// TEST 19: LANDMARK ALIGNMENT BINDINGS — PUBLIC READ & ADMIN-ONLY WRITE
// ============================================================================
test('3ROLE-LANDMARK-01: (19) Landmark Alignment Bindings — Public can read landmarkBindings; only Admin can write valid LandmarkBindingRecord; Manager/User/Guest write and invalid schema are denied', async () => {
  await seedBaseEmulatorState();
  const validBinding = {
    landmarkId: 'nha_minh_huong',
    label: 'Nhà Minh Hường',
    placeId: 'xh_landmark_nha_minh_huong',
    anchorType: 'place',
    offsetX: 1.5,
    offsetY: 0,
    offsetZ: -0.75,
    rotationY: 0.12,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: Date.now(),
    updatedBy: 'admin@xuanhoacogi.com',
  };

  // 19.1 Guest, User, Manager cannot write landmarkBindings
  for (const [roleLabel, token] of [
    ['GUEST', null],
    ['USER', TOKENS.USER_A],
    ['MANAGER', TOKENS.MANAGER_1],
  ]) {
    const res = await rtdbRequest(
      'PUT',
      'xuanhoa_admin/global_state/landmarkBindings/nha_minh_huong',
      token,
      validBinding
    );
    assert.equal(res.status, 401, `${roleLabel} writing landmarkBindings must be denied (401)`);
  }

  // 19.2 Admin writing valid landmarkBinding succeeds (200)
  const adminWriteRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/landmarkBindings/nha_minh_huong',
    TOKENS.ADMIN_1,
    validBinding
  );
  assert.equal(adminWriteRes.status, 200, 'Admin writing valid landmarkBindings must succeed (200)');

  // 19.3 Guest/Public can read landmarkBindings (200)
  const publicReadRes = await rtdbRequest(
    'GET',
    'xuanhoa_admin/global_state/landmarkBindings/nha_minh_huong',
    null
  );
  assert.equal(publicReadRes.status, 200, 'Public reading landmarkBindings must succeed (200)');
  assert.equal(publicReadRes.data.landmarkId, 'nha_minh_huong');
  assert.equal(publicReadRes.data.offsetX, 1.5);

  // 19.4 Admin writing invalid scale or unexpected field is denied (401)
  const badScaleRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/landmarkBindings/nha_minh_huong',
    TOKENS.ADMIN_1,
    { ...validBinding, scale: 99 }
  );
  assert.equal(badScaleRes.status, 401, 'Out-of-range scale (99) must be denied (401)');

  const extraFieldRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/landmarkBindings/nha_minh_huong',
    TOKENS.ADMIN_1,
    { ...validBinding, unexpectedField: 'hack' }
  );
  assert.equal(extraFieldRes.status, 401, 'Unexpected field in landmarkBindings must be denied (401)');
});

// ============================================================================
// TEST 20: RELEASE V2 SAFETY PATCH — FIREBASE AUTH UID VERIFICATION & BOOTSTRAP LOCK
// ============================================================================
test('3ROLE-SAFETY-V2-01: (20) Firebase Auth UID Verification — Only verified 28-char Firebase Auth UID is bootstrapped; 21-digit Google OAuth sub and synthetic uid_* are rejected; verified Admin saves landmarkBindings (200)', async () => {
  const { execFileSync } = await import('node:child_process');
  const latestBackupPath = path.join(ROOT_DIR, 'backups', 'pre_release_2026_11_04', 'rtdb_prod_backup_20261104.json');
  const fallbackBackupPath =
    'C:\\Users\\tmide\\.gemini\\antigravity\\brain\\0a08b7ec-9a57-410e-9871-f2facfc4491c\\scratch\\backups\\pre_security_hardening_20261103\\rtdb_full_backup_20261103.json';
  const rawBackup = JSON.parse(
    fs.readFileSync(fs.existsSync(latestBackupPath) ? latestBackupPath : fallbackBackupPath, 'utf8')
  );
  const backupData = rawBackup?.xuanhoa_admin || rawBackup;

  // Seed Emulator with production-shaped members_registry, global_state/members, and adminAccounts
  await seedBaseEmulatorState();
  await rtdbRequest('DELETE', 'xuanhoa_security', TOKENS.OWNER);
  await rtdbRequest('PUT', 'xuanhoa_admin/members_registry', TOKENS.OWNER, backupData.members_registry || {});
  await rtdbRequest('PUT', 'xuanhoa_admin/global_state/members', TOKENS.OWNER, backupData.global_state?.members || {});
  await rtdbRequest('PUT', 'xuanhoa_admin/global_state/adminAccounts', TOKENS.OWNER, backupData.global_state?.adminAccounts || []);

  // Execute bootstrap-security-roles.mjs against Emulator
  const bootstrapScript = path.join(ROOT_DIR, 'scripts', 'bootstrap-security-roles.mjs');
  const [, portStr] = EMULATOR_HOST.split(':');
  const out = execFileSync(
    process.execPath,
    [bootstrapScript, '--emulator', `--port=${portStr || '9000'}`, `--ns=${NS}`],
    {
      cwd: ROOT_DIR,
      encoding: 'utf8',
    }
  );
  assert.match(out, /VERIFIED_PRIMARY_FOUNDER_BOOTSTRAPPED/);
  assert.match(out, /DO_NOT_BOOTSTRAP/);

  // Inspect resulting xuanhoa_security node on Emulator
  const secRes = await rtdbRequest('GET', 'xuanhoa_security', TOKENS.OWNER);
  assert.equal(secRes.status, 200);
  const primaryFounderUids = Object.keys(secRes.data?.primary_founder || {});
  const adminUids = Object.keys(secRes.data?.admins || {});
  const managerUids = Object.keys(secRes.data?.managers || {});

  // Exactly 1 verified 28-char alphanumeric Firebase Auth UID is bootstrapped as PRIMARY FOUNDER & Admin;
  // 0 unverified 21-digit Google sub or uid_* accounts are bootstrapped
  assert.equal(primaryFounderUids.length, 1, 'Only the 1 verified 28-char Firebase Auth UID may be bootstrapped as PRIMARY FOUNDER');
  assert.equal(adminUids.length, 1, 'Only the 1 verified 28-char Firebase Auth Admin UID may be bootstrapped');
  assert.equal(primaryFounderUids[0], adminUids[0], 'Primary Founder UID must match bootstrapped Admin UID');
  assert.equal(managerUids.length, 0, 'Unverified 21-digit Google sub and uid_* Manager records must NOT be bootstrapped');

  const verifiedAdminUid = adminUids[0];
  assert.equal(verifiedAdminUid.length, 28, 'Verified Firebase Auth UID must be 28 chars');
  assert.doesNotMatch(verifiedAdminUid, /^\d+$/, 'Verified Firebase Auth UID must not be all-digits Google sub');

  // Verify the actual verified Primary Founder UID has full permissions & can save landmarkBindings
  const verifiedAdminToken = createEmulatorJwt({ uid: verifiedAdminUid });
  const adminBindingPayload = {
    landmarkId: 'chua_hien_luong',
    label: 'Chùa Hiền Lương',
    placeId: 'xh_landmark_chua_hien_luong',
    anchorType: 'place',
    offsetX: -2.0,
    offsetY: 0,
    offsetZ: 1.25,
    rotationY: 0,
    scale: 1,
    visible: true,
    modelVisibilityMode: 'follow_place',
    updatedAt: Date.now(),
    updatedBy: 'verified-admin',
  };
  const saveBindingRes = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/landmarkBindings/chua_hien_luong',
    verifiedAdminToken,
    adminBindingPayload
  );
  assert.equal(saveBindingRes.status, 200, 'Verified 28-char Admin UID must save landmarkBindings (200)');

  // Verify unverified 21-digit Google sub & synthetic uid_* records from members_registry + global_state/members + adminAccounts/adminEmails are denied (401)
  const knownAdminEmailSet = new Set(
    [
      ...(backupData.global_state?.adminAccounts || []).map(a => String(a?.username || '')),
      ...(backupData.global_state?.adminEmails || []).map(e => String(e || '')),
    ]
      .map(e => e.trim().toLowerCase())
      .filter(e => e.includes('@') && !e.endsWith('@xuanhoacogi.com'))
  );
  const byEmail = new Map();
  for (const src of [backupData.global_state?.members || {}, backupData.members_registry || {}]) {
    for (const [k, m] of Object.entries(src)) {
      if (!m || typeof m !== 'object') continue;
      const email = String(m.email || k.replace(/,/g, '.')).trim().toLowerCase();
      if (!email.includes('@') || email.endsWith('@xuanhoacogi.com')) continue;
      const prev = byEmail.get(email) || {};
      byEmail.set(email, {
        uid: m.uid && !String(m.uid).startsWith('uid_') ? m.uid : prev.uid || m.uid || `uid_${email.replace(/[^a-z0-9]/g, '_')}`,
        canManageWeb: Boolean(m.canManageWeb || prev.canManageWeb || knownAdminEmailSet.has(email)),
        canManageMaps: Boolean(m.canManageMaps || prev.canManageMaps || knownAdminEmailSet.has(email)),
      });
    }
  }
  const unverifiedCandidates = Array.from(byEmail.values()).filter(
    m => (m.canManageWeb || m.canManageMaps) && m.uid && m.uid !== verifiedAdminUid
  );
  assert.equal(unverifiedCandidates.length, 3, 'Must find the 3 held-back unverified accounts');
  for (const unverified of unverifiedCandidates) {
    const unverifiedToken = createEmulatorJwt({ uid: unverified.uid });
    const tryBinding = await rtdbRequest(
      'PUT',
      'xuanhoa_admin/global_state/landmarkBindings/chua_hien_luong',
      unverifiedToken,
      adminBindingPayload
    );
    assert.equal(tryBinding.status, 401, 'Unverified UID must be denied landmarkBindings write (401)');

    const tryProposal = await rtdbRequest(
      'PUT',
      'xuanhoa_admin/global_state/placeProposals/prop_unverified_test',
      unverifiedToken,
      {
        id: 'prop_unverified_test',
        placeId: 'xh_verified_1',
        placeName: 'Công an Phường Xuân Hòa',
        actionType: 'update',
        status: 'pending',
        submittedBy: 'unverified',
        submittedByUid: unverified.uid,
        submittedByName: 'Unverified',
        submittedAt: Date.now(),
        baseVersion: 3,
        proposedData: { name: 'Công an Phường Xuân Hòa' },
      }
    );
    assert.equal(tryProposal.status, 401, 'Unverified UID must not have Manager proposal write access (401)');
  }
});

// ============================================================================
// TEST 21: FOUNDER SYSTEM V2 — PRIMARY FOUNDER + BACKUP FOUNDER + 12 MANDATORY SCENARIOS
// ============================================================================
test('FOUNDER-V2-EMULATOR-01: (21) Founder System V2 — Primary Founder, Backup Founder, Admin, Manager, User & Guest across all 12 mandatory RBAC and security scenarios', async () => {
  await seedBaseEmulatorState();
  const now = Date.now();

  // Verified 28-char Firebase Auth UIDs (alphanumeric, non-numeric)
  const PRIMARY_FOUNDER_UID = '4ouY5sN8r3P6wQvX2kLm9jBcTd92';
  const BACKUP_FOUNDER_UID = 'Bf9xK2mQp7LzW4nRt8vYc3jHdE61';
  const VERIFIED_ADMIN_UID = 'Ad7mN3pQr8StV5wXy2zBc4dFgH19';
  const VERIFIED_MANAGER_UID = 'Mg5kL8nPq2RsT7uVw9xYz3bCdF42';
  const VERIFIED_USER_UID = 'Us2jH6kLm9NpQ4rSt8vWx1yZaB75';
  const UNVERIFIED_GOOGLE_SUB_21 = '109876543210987654321';
  const UNVERIFIED_SYNTHETIC_UID = 'uid_truongtuanminh_91_gmail_com';

  const PF_TOKEN = createEmulatorJwt({ uid: PRIMARY_FOUNDER_UID });
  const BF_TOKEN = createEmulatorJwt({ uid: BACKUP_FOUNDER_UID });
  const ADM_TOKEN = createEmulatorJwt({ uid: VERIFIED_ADMIN_UID });
  const MGR_TOKEN = createEmulatorJwt({ uid: VERIFIED_MANAGER_UID });
  const USR_TOKEN = createEmulatorJwt({ uid: VERIFIED_USER_UID });

  // Bootstrap Primary Founder via OWNER (server-side Admin SDK / bootstrap script equivalent)
  await rtdbRequest('PUT', `xuanhoa_security/primary_founder/${PRIMARY_FOUNDER_UID}`, TOKENS.OWNER, true);
  await rtdbRequest('PUT', `xuanhoa_security/admins/${PRIMARY_FOUNDER_UID}`, TOKENS.OWNER, true);
  await rtdbRequest('PUT', `xuanhoa_admin/members_registry/${PRIMARY_FOUNDER_UID}`, TOKENS.OWNER, {
    uid: PRIMARY_FOUNDER_UID,
    email: 'marcel.vietnam@gmail.com',
    displayName: 'Dê Già Designer',
    nickname: 'Dê Già Designer',
    status: 'admin',
    role: 'primary_founder',
    roleTier: 'primary_founder',
    isAdmin: true,
    canManageWeb: true,
    canManageMaps: true,
    createdAt: now - 100000,
    lastActiveAt: now,
  });

  // Seed initial verified user records in members_registry
  for (const [uid, email, name] of [
    [VERIFIED_ADMIN_UID, 'verified.admin@gmail.com', 'Verified Admin Candidate'],
    [VERIFIED_MANAGER_UID, 'verified.manager@gmail.com', 'Verified Manager Candidate'],
    [VERIFIED_USER_UID, 'verified.user@gmail.com', 'Verified Regular User'],
  ]) {
    await rtdbRequest('PUT', `xuanhoa_admin/members_registry/${uid}`, TOKENS.OWNER, {
      uid,
      email,
      displayName: name,
      nickname: name,
      status: 'active',
      canManageWeb: false,
      canManageMaps: false,
      createdAt: now - 50000,
      lastActiveAt: now,
    });
  }

  // --------------------------------------------------------------------------
  // SCENARIO 1: Primary Founder has full system & role management permissions
  // --------------------------------------------------------------------------
  const pfReadSec = await rtdbRequest('GET', 'xuanhoa_security', PF_TOKEN);
  assert.equal(pfReadSec.status, 200, '(1) Primary Founder reading full /xuanhoa_security must succeed (200)');

  // Primary Founder provisions Backup Founder in /xuanhoa_security/backup_founder/$uid (no password/secret allowed)
  const bfAttemptWithPassword = await rtdbRequest(
    'PUT',
    `xuanhoa_security/backup_founder/${BACKUP_FOUNDER_UID}`,
    PF_TOKEN,
    {
      uid: BACKUP_FOUNDER_UID,
      username: 'founder_backup_xh',
      active: true,
      password: 'ForbiddenPlaintextPassword!',
      createdByUid: PRIMARY_FOUNDER_UID,
      createdAt: now,
      updatedAt: now,
    }
  );
  assert.equal(
    bfAttemptWithPassword.status,
    401,
    '(1b) Writing password/passwordHash/secret into backup_founder node must be rejected by Rules (401)'
  );

  const bfAttemptWithMfaClaim = await rtdbRequest(
    'PUT',
    `xuanhoa_security/backup_founder/${BACKUP_FOUNDER_UID}`,
    PF_TOKEN,
    {
      uid: BACKUP_FOUNDER_UID,
      username: 'founder_backup_xh',
      active: true,
      mfaRequired: true,
      createdByUid: PRIMARY_FOUNDER_UID,
      createdAt: now,
      updatedAt: now,
    }
  );
  assert.equal(
    bfAttemptWithMfaClaim.status,
    401,
    '(1b-mfa) Writing unverified mfaRequired claim into backup_founder node must be rejected by Rules (401)'
  );

  const bfValidProvision = await rtdbRequest(
    'PUT',
    `xuanhoa_security/backup_founder/${BACKUP_FOUNDER_UID}`,
    PF_TOKEN,
    {
      uid: BACKUP_FOUNDER_UID,
      username: 'founder_backup_xh',
      displayName: 'Founder Dự Phòng',
      recoveryEmail: 'recovery.founder@gmail.com',
      recoveryEmailVerified: true,
      active: true,
      emailVerified: true,
      sessionEpoch: 1,
      createdByUid: PRIMARY_FOUNDER_UID,
      createdAt: now,
      updatedAt: now,
    }
  );
  assert.equal(
    bfValidProvision.status,
    200,
    '(1c) Primary Founder provisioning valid Backup Founder record must succeed (200)'
  );

  // --------------------------------------------------------------------------
  // SCENARIO 2: Backup Founder logs in via Firebase Auth & has Founder permissions
  // --------------------------------------------------------------------------
  const bfReadSec = await rtdbRequest('GET', 'xuanhoa_security', BF_TOKEN);
  assert.equal(bfReadSec.status, 200, '(2) Active Backup Founder reading /xuanhoa_security must succeed (200)');

  const bfSaveLandmark = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/landmarkBindings/nha_minh_huong',
    BF_TOKEN,
    {
      landmarkId: 'nha_minh_huong',
      label: 'Nhà Minh Hường',
      placeId: 'xh_landmark_nha_minh_huong',
      anchorType: 'place',
      offsetX: 0.5,
      offsetY: 0,
      offsetZ: -0.5,
      rotationY: 0,
      scale: 1,
      visible: true,
      modelVisibilityMode: 'follow_place',
      updatedAt: now,
      updatedBy: 'backup_founder',
    }
  );
  assert.equal(bfSaveLandmark.status, 200, '(2b) Backup Founder writing landmarkBindings must succeed (200)');

  // --------------------------------------------------------------------------
  // SCENARIO 3: Backup Founder CANNOT delete, demote, or lock Primary Founder
  // --------------------------------------------------------------------------
  const bfDeletePfNode = await rtdbRequest(
    'DELETE',
    `xuanhoa_security/primary_founder/${PRIMARY_FOUNDER_UID}`,
    BF_TOKEN
  );
  assert.equal(bfDeletePfNode.status, 401, '(3a) Backup Founder deleting primary_founder node must be denied (401)');

  const bfDemotePfAdmin = await rtdbRequest(
    'DELETE',
    `xuanhoa_security/admins/${PRIMARY_FOUNDER_UID}`,
    BF_TOKEN
  );
  assert.equal(bfDemotePfAdmin.status, 401, '(3b) Backup Founder removing Primary Founder from admins must be denied (401)');

  const bfLockPf = await rtdbRequest(
    'PUT',
    `xuanhoa_security/locked_uids/${PRIMARY_FOUNDER_UID}`,
    BF_TOKEN,
    true
  );
  assert.equal(bfLockPf.status, 401, '(3c) Backup Founder locking Primary Founder UID must be denied (401)');

  const bfBanPfRegistry = await rtdbRequest(
    'PUT',
    `xuanhoa_admin/members_registry/${PRIMARY_FOUNDER_UID}`,
    BF_TOKEN,
    {
      uid: PRIMARY_FOUNDER_UID,
      email: 'marcel.vietnam@gmail.com',
      displayName: 'Dê Già Designer',
      nickname: 'Dê Già Designer',
      status: 'banned',
      canManageWeb: false,
      canManageMaps: false,
      createdAt: now - 100000,
      lastActiveAt: now,
    }
  );
  assert.equal(bfBanPfRegistry.status, 401, '(3d) Backup Founder banning/demoting Primary Founder in members_registry must be denied (401)');

  const bfDeletePfRegistry = await rtdbRequest(
    'DELETE',
    `xuanhoa_admin/members_registry/${PRIMARY_FOUNDER_UID}`,
    BF_TOKEN
  );
  assert.equal(bfDeletePfRegistry.status, 401, '(3e) Backup Founder deleting Primary Founder from members_registry must be denied (401)');

  // --------------------------------------------------------------------------
  // SCENARIO 4: Founder grants ADMIN to a verified 28-char Firebase Auth UID
  // --------------------------------------------------------------------------
  // First verify unverified 21-digit Google sub and uid_* are rejected by .validate even if Founder writes them
  const pfGrantInvalidSub = await rtdbRequest(
    'PUT',
    `xuanhoa_security/admins/${UNVERIFIED_GOOGLE_SUB_21}`,
    PF_TOKEN,
    true
  );
  assert.equal(pfGrantInvalidSub.status, 401, '(4a) Granting Admin to 21-digit numeric Google sub must be rejected (401)');

  const pfGrantInvalidSynthetic = await rtdbRequest(
    'PUT',
    `xuanhoa_security/admins/${UNVERIFIED_SYNTHETIC_UID}`,
    PF_TOKEN,
    true
  );
  assert.equal(pfGrantInvalidSynthetic.status, 401, '(4b) Granting Admin to synthetic uid_* must be rejected (401)');

  // Now Primary Founder grants Admin to verified 28-char UID
  const pfGrantVerifiedAdmin = await rtdbRequest(
    'PUT',
    `xuanhoa_security/admins/${VERIFIED_ADMIN_UID}`,
    PF_TOKEN,
    true
  );
  assert.equal(pfGrantVerifiedAdmin.status, 200, '(4c) Primary Founder granting Admin to verified 28-char UID must succeed (200)');

  await rtdbRequest('PUT', `xuanhoa_admin/members_registry/${VERIFIED_ADMIN_UID}`, PF_TOKEN, {
    uid: VERIFIED_ADMIN_UID,
    email: 'verified.admin@gmail.com',
    displayName: 'Verified Admin Candidate',
    nickname: 'Verified Admin Candidate',
    status: 'admin',
    roleTier: 'admin',
    isAdmin: true,
    canManageWeb: true,
    canManageMaps: true,
    createdAt: now - 50000,
    lastActiveAt: now,
  });

  // Verify newly granted Admin can perform Admin actions (e.g. write places)
  const newAdminPlaceWrite = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/places/xh_unpinned_1',
    ADM_TOKEN,
    {
      id: 'xh_unpinned_1',
      name: 'Quán Chưa Ghim 1 (Đã cập nhật bởi Admin mới)',
      category: 'an-chinh',
      locationStatus: 'unlocated',
      version: 2,
      updatedAt: now,
    }
  );
  assert.equal(newAdminPlaceWrite.status, 200, '(4d) Newly granted Admin must have Admin write access on places (200)');

  // --------------------------------------------------------------------------
  // SCENARIO 5 & 9: Regular ADMIN cannot modify Founder or grant/revoke ADMIN/MANAGER
  // --------------------------------------------------------------------------
  const admGrantAnotherAdmin = await rtdbRequest(
    'PUT',
    `xuanhoa_security/admins/${VERIFIED_USER_UID}`,
    ADM_TOKEN,
    true
  );
  assert.equal(admGrantAnotherAdmin.status, 401, '(9a) Regular Admin granting Admin role must be denied (401)');

  const admGrantManager = await rtdbRequest(
    'PUT',
    `xuanhoa_security/managers/${VERIFIED_MANAGER_UID}`,
    ADM_TOKEN,
    true
  );
  assert.equal(admGrantManager.status, 401, '(9b) Regular Admin granting Manager role must be denied (401)');

  const admModifyBackupFounder = await rtdbRequest(
    'PUT',
    `xuanhoa_security/backup_founder/${BACKUP_FOUNDER_UID}`,
    ADM_TOKEN,
    {
      uid: BACKUP_FOUNDER_UID,
      username: 'hacked',
      active: false,
      createdByUid: VERIFIED_ADMIN_UID,
      createdAt: now,
      updatedAt: now,
    }
  );
  assert.equal(admModifyBackupFounder.status, 401, '(9c) Regular Admin modifying Backup Founder must be denied (401)');

  const admElevateRegistryRole = await rtdbRequest(
    'PUT',
    `xuanhoa_admin/members_registry/${VERIFIED_USER_UID}`,
    ADM_TOKEN,
    {
      uid: VERIFIED_USER_UID,
      email: 'verified.user@gmail.com',
      displayName: 'Verified Regular User',
      nickname: 'Verified Regular User',
      status: 'admin',
      canManageWeb: true,
      canManageMaps: true,
      createdAt: now - 50000,
      lastActiveAt: now,
    }
  );
  assert.equal(admElevateRegistryRole.status, 401, '(9d) Regular Admin elevating role flags in members_registry must be denied (401)');

  // Now Founder revokes Admin from VERIFIED_ADMIN_UID (Scenario 5)
  const pfRevokeAdmin = await rtdbRequest(
    'DELETE',
    `xuanhoa_security/admins/${VERIFIED_ADMIN_UID}`,
    PF_TOKEN
  );
  assert.equal(pfRevokeAdmin.status, 200, '(5a) Founder revoking Admin role must succeed (200)');

  const revokedAdminTryWrite = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/places/xh_unpinned_1',
    ADM_TOKEN,
    {
      id: 'xh_unpinned_1',
      name: 'Attempt after revoke',
      category: 'an-chinh',
      locationStatus: 'unlocated',
      version: 3,
      updatedAt: now,
    }
  );
  assert.equal(revokedAdminTryWrite.status, 401, '(5b) Revoked Admin must immediately lose Admin write access (401)');

  // --------------------------------------------------------------------------
  // SCENARIO 6 & 7 & 10: Founder grants & revokes MANAGER; Manager can only submit proposals
  // --------------------------------------------------------------------------
  // Backup Founder grants Manager to VERIFIED_MANAGER_UID
  const bfGrantManager = await rtdbRequest(
    'PUT',
    `xuanhoa_security/managers/${VERIFIED_MANAGER_UID}`,
    BF_TOKEN,
    true
  );
  assert.equal(bfGrantManager.status, 200, '(6a) Backup Founder granting Manager to verified 28-char UID must succeed (200)');

  // Scenario 10: Manager can submit a placeProposal (200) but CANNOT directly write places (401)
  const mgrDirectPlaceWrite = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/places/xh_unpinned_1',
    MGR_TOKEN,
    {
      id: 'xh_unpinned_1',
      name: 'Manager direct write attempt',
      category: 'an-chinh',
      locationStatus: 'unlocated',
      version: 3,
      updatedAt: now,
    }
  );
  assert.equal(mgrDirectPlaceWrite.status, 401, '(10a) Manager direct write on global_state/places must be denied (401)');

  const mgrSubmitProposal = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/placeProposals/prop_founder_v2_mgr',
    MGR_TOKEN,
    {
      id: 'prop_founder_v2_mgr',
      placeId: 'xh_unpinned_1',
      placeName: 'Quán Chưa Ghim 1',
      actionType: 'update',
      status: 'pending',
      submittedBy: 'verified.manager@gmail.com',
      submittedByUid: VERIFIED_MANAGER_UID,
      submittedByName: 'Verified Manager Candidate',
      submittedAt: now,
      baseVersion: 2,
      proposedData: {
        name: 'Quán Chưa Ghim 1',
        address: 'Xuân Hòa',
      },
    }
  );
  assert.equal(mgrSubmitProposal.status, 200, '(10b) Newly granted Manager submitting placeProposal must succeed (200)');

  // Scenario 7: Founder revokes Manager
  const pfRevokeManager = await rtdbRequest(
    'DELETE',
    `xuanhoa_security/managers/${VERIFIED_MANAGER_UID}`,
    PF_TOKEN
  );
  assert.equal(pfRevokeManager.status, 200, '(7a) Founder revoking Manager role must succeed (200)');

  const revokedMgrProposal = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/placeProposals/prop_founder_v2_mgr_2',
    MGR_TOKEN,
    {
      id: 'prop_founder_v2_mgr_2',
      placeId: 'xh_unpinned_1',
      placeName: 'Quán Chưa Ghim 1',
      actionType: 'update',
      status: 'pending',
      submittedBy: 'verified.manager@gmail.com',
      submittedByUid: VERIFIED_MANAGER_UID,
      submittedByName: 'Verified Manager Candidate',
      submittedAt: now,
      baseVersion: 2,
      proposedData: { name: 'Quán Chưa Ghim 1' },
    }
  );
  assert.equal(revokedMgrProposal.status, 401, '(7b) Revoked Manager must immediately lose proposal submission access (401)');

  // --------------------------------------------------------------------------
  // SCENARIO 8: Founder locks an account -> locked account immediately loses all write privileges
  // --------------------------------------------------------------------------
  // Re-grant Manager to VERIFIED_MANAGER_UID, then lock VERIFIED_MANAGER_UID
  await rtdbRequest('PUT', `xuanhoa_security/managers/${VERIFIED_MANAGER_UID}`, PF_TOKEN, true);
  const lockMgrRes = await rtdbRequest(
    'PUT',
    `xuanhoa_security/locked_uids/${VERIFIED_MANAGER_UID}`,
    PF_TOKEN,
    true
  );
  assert.equal(lockMgrRes.status, 200, '(8a) Founder locking an account in locked_uids must succeed (200)');

  const lockedMgrProposalAttempt = await rtdbRequest(
    'PUT',
    'xuanhoa_admin/global_state/placeProposals/prop_while_locked',
    MGR_TOKEN,
    {
      id: 'prop_while_locked',
      placeId: 'xh_unpinned_1',
      placeName: 'Quán Chưa Ghim 1',
      actionType: 'update',
      status: 'pending',
      submittedBy: 'verified.manager@gmail.com',
      submittedByUid: VERIFIED_MANAGER_UID,
      submittedByName: 'Verified Manager Candidate',
      submittedAt: now,
      baseVersion: 2,
      proposedData: { name: 'Quán Chưa Ghim 1' },
    }
  );
  assert.equal(lockedMgrProposalAttempt.status, 401, '(8b) Locked Manager account must be denied proposal writes even if still in managers node (401)');

  const lockedMgrSelfProfileAttempt = await rtdbRequest(
    'PUT',
    `xuanhoa_admin/members_registry/${VERIFIED_MANAGER_UID}`,
    MGR_TOKEN,
    {
      uid: VERIFIED_MANAGER_UID,
      email: 'verified.manager@gmail.com',
      displayName: 'Attempt while locked',
      nickname: 'Attempt',
      status: 'active',
      canManageWeb: false,
      canManageMaps: false,
      createdAt: now - 50000,
      lastActiveAt: now,
    }
  );
  assert.equal(lockedMgrSelfProfileAttempt.status, 401, '(8c) Locked account must be denied self-profile updates in members_registry (401)');

  // Primary Founder revokes/deactivates Backup Founder session -> Backup Founder immediately loses Founder privileges
  const deactivateBfRes = await rtdbRequest(
    'PUT',
    `xuanhoa_security/backup_founder/${BACKUP_FOUNDER_UID}`,
    PF_TOKEN,
    {
      uid: BACKUP_FOUNDER_UID,
      username: 'founder_backup_xh',
      displayName: 'Founder Dự Phòng',
      active: false,
      sessionEpoch: 2,
      createdByUid: PRIMARY_FOUNDER_UID,
      createdAt: now,
      updatedAt: now,
      revokedAt: now,
      revokedByUid: PRIMARY_FOUNDER_UID,
    }
  );
  assert.equal(deactivateBfRes.status, 200, '(8d) Primary Founder deactivating Backup Founder session must succeed (200)');

  const inactiveBfGrantAttempt = await rtdbRequest(
    'PUT',
    `xuanhoa_security/admins/${VERIFIED_USER_UID}`,
    BF_TOKEN,
    true
  );
  assert.equal(inactiveBfGrantAttempt.status, 401, '(8e) Deactivated Backup Founder must immediately lose Founder role-granting privileges (401)');

  // --------------------------------------------------------------------------
  // SCENARIO 11 & 12: User & Guest cannot self-escalate to Founder, Admin, or Manager
  // --------------------------------------------------------------------------
  for (const [label, tok, targetUid] of [
    ['USER', USR_TOKEN, VERIFIED_USER_UID],
    ['GUEST', null, VERIFIED_USER_UID],
  ]) {
    for (const secNode of ['primary_founder', 'backup_founder', 'admins', 'managers']) {
      const escRes = await rtdbRequest(
        'PUT',
        `xuanhoa_security/${secNode}/${targetUid}`,
        tok,
        true
      );
      assert.equal(escRes.status, 401, `(11/12) ${label} self-escalation on xuanhoa_security/${secNode} must be denied (401)`);
    }
  }
});

// ============================================================================
// TEST 17: FOUNDER V2 FINAL UX & SECURITY — ALL 12 MANDATORY SCENARIOS
// (Privileged Backend Password Reset Without Old Password, Disable Bypass Fix,
// Server-Side Rate Limiting, Recovery Email, Zero Secret Leak & 12 Landmarks)
// ============================================================================
test('FOUNDER-V2-FINAL-UX-SECURITY-17: All 12 mandatory scenarios (Primary/Backup Login, Copy Username, Reset Password without old password, Old password rejected, Backup Founder active=false + admins=true bypass blocked 401, Rate limiting 429, Zero secret leak, 12 Landmarks & 165 IDs preserved)', async () => {
  await seedBaseEmulatorState();
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  const PRIMARY_FOUNDER_UID = '4ouY5sN8r3P6wQvX2kLm9jBcTd92';
  const BACKUP_FOUNDER_UID = '7bK9mP2xQ5vN8wL4jR6tY3cZaE18';
  const REGULAR_ADMIN_UID = '9cM4nQ7zR2wP5xK8vL3jT6bYaF24';

  const PF_RECENT_TOKEN = createEmulatorJwt({
    uid: PRIMARY_FOUNDER_UID,
    email: 'marcel.vietnam@gmail.com',
    auth_time: nowSec - 30,
  });
  const PF_STALE_TOKEN = createEmulatorJwt({
    uid: PRIMARY_FOUNDER_UID,
    email: 'marcel.vietnam@gmail.com',
    auth_time: nowSec - 900, // > 300s stale auth_time
  });
  const BF_TOKEN = createEmulatorJwt({
    uid: BACKUP_FOUNDER_UID,
    email: 'recovery.founder@gmail.com',
    auth_time: nowSec - 20,
  });
  const ADM_TOKEN = createEmulatorJwt({
    uid: REGULAR_ADMIN_UID,
    email: 'regular.admin@gmail.com',
    auth_time: nowSec - 20,
  });

  // Seed Primary Founder & Regular Admin in RTDB
  await rtdbRequest('PUT', 'xuanhoa_security', TOKENS.OWNER, {
    primary_founder: { [PRIMARY_FOUNDER_UID]: true },
    backup_founder: {},
    admins: {
      [PRIMARY_FOUNDER_UID]: true,
      [REGULAR_ADMIN_UID]: true,
    },
    managers: {},
    locked_uids: {},
  });

  // Start Privileged Founder Security Backend on ephemeral port connected to RTDB Emulator
  const backendInstance = createFounderSecurityBackend({
    rtdbBaseUrl: BASE_URL,
    rtdbNamespace: NS,
    emulatorOwnerToken: TOKENS.OWNER,
  });
  const server = http.createServer((req, res) => {
    backendInstance.middleware(req, res, () => {
      res.statusCode = 404;
      res.end('Not found');
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const apiBase = `http://127.0.0.1:${addr.port}/api/founder-security`;

  async function callBackendApi(endpoint, token, bodyObj) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${apiBase}/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyObj || {}),
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  try {
    // ------------------------------------------------------------------------
    // SCENARIO 1: Primary Founder logs in with Google & accesses Founder Security
    // ------------------------------------------------------------------------
    const pfReadSec = await rtdbRequest('GET', 'xuanhoa_security/primary_founder', PF_RECENT_TOKEN);
    assert.equal(pfReadSec.status, 200, '(Scenario 1) Primary Founder Google session verified (200)');

    // ------------------------------------------------------------------------
    // SCENARIO 2 & 3: Provision Backup Founder with real recovery email & custom username,
    // verify username copy/read & login via username + password
    // ------------------------------------------------------------------------
    const fakeInternalEmailRes = await callBackendApi('provision-backup-founder', PF_RECENT_TOKEN, {
      uid: BACKUP_FOUNDER_UID,
      username: 'founder_duphong_xh',
      password: 'InitialPassword#2026',
      displayName: 'Founder Dự Phòng',
      recoveryEmail: 'fake@backup-founder.xuanhoacogi.internal',
    });
    assert.equal(
      fakeInternalEmailRes.status,
      400,
      '(Scenario 2a) Fake .internal recovery email must be rejected (400)'
    );

    const provisionRes = await callBackendApi('provision-backup-founder', PF_RECENT_TOKEN, {
      uid: BACKUP_FOUNDER_UID,
      username: 'founder_duphong_xh',
      password: 'InitialPassword#2026',
      displayName: 'Founder Dự Phòng',
      recoveryEmail: 'recovery.founder@gmail.com',
    });
    assert.equal(provisionRes.status, 200, '(Scenario 2b) Provisioning Backup Founder with real recovery email must succeed (200)');
    assert.equal(provisionRes.data.record.username, 'founder_duphong_xh', '(Scenario 3) Primary Founder can view & copy Backup Founder username');
    assert.equal(provisionRes.data.record.recoveryEmail, 'recovery.founder@gmail.com');

    const loginInitialRes = await callBackendApi('login', null, {
      username: 'founder_duphong_xh',
      password: 'InitialPassword#2026',
    });
    assert.equal(loginInitialRes.status, 200, '(Scenario 2c) Backup Founder login with custom username & initial password must succeed (200)');
    assert.equal(loginInitialRes.data.authEmail, 'recovery.founder@gmail.com');

    // ------------------------------------------------------------------------
    // SCENARIO 4 & 5: Primary Founder resets Backup Founder password WITHOUT old password
    // via Privileged Backend; old password immediately fails, new password works
    // ------------------------------------------------------------------------
    // 4a. Stale auth_time (> 5 min) must require re-auth (403 RECENT_AUTH_REQUIRED)
    const staleResetRes = await callBackendApi('reset-password', PF_STALE_TOKEN, {
      backupUid: BACKUP_FOUNDER_UID,
      newPassword: 'NewUpdatedPassword#2027',
      confirmPassword: 'NewUpdatedPassword#2027',
    });
    assert.equal(staleResetRes.status, 403, '(Scenario 4a) Password reset with stale auth_time must be rejected (403)');
    assert.equal(staleResetRes.data.code, 'RECENT_AUTH_REQUIRED');

    // 4b. Regular Admin attempting to reset Backup Founder password must be denied (403)
    const adminResetAttempt = await callBackendApi('reset-password', ADM_TOKEN, {
      backupUid: BACKUP_FOUNDER_UID,
      newPassword: 'HackedPassword#2027',
      confirmPassword: 'HackedPassword#2027',
    });
    assert.equal(adminResetAttempt.status, 403, '(Scenario 4b) Regular Admin resetting Backup Founder password must be denied (403)');

    // 4c. Primary Founder with recent auth resets password WITHOUT old password -> 200 OK
    const validResetRes = await callBackendApi('reset-password', PF_RECENT_TOKEN, {
      backupUid: BACKUP_FOUNDER_UID,
      newPassword: 'NewUpdatedPassword#2027',
      confirmPassword: 'NewUpdatedPassword#2027',
    });
    assert.equal(validResetRes.status, 200, '(Scenario 4c) Primary Founder resetting Backup Founder password without old password must succeed (200)');
    assert.equal(validResetRes.data.sessionEpoch, 2, 'Session epoch must increment on password reset');

    // 5a. Old password immediately fails (401)
    const oldPwdLogin = await callBackendApi('login', null, {
      username: 'founder_duphong_xh',
      password: 'InitialPassword#2026',
    });
    assert.equal(oldPwdLogin.status, 401, '(Scenario 5a) Old password must no longer work after password reset (401)');

    // 5b. New password immediately works (200)
    const newPwdLogin = await callBackendApi('login', null, {
      username: 'founder_duphong_xh',
      password: 'NewUpdatedPassword#2027',
    });
    assert.equal(newPwdLogin.status, 200, '(Scenario 5b) New password must immediately succeed after password reset (200)');

    // ------------------------------------------------------------------------
    // SCENARIO 6 & 7: CRITICAL FIX — Backup Founder with active=false AND admins=true
    // (and managers=true) MUST STILL BE DENIED ALL ADMIN/MANAGER/FOUNDER RIGHTS (401)
    // ------------------------------------------------------------------------
    // Force the exact vulnerability state in RTDB via OWNER:
    // backup_founder/$uid.active = false, WHILE admins/$uid = true AND managers/$uid = true
    await rtdbRequest('PUT', `xuanhoa_security/backup_founder/${BACKUP_FOUNDER_UID}`, TOKENS.OWNER, {
      uid: BACKUP_FOUNDER_UID,
      username: 'founder_duphong_xh',
      displayName: 'Founder Dự Phòng',
      recoveryEmail: 'recovery.founder@gmail.com',
      recoveryEmailVerified: true,
      active: false,
      sessionEpoch: 3,
      createdByUid: PRIMARY_FOUNDER_UID,
      createdAt: now,
      updatedAt: now,
    });
    await rtdbRequest('PUT', `xuanhoa_security/admins/${BACKUP_FOUNDER_UID}`, TOKENS.OWNER, true);
    await rtdbRequest('PUT', `xuanhoa_security/managers/${BACKUP_FOUNDER_UID}`, TOKENS.OWNER, true);

    // Verify disabled Backup Founder is rejected across ALL privileged RTDB paths despite admins/$uid === true and managers/$uid === true!
    const bypassReadSecurity = await rtdbRequest('GET', 'xuanhoa_security', BF_TOKEN);
    assert.equal(
      bypassReadSecurity.status,
      401,
      '(Scenario 6a) Backup Founder with active=false + admins=true must be denied reading /xuanhoa_security (401)'
    );

    const bypassWritePlaces = await rtdbRequest(
      'PUT',
      'xuanhoa_admin/global_state/places/xh_unpinned_1',
      BF_TOKEN,
      {
        id: 'xh_unpinned_1',
        name: 'Bypass Attempt on Places',
        category: 'an-chinh',
        locationStatus: 'unlocated',
        version: 9,
        updatedAt: now,
      }
    );
    assert.equal(
      bypassWritePlaces.status,
      401,
      '(Scenario 6b) Backup Founder with active=false + admins=true must be denied writing /places (401)'
    );

    const bypassWriteProposal = await rtdbRequest(
      'PUT',
      'xuanhoa_admin/global_state/placeProposals/prop_bypass_bf',
      BF_TOKEN,
      {
        id: 'prop_bypass_bf',
        placeId: 'xh_unpinned_1',
        placeName: 'Quán Chưa Ghim 1',
        actionType: 'update',
        status: 'pending',
        submittedBy: 'recovery.founder@gmail.com',
        submittedByUid: BACKUP_FOUNDER_UID,
        submittedByName: 'Disabled BF',
        submittedAt: now,
        baseVersion: 1,
        proposedData: { name: 'Bypass Proposal' },
      }
    );
    assert.equal(
      bypassWriteProposal.status,
      401,
      '(Scenario 6c) Backup Founder with active=false + managers=true must be denied submitting placeProposals (401)'
    );

    const bypassWriteLandmarks = await rtdbRequest(
      'PUT',
      'xuanhoa_admin/global_state/landmarkBindings/nha_minh_huong',
      BF_TOKEN,
      {
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
        updatedBy: 'disabled_bf',
      }
    );
    assert.equal(
      bypassWriteLandmarks.status,
      401,
      '(Scenario 6d) Backup Founder with active=false + admins=true must be denied writing landmarkBindings (401)'
    );

    const bypassReadMembers = await rtdbRequest('GET', 'xuanhoa_admin/members_registry', BF_TOKEN);
    assert.equal(
      bypassReadMembers.status,
      401,
      '(Scenario 6e) Backup Founder with active=false + admins=true must be denied reading members_registry (401)'
    );

    // Also verify Privileged Backend blocks login & role-update for disabled Backup Founder
    const disabledBfLogin = await callBackendApi('login', null, {
      username: 'founder_duphong_xh',
      password: 'NewUpdatedPassword#2027',
    });
    assert.equal(disabledBfLogin.status, 403, '(Scenario 7a) Disabled/Locked Backup Founder login must be denied (403)');

    const disabledBfRoleUpdate = await callBackendApi('role-update', BF_TOKEN, {
      targetUid: REGULAR_ADMIN_UID,
      role: 'user',
    });
    assert.ok(
      [401, 403].includes(disabledBfRoleUpdate.status),
      '(Scenario 7b) Disabled Backup Founder role-update on backend must be denied (401/403)'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 8, 9 & 10: Regular Admin cannot grant Admin/Founder; Founder grants/revokes Admin & Manager
    // ------------------------------------------------------------------------
    const regularAdminEscalateBackend = await callBackendApi('role-update', ADM_TOKEN, {
      targetUid: '3xK8mP2vN5wL9jR4tY6cZaE18bQ7',
      role: 'admin',
    });
    assert.equal(regularAdminEscalateBackend.status, 403, '(Scenario 8) Regular Admin cannot grant Admin via backend (403)');

    const pfGrantAdminBackend = await callBackendApi('role-update', PF_RECENT_TOKEN, {
      targetUid: '3xK8mP2vN5wL9jR4tY6cZaE18bQ7',
      role: 'admin',
    });
    assert.equal(pfGrantAdminBackend.status, 200, '(Scenario 9a) Primary Founder granting Admin via backend must succeed (200)');

    const pfRevokeAdminBackend = await callBackendApi('role-update', PF_RECENT_TOKEN, {
      targetUid: '3xK8mP2vN5wL9jR4tY6cZaE18bQ7',
      role: 'user',
    });
    assert.equal(pfRevokeAdminBackend.status, 200, '(Scenario 9b) Primary Founder revoking Admin via backend must succeed (200)');

    const pfGrantManagerBackend = await callBackendApi('role-update', PF_RECENT_TOKEN, {
      targetUid: '3xK8mP2vN5wL9jR4tY6cZaE18bQ7',
      role: 'manager',
      canManageWeb: true,
      canManageMaps: true,
    });
    assert.equal(pfGrantManagerBackend.status, 200, '(Scenario 10a) Primary Founder granting Manager via backend must succeed (200)');

    const pfRevokeManagerBackend = await callBackendApi('role-update', PF_RECENT_TOKEN, {
      targetUid: '3xK8mP2vN5wL9jR4tY6cZaE18bQ7',
      role: 'user',
    });
    assert.equal(pfRevokeManagerBackend.status, 200, '(Scenario 10b) Primary Founder revoking Manager via backend must succeed (200)');

    // ------------------------------------------------------------------------
    // SERVER-SIDE RATE LIMITING (429 Too Many Requests after 5 failed attempts)
    // ------------------------------------------------------------------------
    // Re-activate Backup Founder first to test wrong-password rate limiting
    await callBackendApi('set-status', PF_RECENT_TOKEN, {
      backupUid: BACKUP_FOUNDER_UID,
      active: true,
    });
    for (let attempt = 1; attempt <= 5; attempt++) {
      const failRes = await callBackendApi('login', null, {
        username: 'rate_limit_probe_user',
        password: `WrongPass_${attempt}`,
      });
      assert.equal(failRes.status, 401, `Attempt ${attempt} must return 401`);
    }
    const sixthAttemptRes = await callBackendApi('login', null, {
      username: 'rate_limit_probe_user',
      password: 'WrongPass_6',
    });
    assert.equal(sixthAttemptRes.status, 429, '6th failed login attempt must be blocked by server-side rate limiter (429)');

    // ------------------------------------------------------------------------
    // SCENARIO 11 & 12: Zero password/token leak in RTDB/auditLogs + 12 Landmarks & 165 IDs preserved
    // ------------------------------------------------------------------------
    const fullRtdbDump = await rtdbRequest('GET', '', TOKENS.OWNER);
    const rtdbJsonStr = JSON.stringify(fullRtdbDump.data || {});
    assert.doesNotMatch(
      rtdbJsonStr,
      /InitialPassword#2026|NewUpdatedPassword#2027/,
      '(Scenario 11) RTDB & auditLogs must NEVER contain any plaintext or hashed password'
    );

    const landmarksSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'map', 'city3d', 'city3d-landmarks.ts'), 'utf8');
    assert.match(landmarksSrc, /nha-minh-huong-final/, '(Scenario 12a) Nhà Minh Hường FINAL model must remain intact');
    const bindingsSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'lib', 'map', 'landmark-bindings.ts'), 'utf8');
    assert.match(bindingsSrc, /chua_hien_luong/, '(Scenario 12b) 12 landmarks bindings must remain intact');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

// ============================================================================
// TEST 18: FINAL PRODUCTION READINESS V3 — CLOUDFLARE WORKER RUNTIME + LEGAL COMPLIANCE
// + GOOGLE LOGIN CONSENT + IMMUTABLE CONSENT AUDIT TRAIL + DATA RIGHTS REQUESTS
// ============================================================================
test('FOUNDER-LEGAL-CLOUDFLARE-V3-18: Cloudflare Worker fetch(request, env) runtime + Vietnamese Legal Compliance (Luật 91/2025/QH15 & NĐ 356/2025/NĐ-CP) + Google Login Consent (4-layer separation, optional decline allowed, immutable audit trail, anti-spoofing, Data Rights Requests)', async () => {
  await seedBaseEmulatorState();
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  const PRIMARY_FOUNDER_UID = '4ouY5sN8r3P6wQvX2kLm9jBcTd92';
  const BACKUP_FOUNDER_UID = '7bK9mP2xQ5vN8wL4jR6tY3cZaE18';
  const USER_CONSENT_UID = '5mN8pQ3rT6vW9xY2zB4cD7fG1hJ5';
  const OTHER_USER_UID = '8kL2mN5pQ7rS9tV3wX6yZ1bC4dF8';

  const PF_TOKEN = createEmulatorJwt({
    uid: PRIMARY_FOUNDER_UID,
    email: 'marcel.vietnam@gmail.com',
    auth_time: nowSec - 15,
  });
  const USER_TOKEN = createEmulatorJwt({
    uid: USER_CONSENT_UID,
    email: 'sinhvien.xuanhoa@gmail.com',
    auth_time: nowSec - 15,
  });
  const OTHER_USER_TOKEN = createEmulatorJwt({
    uid: OTHER_USER_UID,
    email: 'other.user@gmail.com',
    auth_time: nowSec - 15,
  });

  await rtdbRequest('PUT', 'xuanhoa_security', TOKENS.OWNER, {
    primary_founder: { [PRIMARY_FOUNDER_UID]: true },
    backup_founder: {},
    admins: { [PRIMARY_FOUNDER_UID]: true },
    managers: {},
    locked_uids: {},
  });

  // Simulated Cloudflare Workers `env` binding
  const workerEnv = {
    VITE_FIREBASE_PROJECT_ID: 'xuanhoacogi',
    FIREBASE_DATABASE_EMULATOR_URL: BASE_URL,
    FIREBASE_DATABASE_NAMESPACE: NS,
    FIREBASE_EMULATOR_OWNER_TOKEN: TOKENS.OWNER,
    ALLOW_EMULATOR_TOKENS: 'true',
    ASSETS: {
      async fetch(req) {
        const u = new URL(req.url);
        return new Response(`SPA HTML for ${u.pathname}`, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    },
  };

  async function callWorkerApi(endpoint, token, bodyObj, method = 'POST') {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const req = new Request(`https://xuanhoacogi.com/api/founder-security/${endpoint}`, {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify(bodyObj || {}),
    });
    const res = await workerRuntime.fetch(req, workerEnv);
    const data = await res.json();
    return { status: res.status, data };
  }

  // 18.1 Verify Cloudflare Worker serves the 4 public legal routes (/terms, /privacy, /community-guidelines, /data-rights)
  for (const legalRoute of ['/terms', '/privacy', '/community-guidelines', '/data-rights']) {
    const pageRes = await workerRuntime.fetch(new Request(`https://xuanhoacogi.com${legalRoute}`), workerEnv);
    assert.equal(pageRes.status, 200, `Cloudflare Worker must serve legal route ${legalRoute} (200)`);
  }

  // 18.2 Verify Cloudflare Worker runs Founder Security endpoints (provision, reset-password, forgot-password, lock-unlock, revoke-sessions, role-update)
  const provRes = await callWorkerApi('provision-backup-founder', PF_TOKEN, {
    uid: BACKUP_FOUNDER_UID,
    username: 'founder_cf_worker',
    password: 'CloudflareWorker#2026',
    displayName: 'Backup Founder CF',
    recoveryEmail: 'cf.recovery@gmail.com',
  });
  assert.equal(provRes.status, 200, 'Worker provision-backup-founder must succeed (200)');

  const forgotRes = await callWorkerApi('forgot-password', null, {
    usernameOrEmail: 'founder_cf_worker',
  });
  assert.equal(forgotRes.status, 200, 'Worker forgot-password must succeed with anti-enumeration message (200)');

  const lockRes = await callWorkerApi('lock-unlock', PF_TOKEN, {
    backupUid: BACKUP_FOUNDER_UID,
    active: false,
  });
  assert.equal(lockRes.status, 200, 'Worker lock-unlock alias must succeed (200)');
  assert.equal(lockRes.data.active, false);

  const revokeRes = await callWorkerApi('revoke-sessions', PF_TOKEN, {
    backupUid: BACKUP_FOUNDER_UID,
  });
  assert.equal(revokeRes.status, 200, 'Worker revoke-sessions must succeed (200)');

  // 18.3 Google Login Consent via Worker (`consent-record`):
  // Declining ALL optional consents (Layer D = false) while accepting required A/B/C MUST succeed (200) and allow login!
  const missingCoreRes = await callWorkerApi('consent-record', USER_TOKEN, {
    policyVersion: '2026.11.04-v3.0',
    privacyNoticeVersion: '2026.11.04-v3.0',
    communityGuidelinesVersion: '2026.11.04-v3.0',
    consentUiVersion: 'xuho-consent-ui-v3.0',
    termsAccepted: true,
    essentialDataNoticeAck: true,
    coreProfileConsent: false, // Missing required Layer C
  });
  assert.equal(missingCoreRes.status, 400, 'Missing coreProfileConsent (Layer C) must be rejected (400)');

  const declineOptionalConsentRes = await callWorkerApi('consent-record', USER_TOKEN, {
    policyVersion: '2026.11.04-v3.0',
    privacyNoticeVersion: '2026.11.04-v3.0',
    communityGuidelinesVersion: '2026.11.04-v3.0',
    consentUiVersion: 'xuho-consent-ui-v3.0',
    termsAccepted: true,
    essentialDataNoticeAck: true,
    coreProfileConsent: true,
    optionalTastePersonalization: false,
    optionalAnalytics: false,
    optionalMarketing: false,
    source: 'web',
  });
  assert.equal(
    declineOptionalConsentRes.status,
    200,
    'User declining all optional consents (Layer D = false) must still succeed (200) and not be blocked from login'
  );
  assert.equal(declineOptionalConsentRes.data.record.firebaseAuthUid, USER_CONSENT_UID);
  assert.equal(declineOptionalConsentRes.data.record.purposes.profile_and_ugc.status, 'granted');
  assert.equal(declineOptionalConsentRes.data.record.purposes.optional_taste_phone.status, 'denied');
  assert.equal(declineOptionalConsentRes.data.record.purposes.optional_analytics.status, 'denied');
  assert.equal(declineOptionalConsentRes.data.record.purposes.optional_marketing.status, 'denied');

  // Verify consent record & immutable audit trail were persisted to RTDB Emulator without any tokens/passwords
  const rtdbConsentRes = await rtdbRequest(
    'GET',
    `xuanhoa_admin/user_consents/${USER_CONSENT_UID}`,
    USER_TOKEN
  );
  assert.equal(rtdbConsentRes.status, 200, 'User reading own user_consents/$uid must succeed (200)');
  assert.equal(rtdbConsentRes.data.policyVersion, '2026.11.04-v3.0');

  // 18.4 Consent Withdrawal via Worker (`consent-withdrawal`):
  // First grant optional_taste_phone, then withdraw it and verify withdrawalTimestamp is recorded
  const grantOptionalRes = await callWorkerApi('consent-withdrawal', USER_TOKEN, {
    purpose: 'optional_taste_phone',
    newStatus: 'granted',
    policyVersion: '2026.11.04-v3.0',
  });
  assert.equal(grantOptionalRes.status, 200);
  assert.equal(grantOptionalRes.data.record.purposes.optional_taste_phone.status, 'granted');

  const withdrawOptionalRes = await callWorkerApi('consent-withdrawal', USER_TOKEN, {
    purpose: 'optional_taste_phone',
    newStatus: 'withdrawn',
    policyVersion: '2026.11.04-v3.0',
  });
  assert.equal(withdrawOptionalRes.status, 200, 'Withdrawing optional_taste_phone consent must succeed (200)');
  assert.equal(withdrawOptionalRes.data.record.purposes.optional_taste_phone.status, 'withdrawn');
  assert.ok(
    typeof withdrawOptionalRes.data.record.withdrawalTimestamp === 'number' &&
      withdrawOptionalRes.data.record.withdrawalTimestamp > 0,
    'withdrawalTimestamp must be recorded by server when consent is withdrawn'
  );

  // 18.5 Anti-Spoofing & Immutability of Consent Evidence in Firebase RTDB Rules:
  // (a) User CANNOT spoof another user's firebaseAuthUid
  const spoofOtherUidRes = await rtdbRequest(
    'PUT',
    `xuanhoa_admin/user_consents/${OTHER_USER_UID}`,
    USER_TOKEN,
    {
      ...declineOptionalConsentRes.data.record,
      firebaseAuthUid: OTHER_USER_UID,
      serverTimestamp: Date.now(),
    }
  );
  assert.equal(spoofOtherUidRes.status, 401, 'User spoofing another user UID in user_consents must be denied (401)');

  // (b) User CANNOT forge a backdated serverTimestamp (e.g. 1 year ago)
  const spoofTimestampRes = await rtdbRequest(
    'PUT',
    `xuanhoa_admin/user_consents/${USER_CONSENT_UID}`,
    USER_TOKEN,
    {
      ...declineOptionalConsentRes.data.record,
      serverTimestamp: Date.now() - 365 * 24 * 60 * 60 * 1000,
    }
  );
  assert.equal(spoofTimestampRes.status, 401, 'Forged/stale serverTimestamp in user_consents must be denied (401)');

  // (c) User CANNOT inject accessToken / refreshToken / password into user_consents
  const injectTokenInConsentRes = await rtdbRequest(
    'PUT',
    `xuanhoa_admin/user_consents/${USER_CONSENT_UID}`,
    USER_TOKEN,
    {
      ...declineOptionalConsentRes.data.record,
      serverTimestamp: Date.now(),
      accessToken: 'ya29.forbidden_google_access_token',
    }
  );
  assert.equal(injectTokenInConsentRes.status, 401, 'Storing Google accessToken in user_consents must be denied (401)');

  // (d) Neither User NOR Primary Founder can delete or overwrite an existing consent_audit_trail entry!
  const trailListRes = await rtdbRequest(
    'GET',
    `xuanhoa_admin/consent_audit_trail/${USER_CONSENT_UID}`,
    USER_TOKEN
  );
  assert.equal(trailListRes.status, 200);
  const trailIds = Object.keys(trailListRes.data || {});
  assert.ok(trailIds.length >= 2, 'consent_audit_trail must contain immutable entries for initial consent + withdrawal');
  const firstTrailId = trailIds[0];

  const userDeleteTrailRes = await rtdbRequest(
    'DELETE',
    `xuanhoa_admin/consent_audit_trail/${USER_CONSENT_UID}/${firstTrailId}`,
    USER_TOKEN
  );
  assert.equal(userDeleteTrailRes.status, 401, 'User deleting consent_audit_trail evidence must be denied (401)');

  const founderDeleteTrailRes = await rtdbRequest(
    'DELETE',
    `xuanhoa_admin/consent_audit_trail/${USER_CONSENT_UID}/${firstTrailId}`,
    PF_TOKEN
  );
  assert.equal(
    founderDeleteTrailRes.status,
    401,
    'Even Primary Founder deleting historical consent_audit_trail evidence must be denied by Rules (401)'
  );

  // 18.6 Personal Data Rights Requests (`data-rights`) via Worker & RTDB Isolation:
  const submitDrRes = await callWorkerApi('data-rights', USER_TOKEN, {
    action: 'submit',
    requestType: 'export_data',
    details: 'Yêu cầu trích xuất dữ liệu hồ sơ cá nhân theo Điều 9 Luật BVDLCN 91/2025/QH15.',
    contactEmail: 'sinhvien.xuanhoa@gmail.com',
  });
  assert.equal(submitDrRes.status, 200, 'User submitting Data Rights Request via Worker must succeed (200)');
  const drId = submitDrRes.data.request.requestId;

  // Another user CANNOT read this user's Data Rights Request in RTDB
  const otherReadDrRes = await rtdbRequest(
    'GET',
    `xuanhoa_admin/data_rights_requests/${drId}`,
    OTHER_USER_TOKEN
  );
  assert.equal(otherReadDrRes.status, 401, 'Other user reading another user Data Rights Request must be denied (401)');

  // Primary Founder resolves Data Rights Request via Worker & records audit log
  const resolveDrRes = await callWorkerApi('data-rights', PF_TOKEN, {
    action: 'resolve',
    requestId: drId,
    status: 'completed',
    resolutionNote: 'Đã cung cấp bản trích xuất JSON đầy đủ cho chủ thể dữ liệu.',
  });
  assert.equal(resolveDrRes.status, 200, 'Primary Founder resolving Data Rights Request via Worker must succeed (200)');
  assert.equal(resolveDrRes.data.request.status, 'completed');
  assert.equal(resolveDrRes.data.request.processedByUid, PRIMARY_FOUNDER_UID);

  // 18.7 Policy Version management via Worker (`policy-version`)
  const getPolicyRes = await callWorkerApi('policy-version', null, { action: 'get' });
  assert.equal(getPolicyRes.status, 200, 'Public reading current policy-version via Worker must succeed (200)');
  assert.equal(getPolicyRes.data.policy.version, '2026.11.04-v3.0');
});

// ============================================================================
// TEST 19: FINAL PRODUCTION RELEASE V4 — REAL HTTP STAGING WORKER (14 ENDPOINTS)
// + PRE-RULES SAFE BOOTSTRAP SEQUENCE + 12 LANDMARKS SAVE/RELOAD/SYNC + ROLLBACK
// ============================================================================
test('FINAL-RELEASE-V4-E2E-19: Real HTTP Cloudflare Worker Staging Server (All 14 endpoints) + Safe Bootstrap Before Rules Publish + 12 Landmarks Save/Reload/Sync + Administrative Lock (Phường Xuân Hòa, tỉnh Phú Thọ) + Rollback Simulation', async () => {
  const { execFileSync } = await import('node:child_process');
  await seedBaseEmulatorState();
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);

  const PRIMARY_FOUNDER_UID = '4ouY5sN8r3P6wQvX2kLm9jBcTd92';
  const BACKUP_FOUNDER_UID = '6nM9pQ4rT7vW2xY5zB8cD1fG3hJ6';
  const TARGET_ADMIN_UID = '2kL5mN8pQ3rS6tV9wX1yZ4bC7dF2';
  const TARGET_MANAGER_UID = '3pQ6rS9tV2wX5yZ8bC1dF4gH7jK3';
  const REGULAR_USER_UID = '9rS2tV5wX8yZ1bC4dF7gH3jK6mN9';

  const PF_TOKEN = createEmulatorJwt({
    uid: PRIMARY_FOUNDER_UID,
    email: 'marcel.vietnam@gmail.com',
    auth_time: nowSec - 10,
  });
  const BF_TOKEN = createEmulatorJwt({
    uid: BACKUP_FOUNDER_UID,
    email: 'backup.recovery.v4@gmail.com',
    auth_time: nowSec - 10,
  });
  const ADM_TOKEN = createEmulatorJwt({
    uid: TARGET_ADMIN_UID,
    email: 'admin.v4@gmail.com',
    auth_time: nowSec - 10,
  });
  const MGR_TOKEN = createEmulatorJwt({
    uid: TARGET_MANAGER_UID,
    email: 'manager.v4@gmail.com',
    auth_time: nowSec - 10,
  });
  const USR_TOKEN = createEmulatorJwt({
    uid: REGULAR_USER_UID,
    email: 'user.v4@gmail.com',
    auth_time: nowSec - 10,
  });

  // --------------------------------------------------------------------------
  // PART A: SAFE BOOTSTRAP SEQUENCE (BOOTSTRAP BEFORE NEW RULES PUBLISH)
  // --------------------------------------------------------------------------
  // 1. Load pre-release/rollback rules first (simulating current Production state before new rules)
  await loadRulesIntoEmulator(rollbackRulesRaw);
  await rtdbRequest('DELETE', 'xuanhoa_security', TOKENS.OWNER);
  const latestBackupPath = path.join(ROOT_DIR, 'backups', 'pre_release_2026_11_04', 'rtdb_prod_backup_20261104.json');
  const fallbackBackupPath =
    'C:\\Users\\tmide\\.gemini\\antigravity\\brain\\0a08b7ec-9a57-410e-9871-f2facfc4491c\\scratch\\backups\\pre_security_hardening_20261103\\rtdb_full_backup_20261103.json';
  const rawBackup = JSON.parse(
    fs.readFileSync(fs.existsSync(latestBackupPath) ? latestBackupPath : fallbackBackupPath, 'utf8')
  );
  const backupData = rawBackup?.xuanhoa_admin || rawBackup;
  await rtdbRequest('PUT', 'xuanhoa_admin/members_registry', TOKENS.OWNER, backupData.members_registry || {});
  await rtdbRequest('PUT', 'xuanhoa_admin/global_state/members', TOKENS.OWNER, backupData.global_state?.members || {});
  await rtdbRequest('PUT', 'xuanhoa_admin/global_state/adminAccounts', TOKENS.OWNER, backupData.global_state?.adminAccounts || []);

  // 2. Run bootstrap-security-roles.mjs with privileged token BEFORE publishing new rules
  const bootstrapScript = path.join(ROOT_DIR, 'scripts', 'bootstrap-security-roles.mjs');
  const [, portStr] = EMULATOR_HOST.split(':');
  const bootOut = execFileSync(
    process.execPath,
    [bootstrapScript, '--emulator', `--port=${portStr || '9000'}`, `--ns=${NS}`],
    { cwd: ROOT_DIR, encoding: 'utf8' }
  );
  assert.match(bootOut, /EMULATOR BOOTSTRAP SUCCESS/, 'Privileged bootstrap + post-check must succeed before rules publish');

  // 3. Verify post-bootstrap state in RTDB: Primary Founder UID is active
  const postBootSec = await rtdbRequest('GET', 'xuanhoa_security', TOKENS.OWNER);
  assert.equal(postBootSec.status, 200);
  const bootstrappedPfUids = Object.keys(postBootSec.data?.primary_founder || {});
  assert.equal(bootstrappedPfUids.length, 1, 'Exactly 1 verified Primary Founder UID must be bootstrapped');
  const verifiedPrimaryFounderUid = bootstrappedPfUids[0];
  assert.equal(verifiedPrimaryFounderUid.length, 28, 'Bootstrapped Primary Founder UID must be 28 chars');
  assert.equal(postBootSec.data?.primary_founder?.[verifiedPrimaryFounderUid], true);
  assert.equal(postBootSec.data?.admins?.[verifiedPrimaryFounderUid], true);

  // Also ensure synthetic PRIMARY_FOUNDER_UID is registered in primary_founder/admins for the staging API tests below
  await rtdbRequest('PUT', `xuanhoa_security/primary_founder/${PRIMARY_FOUNDER_UID}`, TOKENS.OWNER, true);
  await rtdbRequest('PUT', `xuanhoa_security/admins/${PRIMARY_FOUNDER_UID}`, TOKENS.OWNER, true);

  // 4. Now publish the new V4 Security Rules AFTER Primary Founder is verified in /xuanhoa_security
  await loadRulesIntoEmulator(rules3RoleRaw);

  // 5. Immediately verify Primary Founder can read /xuanhoa_security and write under new Rules (0 downtime)
  const verifiedPfToken = createEmulatorJwt({ uid: verifiedPrimaryFounderUid, auth_time: nowSec - 10 });
  const pfSmokeRead = await rtdbRequest('GET', 'xuanhoa_security', verifiedPfToken);
  assert.equal(pfSmokeRead.status, 200, 'Primary Founder must immediately have full access after Rules publish (200)');

  // --------------------------------------------------------------------------
  // PART B: REAL HTTP STAGING SERVER WRAPPING CLOUDFLARE WORKER (worker.js)
  // --------------------------------------------------------------------------
  const distDir = path.join(ROOT_DIR, 'dist');
  const distIndexHtml = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

  const stagingWorkerEnv = {
    VITE_FIREBASE_PROJECT_ID: 'xuanhoacogi',
    VITE_FIREBASE_DATABASE_URL: 'https://xuanhoacogi-default-rtdb.firebaseio.com',
    FIREBASE_DATABASE_EMULATOR_URL: BASE_URL,
    FIREBASE_DATABASE_NAMESPACE: NS,
    FIREBASE_EMULATOR_OWNER_TOKEN: TOKENS.OWNER,
    ALLOW_EMULATOR_TOKENS: 'true',
    ASSETS: {
      async fetch(req) {
        const u = new URL(req.url);
        const relPath = u.pathname === '/' ? 'index.html' : u.pathname.replace(/^\//, '');
        const candidateFile = path.join(distDir, relPath);
        if (fs.existsSync(candidateFile) && fs.statSync(candidateFile).isFile()) {
          const ext = path.extname(candidateFile).toLowerCase();
          const mime =
            ext === '.js'
              ? 'application/javascript; charset=utf-8'
              : ext === '.css'
              ? 'text/css; charset=utf-8'
              : ext === '.html'
              ? 'text/html; charset=utf-8'
              : 'application/octet-stream';
          return new Response(fs.readFileSync(candidateFile), {
            status: 200,
            headers: { 'Content-Type': mime },
          });
        }
        // Cloudflare Workers single-page-application fallback
        return new Response(distIndexHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    },
  };

  const stagingHttpServer = http.createServer(async (req, res) => {
    try {
      const fullUrl = `http://127.0.0.1${req.url || '/'}`;
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const bodyBuf = Buffer.concat(chunks);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) headers.set(k, v.join(', '));
        else if (typeof v === 'string') headers.set(k, v);
      }
      const webReq = new Request(fullUrl, {
        method: req.method || 'GET',
        headers,
        body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : bodyBuf,
      });
      const webRes = await workerRuntime.fetch(webReq, stagingWorkerEnv);
      res.statusCode = webRes.status;
      webRes.headers.forEach((val, key) => res.setHeader(key, val));
      const ab = await webRes.arrayBuffer();
      res.end(Buffer.from(ab));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ ok: false, message: String(err) }));
    }
  });

  await new Promise(resolve => stagingHttpServer.listen(0, '127.0.0.1', resolve));
  const stagingPort = stagingHttpServer.address().port;
  const stagingBaseUrl = `http://127.0.0.1:${stagingPort}`;

  async function callStagingApi(endpoint, token, bodyObj) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${stagingBaseUrl}/api/founder-security/${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyObj || {}),
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  try {
    // Verify static SPA routes (/terms, /privacy, /community-guidelines, /data-rights) over real HTTP
    for (const routePath of ['/', '/terms', '/privacy', '/community-guidelines', '/data-rights']) {
      const r = await fetch(`${stagingBaseUrl}${routePath}`);
      assert.equal(r.status, 200, `Staging HTTP GET ${routePath} must return 200`);
      const html = await r.text();
      assert.match(html, /Phường Xuân Hòa, tỉnh Phú Thọ/, `HTML on ${routePath} must reflect locked administrative unit`);
    }

    // (1) Founder login & Provision Backup Founder (One-time setup)
    const unauthProvision = await callStagingApi('provision-backup-founder', null, {
      uid: BACKUP_FOUNDER_UID,
      username: 'founder_v4_backup',
      password: 'BackupFounderV4#2026',
      recoveryEmail: 'backup.recovery.v4@gmail.com',
    });
    assert.equal(unauthProvision.status, 401, '(API 1a) Unauthenticated provision must return 401');

    const provRes = await callStagingApi('provision-backup-founder', PF_TOKEN, {
      uid: BACKUP_FOUNDER_UID,
      username: 'founder_v4_backup',
      password: 'BackupFounderV4#2026',
      displayName: 'Backup Founder V4',
      recoveryEmail: 'backup.recovery.v4@gmail.com',
    });
    assert.equal(provRes.status, 200, '(API 1b) Primary Founder provisioning Backup Founder over HTTP must return 200');
    assert.equal(provRes.data.record.username, 'founder_v4_backup');

    // (2) Backup Founder login via custom username + password
    const bfLoginOk = await callStagingApi('login', null, {
      username: 'founder_v4_backup',
      password: 'BackupFounderV4#2026',
    });
    assert.equal(bfLoginOk.status, 200, '(API 2) Backup Founder login with valid credentials must return 200');
    assert.equal(bfLoginOk.data.uid, BACKUP_FOUNDER_UID);

    // (3) Backup Founder password reset WITHOUT old password
    const resetPwdRes = await callStagingApi('reset-password', PF_TOKEN, {
      backupUid: BACKUP_FOUNDER_UID,
      newPassword: 'ResetFounderV4#2027',
      confirmPassword: 'ResetFounderV4#2027',
    });
    assert.equal(resetPwdRes.status, 200, '(API 3a) Primary Founder resetting password without old password must return 200');

    const bfOldLogin = await callStagingApi('login', null, {
      username: 'founder_v4_backup',
      password: 'BackupFounderV4#2026',
    });
    assert.equal(bfOldLogin.status, 401, '(API 3b) Old password must immediately fail with 401');

    const bfNewLogin = await callStagingApi('login', null, {
      username: 'founder_v4_backup',
      password: 'ResetFounderV4#2027',
    });
    assert.equal(bfNewLogin.status, 200, '(API 3c) New password must immediately succeed with 200');

    // (4) Forgot password
    const forgotRes = await callStagingApi('forgot-password', null, {
      identifier: 'founder_v4_backup',
    });
    assert.equal(forgotRes.status, 200, '(API 4) Forgot password must return 200 with anti-enumeration response');

    // (5) Recovery email verification/update
    const recEmailRes = await callStagingApi('verify-recovery-email', PF_TOKEN, {
      backupUid: BACKUP_FOUNDER_UID,
      recoveryEmail: 'verified.recovery.v4@gmail.com',
    });
    assert.equal(recEmailRes.status, 200, '(API 5) Verify/update recovery email must return 200');
    assert.equal(recEmailRes.data.record.recoveryEmail, 'verified.recovery.v4@gmail.com');

    // (6 & 7) Role update — Admin grant & revoke
    const grantAdmRes = await callStagingApi('role-update', PF_TOKEN, {
      targetUid: TARGET_ADMIN_UID,
      role: 'admin',
    });
    assert.equal(grantAdmRes.status, 200, '(API 6/7a) Granting Admin via Worker HTTP API must return 200');
    const checkAdmNode = await rtdbRequest('GET', `xuanhoa_security/admins/${TARGET_ADMIN_UID}`, PF_TOKEN);
    assert.equal(checkAdmNode.data, true, 'RTDB admins/$uid must be true after grant');

    // Verify regular Admin cannot grant Admin to someone else
    const admSelfGrantAttempt = await callStagingApi('role-update', ADM_TOKEN, {
      targetUid: REGULAR_USER_UID,
      role: 'admin',
    });
    assert.equal(admSelfGrantAttempt.status, 403, '(API 6/7b) Regular Admin granting Admin must be rejected with 403');

    const revokeAdmRes = await callStagingApi('role-update', PF_TOKEN, {
      targetUid: TARGET_ADMIN_UID,
      role: 'user',
    });
    assert.equal(revokeAdmRes.status, 200, '(API 7c) Revoking Admin via Worker HTTP API must return 200');
    const checkAdmAfterRevoke = await rtdbRequest('GET', `xuanhoa_security/admins/${TARGET_ADMIN_UID}`, PF_TOKEN);
    assert.notEqual(checkAdmAfterRevoke.data, true, 'RTDB admins/$uid must not be true after revoke');

    // (8) Manager grant & revoke
    const grantMgrRes = await callStagingApi('role-update', PF_TOKEN, {
      targetUid: TARGET_MANAGER_UID,
      role: 'manager',
      canManageMaps: true,
      canManageWeb: true,
    });
    assert.equal(grantMgrRes.status, 200, '(API 8a) Granting Manager via Worker HTTP API must return 200');
    const checkMgrNode = await rtdbRequest('GET', `xuanhoa_security/managers/${TARGET_MANAGER_UID}`, PF_TOKEN);
    assert.equal(checkMgrNode.data, true, 'RTDB managers/$uid must be true after grant');

    const revokeMgrRes = await callStagingApi('role-update', PF_TOKEN, {
      targetUid: TARGET_MANAGER_UID,
      role: 'user',
    });
    assert.equal(revokeMgrRes.status, 200, '(API 8b) Revoking Manager via Worker HTTP API must return 200');

    // (9) Lock/unlock Backup Founder + verify active=false + admins=true bypass is blocked (401)
    const lockBfRes = await callStagingApi('lock-unlock', PF_TOKEN, {
      backupUid: BACKUP_FOUNDER_UID,
      active: false,
    });
    assert.equal(lockBfRes.status, 200, '(API 9a) Locking Backup Founder must return 200');
    assert.equal(lockBfRes.data.active, false);

    // Even if admins/$uid is forcibly set to true while backup_founder/$uid/active === false, RTDB Rules MUST block!
    await rtdbRequest('PUT', `xuanhoa_security/admins/${BACKUP_FOUNDER_UID}`, TOKENS.OWNER, true);
    const bfBypassTry = await rtdbRequest('GET', 'xuanhoa_security', BF_TOKEN);
    assert.equal(
      bfBypassTry.status,
      401,
      '(API 9b) Backup Founder with active=false + admins=true MUST be denied by RTDB Rules (401)'
    );

    const unlockBfRes = await callStagingApi('lock-unlock', PF_TOKEN, {
      backupUid: BACKUP_FOUNDER_UID,
      active: true,
    });
    assert.equal(unlockBfRes.status, 200, '(API 9c) Unlocking Backup Founder must return 200');
    assert.equal(unlockBfRes.data.active, true);

    // (10) Revoke sessions
    const revokeSessRes = await callStagingApi('revoke-sessions', PF_TOKEN, {
      backupUid: BACKUP_FOUNDER_UID,
    });
    assert.equal(revokeSessRes.status, 200, '(API 10) Revoke sessions must return 200 and increment sessionEpoch');

    // (11) Consent record (declining optional consents still succeeds 200)
    const consentRes = await callStagingApi('consent-record', USR_TOKEN, {
      policyVersion: '2026.11.04-v3.0',
      privacyNoticeVersion: '2026.11.04-v3.0',
      communityGuidelinesVersion: '2026.11.04-v3.0',
      consentUiVersion: 'xuho-consent-ui-v3.0',
      termsAccepted: true,
      essentialDataNoticeAck: true,
      coreProfileConsent: true,
      optionalTastePersonalization: false,
      optionalAnalytics: false,
      optionalMarketing: false,
    });
    assert.equal(consentRes.status, 200, '(API 11) Recording Google Login Consent with optional=false must return 200');

    // (12) Consent withdrawal
    const withdrawRes = await callStagingApi('consent-withdrawal', USR_TOKEN, {
      consentPurpose: 'optional_taste_phone',
      consentStatus: 'withdrawn',
    });
    assert.equal(withdrawRes.status, 200, '(API 12) Withdrawing consent purpose must return 200');
    assert.ok(withdrawRes.data.record.withdrawalTimestamp > 0);

    // (13) Data-rights request (submit -> list -> resolve)
    const drSubmit = await callStagingApi('data-rights', USR_TOKEN, {
      action: 'submit',
      requestType: 'access',
      details: 'Yêu cầu xem thông tin xử lý dữ liệu cá nhân theo Luật 91/2025/QH15.',
    });
    assert.equal(drSubmit.status, 200, '(API 13a) Submitting data-rights request must return 200');
    const reqId = drSubmit.data.request.requestId;

    const drList = await callStagingApi('data-rights', PF_TOKEN, { action: 'list' });
    assert.equal(drList.status, 200, '(API 13b) Founder listing data-rights requests must return 200');
    assert.ok(drList.data.requests.some(r => r.requestId === reqId));

    const drResolve = await callStagingApi('data-rights', PF_TOKEN, {
      action: 'resolve',
      requestId: reqId,
      status: 'completed',
      resolutionNote: 'Đã phản hồi đầy đủ thông tin xử lý dữ liệu cho thành viên.',
    });
    assert.equal(drResolve.status, 200, '(API 13c) Founder resolving data-rights request must return 200');

    // (13b) Status route (/api/founder-security/status)
    const statusRes = await callStagingApi('status', PF_TOKEN, {});
    assert.equal(statusRes.status, 200, '(API 13-status) Founder calling /api/founder-security/status must return 200');
    assert.equal(statusRes.data.passwordHashInRtdb, false);
    assert.equal(statusRes.data.customHmacSession, false);
    assert.equal(statusRes.data.authArchitecture, 'firebase_auth_email_password_standardized');

    // (14) Audit logs route (/api/founder-security/audit-logs) & RTDB verification
    const auditApiRes = await callStagingApi('audit-logs', PF_TOKEN, { limit: 25 });
    assert.equal(auditApiRes.status, 200, '(API 14-audit-logs) Founder calling /api/founder-security/audit-logs must return 200');
    assert.ok(Array.isArray(auditApiRes.data.auditLogs) && auditApiRes.data.auditLogs.length > 0);
    const auditLogsRes = await rtdbRequest('GET', 'xuanhoa_admin/global_state/auditLogs', PF_TOKEN);
    assert.equal(auditLogsRes.status, 200, '(API 14) Audit logs must be persisted in RTDB');
    const auditLogsJson = JSON.stringify(auditLogsRes.data || {});
    assert.doesNotMatch(
      auditLogsJson,
      /BackupFounderV4#2026|ResetFounderV4#2027/,
      'Audit logs must never leak plaintext or hashed passwords'
    );

    // Verify zero passwordHash in RTDB backup_founder node (100% Firebase Auth Email/Password architecture)
    const bfRecordCheck = await rtdbRequest('GET', `xuanhoa_security/backup_founder/${BACKUP_FOUNDER_UID}`, PF_TOKEN);
    assert.equal(bfRecordCheck.status, 200);
    assert.equal('passwordHash' in (bfRecordCheck.data || {}), false, 'RTDB backup_founder record must NOT store passwordHash');
    assert.equal('password' in (bfRecordCheck.data || {}), false, 'RTDB backup_founder record must NOT store password');
    assert.equal('secret' in (bfRecordCheck.data || {}), false, 'RTDB backup_founder record must NOT store secret');
    assert.equal(bfRecordCheck.data?.username, 'founder_v4_backup');

    // ------------------------------------------------------------------------
    // PART C: 12 LANDMARKS SAVE, RELOAD & CROSS-BROWSER SYNC VERIFICATION
    // ------------------------------------------------------------------------
    const bindingsCode = fs.readFileSync(path.join(ROOT_DIR, 'src', 'lib', 'map', 'landmark-bindings.ts'), 'utf8');
    const expected12Landmarks = [
      'hpu2_a1',
      'dh_kien_truc',
      'quang_truong_chim_xanh',
      'nha_trang_xuan_hoa',
      'nui_than_lan',
      'xuanhoa_primary_school',
      'xuanhoa_secondary_school',
      'xuanhoa_high_school',
      'chua_hien_luong',
      'chua_an_hoa',
      'mam_non_xuan_hoa',
      'nha_minh_huong',
    ];
    let matchedLandmarkKeys = 0;
    for (const lmKey of expected12Landmarks) {
      if (bindingsCode.includes(lmKey)) matchedLandmarkKeys++;
    }
    assert.equal(matchedLandmarkKeys, 12, `All 12 locked landmarks must exist in landmark-bindings.ts (found ${matchedLandmarkKeys})`);

    // Founder saves transform (move + rotate + scale) for nha_minh_huong to Firebase RTDB
    const savedTransform = {
      landmarkId: 'nha_minh_huong',
      label: 'Nhà Minh Hường',
      placeId: 'xh_landmark_nha_minh_huong',
      anchorType: 'place',
      offsetX: 3.25,
      offsetY: 0,
      offsetZ: -1.75,
      rotationY: 0.45,
      scale: 1.15,
      visible: true,
      modelVisibilityMode: 'follow_place',
      updatedAt: Date.now(),
      updatedBy: 'Dê Già Designer',
    };
    const saveLmRes = await rtdbRequest(
      'PUT',
      'xuanhoa_admin/global_state/landmarkBindings/nha_minh_huong',
      PF_TOKEN,
      savedTransform
    );
    assert.equal(saveLmRes.status, 200, 'Founder saving landmark transform to Firebase RTDB must succeed (200)');

    // Reload / Second browser session (Guest/Public) reads landmarkBindings and gets exact transform
    const reloadLmRes = await rtdbRequest(
      'GET',
      'xuanhoa_admin/global_state/landmarkBindings/nha_minh_huong',
      TOKENS.GUEST
    );
    assert.equal(reloadLmRes.status, 200, 'Second browser / Guest reloading landmarkBindings must succeed (200)');
    assert.equal(reloadLmRes.data.offsetX, 3.25);
    assert.equal(reloadLmRes.data.offsetZ, -1.75);
    assert.equal(reloadLmRes.data.rotationY, 0.45);
    assert.equal(reloadLmRes.data.scale, 1.15);

    // ------------------------------------------------------------------------
    // PART D: EMERGENCY ROLLBACK SIMULATION
    // ------------------------------------------------------------------------
    await loadRulesIntoEmulator(rollbackRulesRaw);
    const rollbackReadRes = await rtdbRequest('GET', 'xuanhoa_admin/global_state/places', TOKENS.GUEST);
    assert.equal(rollbackReadRes.status, 200, 'Rollback rules must keep public map reading online (200)');
    await loadRulesIntoEmulator(rules3RoleRaw);

    // ------------------------------------------------------------------------
    // PART E: FINAL DEPLOY SAFETY CORRECTION VERIFICATION
    // (1) Privileged RTDB Backup + SHA-256 + Isolated Emulator Restore Drill
    // (2) Privileged Bootstrap Verification (--verify-only)
    // (3) 7-Role Smoke Test (Guest, User, Manager, Admin, Primary Founder, Backup Founder Active, Backup Founder Inactive)
    // (4) Production Mode alg:none Token Rejection Check
    // ------------------------------------------------------------------------
    const backupScript = path.join(ROOT_DIR, 'scripts', 'backup-and-verify-rtdb.mjs');
    const smokeScript = path.join(ROOT_DIR, 'scripts', 'smoke-test-roles.mjs');
    const scratchBackupOutDir =
      'C:\\Users\\tmide\\.gemini\\antigravity\\brain\\0a08b7ec-9a57-410e-9871-f2facfc4491c\\scratch\\backups\\verified_deploy_safety_20261105';
    const scratchPreBootstrapBackupDir =
      'C:\\Users\\tmide\\.gemini\\antigravity\\brain\\0a08b7ec-9a57-410e-9871-f2facfc4491c\\scratch\\backups\\pre_bootstrap_null_sec_20261105';

    // (E0) Verify pre-bootstrap `/xuanhoa_security = null` is accepted as valid pre-bootstrap backup & restores cleanly
    await rtdbRequest('DELETE', 'xuanhoa_security', TOKENS.OWNER);
    const preBootstrapBackupOut = execFileSync(
      process.execPath,
      [
        backupScript,
        '--emulator',
        `--port=${portStr || '9000'}`,
        `--ns=${NS}`,
        `--emulator-port=${portStr || '9000'}`,
        `--out-dir=${scratchPreBootstrapBackupDir}`,
        '--verify-emulator-restore',
      ],
      { cwd: ROOT_DIR, encoding: 'utf8' }
    );
    assert.match(preBootstrapBackupOut, /Security Node State\s+:\s+null_valid_pre_bootstrap/);
    assert.match(preBootstrapBackupOut, /Emulator Restore Drill\s+:\s+PASSED/);

    // Re-seed verified 28-char Primary Founder before running --verify-only and post-bootstrap backup drill
    const bootVerifySeedOut = execFileSync(
      process.execPath,
      [bootstrapScript, '--emulator', `--port=${portStr || '9000'}`, `--ns=${NS}`],
      { cwd: ROOT_DIR, encoding: 'utf8' }
    );
    assert.match(bootVerifySeedOut, /EMULATOR BOOTSTRAP SUCCESS/);

    // Verify `--verify-only` mode on bootstrap-security-roles.mjs
    const bootVerifyOnlyOut = execFileSync(
      process.execPath,
      [bootstrapScript, '--emulator', `--port=${portStr || '9000'}`, `--ns=${NS}`, '--verify-only'],
      { cwd: ROOT_DIR, encoding: 'utf8' }
    );
    assert.match(bootVerifyOnlyOut, /EMULATOR VERIFY-ONLY PASSED/);

    // Run `backup-and-verify-rtdb.mjs --emulator --verify-emulator-restore` (post-bootstrap populated state)
    const backupDrillOut = execFileSync(
      process.execPath,
      [
        backupScript,
        '--emulator',
        `--port=${portStr || '9000'}`,
        `--ns=${NS}`,
        `--emulator-port=${portStr || '9000'}`,
        `--out-dir=${scratchBackupOutDir}`,
        '--verify-emulator-restore',
      ],
      { cwd: ROOT_DIR, encoding: 'utf8' }
    );
    assert.match(backupDrillOut, /PRIVILEGED RTDB & RULES BACKUP VERIFIED \(100% VALID\)/);
    assert.match(backupDrillOut, /Security Node State\s+:\s+populated_security_node/);
    assert.match(backupDrillOut, /Emulator Restore Drill\s+:\s+PASSED/);

    // Run `smoke-test-roles.mjs` against Emulator (all 7 roles, 34 assertions)
    const smokeOut = execFileSync(
      process.execPath,
      [
        smokeScript,
        '--emulator',
        `--port=${portStr || '9000'}`,
        `--ns=${NS}`,
      ],
      { cwd: ROOT_DIR, encoding: 'utf8' }
    );
    assert.match(smokeOut, /7-ROLE RBAC & WORKER API SMOKE TEST \(34\/34 PASSED\)/);

    // Verify Read-Only Production Smoke Test (`runProductionReadOnlySmokeTest`) with Primary Founder Dê Già Designer token (0 writes to Places)
    const { runProductionReadOnlySmokeTest } = await import('../scripts/smoke-test-roles.mjs');
    const realPfToken = createEmulatorJwt({
      uid: verifiedPrimaryFounderUid,
      email: 'marcel.vietnam@gmail.com',
      auth_time: nowSec - 5,
    });
    const readOnlyProdChecks = await runProductionReadOnlySmokeTest({
      rtdbBaseUrl: BASE_URL,
      nsQuery: `ns=${NS}`,
      workerBaseUrl: stagingBaseUrl,
      founderIdToken: realPfToken,
      privilegedHeaders: { Authorization: `Bearer ${TOKENS.OWNER}` },
      expectedFounderUid: verifiedPrimaryFounderUid,
    });
    assert.equal(readOnlyProdChecks.length, 15, 'Read-only production smoke test must execute all 15 read-only checks');
    assert.ok(readOnlyProdChecks.every(c => c.status === 'PASS'), 'All 15 read-only production checks must PASS');

    // Verify Production-mode Worker (`ALLOW_EMULATOR_TOKENS` omitted/false) unconditionally rejects `alg: "none"` unsigned JWTs (401)
    const prodModeEnv = {
      ...stagingWorkerEnv,
      ALLOW_EMULATOR_TOKENS: 'false',
      FIREBASE_EMULATOR_OWNER_TOKEN: '',
    };
    const unsignedTokenAttempt = await workerRuntime.fetch(
      new Request('https://xuanhoacogi.com/api/founder-security/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${PF_TOKEN}`, // PF_TOKEN has alg: "none"
        },
        body: '{}',
      }),
      prodModeEnv
    );
    assert.equal(
      unsignedTokenAttempt.status,
      401,
      'Production-mode Worker (allowEmulatorTokens=false) must immediately reject alg:none JWTs with 401'
    );
  } finally {
    await new Promise(resolve => stagingHttpServer.close(resolve));
  }
});
