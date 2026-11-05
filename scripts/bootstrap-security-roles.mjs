#!/usr/bin/env node
/**
 * XUHO CITY — PRIVILEGED SECURITY ROLE BOOTSTRAP & VERIFICATION SCRIPT (V4)
 * ============================================================================
 * Mục đích:
 *   1. Khởi tạo nhánh phân quyền gốc `/xuanhoa_security` với schema thống nhất:
 *      - `/xuanhoa_security/primary_founder/$uid = true`
 *      - `/xuanhoa_security/backup_founder/$uid = { uid, username, active, ... }`
 *      - `/xuanhoa_security/admins/$uid = true`
 *      - `/xuanhoa_security/managers/$uid = true`
 *      - `/xuanhoa_security/locked_uids/$uid = true`
 *   2. Hỗ trợ đầy đủ xác thực đặc quyền:
 *      - `GOOGLE_APPLICATION_CREDENTIALS` (file JSON Service Account -> tự động lấy OAuth2 Access Token)
 *      - `FIREBASE_SERVICE_ACCOUNT_JSON` (chuỗi JSON Service Account)
 *      - `FIREBASE_ACCESS_TOKEN` (OAuth2 Access Token)
 *      - `FIREBASE_DATABASE_SECRET` (RTDB Database Secret)
 *   3. Chế độ `--verify-only`:
 *      - Xác minh độc lập bằng quyền đặc quyền (TUYỆT ĐỐI KHÔNG dùng curl ẩn danh)
 *      - Kiểm tra `/xuanhoa_security/primary_founder/<PrimaryFounderUID> === true`
 *      - Kiểm tra `/xuanhoa_security/admins/<PrimaryFounderUID> === true`
 *      - Kiểm tra tương thích với `database.rules.json` cho phiên đăng nhập Primary Founder.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mintServiceAccountAccessToken } from '../server/founder-security-backend.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

export const EXPECTED_PROJECT_ID = 'xuanhoacogi';
export const EXPECTED_PROD_DB_URL = 'https://xuanhoacogi-default-rtdb.firebaseio.com';
export const EXPECTED_NAMESPACE = 'xuanhoacogi-default-rtdb';

export function maskUid(uid) {
  if (!uid || typeof uid !== 'string') return '(none)';
  const s = uid.trim();
  if (s.length <= 8) return `${s.slice(0, 2)}***${s.slice(-2)}`;
  return `${s.slice(0, 4)}...${s.slice(-4)} (len=${s.length})`;
}

export function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '(masked)';
  const [local, domain] = email.trim().split('@');
  const head = local.slice(0, 3);
  const tail = local.length > 5 ? local.slice(-2) : '';
  return `${head}***${tail}@${domain}`;
}

export function classifyUidFormat(uid) {
  if (!uid || typeof uid !== 'string' || !uid.trim()) return 'MISSING';
  const clean = uid.trim();
  if (clean.startsWith('uid_')) return 'SYNTHETIC_EMAIL_FALLBACK';
  if (/^\d{18,25}$/.test(clean)) return 'GOOGLE_OAUTH_SUB_NUMERIC_21DIGIT';
  if (isVerifiedFirebaseAuthUid(clean)) return 'FIREBASE_AUTH_UID_28CHAR';
  return `UNRECOGNIZED_FORMAT(len=${clean.length})`;
}

export function isVerifiedFirebaseAuthUid(uid) {
  if (typeof uid !== 'string' || !uid.trim()) return false;
  const clean = uid.trim();
  if (
    clean.startsWith('uid_') ||
    clean.startsWith('google_') ||
    clean.startsWith('fb_') ||
    clean.includes('@') ||
    clean.includes('.') ||
    clean.includes('%') ||
    clean.includes('/') ||
    clean.includes('#') ||
    clean.includes('$') ||
    clean.includes('[') ||
    clean.includes(']')
  ) {
    return false;
  }
  if (/^\d+$/.test(clean)) {
    return false;
  }
  return /^[A-Za-z0-9]{20,36}$/.test(clean);
}

export function assertValidUidKey(uid, roleLabel) {
  if (typeof uid !== 'string' || !uid.trim()) {
    throw new Error(`[BOOTSTRAP BLOCKED] UID rỗng cho vai trò ${roleLabel}.`);
  }
  const clean = uid.trim();
  if (!isVerifiedFirebaseAuthUid(clean)) {
    const reason = /^\d+$/.test(clean)
      ? 'Google OAuth sub (numeric) không phải Firebase Auth UID'
      : clean.startsWith('uid_')
      ? 'Khóa fallback tự sinh (uid_*) không phải Firebase Auth UID'
      : 'Không khớp định dạng Firebase Auth UID 28 ký tự';
    throw new Error(
      `[BOOTSTRAP BLOCKED] Từ chối bootstrap UID chưa xác minh (${maskUid(clean)}) cho ${roleLabel}: ${reason}.`
    );
  }
  return clean;
}

export function verifyProjectIdentity() {
  const firebaseRcPath = path.join(PROJECT_ROOT, '.firebaserc');
  if (fs.existsSync(firebaseRcPath)) {
    const rc = JSON.parse(fs.readFileSync(firebaseRcPath, 'utf8'));
    const defaultProj = rc?.projects?.default;
    if (defaultProj && defaultProj !== EXPECTED_PROJECT_ID) {
      throw new Error(
        `[ANTI-WRONG-PROJECT] .firebaserc trỏ tới "${defaultProj}", khác với "${EXPECTED_PROJECT_ID}"!`
      );
    }
  }

  const firebaseTsPath = path.join(PROJECT_ROOT, 'src', 'lib', 'firebase.ts');
  if (fs.existsSync(firebaseTsPath)) {
    const content = fs.readFileSync(firebaseTsPath, 'utf8');
    if (!content.includes(EXPECTED_PROD_DB_URL)) {
      throw new Error(
        `[ANTI-WRONG-PROJECT] src/lib/firebase.ts không chứa databaseURL chuẩn "${EXPECTED_PROD_DB_URL}"!`
      );
    }
  }
}

/**
 * Resolves privileged authentication query/headers for Production RTDB from:
 * 1. GOOGLE_APPLICATION_CREDENTIALS (path to Service Account JSON file)
 * 2. FIREBASE_SERVICE_ACCOUNT_JSON (inline JSON string)
 * 3. FIREBASE_ACCESS_TOKEN (OAuth2 Access Token)
 * 4. FIREBASE_DATABASE_SECRET (Database Secret)
 * 5. --auth-token=... CLI flag
 */
