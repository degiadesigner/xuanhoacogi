import {
  ManagedMember,
  MemberStatus,
  getAdminState,
  saveAdminState,
  updateMemberManagerPermissions,
  updateMemberStatusInAdmin,
  deleteMemberAndPurgeReviews,
  pushMemberToCloudRealtime,
  addAdminAuditLog,
} from './admin-store';

export type MemberRoleFilter = 'all' | 'admin' | 'web' | 'maps' | 'both' | 'member';
export type MemberStatusFilter = 'all' | 'active' | 'muted' | 'banned';
export type MemberSortOption = 'newest' | 'oldest' | 'name_asc' | 'name_desc' | 'last_active';
export type MemberPageSize = 25 | 50 | 100;

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
  isFounder: boolean;
  isAdmin: boolean;
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
  admin: number;
  web: number;
  maps: number;
  both: number;
  member: number;
  statusAll: number;
  statusActive: number;
  statusMuted: number;
  statusBanned: number;
}

export interface OperatorGroupsSummary {
  admins: IndexedMemberRecord[];
  webManagers: IndexedMemberRecord[];
  mapsManagers: IndexedMemberRecord[];
  adminTotal: number;
  webTotal: number;
  mapsTotal: number;
}

export interface MemberQueryParams {
  page: number;
  pageSize: MemberPageSize;
  roleFilter: MemberRoleFilter;
  statusFilter: MemberStatusFilter;
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

const FOUNDER_EMAILS = new Set([
  'truongtuanminh.91@gmail.com',
  'minhtt@xuanhoacogi.com',
]);

const DEFAULT_SYSTEM_ADMIN_EMAILS = new Set([
  'truongtuanminh.91@gmail.com',
  'marcel.vietnam@gmail.com',
  'admin@xuanhoacogi.com',
  'minhtt@xuanhoacogi.com',
]);

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

export function isFounderMember(memberOrEmail?: { email?: string; nickname?: string } | string | null): boolean {
  if (!memberOrEmail) return false;
  const email = (typeof memberOrEmail === 'string' ? memberOrEmail : memberOrEmail.email || '')
    .trim()
    .toLowerCase();
  if (FOUNDER_EMAILS.has(email)) return true;
  if (typeof memberOrEmail === 'object' && memberOrEmail.nickname) {
    const nick = memberOrEmail.nickname.trim().toLowerCase();
    if (nick === 'minhtt' || nick === 'minhtt (founder)') return true;
  }
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
  admin: 0,
  web: 0,
  maps: 0,
  both: 0,
  member: 0,
  statusAll: 0,
  statusActive: 0,
  statusMuted: 0,
  statusBanned: 0,
};
let cachedOperators: OperatorGroupsSummary = {
  admins: [],
  webManagers: [],
  mapsManagers: [],
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
  const adminEmailsSet = new Set<string>(DEFAULT_SYSTEM_ADMIN_EMAILS);
  for (const em of state.adminEmails || []) {
    if (em && em.includes('@')) {
      adminEmailsSet.add(em.trim().toLowerCase());
    }
  }

  if (simulatedMembersOverlay) {
    return {
      sourceMap: simulatedMembersOverlay,
      adminEmailsSet,
      stamp: `sim_${simulatedDatasetVersion}_${Object.keys(simulatedMembersOverlay).length}`,
    };
  }

  const baseMembers = state.members || {};
  const merged: Record<string, ManagedMember> = { ...baseMembers };

  // Đảm bảo Founder MinhTT và Admin hệ thống luôn có bản ghi hợp nhất trong danh mục Quản trị
  const defaultFounderEmail = 'truongtuanminh.91@gmail.com';
  if (!merged[defaultFounderEmail]) {
    merged[defaultFounderEmail] = {
      uid: `uid_${defaultFounderEmail.replace(/[^a-z0-9]/g, '_')}`,
      email: defaultFounderEmail,
      displayName: 'MinhTT',
      nickname: 'MinhTT',
      avatar: '🛡️',
      avatarId: 'm_thin',
      gender: 'male',
      residentType: 'local',
      status: 'admin',
      canManageWeb: true,
      canManageMaps: true,
      spinsCount: 100,
      level: 10,
      reviewsCount: 10,
      createdAt: 1710000000000,
      lastActiveAt: Date.now(),
    };
  }

  const secondAdminEmail = 'marcel.vietnam@gmail.com';
  if (!merged[secondAdminEmail]) {
    merged[secondAdminEmail] = {
      uid: `uid_${secondAdminEmail.replace(/[^a-z0-9]/g, '_')}`,
      email: secondAdminEmail,
      displayName: 'Admin Xuân Hòa',
      nickname: 'Admin Xuân Hòa',
      avatar: '🛡️',
      avatarId: 'm_thin',
      gender: 'male',
      residentType: 'local',
      status: 'admin',
      canManageWeb: true,
      canManageMaps: true,
      spinsCount: 50,
      level: 8,
      reviewsCount: 5,
      createdAt: 1712000000000,
      lastActiveAt: Date.now() - 3600_000,
    };
  }

  const memberCount = Object.keys(merged).length;
  const stamp = `real_${state.updatedAt || 0}_${memberCount}_${simulatedDatasetVersion}`;
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

  const list: IndexedMemberRecord[] = [];
  const byEmail = new Map<string, IndexedMemberRecord>();
  const byUid = new Map<string, IndexedMemberRecord>();

  const admins: IndexedMemberRecord[] = [];
  const webManagers: IndexedMemberRecord[] = [];
  const mapsManagers: IndexedMemberRecord[] = [];

  let bothCount = 0;
  let regularCount = 0;
  let statusActive = 0;
  let statusMuted = 0;
  let statusBanned = 0;

  for (const [rawKey, m] of Object.entries(sourceMap)) {
    if (!m || !m.email) continue;
    const email = m.email.trim().toLowerCase() || rawKey.trim().toLowerCase();
    if (!email || byEmail.has(email)) continue;

    const uid = m.uid || `uid_${email.replace(/[^a-z0-9]/g, '_')}`;
    const displayName = (m.nickname || m.displayName || email.split('@')[0]).trim();
    const isFounder = isFounderMember({ email, nickname: displayName });
    const isAdmin = isFounder || m.status === 'admin' || adminEmailsSet.has(email);

    // Nếu là Admin tối cao -> thuộc nhóm ADMIN.
    // Nhóm QUẢN LÝ WEB và QUẢN LÝ MAPS dành cho các thành viên được cấp quyền vận hành Web / Maps
    // (Một user có cả Web + Maps chỉ có 1 bản ghi duy nhất nhưng xuất hiện ở cả 2 cột QUẢN LÝ WEB và QUẢN LÝ MAPS)
    const canManageWeb = isAdmin ? true : Boolean(m.canManageWeb);
    const canManageMaps = isAdmin ? true : Boolean(m.canManageMaps);
    const isWebManager = !isAdmin && canManageWeb;
    const isMapsManager = !isAdmin && canManageMaps;
    const isBothManager = isWebManager && isMapsManager;
    const isRegularMember = !isAdmin && !isWebManager && !isMapsManager;

    const effectiveStatus: 'active' | 'muted' | 'banned' =
      isAdmin
        ? 'active'
        : m.status === 'banned'
        ? 'banned'
        : m.status === 'muted'
        ? 'muted'
        : 'active';

    if (effectiveStatus === 'active') statusActive++;
    else if (effectiveStatus === 'muted') statusMuted++;
    else if (effectiveStatus === 'banned') statusBanned++;

    const roleTokens: string[] = [];
    if (isFounder) roleTokens.push('founder', 'sang lap');
    if (isAdmin) roleTokens.push('admin', 'quan tri', 'superadmin');
    if (isWebManager) roleTokens.push('ql web', 'quan ly web', 'web', 'quan ly quan');
    if (isMapsManager) roleTokens.push('ql maps', 'quan ly maps', 'maps', 'ban do');
    if (isBothManager) roleTokens.push('web maps', 'kiem nhiem');
    if (isRegularMember) roleTokens.push('thanh vien', 'member');

    const normName = stripVnAccents(displayName);
    const searchHaystack = `${displayName.toLowerCase()} ${normName} ${email} ${uid.toLowerCase()} ${
      m.phone || ''
    } ${roleTokens.join(' ')}`;

    const record: IndexedMemberRecord = {
      uid,
      email,
      displayName,
      nickname: m.nickname || displayName,
      shortEmail: formatShortEmail(email, 16),
      initials: computeAvatarInitials(displayName, email),
      avatar: m.avatar || '🐭',
      phone: m.phone || '',
      residentType: m.residentType || 'student_sp2',
      status: isAdmin ? 'admin' : m.status || 'active',
      effectiveStatus,
      isFounder,
      isAdmin,
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

    if (isAdmin) {
      admins.push(record);
    } else {
      if (isWebManager) webManagers.push(record);
      if (isMapsManager) mapsManagers.push(record);
      if (isBothManager) bothCount++;
      if (isRegularMember) regularCount++;
    }
  }

  // Sắp xếp Founder lên đầu cột ADMIN, tiếp theo theo tên
  admins.sort((a, b) => {
    if (a.isFounder !== b.isFounder) return a.isFounder ? -1 : 1;
    return a.displayName.localeCompare(b.displayName, 'vi');
  });
  webManagers.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  mapsManagers.sort((a, b) => b.lastActiveAt - a.lastActiveAt);

  // Mặc định sắp xếp danh sách tổng theo thời gian tham gia mới nhất
  list.sort((a, b) => b.createdAt - a.createdAt);

  cachedIndexedAll = list;
  cachedByEmail = byEmail;
  cachedByUid = byUid;
  cachedUnifiedCounts = {
    all: list.length,
    admin: admins.length,
    web: webManagers.length,
    maps: mapsManagers.length,
    both: bothCount,
    member: regularCount,
    statusAll: list.length,
    statusActive,
    statusMuted,
    statusBanned,
  };
  cachedOperators = {
    admins,
    webManagers,
    mapsManagers,
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
  const sortBy: MemberSortOption = params.sortBy || 'newest';
  const rawSearch = (params.search || '').trim().toLowerCase();
  const normSearch = rawSearch ? stripVnAccents(rawSearch) : '';

  const cacheKey = `${cachedIndexStamp}|${roleFilter}|${statusFilter}|${sortBy}|${rawSearch}|${params.page}|${pageSize}`;
  const cachedResult = pageSliceCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // 1. Chọn tập nguồn theo roleFilter từ index đã phân loại sẵn
  let roleFiltered: IndexedMemberRecord[];
  switch (roleFilter) {
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

  // 2. Lọc theo statusFilter và search token
  let filtered = roleFiltered;
  if (statusFilter !== 'all' || rawSearch) {
    const tokens = normSearch ? normSearch.split(/\s+/).filter(Boolean) : [];
    filtered = roleFiltered.filter(item => {
      if (statusFilter !== 'all' && item.effectiveStatus !== statusFilter) {
        return false;
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
// Bảo vệ tuyệt đối quyền Founder / SuperAdmin
// ============================================================================
export function updateMemberPermissionsUnified(
  emailKey: string,
  patch: { canManageWeb: boolean; canManageMaps: boolean }
): { ok: boolean; message: string; updated?: IndexedMemberRecord | null } {
  const cleanEmail = emailKey.trim().toLowerCase();
  const existing = getIndexedMemberByKey(cleanEmail);
  if (!existing) {
    return { ok: false, message: 'Không tìm thấy thành viên này.' };
  }

  if (existing.isFounder) {
    return {
      ok: false,
      message: 'Tài khoản Founder (Sáng lập) có toàn quyền mặc định, không thể hạ quyền.',
    };
  }

  if (simulatedMembersOverlay && simulatedMembersOverlay[cleanEmail]) {
    simulatedMembersOverlay[cleanEmail] = {
      ...simulatedMembersOverlay[cleanEmail],
      canManageWeb: patch.canManageWeb,
      canManageMaps: patch.canManageMaps,
      lastActiveAt: Date.now(),
    };
    simulatedDatasetVersion += 1;
    invalidateMemberIndexCache();
  } else {
    updateMemberManagerPermissions(cleanEmail, {
      canManageWeb: patch.canManageWeb,
      canManageMaps: patch.canManageMaps,
    });
    invalidateMemberIndexCache();
  }

  const updated = getIndexedMemberByKey(cleanEmail);
  const roleParts: string[] = [];
  if (patch.canManageWeb) roleParts.push('Quản lý Web');
  if (patch.canManageMaps) roleParts.push('Quản lý Maps');
  const msg =
    roleParts.length > 0
      ? `Đã cấp quyền ${roleParts.join(' + ')} cho ${existing.displayName}`
      : `Đã gỡ quyền Quản lý của ${existing.displayName}`;

  return { ok: true, message: msg, updated };
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
  if (existing.isFounder || existing.isAdmin) {
    return {
      ok: false,
      message: 'Không thể tắt tiếng hoặc khóa tài khoản Admin / Founder.',
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
    updateMemberStatusInAdmin(cleanEmail, nextStatus);
    invalidateMemberIndexCache();
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
  if (existing.isFounder || existing.isAdmin) {
    return {
      ok: false,
      message: 'Không thể xóa tài khoản Admin / Founder.',
    };
  }

  if (simulatedMembersOverlay && simulatedMembersOverlay[cleanEmail]) {
    delete simulatedMembersOverlay[cleanEmail];
    simulatedDatasetVersion += 1;
    invalidateMemberIndexCache();
  } else {
    deleteMemberAndPurgeReviews(cleanEmail);
    invalidateMemberIndexCache();
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
        target.canManageWeb = action.canManageWeb;
        target.canManageMaps = action.canManageMaps;
        target.lastActiveAt = Date.now();
        pushMemberToCloudRealtime(target, true);
        updatedCount++;
      } else if (action.type === 'revoke_roles') {
        target.canManageWeb = false;
        target.canManageMaps = false;
        target.lastActiveAt = Date.now();
        pushMemberToCloudRealtime(target, true);
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
    updateMemberStatusUnified,
    deleteMemberUnified,
    bulkUpdateMembersUnified,
  };
}
