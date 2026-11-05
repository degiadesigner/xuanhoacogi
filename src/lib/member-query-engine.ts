import {
  ManagedMember,
  MemberStatus,
  SystemRoleTier,
  AccountIdentityStatus,
  PendingRoleAssignmentRecord,
  PendingRoleTargetType,
  PRIMARY_FOUNDER_EMAIL,
  PRIMARY_FOUNDER_DISPLAY_NAME,
  getAdminState,
  getSecurityState,
  isVerifiedFirebaseAuthUid,
  isUidPrimaryFounder,
  isUidActiveBackupFounder,
  isUidDisabledBackupFounder,
  isUidOperationalAdmin,
  isUidOperationalManager,
  isUidLocked,
  resolveMemberIdentityState,
  getPendingRoleAssignmentForMember,
  saveOrQueueMemberRoleAssignment,
  cancelPendingRoleAssignment,
  grantOrRevokeAdminRole,
  saveAdminState,
  updateMemberManagerPermissions,
  updateMemberStatusInAdmin,
  deleteMemberAndPurgeReviews,
  pushMemberToCloudRealtime,
  addAdminAuditLog,
} from './admin-store';

export type MemberRoleFilter = 'all' | 'founder' | 'admin' | 'web' | 'maps' | 'both' | 'member';
export type MemberStatusFilter = 'all' | 'active' | 'muted' | 'banned';
export type MemberVerificationFilter =
  | 'all'
  | 'verified'
  | 'pending_verification'
  | 'pending_role_activation'
  | 'conflict';
export type MemberSortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'last_active';
export type MemberPageSize = 25 | 50 | 100;
export type UidVerificationClass = 'verified_28char' | 'google_sub_21digit' | 'synthetic_uid';

export interface IndexedMemberRecord {
  uid: string;
  email: string;
  displayName: string;
  nickname: string;
  shortEmail: string;
  initials: string;
  avatar: string;
  phone: string;
  residentType: string;
  status: MemberStatus;
  effectiveStatus: 'active' | 'muted' | 'banned';
  roleTier: SystemRoleTier;
  isPrimaryFounder: boolean;
  isBackupFounder: boolean;
  isFounder: boolean;
  isAdmin: boolean;
  isUidVerified: boolean;
  uidVerificationClass: UidVerificationClass;
  identityStatus: AccountIdentityStatus;
  legacyUid: string;
  googleSub: string | null;
  conflictReason: string | null;
  pendingRoleAssignment: PendingRoleAssignmentRecord | null;
  hasLegacyPendingRole: boolean;
  canManageWeb: boolean;
  canManageMaps: boolean;
  isWebManager: boolean;
  isMapsManager: boolean;
  isBothManager: boolean;
  isRegularMember: boolean;
  createdAt: number;
  lastActiveAt: number;
  spinsCount: number;
  level: number;
  reviewsCount: number;
  /** Pre-normalized lowercase search string (accents stripped + raw) */
  searchHaystack: string;
  /** Collator-friendly normalized name for fast sorting */
  sortNameKey: string;
  rawMember: ManagedMember;
}

export interface UnifiedMemberCounts {
  all: number;
  founder: number;
  admin: number;
  web: number;
  maps: number;
  both: number;
  member: number;
  statusAll: number;
  statusActive: number;
  statusMuted: number;
  statusBanned: number;
  verifiedCount: number;
  pendingVerificationCount: number;
  pendingRoleActivationCount: number;
  conflictCount: number;
}

export interface OperatorGroupsSummary {
  founders: IndexedMemberRecord[];
  admins: IndexedMemberRecord[];
  webManagers: IndexedMemberRecord[];
  mapsManagers: IndexedMemberRecord[];
  founderTotal: number;
  adminTotal: number;
  webTotal: number;
  mapsTotal: number;
}

export interface MemberQueryParams {
  page: number;
  pageSize: MemberPageSize;
  roleFilter: MemberRoleFilter;
  statusFilter: MemberStatusFilter;
  verificationFilter?: MemberVerificationFilter;
  search: string;
  sortBy: MemberSortOption;
}

export interface MemberQueryResult {
  items: IndexedMemberRecord[];
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: MemberPageSize;
  startIndex: number;
  endIndex: number;
  counts: UnifiedMemberCounts;
  operators: OperatorGroupsSummary;
  recentMembers: IndexedMemberRecord[];
  queryTimeMs: number;
}

const PRIMARY_FOUNDER_EMAILS = new Set([
  PRIMARY_FOUNDER_EMAIL,
]);

const DEFAULT_SYSTEM_ADMIN_EMAILS = new Set([
  PRIMARY_FOUNDER_EMAIL,
]);

export function classifyMemberUid(uid?: string | null): UidVerificationClass {
  const clean = String(uid || '').trim();
  if (isVerifiedFirebaseAuthUid(clean)) return 'verified_28char';
  if (/^[0-9]{20,22}$/.test(clean)) return 'google_sub_21digit';
  return 'synthetic_uid';
}

export function stripVnAccents(str?: string | null): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