export async function resolvePrivilegedProdAuth(args = []) {
  const cliToken = args.find(a => a.startsWith('--auth-token='))?.split('=')[1];
  const saPath =
    args.find(a => a.startsWith('--service-account='))?.split('=')[1] ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    '';
  const saInline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';

  if (saPath && fs.existsSync(saPath)) {
    const rawSa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
    if (rawSa.project_id && rawSa.project_id !== EXPECTED_PROJECT_ID) {
      throw new Error(
        `[ANTI-WRONG-PROJECT] Service Account project_id="${rawSa.project_id}" không khớp "${EXPECTED_PROJECT_ID}"!`
      );
    }
    const oauthToken = await mintServiceAccountAccessToken(rawSa);
    if (!oauthToken) {
      throw new Error(
        '[AUTH FAILED] Không thể lấy Google OAuth2 Access Token từ file GOOGLE_APPLICATION_CREDENTIALS.'
      );
    }
    return {
      mode: 'service_account_oauth2',
      headers: { Authorization: `Bearer ${oauthToken}` },
      querySuffix: '',
      oauthToken,
    };
  }

  if (saInline) {
    const rawSa = JSON.parse(saInline);
    if (rawSa.project_id && rawSa.project_id !== EXPECTED_PROJECT_ID) {
      throw new Error(
        `[ANTI-WRONG-PROJECT] FIREBASE_SERVICE_ACCOUNT_JSON project_id="${rawSa.project_id}" không khớp "${EXPECTED_PROJECT_ID}"!`
      );
    }
    const oauthToken = await mintServiceAccountAccessToken(rawSa);
    if (!oauthToken) {
      throw new Error(
        '[AUTH FAILED] Không thể lấy Google OAuth2 Access Token từ FIREBASE_SERVICE_ACCOUNT_JSON.'
      );
    }
    return {
      mode: 'service_account_oauth2',
      headers: { Authorization: `Bearer ${oauthToken}` },
      querySuffix: '',
      oauthToken,
    };
  }

  if (process.env.FIREBASE_ACCESS_TOKEN) {
    const token = process.env.FIREBASE_ACCESS_TOKEN.trim();
    return {
      mode: 'oauth2_access_token',
      headers: { Authorization: `Bearer ${token}` },
      querySuffix: '',
      oauthToken: token,
    };
  }

  if (process.env.FIREBASE_DATABASE_SECRET || cliToken) {
    const secret = (process.env.FIREBASE_DATABASE_SECRET || cliToken).trim();
    return {
      mode: 'database_secret',
      headers: {},
      querySuffix: `?auth=${encodeURIComponent(secret)}`,
      oauthToken: null,
    };
  }

  throw new Error(
    '[PRODUCTION SAFETY GATE] Thiếu thông tin xác thực đặc quyền! Vui lòng cung cấp GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_ACCESS_TOKEN hoặc FIREBASE_DATABASE_SECRET.'
  );
}

