#!/usr/bin/env node
/**
 * XUHO CITY — MANIFEST-LOCKED GIT STAGING & PRE-DEPLOY SAFETY VERIFIER (V2)
 * ============================================================================
 * Mục đích:
 *   Thay thế hoàn toàn `git add -A` / `git add .` bằng cơ chế khóa chặt theo
 *   `release-manifest.v2.json`:
 *     1. Reset toàn bộ Git index (`git reset`).
 *     2. Chỉ stage đúng danh sách file đã được phê duyệt trong `release-manifest.v2.json`.
 *     3. Kiểm tra `git diff --cached --name-status` và danh sách file staged:
 *        - Từ chối ngay (exit code 1) nếu có bất kỳ file nào ngoài manifest.
 *        - Từ chối ngay nếu phát hiện backup, secrets, log, file test tạm hoặc báo cáo `.md` nội bộ.
 *        - Xác minh đúng Cloudflare Workers project (`xuanhoacogi`), nhánh deploy (`main`),
 *          và Firebase project (`xuanhoacogi`).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

function runGit(args) {
  return execFileSync('git', args, {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
  }).trim();
}

function main() {
  const manifestPath = path.join(PROJECT_ROOT, 'release-manifest.v2.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`[MANIFEST LOCK FAILED] Không tìm thấy ${manifestPath}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // 1. Xác minh Cloudflare Workers, nhánh Git và Firebase project
  const wranglerJson = JSON.parse(
    fs.readFileSync(path.join(PROJECT_ROOT, 'wrangler.json'), 'utf8')
  );
  if (
    wranglerJson.name !== manifest.cloudflareWorkerName ||
    wranglerJson.assets?.directory !== manifest.cloudflareAssetsDirectory
  ) {
    throw new Error(
      `[TARGET MISMATCH] wrangler.json (${wranglerJson.name}, ${wranglerJson.assets?.directory}) không khớp manifest!`
    );
  }

  const firebaseRc = JSON.parse(
    fs.readFileSync(path.join(PROJECT_ROOT, '.firebaserc'), 'utf8')
  );
  if (firebaseRc.projects?.default !== manifest.firebaseProjectId) {
    throw new Error(
      `[TARGET MISMATCH] .firebaserc (${firebaseRc.projects?.default}) không khớp "${manifest.firebaseProjectId}"!`
    );
  }

  const currentBranch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const remoteUrl = runGit(['remote', 'get-url', 'origin']);
  if (currentBranch !== manifest.deployBranch) {
    throw new Error(
      `[BRANCH MISMATCH] Nhánh hiện tại là "${currentBranch}", yêu cầu "${manifest.deployBranch}"!`
    );
  }
  if (!remoteUrl.includes('degiadesigner/xuanhoacogi')) {
    throw new Error(`[REMOTE MISMATCH] Git origin "${remoteUrl}" không khớp dự án chính thức!`);
  }

  // 2. Xóa sạch staging index trước khi stage từng file trong manifest (TUYỆT ĐỐI KHÔNG dùng git add -A)
  runGit(['reset']);

  const approvedSet = new Set(manifest.approvedFiles);
  const filesToStage = [...manifest.approvedFiles];
  runGit(['add', '--', ...filesToStage]);

  // 3. Kiểm tra danh sách file đã stage qua git diff --cached --name-status
  const cachedStatusRaw = runGit(['diff', '--cached', '--name-status']);
  const stagedEntries = cachedStatusRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\t+/);
      return { status: parts[0], file: parts[parts.length - 1] };
    });

  const forbiddenRegexes = (manifest.forbiddenPatterns || []).map((p) => new RegExp(p, 'i'));

  const outOfScopeStaged = [];
  const forbiddenMatched = [];

  for (const item of stagedEntries) {
    if (!approvedSet.has(item.file)) {
      outOfScopeStaged.push(item.file);
    }
    for (const rx of forbiddenRegexes) {
      if (rx.test(item.file)) {
        forbiddenMatched.push(`${item.file} (matched ${rx})`);
      }
    }
  }

  // 4. Kiểm tra còn file tracked/untracked nào ngoài phạm vi chưa được xử lý hoặc chưa được .gitignore chặn
  const porcelainRaw = runGit(['status', '--porcelain']);
  const remainingUnstagedOrUntracked = porcelainRaw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .filter((line) => {
      // Index status ở cột 0, worktree status ở cột 1
      const indexStatus = line[0];
      const worktreeStatus = line[1];
      return worktreeStatus !== ' ' || indexStatus === '?';
    });

  if (outOfScopeStaged.length > 0) {
    throw new Error(
      `[MANIFEST LOCK BLOCKED] Phát hiện file ngoài danh mục được stage: ${outOfScopeStaged.join(', ')}`
    );
  }

  if (forbiddenMatched.length > 0) {
    throw new Error(
      `[MANIFEST LOCK BLOCKED] Phát hiện file bị cấm trong staging area: ${forbiddenMatched.join(', ')}`
    );
  }

  if (remainingUnstagedOrUntracked.length > 0) {
    throw new Error(
      `[MANIFEST LOCK BLOCKED] Còn thay đổi ngoài phạm vi chưa được khóa/loại trừ:\n${remainingUnstagedOrUntracked.join('\n')}`
    );
  }

  const diffStat = runGit(['diff', '--cached', '--stat']);

  console.log('============================================================================');
  console.log('XUHO CITY — RELEASE MANIFEST LOCK VERIFIED (100% CLEAN)');
  console.log('============================================================================');
  console.log(`Cloudflare Worker : ${wranglerJson.name} (assets: ${wranglerJson.assets?.directory})`);
  console.log(`Git Remote & Branch: ${remoteUrl} (${currentBranch})`);
  console.log(`Firebase Project  : ${firebaseRc.projects?.default}`);
  console.log(`Staged Files Count: ${stagedEntries.length} / ${manifest.approvedFiles.length} approved`);
  console.log(`Out-of-Scope Files: 0`);
  console.log(`Unstaged/Untracked: 0`);
  console.log('\n--- STAGED FILES (git diff --cached --name-status) ---');
  for (const e of stagedEntries) {
    console.log(`  ${e.status.padEnd(4)} ${e.file}`);
  }
  console.log('\n--- STAGED DIFF SUMMARY ---');
  console.log(diffStat);
}

main();