export function computeAvatarInitials(name?: string | null, email?: string | null): string {
  const clean = (name || '').trim();
  if (clean) {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0][0] || '';
      const last = parts[parts.length - 1][0] || '';
      return `${first}${last}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase();
  }
  const cleanEmail = (email || '').trim();
  return cleanEmail.slice(0, 2).toUpperCase() || 'TV';
}

export function formatShortEmail(email?: string | null, maxLocalLen = 14): string {
  const clean = (email || '').trim().toLowerCase();
  const atIdx = clean.indexOf('@');
  if (atIdx <= 0) return clean;
  const local = clean.slice(0, atIdx);
  const domain = clean.slice(atIdx);
  if (local.length <= maxLocalLen) return clean;
  return `${local.slice(0, maxLocalLen - 2)}…${domain}`;
}

export function formatShortDateVi(timestamp?: number | null): string {
  if (!timestamp || !Number.isFinite(timestamp)) return '—';
  const d = new Date(timestamp);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export function isFounderMember(
  memberOrEmail?: { email?: string; nickname?: string; uid?: string; roleTier?: SystemRoleTier } | string | null
): boolean {
  if (!memberOrEmail) return false;
  if (typeof memberOrEmail === 'object') {
    if (
      memberOrEmail.roleTier === 'primary_founder' ||
      memberOrEmail.roleTier === 'backup_founder'
    ) {
      return true;
    }
    if (
      memberOrEmail.uid &&
      (isUidPrimaryFounder(memberOrEmail.uid) || isUidActiveBackupFounder(memberOrEmail.uid))
    ) {
      return true;
    }
  }
  const email = (typeof memberOrEmail === 'string' ? memberOrEmail : memberOrEmail.email || '')
    .trim()
    .toLowerCase();
  if (PRIMARY_FOUNDER_EMAILS.has(email)) return true;
  return false;
}

// ============================================================================
// IN-MEMORY SIMULATION DATASET OVERLAY (100 / 2.000 / 10.000+ USERS)
// Không ghi đè hay đẩy dữ liệu giả lập lên Firebase RTDB thật
// ============================================================================
let simulatedMembersOverlay: Record<string, ManagedMember> | null = null;
let simulatedDatasetVersion = 0;

export function getSimulatedMembersCount(): number {
  return simulatedMembersOverlay ? Object.keys(simulatedMembersOverlay).length : 0;
}

const VN_LAST_NAMES = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng',
  'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Đinh', 'Đoàn', 'Lương', 'Trương',
];
const VN_MIDDLE_NAMES = [
  'Văn', 'Thị', 'Đức', 'Minh', 'Hoàng', 'Ngọc', 'Quốc', 'Thanh', 'Phương', 'Gia',
  'Tuấn', 'Hữu', 'Khánh', 'Bảo', 'Thùy', 'Hải', 'Xuân', 'Thu', 'Anh', 'Đình',
];
const VN_FIRST_NAMES = [
  'An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Giang', 'Hà', 'Hải', 'Hiếu', 'Hoàng',
  'Hùng', 'Hương', 'Huyền', 'Khánh', 'Khoa', 'Linh', 'Long', 'Mai', 'Minh', 'Nam',
  'Nga', 'Ngọc', 'Nhung', 'Oanh', 'Phúc', 'Phương', 'Quân', 'Quang', 'Quỳnh', 'Sơn',
  'Tâm', 'Tân', 'Thảo', 'Thắng', 'Thanh', 'Thịnh', 'Thu', 'Thủy', 'Toàn', 'Trang',
  'Trinh', 'Trung', 'Tú', 'Tuấn', 'Tùng', 'Uyên', 'Vân', 'Việt', 'Vinh', 'Yến',
];

export function setSimulatedMembersDataset(totalCount: number | null): {
  totalGenerated: number;
  counts: UnifiedMemberCounts;
} {
  if (!totalCount || totalCount <= 0) {
    simulatedMembersOverlay = null;
    simulatedDatasetVersion += 1;
    invalidateMemberIndexCache();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('xuanhoa-member-sim-change'));
    }
    const res = queryMembersPage({
      page: 1,
      pageSize: 50,
      roleFilter: 'all',
      statusFilter: 'all',
      search: '',
      sortBy: 'newest',
    });
    return { totalGenerated: 0, counts: res.counts };
  }

  const now = Date.now();
  const dayMs = 86_400_000;
  const map: Record<string, ManagedMember> = {};

  // 1. Admins (3 người: MinhTT Founder + 2 Admins)
  const adminSeeds: Array<{ email: string; name: string; createdOffsetDays: number }> = [
    { email: 'truongtuanminh.91@gmail.com', name: 'MinhTT', createdOffsetDays: 365 },
    { email: 'marcel.vietnam@gmail.com', name: 'Marcel Admin', createdOffsetDays: 340 },
    { email: 'bqt.xuanhoa.phutho@gmail.com', name: 'Quản Trị Xuân Hòa', createdOffsetDays: 300 },
  ];
  for (const adm of adminSeeds) {
    map[adm.email] = {
      uid: `uid_${adm.email.replace(/[^a-z0-9]/g, '_')}`,
      email: adm.email,
      displayName: adm.name,
      nickname: adm.name,
      avatar: '🛡️',
      avatarId: 'm_thin',
      gender: 'male',
      residentType: 'local',
      status: 'admin',
      canManageWeb: true,
      canManageMaps: true,
      spinsCount: 120,
      level: 10,
      reviewsCount: 15,
      createdAt: now - adm.createdOffsetDays * dayMs,
      lastActiveAt: now - 300_000,
    };
  }

  // 2. Managers:
  // - User A: Web only (canManageWeb: true, canManageMaps: false)
  // - User B: Maps only (canManageWeb: false, canManageMaps: true)
  // - User C: Web + Maps (canManageWeb: true, canManageMaps: true) -> 1 record duy nhất, xuất hiện ở cả 2 nhóm UI!
  // Cùng các Quản lý Web & Maps khác để đạt chuẩn (VD: 8 QL Web, 5 QL Maps trong đó có 2 người kiêm nhiệm cả Web + Maps)
  const managerSeeds: Array<{
    email: string;
    name: string;
    web: boolean;
    maps: boolean;
    offsetDays: number;
  }> = [
    {
      email: 'user.a.qlweb@gmail.com',
      name: 'Nguyễn Văn A (Web)',
      web: true,
      maps: false,
      offsetDays: 180,
    },
    {
      email: 'user.b.qlmaps@gmail.com',
      name: 'Trần Thị B (Maps)',
      web: false,
      maps: true,
      offsetDays: 175,
    },
    {
      email: 'user.c.webmaps@gmail.com',
      name: 'Lê Hoàng C (Web + Maps)',
      web: true,
      maps: true,
      offsetDays: 170,
    },
    {
      email: 'pham.huong.webmaps@gmail.com',
      name: 'Phạm Thu Hương',
      web: true,
      maps: true,
      offsetDays: 160,
    },
    {
      email: 'hoang.duc.qlweb@gmail.com',
      name: 'Hoàng Minh Đức',
      web: true,
      maps: false,
      offsetDays: 150,
    },
    {
      email: 'vu.tuan.qlweb@gmail.com',
      name: 'Vũ Anh Tuấn',
      web: true,
      maps: false,
      offsetDays: 145,
    },
    {
      email: 'dang.linh.qlweb@gmail.com',
      name: 'Đặng Thùy Linh',
      web: true,
      maps: false,
      offsetDays: 140,
    },
    {
      email: 'bui.son.qlweb@gmail.com',
      name: 'Bùi Thái Sơn',
      web: true,
      maps: false,
      offsetDays: 135,
    },
    {
      email: 'do.quang.qlweb@gmail.com',
      name: 'Đỗ Nhật Quang',
      web: true,
      maps: false,
      offsetDays: 130,
    },
    {
      email: 'ngo.hai.qlmaps@gmail.com',
      name: 'Ngô Thanh Hải',
      web: false,
      maps: true,
      offsetDays: 125,
    },
    {
      email: 'duong.khanh.qlmaps@gmail.com',
      name: 'Dương Quốc Khánh',
      web: false,
      maps: true,
      offsetDays: 120,
    },
  ];

  for (const mgr of managerSeeds) {
    if (Object.keys(map).length >= totalCount) break;
    map[mgr.email] = {
      uid: `uid_${mgr.email.replace(/[^a-z0-9]/g, '_')}`,
      email: mgr.email,
      displayName: mgr.name,
      nickname: mgr.name,
      avatar: '🐭',
      avatarId: 'm_ty',
      gender: 'male',
      residentType: 'student_sp2',
      status: 'active',
      canManageWeb: mgr.web,
      canManageMaps: mgr.maps,
      spinsCount: 45,
      level: 5,
      reviewsCount: 6,
      createdAt: now - mgr.offsetDays * dayMs,
      lastActiveAt: now - mgr.offsetDays * 3600_000,
    };
  }

  // 3. Regular Members (sinh đủ totalCount người)
  const existingCount = Object.keys(map).length;
  const remaining = Math.max(0, totalCount - existingCount);

  for (let i = 1; i <= remaining; i++) {
    const last = VN_LAST_NAMES[i % VN_LAST_NAMES.length];
    const mid = VN_MIDDLE_NAMES[(i * 3 + Math.floor(i / 20)) % VN_MIDDLE_NAMES.length];
    const first = VN_FIRST_NAMES[(i * 7 + Math.floor(i / 10)) % VN_FIRST_NAMES.length];
    const fullName = `${last} ${mid} ${first}`;
    const slugFirst = stripVnAccents(first).replace(/\s+/g, '');
    const slugLast = stripVnAccents(last).replace(/\s+/g, '');
    const slugMid = stripVnAccents(mid).replace(/\s+/g, '');
    const padded = String(i).padStart(4, '0');
    const email = `${slugFirst}.${slugLast}${slugMid}.${padded}@gmail.com`;

    const status: MemberStatus =
      i % 47 === 0 ? 'banned' : i % 29 === 0 ? 'muted' : 'active';

    const createdAt = now - ((i * 17) % 180) * dayMs - (i % 86400) * 1000;
    const lastActiveAt = createdAt + ((i * 13) % 7) * dayMs;

    map[email] = {
      uid: `uid_${email.replace(/[^a-z0-9]/g, '_')}`,
      email,
      displayName: fullName,
      nickname: fullName,
      avatar: '🐭',
      avatarId: 'm_ty',
      gender: i % 2 === 0 ? 'female' : 'male',
      phone: `09${String((10000000 + i * 7919) % 90000000 + 10000000)}`,
      residentType: i % 3 === 0 ? 'local' : 'student_sp2',
      status,
      canManageWeb: false,
      canManageMaps: false,
      spinsCount: (i * 5) % 80,
      level: ((i * 3) % 8) + 1,
      reviewsCount: i % 9,
      createdAt,
      lastActiveAt,
    };
  }

  simulatedMembersOverlay = map;
  simulatedDatasetVersion += 1;
  invalidateMemberIndexCache();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('xuanhoa-member-sim-change'));
  }

  const res = queryMembersPage({
    page: 1,
    pageSize: 50,
    roleFilter: 'all',
    statusFilter: 'all',
    search: '',
    sortBy: 'newest',
  });
  return {
    totalGenerated: Object.keys(map).length,
    counts: res.counts,
  };
}

// ============================================================================
// INDEX CACHE & FAST QUERY ENGINE
// ============================================================================
let cachedIndexStamp = '';
let cachedIndexedAll: IndexedMemberRecord[] = [];
let cachedByEmail = new Map<string, IndexedMemberRecord>();
let cachedByUid = new Map<string, IndexedMemberRecord>();
let cachedUnifiedCounts: UnifiedMemberCounts = {
  all: 0,
  founder: 0,
  admin: 0,
  web: 0,
  maps: 0,
  both: 0,
  member: 0,
  statusAll: 0,
  statusActive: 0,
  statusMuted: 0,
  statusBanned: 0,
  verifiedCount: 0,
  pendingVerificationCount: 0,
  pendingRoleActivationCount: 0,
  conflictCount: 0,
};
let cachedOperators: OperatorGroupsSummary = {
  founders: [],
  admins: [],
  webManagers: [],
  mapsManagers: [],
  founderTotal: 0,
  adminTotal: 0,
  webTotal: 0,
  mapsTotal: 0,
};
let cachedRecentMembers: IndexedMemberRecord[] = [];

// LRU Cache cho các trang đã truy vấn
const pageSliceCache = new Map<string, MemberQueryResult>();
const MAX_PAGE_CACHE_ENTRIES = 40;

export function invalidateMemberIndexCache(): void {
  cachedIndexStamp = '';
  pageSliceCache.clear();
}

function buildEffectiveMembersSource(): {
  sourceMap: Record<string, ManagedMember>;
  adminEmailsSet: Set<string>;
  stamp: string;
} {
  const state = getAdminState();
  const sec = getSecurityState();
  const adminEmailsSet = new Set<string>(DEFAULT_SYSTEM_ADMIN_EMAILS);

  if (simulatedMembersOverlay) {
    return {
      sourceMap: simulatedMembersOverlay,
      adminEmailsSet,
      stamp: `sim_${simulatedDatasetVersion}_${Object.keys(simulatedMembersOverlay).length}`,
    };
  }

  const baseMembers = state.members || {};
  const merged: Record<string, ManagedMember> = { ...baseMembers };

  // Đảm bảo Primary Founder (Dê Già Designer — marcel.vietnam@gmail.com) luôn có mặt trong danh mục Quản trị
  const primaryFounderUid = Object.keys(sec.primary_founder || {})[0] || '';
  if (!merged[PRIMARY_FOUNDER_EMAIL]) {
    merged[PRIMARY_FOUNDER_EMAIL] = {
      uid: primaryFounderUid || '4ouY5sN8r3P6wQvX2kLm9jBcTd92',
      email: PRIMARY_FOUNDER_EMAIL,
      displayName: PRIMARY_FOUNDER_DISPLAY_NAME,
      nickname: PRIMARY_FOUNDER_DISPLAY_NAME,
      avatar: '👑',
      avatarId: 'm_thin',
      gender: 'male',
      residentType: 'local',
      status: 'admin',
      roleTier: 'primary_founder',
      canManageWeb: true,
      canManageMaps: true,
      spinsCount: 50,
      level: 10,
      reviewsCount: 5,
      createdAt: 1712000000000,
      lastActiveAt: Date.now(),
    };
  } else if (primaryFounderUid && !isVerifiedFirebaseAuthUid(merged[PRIMARY_FOUNDER_EMAIL].uid)) {
    merged[PRIMARY_FOUNDER_EMAIL] = {
      ...merged[PRIMARY_FOUNDER_EMAIL],
      uid: primaryFounderUid,
      roleTier: 'primary_founder',
      status: 'admin',
      canManageWeb: true,
      canManageMaps: true,
    };
  }

  // Đồng bộ các bản ghi Backup Founder đang active từ xuanhoa_security/backup_founder vào danh mục
  for (const [bfUid, bfVal] of Object.entries(sec.backup_founder || {})) {
    if (!isVerifiedFirebaseAuthUid(bfUid)) continue;
    const bfObj = typeof bfVal === 'object' && bfVal ? bfVal : null;
    const bfEmail = (
      bfObj?.recoveryEmail ||
      `${bfObj?.username || 'backup_founder'}@xuanhoacogi.vn`
    )
      .trim()
      .toLowerCase();
    const isAlreadyPresent = Object.values(merged).some(
      m => m && (m.uid === bfUid || m.email?.toLowerCase() === bfEmail)
    );
    if (!isAlreadyPresent && (bfVal === true || bfObj?.active === true)) {
      merged[bfEmail] = {
        uid: bfUid,
        email: bfEmail,
        displayName: bfObj?.displayName || `Backup Founder (@${bfObj?.username || 'backup'})`,
        nickname: bfObj?.displayName || `Backup Founder (@${bfObj?.username || 'backup'})`,
        avatar: '🛡️',
        avatarId: 'founder-backup',
        gender: 'other',
        residentType: 'local',
        status: 'admin',
        roleTier: 'backup_founder',
        canManageWeb: true,
        canManageMaps: true,
        createdAt: bfObj?.createdAt || Date.now(),
        lastActiveAt: bfObj?.updatedAt || Date.now(),
      };
    }
  }

  const pendingStamp = Object.entries(sec.pending_role_assignments || {})
    .map(([k, v]) => `${k}:${v?.status}:${v?.requestedRole}:v${v?.revision || 1}`)
    .join(',');
  const linksStamp = Object.entries(sec.identity_links || {})
    .map(([k, v]) => `${k}:${v?.status}:${v?.verifiedFirebaseUid || ''}`)
    .join(',');
  const secStamp = `${Object.keys(sec.primary_founder || {}).join(',')}|${Object.keys(
    sec.backup_founder || {}
  ).join(',')}|${Object.keys(sec.admins || {}).join(',')}|${Object.keys(
    sec.managers || {}
  ).join(',')}|${Object.keys(sec.locked_uids || {}).join(',')}|${pendingStamp}|${linksStamp}`;
  const memberCount = Object.keys(merged).length;
  const stamp = `real_${state.updatedAt || 0}_${memberCount}_${secStamp}_${simulatedDatasetVersion}`;
  return {
    sourceMap: merged,
    adminEmailsSet,
    stamp,
  };
}

function ensureMemberIndex(): void {
  const { sourceMap, adminEmailsSet, stamp } = buildEffectiveMembersSource();
  if (stamp === cachedIndexStamp && cachedIndexedAll.length > 0) {
    return;
  }

  const sec = getSecurityState();
  const isSimulationMode = Boolean(simulatedMembersOverlay);
  const list: IndexedMemberRecord[] = [];
  const byEmail = new Map<string, IndexedMemberRecord>();
  const byUid = new Map<string, IndexedMemberRecord>();

  const founders: IndexedMemberRecord[] = [];
  const admins: IndexedMemberRecord[] = [];
  const webManagers: IndexedMemberRecord[] = [];
  const mapsManagers: IndexedMemberRecord[] = [];

  let bothCount = 0;
  let regularCount = 0;
  let statusActive = 0;
  let statusMuted = 0;
  let statusBanned = 0;
  let verifiedCount = 0;
  let pendingVerificationCount = 0;
  let pendingRoleActivationCount = 0;
  let conflictCount = 0;

  for (const [rawKey, m] of Object.entries(sourceMap)) {
    if (!m || !m.email) continue;
    const email = m.email.trim().toLowerCase() || rawKey.trim().toLowerCase();
    if (!email || byEmail.has(email)) continue;

    const identityInfo = isSimulationMode
      ? {
          status: 'VERIFIED' as AccountIdentityStatus,
          verifiedUid: m.uid || `uid_${email.replace(/[^a-z0-9]/g, '_')}`,
          legacyUid: m.uid || `uid_${email.replace(/[^a-z0-9]/g, '_')}`,
          googleSub: null,
          conflictReason: null,
        }
      : resolveMemberIdentityState(m, sec, sourceMap);

    const uid =
      identityInfo.verifiedUid ||
      m.uid ||
      `uid_${email.replace(/[^a-z0-9]/g, '_')}`;
    const displayName = (m.nickname || m.displayName || email.split('@')[0]).trim();
    const uidVerificationClass = classifyMemberUid(uid);
    const isUidVerified = isSimulationMode
      ? true
      : identityInfo.status === 'VERIFIED' && uidVerificationClass === 'verified_28char';
    const isDisabledBf = !isSimulationMode && isUidDisabledBackupFounder(uid);
    const isLocked = !isSimulationMode && (isUidLocked(uid) || isDisabledBf);

    const isPrimaryFounder =
      !isSimulationMode
        ? (isUidVerified && isUidPrimaryFounder(uid)) ||
          email === PRIMARY_FOUNDER_EMAIL
        : email === PRIMARY_FOUNDER_EMAIL;
    const isBackupFounder =
      !isPrimaryFounder &&
      !isLocked &&
      !isDisabledBf &&
      ((isUidVerified && isUidActiveBackupFounder(uid)) ||
        (!isUidVerified && m.roleTier === 'backup_founder'));
    const isFounder = isPrimaryFounder || isBackupFounder;

    const rawPendingRole = isSimulationMode ? null : getPendingRoleAssignmentForMember(email, sec);

    // QUY TẮC FOUNDER V2 + V6: Không tự động cấp quyền Admin/Manager hoạt động cho UID cũ chưa xác minh (21-digit Google sub hoặc uid_*)
    const wantsLegacyRole = Boolean(
      m.status === 'admin' || m.roleTier === 'admin' || m.canManageWeb || m.canManageMaps
    );

    const isOperationalAdmin =
      isFounder ||
      (!isLocked &&
        !isDisabledBf &&
        isUidVerified &&
        identityInfo.status !== 'CONFLICT' &&
        (isUidOperationalAdmin(uid) ||
          m.status === 'admin' ||
          m.roleTier === 'admin' ||
          adminEmailsSet.has(email)));

    const canManageWeb = isOperationalAdmin
      ? true
      : !isLocked &&
        !isDisabledBf &&
        isUidVerified &&
        identityInfo.status !== 'CONFLICT' &&
        Boolean(m.canManageWeb || isUidOperationalManager(uid));
    const canManageMaps = isOperationalAdmin
      ? true
      : !isLocked &&
        !isDisabledBf &&
        isUidVerified &&
        identityInfo.status !== 'CONFLICT' &&
        Boolean(m.canManageMaps || isUidOperationalManager(uid));

    const isWebManager = !isOperationalAdmin && canManageWeb;
    const isMapsManager = !isOperationalAdmin && canManageMaps;
    const isBothManager = isWebManager && isMapsManager;
    const isRegularMember = !isOperationalAdmin && !isWebManager && !isMapsManager;

    // Không bao giờ hiển thị đồng thời ACTIVE và PENDING cho cùng một quyền
    const pendingRoleAssignment =
      !isOperationalAdmin && !isWebManager && !isMapsManager ? rawPendingRole : null;
    const hasLegacyPendingRole =
      !isPrimaryFounder &&
      !isUidVerified &&
      Boolean(pendingRoleAssignment || wantsLegacyRole);

    if (identityInfo.status === 'CONFLICT') {
      conflictCount++;
    } else if (isUidVerified || isPrimaryFounder) {
      verifiedCount++;
    } else {
      pendingVerificationCount++;
    }
    if (pendingRoleAssignment) {
      pendingRoleActivationCount++;
    }

    const roleTier: SystemRoleTier = isPrimaryFounder
      ? 'primary_founder'
      : isBackupFounder
      ? 'backup_founder'
      : isOperationalAdmin
      ? 'admin'
      : isWebManager || isMapsManager
      ? 'manager'
      : 'user';

    const effectiveStatus: 'active' | 'muted' | 'banned' = isPrimaryFounder
      ? 'active'
      : isLocked || m.status === 'banned'
      ? 'banned'
      : isOperationalAdmin
      ? 'active'
      : m.status === 'muted'
      ? 'muted'
      : 'active';

    if (effectiveStatus === 'active') statusActive++;
    else if (effectiveStatus === 'muted') statusMuted++;
    else if (effectiveStatus === 'banned') statusBanned++;

    const roleTokens: string[] = [];
    if (isPrimaryFounder) roleTokens.push('primary founder', 'founder chinh', 'founder', 'sang lap');
    if (isBackupFounder) roleTokens.push('backup founder', 'founder du phong', 'founder');
    if (isOperationalAdmin) roleTokens.push('admin', 'quan tri', 'superadmin');
    if (isWebManager) roleTokens.push('ql web', 'quan ly web', 'web', 'manager');
    if (isMapsManager) roleTokens.push('ql maps', 'quan ly maps', 'maps', 'ban do', 'manager');
    if (isBothManager) roleTokens.push('web maps', 'kiem nhiem');
    if (hasLegacyPendingRole) roleTokens.push('cho xac minh uid', 'unverified uid', 'cho kich hoat');
    if (pendingRoleAssignment) {
      roleTokens.push('pending role', 'quyen cho', pendingRoleAssignment.requestedRole);
    }
    if (identityInfo.status === 'CONFLICT') {
      roleTokens.push('xung dot', 'conflict');
    }
    if (isRegularMember) roleTokens.push('thanh vien', 'member', 'user');

    const normName = stripVnAccents(displayName);
    const searchHaystack = `${displayName.toLowerCase()} ${normName} ${email} ${uid.toLowerCase()} ${identityInfo.legacyUid.toLowerCase()} ${
      m.phone || ''
    } ${roleTokens.join(' ')}`;

    const record: IndexedMemberRecord = {
      uid,
      email,
      displayName,
      nickname: m.nickname || displayName,
      shortEmail: formatShortEmail(email, 16),
      initials: computeAvatarInitials(displayName, email),
      avatar: isPrimaryFounder ? '👑' : isBackupFounder ? '🛡️' : m.avatar || '🐭',
      phone: m.phone || '',
      residentType: m.residentType || 'student_sp2',
      status: isOperationalAdmin ? 'admin' : effectiveStatus,
      effectiveStatus,
      roleTier,
      isPrimaryFounder,
      isBackupFounder,
      isFounder,
      isAdmin: isOperationalAdmin,
      isUidVerified: isUidVerified || isPrimaryFounder,
      uidVerificationClass,
      identityStatus: isPrimaryFounder ? 'VERIFIED' : identityInfo.status,
      legacyUid: identityInfo.legacyUid,
      googleSub: identityInfo.googleSub,
      conflictReason: identityInfo.conflictReason,
      pendingRoleAssignment,
      hasLegacyPendingRole,
      canManageWeb,
      canManageMaps,
      isWebManager,
      isMapsManager,
      isBothManager,
      isRegularMember,
      createdAt: m.createdAt || 1710000000000,
      lastActiveAt: m.lastActiveAt || m.createdAt || 1710000000000,
      spinsCount: m.spinsCount || 0,
      level: m.level || 1,
      reviewsCount: m.reviewsCount || 0,
      searchHaystack,
      sortNameKey: normName || email,
      rawMember: m,
    };

    list.push(record);
    byEmail.set(email, record);
    byUid.set(uid, record);

    if (isFounder) {
      founders.push(record);
    }
    if (isOperationalAdmin) {
      admins.push(record);
    } else {
      if (isWebManager) webManagers.push(record);
      if (isMapsManager) mapsManagers.push(record);
      if (isBothManager) bothCount++;
      if (isRegularMember) regularCount++;
    }
  }

  // Sắp xếp Primary Founder -> Backup Founder -> Admin theo tên
  const sortFounderPriority = (a: IndexedMemberRecord, b: IndexedMemberRecord) => {
    if (a.isPrimaryFounder !== b.isPrimaryFounder) return a.isPrimaryFounder ? -1 : 1;
    if (a.isBackupFounder !== b.isBackupFounder) return a.isBackupFounder ? -1 : 1;
    return a.displayName.localeCompare(b.displayName, 'vi');
  };
  founders.sort(sortFounderPriority);
  admins.sort(sortFounderPriority);
  webManagers.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  mapsManagers.sort((a, b) => b.lastActiveAt - a.lastActiveAt);

  // Mặc định sắp xếp danh sách tổng: Primary Founder -> Backup Founder -> Admin -> thời gian tham gia
  list.sort((a, b) => {
    if (a.isPrimaryFounder !== b.isPrimaryFounder) return a.isPrimaryFounder ? -1 : 1;
    if (a.isBackupFounder !== b.isBackupFounder) return a.isBackupFounder ? -1 : 1;
    return b.createdAt - a.createdAt;
  });

  cachedIndexedAll = list;
  cachedByEmail = byEmail;
  cachedByUid = byUid;
  cachedUnifiedCounts = {
    all: list.length,
    founder: founders.length,
    admin: admins.length,
    web: webManagers.length,
    maps: mapsManagers.length,
    both: bothCount,
    member: regularCount,
    statusAll: list.length,
    statusActive,
    statusMuted,
    statusBanned,
    verifiedCount,
    pendingVerificationCount,
    pendingRoleActivationCount,
    conflictCount,
  };
  cachedOperators = {
    founders,
    admins,
    webManagers,
    mapsManagers,
    founderTotal: founders.length,
    adminTotal: admins.length,
    webTotal: webManagers.length,
    mapsTotal: mapsManagers.length,
  };
  cachedRecentMembers = list.filter(r => r.isRegularMember).slice(0, 5);
  cachedIndexStamp = stamp;
  pageSliceCache.clear();
}

export function getIndexedMemberByKey(emailOrUid: string): IndexedMemberRecord | null {
  ensureMemberIndex();
  const clean = (emailOrUid || '').trim().toLowerCase();
  return cachedByEmail.get(clean) || cachedByUid.get(emailOrUid.trim()) || null;
}

export function queryMembersPage(params: MemberQueryParams): MemberQueryResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  ensureMemberIndex();

  const pageSize: MemberPageSize =
    params.pageSize === 25 || params.pageSize === 50 || params.pageSize === 100
      ? params.pageSize
      : 50;
  const roleFilter: MemberRoleFilter = params.roleFilter || 'all';
  const statusFilter: MemberStatusFilter = params.statusFilter || 'all';
  const verificationFilter: MemberVerificationFilter = params.verificationFilter || 'all';
  const sortBy: MemberSortOption = params.sortBy || 'newest';
  const rawSearch = (params.search || '').trim().toLowerCase();
  const normSearch = rawSearch ? stripVnAccents(rawSearch) : '';

  const cacheKey = `${cachedIndexStamp}|${roleFilter}|${statusFilter}|${verificationFilter}|${sortBy}|${rawSearch}|${params.page}|${pageSize}`;
  const cachedResult = pageSliceCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // 1. Chọn tập nguồn theo roleFilter từ index đã phân loại sẵn
  let roleFiltered: IndexedMemberRecord[];
  switch (roleFilter) {
    case 'founder':
      roleFiltered = cachedOperators.founders;
      break;
    case 'admin':
      roleFiltered = cachedOperators.admins;
      break;
    case 'web':
      roleFiltered = cachedOperators.webManagers;
      break;
    case 'maps':
      roleFiltered = cachedOperators.mapsManagers;
      break;
    case 'both':
      roleFiltered = cachedOperators.webManagers.filter(m => m.isBothManager);
      break;
    case 'member':
      roleFiltered = cachedIndexedAll.filter(m => m.isRegularMember);
      break;
    case 'all':
    default:
      roleFiltered = cachedIndexedAll;
      break;
  }

  // 2. Lọc theo statusFilter, verificationFilter và search token
  let filtered = roleFiltered;
  if (statusFilter !== 'all' || verificationFilter !== 'all' || rawSearch) {
    const tokens = normSearch ? normSearch.split(/\s+/).filter(Boolean) : [];
    filtered = roleFiltered.filter(item => {
      if (statusFilter !== 'all' && item.effectiveStatus !== statusFilter) {
        return false;
      }
      if (verificationFilter !== 'all') {
        if (verificationFilter === 'verified' && !item.isUidVerified) return false;
        if (
          verificationFilter === 'pending_verification' &&
          (item.isUidVerified || item.identityStatus === 'CONFLICT')
        ) {
          return false;
        }
        if (verificationFilter === 'pending_role_activation' && !item.pendingRoleAssignment) {
          return false;
        }
        if (verificationFilter === 'conflict' && item.identityStatus !== 'CONFLICT') {
          return false;
        }
      }
      if (!rawSearch) return true;
      if (item.searchHaystack.includes(rawSearch)) return true;
      if (tokens.length > 0 && tokens.every(tk => item.searchHaystack.includes(tk))) {
        return true;
      }
      return false;
    });
  }

  // 3. Sắp xếp
  const sorted = [...filtered];
  switch (sortBy) {
    case 'newest':
      sorted.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case 'oldest':
      sorted.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case 'name_asc':
      sorted.sort((a, b) => a.displayName.localeCompare(b.displayName, 'vi'));
      break;
    case 'name_desc':
      sorted.sort((a, b) => b.displayName.localeCompare(a.displayName, 'vi'));
      break;
    case 'last_active':
      sorted.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
      break;
  }

  // 4. Cắt trang (chỉ trả dữ liệu của trang hiện tại)
  const totalItems = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(Math.max(1, params.page || 1), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const items = sorted.slice(startIndex, endIndex);

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const result: MemberQueryResult = {
    items,
    totalItems,
    totalPages,
    currentPage,
    pageSize,
    startIndex,
    endIndex,
    counts: cachedUnifiedCounts,
    operators: cachedOperators,
    recentMembers: cachedRecentMembers,
    queryTimeMs: Number((t1 - t0).toFixed(2)),
  };

  if (pageSliceCache.size >= MAX_PAGE_CACHE_ENTRIES) {
    const oldestKey = pageSliceCache.keys().next().value;
    if (oldestKey) pageSliceCache.delete(oldestKey);
  }
  pageSliceCache.set(cacheKey, result);
  return result;
}

// ============================================================================
// MUTATION HELPERS (CẬP NHẬT TỨC THÌ TRÊN CẢ STORE THẬT VÀ DATASET GIẢ LẬP)
// Bảo vệ tuyệt đối quyền Founder / SuperAdmin + Hỗ trợ Quyền Chờ Kích Hoạt V6
// ============================================================================
export function updateMemberPermissionsUnified(
  emailKey: string,
  patch: { canManageWeb: boolean; canManageMaps: boolean; makeAdmin?: boolean }
): {
  ok: boolean;
  mode?: 'ACTIVE_IMMEDIATELY' | 'PENDING_ROLE_ACTIVATION' | 'CLEARED_TO_MEMBER';
  message: string;
  updated?: IndexedMemberRecord | null;
} {
  const cleanEmail = emailKey.trim().toLowerCase();
  const existing = getIndexedMemberByKey(cleanEmail);
  if (!existing) {
    return { ok: false, message: 'Không tìm thấy thành viên này.' };
  }

  if (existing.isFounder) {
    return {
      ok: false,
      message: 'Tài khoản Founder (Primary / Backup Founder) có toàn quyền mặc định, không thể hạ quyền qua mục Quản lý.',
    };
  }

  if (simulatedMembersOverlay && simulatedMembersOverlay[cleanEmail]) {
    const nextAdmin = patch.makeAdmin !== undefined ? patch.makeAdmin : simulatedMembersOverlay[cleanEmail].status === 'admin';
    simulatedMembersOverlay[cleanEmail] = {
      ...simulatedMembersOverlay[cleanEmail],
      status: nextAdmin ? 'admin' : 'active',
      roleTier: nextAdmin ? 'admin' : patch.canManageWeb || patch.canManageMaps ? 'manager' : 'user',
      canManageWeb: nextAdmin ? true : patch.canManageWeb,
      canManageMaps: nextAdmin ? true : patch.canManageMaps,
      lastActiveAt: Date.now(),
    };
    simulatedDatasetVersion += 1;
    invalidateMemberIndexCache();
    const updatedSim = getIndexedMemberByKey(cleanEmail);
    return {
      ok: true,
      mode: 'ACTIVE_IMMEDIATELY',
      message: nextAdmin
        ? `👑 Đã cấp quyền ADMIN cho ${existing.displayName}`
        : patch.canManageWeb || patch.canManageMaps
        ? `Đã cấp quyền Quản lý cho ${existing.displayName}`
        : `Đã thu hồi quyền của ${existing.displayName} (về Thành viên)`,
      updated: updatedSim,
    };
  }

  try {
    const makeAdmin = Boolean(patch.makeAdmin);
    const requestedRole: PendingRoleTargetType = makeAdmin
      ? 'admin'
      : patch.canManageWeb && patch.canManageMaps
      ? 'manager_both'
      : patch.canManageWeb
      ? 'manager_web'
      : patch.canManageMaps
      ? 'manager_maps'
      : 'member';

    const saveRes = saveOrQueueMemberRoleAssignment(cleanEmail, {
      requestedRole,
      canManageWeb: makeAdmin ? true : patch.canManageWeb,
      canManageMaps: makeAdmin ? true : patch.canManageMaps,
    });
    invalidateMemberIndexCache();
    const updated = getIndexedMemberByKey(cleanEmail);
    return {
      ok: true,
      mode: saveRes.mode,
      message: saveRes.message,
      updated,
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Không thể cập nhật phân quyền thành viên.',
    };
  }
}

export function cancelPendingRoleUnified(
  emailKey: string,
  reason?: string
): { ok: boolean; message: string; updated?: IndexedMemberRecord | null } {
  const cleanEmail = emailKey.trim().toLowerCase();
  try {
    const res = cancelPendingRoleAssignment(cleanEmail, reason);
    invalidateMemberIndexCache();
    return {
      ok: res.ok,
      message: res.message,
      updated: getIndexedMemberByKey(cleanEmail),
    };
  } catch (err: any) {
    return {
      ok: false,
      message: err?.message || 'Không thể hủy yêu cầu quyền chờ kích hoạt.',
    };
  }
}

export function updateMemberStatusUnified(
  emailKey: string,
  nextStatus: 'active' | 'muted' | 'banned'
): { ok: boolean; message: string } {
  const cleanEmail = emailKey.trim().toLowerCase();
  const existing = getIndexedMemberByKey(cleanEmail);
  if (!existing) {
    return { ok: false, message: 'Không tìm thấy thành viên.' };
  }
  if (existing.isPrimaryFounder) {
    return {
      ok: false,
      message: 'Tuyệt đối không thể tắt tiếng hoặc khóa tài khoản Primary Founder (Dê Già Designer).',
    };
  }
  if (existing.isBackupFounder) {
    return {
      ok: false,
      message: 'Để tạm ngưng hoặc thu hồi phiên của Backup Founder, vui lòng sử dụng bảng Quản lý Backup Founder.',
    };
  }

  if (simulatedMembersOverlay && simulatedMembersOverlay[cleanEmail]) {
    simulatedMembersOverlay[cleanEmail] = {
      ...simulatedMembersOverlay[cleanEmail],
      status: nextStatus,
      lastActiveAt: Date.now(),
    };
    simulatedDatasetVersion += 1;
    invalidateMemberIndexCache();
  } else {
    try {
      updateMemberStatusInAdmin(cleanEmail, nextStatus);
      invalidateMemberIndexCache();
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message || 'Không thể cập nhật trạng thái tài khoản.',
      };
    }
  }

  const statusText =
    nextStatus === 'active'
      ? 'Mở hoạt động'
      : nextStatus === 'muted'
      ? 'Tắt tiếng (Mute)'
      : 'Khóa tài khoản';
  return { ok: true, message: `${statusText}: ${existing.displayName}` };
}

export function deleteMemberUnified(emailKey: string): { ok: boolean; message: string } {
  const cleanEmail = emailKey.trim().toLowerCase();
  const existing = getIndexedMemberByKey(cleanEmail);
  if (!existing) {
    return { ok: false, message: 'Không tìm thấy thành viên.' };
  }
  if (existing.isPrimaryFounder || existing.isBackupFounder) {
    return {
      ok: false,
      message: 'Không thể xóa tài khoản Founder.',
    };
  }

  if (simulatedMembersOverlay && simulatedMembersOverlay[cleanEmail]) {
    delete simulatedMembersOverlay[cleanEmail];
    simulatedDatasetVersion += 1;
    invalidateMemberIndexCache();
  } else {
    try {
      deleteMemberAndPurgeReviews(cleanEmail);
      invalidateMemberIndexCache();
    } catch (err: any) {
      return {
        ok: false,
        message: err?.message || 'Không thể xóa tài khoản.',
      };
    }
  }

  return { ok: true, message: `Đã xóa thành viên ${existing.displayName}` };
}

export function createMemberUnified(payload: {
  displayName: string;
  email: string;
  canManageWeb?: boolean;
  canManageMaps?: boolean;
}): { ok: boolean; message: string; created?: IndexedMemberRecord | null } {
  const cleanName = payload.displayName.trim();
  const cleanEmail = payload.email.trim().toLowerCase();
  if (!cleanName) {
    return { ok: false, message: 'Vui lòng nhập tên thành viên.' };
  }
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { ok: false, message: 'Vui lòng nhập địa chỉ Gmail hợp lệ.' };
  }

  const now = Date.now();
  const newMember: ManagedMember = {
    uid: `uid_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`,
    email: cleanEmail,
    displayName: cleanName,
    nickname: cleanName,
    avatar: '🐭',
    avatarId: 'm_thin',
    gender: 'male',
    residentType: 'student_sp2',
    status: 'active',
    canManageWeb: Boolean(payload.canManageWeb),
    canManageMaps: Boolean(payload.canManageMaps),
    spinsCount: 0,
    level: 1,
    reviewsCount: 0,
    createdAt: now,
    lastActiveAt: now,
  };

  if (simulatedMembersOverlay) {
    simulatedMembersOverlay[cleanEmail] = newMember;
    simulatedDatasetVersion += 1;
    invalidateMemberIndexCache();
  } else {
    const state = getAdminState();
    state.members[cleanEmail] = newMember;
    state.auditLogs = addAdminAuditLog(
      state,
      'Thêm thành viên mới',
      `${cleanName} (${cleanEmail})`,
      'user'
    );
    pushMemberToCloudRealtime(newMember, true);
    saveAdminState(state);
    invalidateMemberIndexCache();
  }

  return {
    ok: true,
    message: `Đã thêm thành viên ${cleanName} (${cleanEmail})`,
    created: getIndexedMemberByKey(cleanEmail),
  };
}

export function bulkUpdateMembersUnified(
  emails: string[],
  action:
    | { type: 'grant_roles'; canManageWeb: boolean; canManageMaps: boolean }
    | { type: 'revoke_roles' }
    | { type: 'status'; status: 'active' | 'muted' | 'banned' }
    | { type: 'delete' }
): { ok: boolean; updatedCount: number; message: string } {
  ensureMemberIndex();
  const cleanEmails = Array.from(new Set(emails.map(e => e.trim().toLowerCase()).filter(Boolean)));
  if (cleanEmails.length === 0) {
    return { ok: false, updatedCount: 0, message: 'Chưa chọn thành viên nào.' };
  }

  let updatedCount = 0;

  if (simulatedMembersOverlay) {
    for (const em of cleanEmails) {
      const rec = cachedByEmail.get(em);
      const target = simulatedMembersOverlay[em];
      if (!rec || !target) continue;
      if (rec.isFounder || rec.isAdmin) continue;

      if (action.type === 'grant_roles') {
        target.canManageWeb = action.canManageWeb;
        target.canManageMaps = action.canManageMaps;
        updatedCount++;
      } else if (action.type === 'revoke_roles') {
        target.canManageWeb = false;
        target.canManageMaps = false;
        updatedCount++;
      } else if (action.type === 'status') {
        target.status = action.status;
        updatedCount++;
      } else if (action.type === 'delete') {
        delete simulatedMembersOverlay[em];
        updatedCount++;
      }
    }
    simulatedDatasetVersion += 1;
    invalidateMemberIndexCache();
  } else {
    const state = getAdminState();
    for (const em of cleanEmails) {
      const rec = cachedByEmail.get(em);
      const target = state.members[em];
      if (!rec || !target) continue;
      if (rec.isFounder || rec.isAdmin) continue;

      if (action.type === 'grant_roles') {
        const reqRole: PendingRoleTargetType =
          action.canManageWeb && action.canManageMaps
            ? 'manager_both'
            : action.canManageWeb
            ? 'manager_web'
            : action.canManageMaps
            ? 'manager_maps'
            : 'member';
        saveOrQueueMemberRoleAssignment(em, {
          requestedRole: reqRole,
          canManageWeb: action.canManageWeb,
          canManageMaps: action.canManageMaps,
        });
        updatedCount++;
      } else if (action.type === 'revoke_roles') {
        saveOrQueueMemberRoleAssignment(em, {
          requestedRole: 'member',
          canManageWeb: false,
          canManageMaps: false,
        });
        updatedCount++;
      } else if (action.type === 'status') {
        target.status = action.status;
        target.lastActiveAt = Date.now();
        pushMemberToCloudRealtime(target, true);
        updatedCount++;
      } else if (action.type === 'delete') {
        delete state.members[em];
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      state.auditLogs = addAdminAuditLog(
        state,
        `Thao tác hàng loạt (${action.type})`,
        `${updatedCount} thành viên`,
        'user'
      );
      saveAdminState(state);
    }
    invalidateMemberIndexCache();
  }

  return {
    ok: updatedCount > 0,
    updatedCount,
    message:
      updatedCount > 0
        ? `Đã cập nhật ${updatedCount} thành viên.`
        : 'Không có thành viên hợp lệ để cập nhật (Admin/Founder được bảo vệ).',
  };
}

// Gắn helper kiểm thử scale dataset vào window để phục vụ E2E & kiểm thử hiệu năng 100 / 2.000 / 10.000 users
if (typeof window !== 'undefined') {
  (window as any).__XUANHOA_MEMBER_ENGINE__ = {
    setSimulatedMembersDataset,
    getSimulatedMembersCount,
    queryMembersPage,
    getIndexedMemberByKey,
    updateMemberPermissionsUnified,
    cancelPendingRoleUnified,
    updateMemberStatusUnified,
    deleteMemberUnified,
    bulkUpdateMembersUnified,
  };
}