export function buildBootstrapPayload(
  extraAdminUids = [],
  extraManagerUids = [],
  xuanhoaAdminNode = null
) {
  const primaryFounderMap = {};
  const backupFounderMap = {};
  const adminsMap = {};
  const managersMap = {};
  const lockedUidsMap = {};
  const verifiedAccounts = [];
  const unverifiedAccounts = [];

  const membersRegistry = xuanhoaAdminNode?.members_registry || {};
  const globalState = xuanhoaAdminNode?.global_state || {};
  const globalMembers = globalState.members || {};
  const adminAccounts = Array.isArray(globalState.adminAccounts) ? globalState.adminAccounts : [];
  const adminEmailsList = Array.isArray(globalState.adminEmails)
    ? globalState.adminEmails
        .map(e => String(e || '').trim().toLowerCase())
        .filter(e => e && e.includes('@') && !e.endsWith('@xuanhoacogi.com'))
    : [];

  const knownAdminEmails = new Set(adminEmailsList);
  const fbUidFromAdminAccountsByEmail = new Map();
  for (const acc of adminAccounts) {
    if (!acc || typeof acc !== 'object') continue;
    const email = String(acc.username || '').trim().toLowerCase();
    if (email && email.includes('@') && !email.endsWith('@xuanhoacogi.com')) {
      knownAdminEmails.add(email);
    }
    const rawId = String(acc.id || '').trim();
    if (rawId.startsWith('fb_')) {
      const candidateUid = rawId.slice(3);
      if (isVerifiedFirebaseAuthUid(candidateUid) && email) {
        fbUidFromAdminAccountsByEmail.set(email, candidateUid);
      }
    }
  }

  const processedEmails = new Set();
  const combinedByEmail = new Map();
  for (const src of [globalMembers, membersRegistry]) {
    if (!src || typeof src !== 'object') continue;
    for (const entry of Object.values(src)) {
      if (!entry || typeof entry !== 'object') continue;
      const email = String(entry.email || '').trim().toLowerCase();
      if (!email || !email.includes('@') || email.endsWith('@xuanhoacogi.com')) continue;
      const prev = combinedByEmail.get(email) || {};
      const bestUid = isVerifiedFirebaseAuthUid(entry.uid)
        ? entry.uid
        : isVerifiedFirebaseAuthUid(prev.uid)
        ? prev.uid
        : entry.uid && !String(entry.uid).startsWith('uid_')
        ? entry.uid
        : prev.uid || entry.uid || '';
      combinedByEmail.set(email, {
        ...prev,
        ...entry,
        email,
        uid: bestUid,
        status:
          entry.status === 'admin' || prev.status === 'admin'
            ? 'admin'
            : entry.status || prev.status,
        canManageMaps: Boolean(entry.canManageMaps || prev.canManageMaps),
        canManageWeb: Boolean(entry.canManageWeb || prev.canManageWeb),
      });
    }
  }

  for (const entry of combinedByEmail.values()) {
    const email = entry.email;
    const isTargetAdmin = knownAdminEmails.has(email) || entry.status === 'admin';
    const isTargetManager =
      !isTargetAdmin && (entry.canManageMaps === true || entry.canManageWeb === true);

    if (!isTargetAdmin && !isTargetManager) continue;
    processedEmails.add(email);

    const regUid = String(entry.uid || '').trim();
    const matchedAdminAccUid = fbUidFromAdminAccountsByEmail.get(email) || null;
    const roleLabel = isTargetAdmin ? 'PRIMARY_FOUNDER' : 'MANAGER';

    if (isVerifiedFirebaseAuthUid(regUid)) {
      if (isTargetAdmin) {
        primaryFounderMap[regUid] = true;
        adminsMap[regUid] = true;
      } else {
        managersMap[regUid] = true;
      }
      verifiedAccounts.push({
        role: roleLabel,
        maskedEmail: maskEmail(email),
        maskedFirebaseAuthUid: maskUid(regUid),
        schemaPath: isTargetAdmin
          ? `/xuanhoa_security/primary_founder/${maskUid(regUid)} = true`
          : `/xuanhoa_security/managers/${maskUid(regUid)} = true`,
        registryMatch: matchedAdminAccUid ? regUid === matchedAdminAccUid : true,
        status: isTargetAdmin
          ? 'VERIFIED_PRIMARY_FOUNDER_BOOTSTRAPPED'
          : 'VERIFIED_FIREBASE_AUTH_UID_BOOTSTRAPPED',
      });
    } else if (isTargetAdmin && matchedAdminAccUid && isVerifiedFirebaseAuthUid(matchedAdminAccUid)) {
      primaryFounderMap[matchedAdminAccUid] = true;
      adminsMap[matchedAdminAccUid] = true;
      verifiedAccounts.push({
        role: roleLabel,
        maskedEmail: maskEmail(email),
        maskedFirebaseAuthUid: maskUid(matchedAdminAccUid),
        schemaPath: `/xuanhoa_security/primary_founder/${maskUid(matchedAdminAccUid)} = true`,
        registryMatch: regUid === matchedAdminAccUid,
        status: 'VERIFIED_FROM_FIREBASE_AUTH_ADMIN_ACCOUNT',
      });
    } else {
      unverifiedAccounts.push({
        role: isTargetAdmin ? 'ADMIN' : 'MANAGER',
        maskedEmail: maskEmail(email),
        maskedRegistryUid: maskUid(regUid),
        registryUidClassification: classifyUidFormat(regUid),
        status: 'NEEDS_FIREBASE_AUTH_UID_VERIFICATION',
        decision: 'DO_NOT_BOOTSTRAP',
      });
    }
  }

  for (const email of knownAdminEmails) {
    if (processedEmails.has(email)) continue;
    const matchedUid = fbUidFromAdminAccountsByEmail.get(email) || null;
    if (matchedUid && isVerifiedFirebaseAuthUid(matchedUid)) {
      primaryFounderMap[matchedUid] = true;
      adminsMap[matchedUid] = true;
      verifiedAccounts.push({
        role: 'PRIMARY_FOUNDER',
        maskedEmail: maskEmail(email),
        maskedFirebaseAuthUid: maskUid(matchedUid),
        schemaPath: `/xuanhoa_security/primary_founder/${maskUid(matchedUid)} = true`,
        registryMatch: false,
        status: 'VERIFIED_FROM_FIREBASE_AUTH_ADMIN_ACCOUNT',
      });
    } else {
      unverifiedAccounts.push({
        role: 'ADMIN',
        maskedEmail: maskEmail(email),
        maskedRegistryUid: '(none)',
        registryUidClassification: 'MISSING_IN_REGISTRY',
        status: 'NEEDS_FIREBASE_AUTH_UID_VERIFICATION',
        decision: 'DO_NOT_BOOTSTRAP',
      });
    }
  }

  for (const extraUid of extraAdminUids) {
    const validUid = assertValidUidKey(extraUid, 'extraAdminUid');
    adminsMap[validUid] = true;
  }

  for (const extraUid of extraManagerUids) {
    const validUid = assertValidUidKey(extraUid, 'extraManagerUid');
    managersMap[validUid] = true;
  }

  return {
    payload: {
      primary_founder: primaryFounderMap,
      backup_founder: backupFounderMap,
      admins: adminsMap,
      managers: managersMap,
      locked_uids: lockedUidsMap,
    },
    verifiedAccounts,
    unverifiedAccounts,
  };
}

