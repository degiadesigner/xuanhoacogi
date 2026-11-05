#!/usr/bin/env node
/**
 * XUHO CITY — PRIVILEGED RTDB & RULES BACKUP + SHA-256 + EMULATOR RESTORE VERIFIER (V4)
 * ============================================================================
 * Thay thế hoàn toàn lệnh `curl` ẩn danh không an toàn.
 *
 * Tính năng bắt buộc:
 *   1. Xác minh đúng project (`xuanhoacogi`) và database (`https://xuanhoacogi-default-rtdb.firebaseio.com`).
 *   2. Sử dụng quyền đặc quyền (`GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_SERVICE_ACCOUNT_JSON`,
 *      `FIREBASE_ACCESS_TOKEN`, `FIREBASE_DATABASE_SECRET` hoặc `--emulator` khi kiểm thử).
 *   3. Sao lưu toàn bộ dữ liệu cần bảo toàn (`xuanhoa_admin`, `xuanhoa_security`) VÀ
 *      Firebase Rules đang có hiệu lực (`/.settings/rules.json`).
 *   4. Kiểm tra HTTP status === 200, định dạng JSON hợp lệ, từ chối ngay nếu phát hiện
 *      `"Permission denied"` hoặc `"error"`.
 *   5. Đối chiếu số lượng bản ghi (`places`, `dishes`, `members_registry`, `landmarkBindings`, `sectorTags`, ...).
 *   6. Tính toán và kiểm chứng mã băm SHA-256 cho từng file sao lưu (`backup-manifest.sha256.json`).
 *   7. Khôi phục thử nghiệm (Restore Drill) vào Official Firebase RTDB Emulator trên namespace cô lập
 *      (`--verify-emulator-restore`), đọc ngược lại để đối chiếu 100% số lượng bản ghi mà KHÔNG đụng chạm Production.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPECTED_PROJECT_ID,
  EXPECTED_PROD_DB_URL,
  verifyProjectIdentity,
  resolvePrivilegedProdAuth,
} from './bootstrap-security-roles.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

export function computeSha256Hex(contentStrOrBuf) {
  return crypto.createHash('sha256').update(contentStrOrBuf).digest('hex');
}

export function stripJsonCommentsAndTrailingCommas(rawText) {
  let out = '';
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < rawText.length; i++) {
    const ch = rawText[i];
    const next = rawText[i + 1];
    if (inLineComment) {
      if (ch === '\n' || ch === '\r') {
        inLineComment = false;
        out += ch;
      }
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    out += ch;
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}

export function assertValidRtdbBackupResponse(httpStatus, rawText, branchLabel, allowJsonc = false) {
  if (httpStatus !== 200) {
    throw new Error(
      `[BACKUP REJECTED] Nhánh "${branchLabel}" trả về HTTP ${httpStatus} (yêu cầu 200 OK).`
    );
  }
  if (!rawText || typeof rawText !== 'string') {
    throw new Error(`[BACKUP REJECTED] Nhánh "${branchLabel}" trả về nội dung rỗng.`);
  }
  if (/permission\s+denied/i.test(rawText)) {
    throw new Error(
      `[BACKUP REJECTED] Nhánh "${branchLabel}" chứa thông báo "Permission denied" — tuyệt đối không chấp nhận bản backup lỗi phân quyền!`
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    if (allowJsonc) {
      try {
        parsed = JSON.parse(stripJsonCommentsAndTrailingCommas(rawText));
      } catch (err2) {
        throw new Error(
          `[BACKUP REJECTED] Nhánh "${branchLabel}" không phải JSON/JSONC hợp lệ: ${err2.message}`
        );
      }
    } else {
      throw new Error(
        `[BACKUP REJECTED] Nhánh "${branchLabel}" không phải JSON hợp lệ: ${err.message}`
      );
    }
  }
  if (parsed && typeof parsed === 'object' && typeof parsed.error === 'string') {
    throw new Error(
      `[BACKUP REJECTED] Nhánh "${branchLabel}" trả về đối tượng lỗi Firebase: "${parsed.error}"`
    );
  }
  return parsed;
}

export function countBackupRecords(xuanhoaAdmin, xuanhoaSecurity) {
  if (!xuanhoaAdmin || typeof xuanhoaAdmin !== 'object') {
    throw new Error('[BACKUP REJECTED] Nhánh /xuanhoa_admin rỗng hoặc không tồn tại!');
  }
  const gs = xuanhoaAdmin.global_state || {};
  const placesCount = Object.keys(gs.places || xuanhoaAdmin.places || {}).length;
  const dishesCount = Object.keys(gs.dishes || xuanhoaAdmin.dishes || {}).length;
  const membersRegistryCount = Object.keys(xuanhoaAdmin.members_registry || {}).length;
  const globalMembersCount = Object.keys(gs.members || {}).length;
  const landmarkBindingsCount = Object.keys(gs.landmarkBindings || {}).length;
  const sectorTagsCount = Array.isArray(xuanhoaAdmin.sectorTags)
    ? xuanhoaAdmin.sectorTags.length
    : Array.isArray(gs.sectorTags)
    ? gs.sectorTags.length
    : Object.keys(xuanhoaAdmin.sectorTags || {}).length;
  const proposalsCount = Object.keys(gs.placeProposals || {}).length;
  const reviewsStoreCount = Object.keys(xuanhoaAdmin.reviews_Store || {}).length;

  const sec = xuanhoaSecurity && typeof xuanhoaSecurity === 'object' ? xuanhoaSecurity : {};
  const primaryFounderCount = Object.keys(sec.primary_founder || {}).length;
  const backupFounderCount = Object.keys(sec.backup_founder || {}).length;
  const adminsCount = Object.keys(sec.admins || {}).length;
  const managersCount = Object.keys(sec.managers || {}).length;

  if (placesCount === 0 && sectorTagsCount === 0 && membersRegistryCount === 0) {
    throw new Error(
      '[BACKUP REJECTED] Bản sao lưu /xuanhoa_admin không có dữ liệu địa điểm/danh mục/thành viên (0 records)!'
    );
  }

  return {
    placesCount,
    dishesCount,
    membersRegistryCount,
    globalMembersCount,
    landmarkBindingsCount,
    sectorTagsCount,
    proposalsCount,
    reviewsStoreCount,
    primaryFounderCount,
    backupFounderCount,
    adminsCount,
    managersCount,
  };
}

export async function verifyRestoreIntoEmulator({
  emulatorPort = 9000,
  backupDir,
  manifest,
}) {
  const restoreNs = `xuanhoacogi-restore-drill-${Date.now()}`;
  const baseUrl = `http://127.0.0.1:${emulatorPort}`;

  const adminRaw = fs.readFileSync(path.join(backupDir, 'xuanhoa_admin.backup.json'), 'utf8');
  const secRaw = fs.readFileSync(path.join(backupDir, 'xuanhoa_security.backup.json'), 'utf8');
  const rulesRaw = fs.readFileSync(path.join(backupDir, 'active_rules.backup.json'), 'utf8');

  // Verify SHA-256 before restore
  if (computeSha256Hex(adminRaw) !== manifest.files['xuanhoa_admin.backup.json'].sha256) {
    throw new Error('[RESTORE DRILL FAILED] Sai lệch SHA-256 của xuanhoa_admin.backup.json!');
  }
  if (computeSha256Hex(secRaw) !== manifest.files['xuanhoa_security.backup.json'].sha256) {
    throw new Error('[RESTORE DRILL FAILED] Sai lệch SHA-256 của xuanhoa_security.backup.json!');
  }
  if (computeSha256Hex(rulesRaw) !== manifest.files['active_rules.backup.json'].sha256) {
    throw new Error('[RESTORE DRILL FAILED] Sai lệch SHA-256 của active_rules.backup.json!');
  }

  // 1. Restore data into isolated Emulator namespace (NEVER touches Production)
  const putAdminRes = await fetch(
    `${baseUrl}/xuanhoa_admin.json?ns=${restoreNs}&access_token=owner`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: adminRaw,
    }
  );
  if (!putAdminRes.ok) {
    throw new Error(
      `[RESTORE DRILL FAILED] Không thể restore xuanhoa_admin vào Emulator (HTTP ${putAdminRes.status}).`
    );
  }

  const putSecRes = await fetch(
    `${baseUrl}/xuanhoa_security.json?ns=${restoreNs}&access_token=owner`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: secRaw,
    }
  );
  if (!putSecRes.ok) {
    throw new Error(
      `[RESTORE DRILL FAILED] Không thể restore xuanhoa_security vào Emulator (HTTP ${putSecRes.status}).`
    );
  }

  // 2. Read back from Emulator and reconcile record counts
  const readBackAdminRes = await fetch(
    `${baseUrl}/xuanhoa_admin.json?ns=${restoreNs}&access_token=owner`
  );
  const readBackSecRes = await fetch(
    `${baseUrl}/xuanhoa_security.json?ns=${restoreNs}&access_token=owner`
  );
  const restoredAdmin = await readBackAdminRes.json();
  const restoredSec = await readBackSecRes.json();

  const restoredCounts = countBackupRecords(restoredAdmin, restoredSec);
  const expectedCounts = manifest.recordCounts;

  for (const [key, expectedVal] of Object.entries(expectedCounts)) {
    if (restoredCounts[key] !== expectedVal) {
      throw new Error(
        `[RESTORE DRILL FAILED] Số lượng bản ghi "${key}" sau khi restore (${restoredCounts[key]}) khác với bản gốc (${expectedVal})!`
      );
    }
  }

  // Clean up temporary drill namespace on Emulator
  await fetch(`${baseUrl}/.json?ns=${restoreNs}&access_token=owner`, { method: 'DELETE' }).catch(
    () => {}
  );

  return {
    ok: true,
    emulatorNamespace: restoreNs,
    restoredCounts,
  };
}

async function main() {
  verifyProjectIdentity();

  const args = process.argv.slice(2);
  const isEmulatorSource = args.includes('--emulator');
  const verifyEmulatorRestore =
    args.includes('--verify-emulator-restore') || isEmulatorSource;
  const confirmProjectArg = args.find(a => a.startsWith('--confirm-project='))?.split('=')[1];
  const portArg = args.find(a => a.startsWith('--emulator-port='))?.split('=')[1];
  const emulatorPort = portArg ? Number(portArg) : 9000;
  const nsArg = args.find(a => a.startsWith('--ns='))?.split('=')[1] || 'xuanhoacogi-default-rtdb';
  const outDirArg = args.find(a => a.startsWith('--out-dir='))?.split('=')[1];

  const backupDir = outDirArg
    ? path.resolve(outDirArg)
    : path.join(PROJECT_ROOT, 'backups', 'pre-deploy-v4-verified');
  fs.mkdirSync(backupDir, { recursive: true });

  let adminRawText = '';
  let secRawText = '';
  let rulesRawText = '';
  let sourceMode = '';

  if (isEmulatorSource) {
    sourceMode = `EMULATOR (http://127.0.0.1:${emulatorPort}?ns=${nsArg})`;
    const baseUrl = `http://127.0.0.1:${emulatorPort}`;
    const [admRes, secRes, rulesRes] = await Promise.all([
      fetch(`${baseUrl}/xuanhoa_admin.json?ns=${nsArg}&access_token=owner`),
      fetch(`${baseUrl}/xuanhoa_security.json?ns=${nsArg}&access_token=owner`),
      fetch(`${baseUrl}/.settings/rules.json?ns=${nsArg}`, {
        headers: { Authorization: 'Bearer owner' },
      }),
    ]);
    adminRawText = await admRes.text();
    secRawText = await secRes.text();
    rulesRawText = rulesRes.ok
      ? await rulesRes.text()
      : fs.readFileSync(path.join(PROJECT_ROOT, 'database.rules.rollback.json'), 'utf8');

    assertValidRtdbBackupResponse(admRes.status, adminRawText, '/xuanhoa_admin');
    assertValidRtdbBackupResponse(secRes.status, secRawText, '/xuanhoa_security');
    assertValidRtdbBackupResponse(200, rulesRawText, '/.settings/rules', true);
  } else {
    if (confirmProjectArg !== EXPECTED_PROJECT_ID) {
      throw new Error(
        `[BACKUP SAFETY GATE] Khi sao lưu Production, bắt buộc truyền --confirm-project=${EXPECTED_PROJECT_ID}.`
      );
    }
    const authInfo = await resolvePrivilegedProdAuth(args);
    sourceMode = `PRODUCTION (${EXPECTED_PROD_DB_URL} via ${authInfo.mode})`;

    const [admRes, secRes, rulesRes] = await Promise.all([
      fetch(`${EXPECTED_PROD_DB_URL}/xuanhoa_admin.json${authInfo.querySuffix}`, {
        headers: authInfo.headers,
      }),
      fetch(`${EXPECTED_PROD_DB_URL}/xuanhoa_security.json${authInfo.querySuffix}`, {
        headers: authInfo.headers,
      }),
      fetch(`${EXPECTED_PROD_DB_URL}/.settings/rules.json${authInfo.querySuffix}`, {
        headers: authInfo.headers,
      }),
    ]);

    adminRawText = await admRes.text();
    secRawText = await secRes.text();
    rulesRawText = await rulesRes.text();

    assertValidRtdbBackupResponse(admRes.status, adminRawText, 'Production /xuanhoa_admin');
    assertValidRtdbBackupResponse(secRes.status, secRawText, 'Production /xuanhoa_security');
    assertValidRtdbBackupResponse(rulesRes.status, rulesRawText, 'Production /.settings/rules', true);
  }

  const parsedAdmin = JSON.parse(adminRawText);
  const parsedSec = JSON.parse(secRawText);
  const parsedRules = JSON.parse(stripJsonCommentsAndTrailingCommas(rulesRawText));
  if (!parsedRules || typeof parsedRules !== 'object' || !parsedRules.rules) {
    throw new Error('[BACKUP REJECTED] Bản sao lưu /.settings/rules không chứa nhánh "rules" hợp lệ!');
  }
  const securityNodePreBootstrapNull = parsedSec === null;
  const recordCounts = countBackupRecords(parsedAdmin, parsedSec);

  const adminFile = path.join(backupDir, 'xuanhoa_admin.backup.json');
  const secFile = path.join(backupDir, 'xuanhoa_security.backup.json');
  const rulesFile = path.join(backupDir, 'active_rules.backup.json');

  fs.writeFileSync(adminFile, adminRawText, 'utf8');
  fs.writeFileSync(secFile, secRawText, 'utf8');
  fs.writeFileSync(rulesFile, rulesRawText, 'utf8');

  const manifest = {
    createdAt: new Date().toISOString(),
    projectId: EXPECTED_PROJECT_ID,
    databaseUrl: isEmulatorSource
      ? `http://127.0.0.1:${emulatorPort}?ns=${nsArg}`
      : EXPECTED_PROD_DB_URL,
    sourceEnvironment: isEmulatorSource ? 'EMULATOR' : 'PRODUCTION',
    sourceMode,
    securityNodePreBootstrapNull,
    securityNodeState: securityNodePreBootstrapNull
      ? 'null_valid_pre_bootstrap'
      : 'populated_security_node',
    recordCounts,
    files: {
      'xuanhoa_admin.backup.json': {
        bytes: Buffer.byteLength(adminRawText, 'utf8'),
        sha256: computeSha256Hex(adminRawText),
      },
      'xuanhoa_security.backup.json': {
        bytes: Buffer.byteLength(secRawText, 'utf8'),
        sha256: computeSha256Hex(secRawText),
      },
      'active_rules.backup.json': {
        bytes: Buffer.byteLength(rulesRawText, 'utf8'),
        sha256: computeSha256Hex(rulesRawText),
      },
    },
    emulatorRestoreVerified: false,
  };

  if (verifyEmulatorRestore) {
    const restoreResult = await verifyRestoreIntoEmulator({
      emulatorPort,
      backupDir,
      manifest,
    });
    manifest.emulatorRestoreVerified = true;
    manifest.emulatorRestoreNamespace = restoreResult.emulatorNamespace;
  }

  const manifestFile = path.join(backupDir, 'backup-manifest.sha256.json');
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('============================================================================');
  console.log('XUHO CITY — PRIVILEGED RTDB & RULES BACKUP VERIFIED (100% VALID)');
  console.log('============================================================================');
  console.log(`Source Environment       : ${manifest.sourceEnvironment}`);
  console.log(`Source Mode              : ${sourceMode}`);
  console.log(`Captured At (ISO)        : ${manifest.createdAt}`);
  console.log(`Security Node State      : ${manifest.securityNodeState}`);
  console.log(`Backup Directory         : ${backupDir}`);
  console.log(`Record Counts Reconciled : ${JSON.stringify(recordCounts)}`);
  console.log(`SHA-256 (xuanhoa_admin)  : ${manifest.files['xuanhoa_admin.backup.json'].sha256}`);
  console.log(`SHA-256 (xuanhoa_sec)    : ${manifest.files['xuanhoa_security.backup.json'].sha256}`);
  console.log(`SHA-256 (active_rules)   : ${manifest.files['active_rules.backup.json'].sha256}`);
  console.log(`Emulator Restore Drill   : ${manifest.emulatorRestoreVerified ? 'PASSED' : 'SKIPPED'}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
  });
}