export function verifyPostBootstrapState(verifiedData, expectedPrimaryFounderUids = []) {
  if (!verifiedData || typeof verifiedData !== 'object' || verifiedData.error) {
    throw new Error(
      `[POST-BOOTSTRAP VERIFICATION FAILED] /xuanhoa_security trả về rỗng hoặc lỗi: ${JSON.stringify(verifiedData)}`
    );
  }
  if (verifiedData.founders !== undefined) {
    throw new Error(
      '[SCHEMA VIOLATION] Phát hiện nhánh lạ /xuanhoa_security/founders! Schema chuẩn chỉ sử dụng /xuanhoa_security/primary_founder/$uid = true và /xuanhoa_security/backup_founder/$uid.'
    );
  }

  const pfNode = verifiedData.primary_founder || {};
  const admNode = verifiedData.admins || {};
  const mgrNode = verifiedData.managers || {};
  const bfNode = verifiedData.backup_founder || {};

  const targetPfUids =
    expectedPrimaryFounderUids.length > 0 ? expectedPrimaryFounderUids : Object.keys(pfNode);
  if (targetPfUids.length === 0) {
    throw new Error(
      '[POST-BOOTSTRAP VERIFICATION FAILED] Không có Primary Founder UID nào trong /xuanhoa_security/primary_founder!'
    );
  }

  for (const pfUid of targetPfUids) {
    assertValidUidKey(pfUid, 'postBootstrapPrimaryFounder');
    if (pfNode[pfUid] !== true) {
      throw new Error(
        `[POST-BOOTSTRAP VERIFICATION FAILED] Primary Founder UID (${maskUid(pfUid)}) chưa có /xuanhoa_security/primary_founder/${pfUid} === true!`
      );
    }
    if (admNode[pfUid] !== true) {
      throw new Error(
        `[POST-BOOTSTRAP VERIFICATION FAILED] Primary Founder UID (${maskUid(pfUid)}) chưa có /xuanhoa_security/admins/${pfUid} === true!`
      );
    }
  }

  for (const [roleNodeName, nodeObj] of [
    ['primary_founder', pfNode],
    ['backup_founder', bfNode],
    ['admins', admNode],
    ['managers', mgrNode],
  ]) {
    for (const uidKey of Object.keys(nodeObj)) {
      if (!isVerifiedFirebaseAuthUid(uidKey)) {
        throw new Error(
          `[POST-BOOTSTRAP VERIFICATION FAILED] Phát hiện UID chưa xác minh (${maskUid(uidKey)}) trong ${roleNodeName}!`
        );
      }
    }
  }
  return true;
}

export function maskPayloadForLog(payload) {
  const maskedPrimaryFounder = {};
  for (const k of Object.keys(payload?.primary_founder || {})) {
    maskedPrimaryFounder[maskUid(k)] = payload.primary_founder[k];
  }
  const maskedBackupFounder = {};
  for (const k of Object.keys(payload?.backup_founder || {})) {
    const v = payload.backup_founder[k];
    maskedBackupFounder[maskUid(k)] =
      typeof v === 'object' && v ? { username: v.username, active: v.active } : Boolean(v);
  }
  const maskedAdmins = {};
  for (const k of Object.keys(payload?.admins || {})) {
    maskedAdmins[maskUid(k)] = payload.admins[k];
  }
  const maskedManagers = {};
  for (const k of Object.keys(payload?.managers || {})) {
    maskedManagers[maskUid(k)] = payload.managers[k];
  }
  const maskedLockedUids = {};
  for (const k of Object.keys(payload?.locked_uids || {})) {
    maskedLockedUids[maskUid(k)] = payload.locked_uids[k];
  }
  return {
    primary_founder: maskedPrimaryFounder,
    backup_founder: maskedBackupFounder,
    admins: maskedAdmins,
    managers: maskedManagers,
    locked_uids: maskedLockedUids,
  };
}

async function main() {
  verifyProjectIdentity();

  const args = process.argv.slice(2);
  const isEmulator = args.includes('--emulator');
  const isExecuteProd = args.includes('--execute-prod') || args.includes('--apply');
  const isVerifyOnly = args.includes('--verify-only');
  const confirmProjectArg = args.find(a => a.startsWith('--confirm-project='))?.split('=')[1];
  const portArg = args.find(a => a.startsWith('--port='))?.split('=')[1];
  const emulatorPort = portArg ? Number(portArg) : 9000;
  const nsArg = args.find(a => a.startsWith('--ns='))?.split('=')[1];
  const targetNamespace = nsArg || EXPECTED_NAMESPACE;

  const extraAdminUids = (args.find(a => a.startsWith('--admin-uids='))?.split('=')[1] || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const extraManagerUids = (args.find(a => a.startsWith('--manager-uids='))?.split('=')[1] || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const backupPath = path.join(
    PROJECT_ROOT,
    'backups',
    'pre_release_2026_11_04',
    'rtdb_prod_backup_20261104.json'
  );
  let backupXuanhoaAdmin = null;
  if (fs.existsSync(backupPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      backupXuanhoaAdmin = parsed?.xuanhoa_admin || null;
    } catch {}
  }

  let { payload, verifiedAccounts, unverifiedAccounts } = buildBootstrapPayload(
    extraAdminUids,
    extraManagerUids,
    backupXuanhoaAdmin
  );

  // --------------------------------------------------------------------------
  // MODE A: VERIFY-ONLY (Privileged verification of /xuanhoa_security)
  // --------------------------------------------------------------------------
  if (isVerifyOnly) {
    if (isEmulator) {
      const baseUrl = `http://127.0.0.1:${emulatorPort}`;
      const verifyRes = await fetch(
        `${baseUrl}/xuanhoa_security.json?ns=${targetNamespace}&access_token=owner`
      );
      if (!verifyRes.ok) {
        throw new Error(`[VERIFY-ONLY FAILED] HTTP ${verifyRes.status} từ Emulator.`);
      }
      const verifiedData = await verifyRes.json();
      verifyPostBootstrapState(verifiedData, Object.keys(payload.primary_founder));
      console.log(
        '[EMULATOR VERIFY-ONLY PASSED] Schema /xuanhoa_security/primary_founder/$uid === true hợp lệ:'
      );
      console.log(JSON.stringify(maskPayloadForLog(verifiedData), null, 2));
      return;
    }

    if (confirmProjectArg !== EXPECTED_PROJECT_ID) {
      throw new Error(
        `[PRODUCTION SAFETY GATE] Khi chạy --verify-only trên Production, bắt buộc truyền --confirm-project=${EXPECTED_PROJECT_ID}.`
      );
    }
    const authInfo = await resolvePrivilegedProdAuth(args);
    const verifyProdRes = await fetch(
      `${EXPECTED_PROD_DB_URL}/xuanhoa_security.json${authInfo.querySuffix}`,
      { headers: authInfo.headers }
    );
    if (!verifyProdRes.ok) {
      throw new Error(
        `[PRODUCTION VERIFY-ONLY FAILED] HTTP ${verifyProdRes.status} khi đọc /xuanhoa_security bằng quyền đặc quyền (${authInfo.mode}).`
      );
    }
    const verifiedProdData = await verifyProdRes.json();
    verifyPostBootstrapState(verifiedProdData, Object.keys(payload.primary_founder));
    console.log(
      `\n[PRODUCTION VERIFY-ONLY PASSED] Đã xác minh bằng quyền đặc quyền (${authInfo.mode}) rằng /xuanhoa_security/primary_founder/$uid === true và /xuanhoa_security/admins/$uid === true:`
    );
    console.log(JSON.stringify(maskPayloadForLog(verifiedProdData), null, 2));
    return;
  }

  console.log('============================================================================');
  console.log('XUHO CITY — SECURITY ROLE BOOTSTRAP PLAN (/xuanhoa_security)');
  console.log('============================================================================');
  console.log(`Project ID verified : ${EXPECTED_PROJECT_ID}`);
  console.log(`Canonical RTDB URL  : ${EXPECTED_PROD_DB_URL}`);
  console.log(
    `Target Mode         : ${
      isEmulator
        ? `EMULATOR (127.0.0.1:${emulatorPort})`
        : isExecuteProd
        ? 'PRODUCTION PRIVILEGED APPLY'
        : 'DRY-RUN (NO NETWORK WRITE)'
    }`
  );
  console.log('Verified Firebase Auth accounts approved for bootstrap (masked):');
  console.log(JSON.stringify(verifiedAccounts, null, 2));
  console.log('Unverified accounts held back — NOT bootstrapped (masked):');
  console.log(JSON.stringify(unverifiedAccounts, null, 2));
  console.log('Payload to write at /xuanhoa_security (masked):');
  console.log(JSON.stringify(maskPayloadForLog(payload), null, 2));

  if (!isEmulator && !isExecuteProd) {
    console.log(
      '\n[DRY-RUN COMPLETED] Không thực hiện ghi mạng vì chưa truyền --emulator hoặc --execute-prod --confirm-project=xuanhoacogi.'
    );
    return;
  }

  // --------------------------------------------------------------------------
  // MODE B: EMULATOR BOOTSTRAP + READ-BACK VERIFICATION
  // --------------------------------------------------------------------------
  if (isEmulator) {
    const baseUrl = `http://127.0.0.1:${emulatorPort}`;
    const existingSecRes = await fetch(
      `${baseUrl}/xuanhoa_security.json?ns=${targetNamespace}&access_token=owner`
    );
    if (existingSecRes.ok) {
      const existingSec = await existingSecRes.json();
      if (existingSec && typeof existingSec === 'object') {
        if (existingSec.backup_founder && typeof existingSec.backup_founder === 'object') {
          Object.assign(payload.backup_founder, existingSec.backup_founder);
        }
        if (existingSec.locked_uids && typeof existingSec.locked_uids === 'object') {
          Object.assign(payload.locked_uids, existingSec.locked_uids);
        }
      }
    }

    const adminNodeRes = await fetch(
      `${baseUrl}/xuanhoa_admin.json?ns=${targetNamespace}&access_token=owner`
    );
    if (adminNodeRes.ok) {
      const liveAdminNode = await adminNodeRes.json();
      if (liveAdminNode && typeof liveAdminNode === 'object') {
        const merged = buildBootstrapPayload(extraAdminUids, extraManagerUids, liveAdminNode);
        Object.assign(payload.primary_founder, merged.payload.primary_founder);
        Object.assign(payload.admins, merged.payload.admins);
        Object.assign(payload.managers, merged.payload.managers);
      }
    }

    if (Object.keys(payload.primary_founder).length === 0) {
      throw new Error(
        '[EMULATOR BOOTSTRAP BLOCKED] Không tìm thấy Primary Founder UID 28 ký tự hợp lệ nào để bootstrap!'
      );
    }

    const writeRes = await fetch(
      `${baseUrl}/xuanhoa_security.json?ns=${targetNamespace}&access_token=owner`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (!writeRes.ok) {
      const errText = await writeRes.text();
      throw new Error(`[EMULATOR BOOTSTRAP FAILED] HTTP ${writeRes.status}: ${errText}`);
    }

    const verifyRes = await fetch(
      `${baseUrl}/xuanhoa_security.json?ns=${targetNamespace}&access_token=owner`
    );
    const verifiedData = await verifyRes.json();
    verifyPostBootstrapState(verifiedData, Object.keys(payload.primary_founder));
    console.log(
      '\n[EMULATOR BOOTSTRAP SUCCESS] Đã ghi và xác minh hậu kiểm /xuanhoa_security trên Emulator (masked):'
    );
    console.log(JSON.stringify(maskPayloadForLog(verifiedData || {}), null, 2));
    return;
  }

  // --------------------------------------------------------------------------
  // MODE C: PRODUCTION PRIVILEGED BOOTSTRAP + READ-BACK VERIFICATION
  // --------------------------------------------------------------------------
  if (isExecuteProd) {
    if (confirmProjectArg !== EXPECTED_PROJECT_ID) {
      throw new Error(
        `[PRODUCTION SAFETY GATE] Bắt buộc truyền --confirm-project=${EXPECTED_PROJECT_ID} khi chạy Production.`
      );
    }
    const authInfo = await resolvePrivilegedProdAuth(args);

    // 1. Pre-Bootstrap Read: Bảo toàn backup_founder / locked_uids nếu đã tồn tại
    const existingSecRes = await fetch(
      `${EXPECTED_PROD_DB_URL}/xuanhoa_security.json${authInfo.querySuffix}`,
      { headers: authInfo.headers }
    );
    if (existingSecRes.ok) {
      const existingSec = await existingSecRes.json();
      if (existingSec && typeof existingSec === 'object' && !existingSec.error) {
        if (existingSec.backup_founder && typeof existingSec.backup_founder === 'object') {
          Object.assign(payload.backup_founder, existingSec.backup_founder);
        }
        if (existingSec.locked_uids && typeof existingSec.locked_uids === 'object') {
          Object.assign(payload.locked_uids, existingSec.locked_uids);
        }
      }
    }

    const liveAdminRes = await fetch(
      `${EXPECTED_PROD_DB_URL}/xuanhoa_admin.json${authInfo.querySuffix}`,
      { headers: authInfo.headers }
    );
    if (liveAdminRes.ok) {
      const liveAdminNode = await liveAdminRes.json();
      if (liveAdminNode && typeof liveAdminNode === 'object' && !liveAdminNode.error) {
        const merged = buildBootstrapPayload(extraAdminUids, extraManagerUids, liveAdminNode);
        Object.assign(payload.primary_founder, merged.payload.primary_founder);
        Object.assign(payload.admins, merged.payload.admins);
        Object.assign(payload.managers, merged.payload.managers);
      }
    }

    if (Object.keys(payload.primary_founder).length === 0) {
      throw new Error(
        '[PRODUCTION BOOTSTRAP BLOCKED] Không tìm thấy Primary Founder UID 28 ký tự hợp lệ nào để bootstrap!'
      );
    }

    // 2. Privileged Write to /xuanhoa_security
    const putRes = await fetch(
      `${EXPECTED_PROD_DB_URL}/xuanhoa_security.json${authInfo.querySuffix}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authInfo.headers,
        },
        body: JSON.stringify(payload),
      }
    );
    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`[PRODUCTION BOOTSTRAP FAILED] HTTP ${putRes.status}: ${errText}`);
    }

    // 3. Mandatory Privileged Read-Back Verification BEFORE allowing Rules publish
    const verifyProdRes = await fetch(
      `${EXPECTED_PROD_DB_URL}/xuanhoa_security.json${authInfo.querySuffix}`,
      { headers: authInfo.headers }
    );
    if (!verifyProdRes.ok) {
      throw new Error(
        `[POST-BOOTSTRAP VERIFICATION FAILED] Không đọc lại được /xuanhoa_security trên Production (HTTP ${verifyProdRes.status})!`
      );
    }
    const verifiedProdData = await verifyProdRes.json();
    verifyPostBootstrapState(verifiedProdData, Object.keys(payload.primary_founder));

    console.log(
      `\n[PRODUCTION BOOTSTRAP & POST-CHECK SUCCESS] Đã khởi tạo và xác minh hậu kiểm /xuanhoa_security trên Production (${authInfo.mode}):`
    );
    console.log(JSON.stringify(maskPayloadForLog(verifiedProdData), null, 2));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}
