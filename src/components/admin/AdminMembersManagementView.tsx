'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  Plus,
  MoreHorizontal,
  Shield,
  Check,
  X,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  UserCheck,
  VolumeX,
  Ban,
  Trash2,
  Eye,
  Edit3,
  Users,
} from 'lucide-react';
import {
  IndexedMemberRecord,
  MemberRoleFilter,
  MemberStatusFilter,
  MemberSortOption,
  MemberPageSize,
  queryMembersPage,
  getIndexedMemberByKey,
  updateMemberPermissionsUnified,
  updateMemberStatusUnified,
  deleteMemberUnified,
  createMemberUnified,
  bulkUpdateMembersUnified,
  formatShortDateVi,
  getSimulatedMembersCount,
  setSimulatedMembersDataset,
} from '@/lib/member-query-engine';
import type { AdminAccount } from '@/lib/admin-store';

export interface AdminMembersThemeTokens {
  bgMain: string;
  bgSidebar: string;
  bgCard: string;
  bgElevated: string;
  bgInput: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  border: string;
  shadow: string;
}

interface AdminMembersManagementViewProps {
  theme: AdminMembersThemeTokens;
  refreshTick: number;
  adminAccounts: AdminAccount[];
  onRefresh: () => void;
  onShowToast: (msg: string, kind?: 'success' | 'warn' | 'approve') => void;
  onOpenNewAdminAccModal: () => void;
  onEditAdminAccModal: (acc: AdminAccount) => void;
  onDeleteAdminAcc: (acc: AdminAccount) => void;
}

// ============================================================================
// ROLE CHIP COMPONENT (22-24px height, compact, minimal)
// ============================================================================
const RoleBadgeChip: React.FC<{
  type: 'founder' | 'admin' | 'web' | 'maps';
}> = React.memo(function RoleBadgeChip({ type }) {
  const styles: Record<
    'founder' | 'admin' | 'web' | 'maps',
    { label: string; bg: string; color: string; border: string }
  > = {
    founder: {
      label: 'Founder',
      bg: '#FEF3C7',
      color: '#92400E',
      border: '#F59E0B',
    },
    admin: {
      label: 'Admin',
      bg: '#FEE2E2',
      color: '#991B1B',
      border: '#FCA5A5',
    },
    web: {
      label: 'Web',
      bg: '#DBEAFE',
      color: '#1E40AF',
      border: '#93C5FD',
    },
    maps: {
      label: 'Maps',
      bg: '#D1FAE5',
      color: '#065F46',
      border: '#6EE7B7',
    },
  };
  const st = styles[type];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: '22px',
        padding: '0 7px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
        lineHeight: 1,
        background: st.bg,
        color: st.color,
        border: `1px solid ${st.border}`,
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
      }}
    >
      {st.label}
    </span>
  );
});

// ============================================================================
// STATUS DOT BADGE (● Hoạt động | ● Tắt tiếng | ● Bị khóa)
// ============================================================================
const StatusDotBadge: React.FC<{
  status: 'active' | 'muted' | 'banned';
}> = React.memo(function StatusDotBadge({ status }) {
  const cfg =
    status === 'banned'
      ? { label: 'Bị khóa', dot: '#EF4444', text: '#B91C1C', bg: 'rgba(239, 68, 68, 0.08)' }
      : status === 'muted'
      ? { label: 'Tắt tiếng', dot: '#F59E0B', text: '#B45309', bg: 'rgba(245, 158, 11, 0.1)' }
      : { label: 'Hoạt động', dot: '#10B981', text: '#047857', bg: 'rgba(16, 185, 129, 0.08)' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        height: '24px',
        padding: '0 8px',
        borderRadius: '999px',
        background: cfg.bg,
        color: cfg.text,
        fontSize: '11.5px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      <span>{cfg.label}</span>
    </span>
  );
});

// ============================================================================
// MEMOIZED DESKTOP TABLE ROW (48-52px height, stable key = member.uid)
// ============================================================================
interface MemberTableRowProps {
  member: IndexedMemberRecord;
  isSelected: boolean;
  isMenuOpen: boolean;
  theme: AdminMembersThemeTokens;
  onToggleSelect: (email: string) => void;
  onOpenPermissionModal: (member: IndexedMemberRecord) => void;
  onOpenDetailModal: (member: IndexedMemberRecord) => void;
  onToggleMenu: (uid: string, e: React.MouseEvent) => void;
  onChangeStatus: (member: IndexedMemberRecord, nextStatus: 'active' | 'muted' | 'banned') => void;
  onDeleteMember: (member: IndexedMemberRecord) => void;
}

const MemberTableRow = React.memo<MemberTableRowProps>(
  function MemberTableRow({
    member,
    isSelected,
    isMenuOpen,
    theme,
    onToggleSelect,
    onOpenPermissionModal,
    onOpenDetailModal,
    onToggleMenu,
    onChangeStatus,
    onDeleteMember,
  }) {
    const joinedDate = formatShortDateVi(member.createdAt);
    const hasAnyRole = member.isFounder || member.isAdmin || member.isWebManager || member.isMapsManager;

    return (
      <tr
        data-member-uid={member.uid}
        data-member-email={member.email}
        style={{
          height: '50px',
          borderBottom: `1px solid ${theme.border}`,
          background: isSelected ? theme.accentSoft : 'transparent',
          transition: 'background-color 0.12s ease',
        }}
      >
        {/* 1. Checkbox */}
        <td style={{ width: '38px', padding: '0 8px 0 12px', textAlign: 'center' }}>
          <input
            type="checkbox"
            checked={isSelected}
            disabled={member.isFounder}
            onChange={() => onToggleSelect(member.email)}
            aria-label={`Chọn ${member.displayName}`}
            style={{
              width: '15px',
              height: '15px',
              cursor: member.isFounder ? 'not-allowed' : 'pointer',
              accentColor: theme.accent,
            }}
          />
        </td>

        {/* 2. Thành viên (Tên 13px semibold + Email 11px muted) */}
        <td style={{ padding: '6px 12px', minWidth: '210px', maxWidth: '320px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: member.isAdmin ? '#FEF3C7' : theme.bgInput,
                color: member.isAdmin ? '#92400E' : theme.textSecondary,
                border: `1px solid ${member.isAdmin ? '#FCD34D' : theme.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10.5px',
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {member.initials}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                onClick={() => onOpenDetailModal(member)}
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: theme.textPrimary,
                  lineHeight: '17px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  cursor: 'pointer',
                }}
                title={`${member.displayName} (${member.email})`}
              >
                {member.displayName}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: theme.textMuted,
                  lineHeight: '14px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={member.email}
              >
                {member.email}
              </div>
            </div>
          </div>
        </td>

        {/* 3. Quyền (Click để mở popover/modal cấp quyền) */}
        <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
          <button
            type="button"
            onClick={() => onOpenPermissionModal(member)}
            title={
              member.isFounder
                ? 'Founder có toàn quyền hệ thống'
                : 'Bấm để chỉnh quyền Quản lý Web / Maps'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '2px 6px',
              marginLeft: '-6px',
              borderRadius: '6px',
              border: '1px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            {hasAnyRole ? (
              <>
                {member.isFounder && <RoleBadgeChip type="founder" />}
                {member.isAdmin && <RoleBadgeChip type="admin" />}
                {!member.isAdmin && member.isWebManager && <RoleBadgeChip type="web" />}
                {!member.isAdmin && member.isMapsManager && <RoleBadgeChip type="maps" />}
              </>
            ) : (
              <span
                style={{
                  fontSize: '12.5px',
                  color: theme.textMuted,
                  fontWeight: 500,
                  padding: '0 4px',
                }}
              >
                —
              </span>
            )}
          </button>
        </td>

        {/* 4. Trạng thái */}
        <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
          <StatusDotBadge status={member.effectiveStatus} />
        </td>

        {/* 5. Tham gia */}
        <td
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            color: theme.textSecondary,
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          {joinedDate}
        </td>

        {/* 6. Menu ⋯ */}
        <td style={{ width: '48px', padding: '6px 12px 6px 6px', textAlign: 'right', position: 'relative' }}>
          <button
            type="button"
            data-action-menu-btn={member.uid}
            onClick={e => onToggleMenu(member.uid, e)}
            aria-label={`Thao tác với ${member.displayName}`}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              border: `1px solid ${isMenuOpen ? theme.accent : 'transparent'}`,
              background: isMenuOpen ? theme.accentSoft : 'transparent',
              color: theme.textSecondary,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <MoreHorizontal size={16} />
          </button>

          {isMenuOpen && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute',
                right: '12px',
                top: '42px',
                zIndex: 80,
                width: '172px',
                background: theme.bgCard,
                border: `1px solid ${theme.border}`,
                borderRadius: '10px',
                boxShadow: '0 10px 28px rgba(15, 23, 42, 0.14)',
                padding: '5px',
                textAlign: 'left',
              }}
            >
              <button
                type="button"
                onClick={() => onOpenDetailModal(member)}
                style={menuItemBtnStyle(theme)}
              >
                <Eye size={13} />
                <span>Xem thông tin</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenPermissionModal(member)}
                style={menuItemBtnStyle(theme)}
              >
                <Shield size={13} />
                <span>Cấp quyền</span>
              </button>

              {!member.isFounder && !member.isAdmin && (
                <>
                  {member.effectiveStatus === 'muted' ? (
                    <button
                      type="button"
                      onClick={() => onChangeStatus(member, 'active')}
                      style={menuItemBtnStyle(theme)}
                    >
                      <UserCheck size={13} />
                      <span>Bỏ tắt tiếng</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onChangeStatus(member, 'muted')}
                      style={menuItemBtnStyle(theme)}
                    >
                      <VolumeX size={13} />
                      <span>Tắt tiếng</span>
                    </button>
                  )}

                  {member.effectiveStatus === 'banned' ? (
                    <button
                      type="button"
                      onClick={() => onChangeStatus(member, 'active')}
                      style={menuItemBtnStyle(theme)}
                    >
                      <UserCheck size={13} />
                      <span>Mở khóa</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onChangeStatus(member, 'banned')}
                      style={menuItemBtnStyle(theme)}
                    >
                      <Ban size={13} />
                      <span>Khóa</span>
                    </button>
                  )}

                  <div
                    style={{
                      height: '1px',
                      background: theme.border,
                      margin: '4px 2px',
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => onDeleteMember(member)}
                    style={{
                      ...menuItemBtnStyle(theme),
                      color: '#DC2626',
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Xóa</span>
                  </button>
                </>
              )}
            </div>
          )}
        </td>
      </tr>
    );
  },
  (prev, next) =>
    prev.member === next.member &&
    prev.isSelected === next.isSelected &&
    prev.isMenuOpen === next.isMenuOpen &&
    prev.theme === next.theme
);

function menuItemBtnStyle(theme: AdminMembersThemeTokens): React.CSSProperties {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 9px',
    borderRadius: '7px',
    border: 'none',
    background: 'transparent',
    color: theme.textPrimary,
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
  };
}

// ============================================================================
// MAIN COMPONENT: AdminMembersManagementView
// ============================================================================
export const AdminMembersManagementView: React.FC<AdminMembersManagementViewProps> = ({
  theme,
  refreshTick,
  adminAccounts,
  onRefresh,
  onShowToast,
  onOpenNewAdminAccModal,
  onEditAdminAccModal,
  onDeleteAdminAcc,
}) => {
  // Search input + 250ms debounce
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filters & Pagination
  const [roleFilter, setRoleFilter] = useState<MemberRoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>('all');
  const [sortBy, setSortBy] = useState<MemberSortOption>('newest');
  const [pageSize, setPageSize] = useState<MemberPageSize>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Bulk selection
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(() => new Set());
  const [isBulkMoreOpen, setIsBulkMoreOpen] = useState(false);
  const [isBulkRoleModalOpen, setIsBulkRoleModalOpen] = useState(false);
  const [bulkWebRole, setBulkWebRole] = useState(true);
  const [bulkMapsRole, setBulkMapsRole] = useState(false);

  // Row menu & Modals
  const [openMenuUid, setOpenMenuUid] = useState<string | null>(null);
  const [permissionModalTarget, setPermissionModalTarget] = useState<IndexedMemberRecord | null>(null);
  const [permWebChecked, setPermWebChecked] = useState(false);
  const [permMapsChecked, setPermMapsChecked] = useState(false);

  const [detailModalTarget, setDetailModalTarget] = useState<IndexedMemberRecord | null>(null);
  const [operatorDrawerGroup, setOperatorDrawerGroup] = useState<'admin' | 'web' | 'maps' | null>(null);

  // Add Member Modal
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberWeb, setNewMemberWeb] = useState(false);
  const [newMemberMaps, setNewMemberMaps] = useState(false);

  // Optional blocks: Mới tham gia (compact) & Nick/Pass Accounts drawer
  const [showRecentBlock, setShowRecentBlock] = useState(false);
  const [showNickAccountsPanel, setShowNickAccountsPanel] = useState(false);
  const [simTick, setSimTick] = useState(0);

  const tableSectionRef = useRef<HTMLDivElement | null>(null);

  // Debounce search 240ms (nằm trong khoảng 200-300ms theo yêu cầu)
  useEffect(() => {
    if (!searchInput.trim()) {
      setDebouncedSearch('');
      setCurrentPage(1);
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(1);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Đóng menu ⋯ khi click ra ngoài
  useEffect(() => {
    if (!openMenuUid && !isBulkMoreOpen) return;
    const handleDocClick = () => {
      setOpenMenuUid(null);
      setIsBulkMoreOpen(false);
    };
    window.addEventListener('click', handleDocClick);
    return () => window.removeEventListener('click', handleDocClick);
  }, [openMenuUid, isBulkMoreOpen]);

  // Lắng nghe sự kiện đổi dataset giả lập từ console/test để re-render tức thì
  useEffect(() => {
    const handleSimChange = () => {
      setSimTick(t => t + 1);
      setCurrentPage(1);
    };
    window.addEventListener('xuanhoa-member-sim-change', handleSimChange);
    return () => window.removeEventListener('xuanhoa-member-sim-change', handleSimChange);
  }, []);

  // Query dữ liệu trang hiện tại từ Member Query Engine
  const queryResult = useMemo(() => {
    return queryMembersPage({
      page: currentPage,
      pageSize,
      roleFilter,
      statusFilter,
      search: debouncedSearch,
      sortBy,
    });
  }, [currentPage, pageSize, roleFilter, statusFilter, debouncedSearch, sortBy, refreshTick, simTick]);

  const { items, totalItems, totalPages, counts, operators, recentMembers } = queryResult;
  const simulatedCount = getSimulatedMembersCount();

  // Giữ đồng bộ detailModalTarget nếu vừa cập nhật quyền/trạng thái
  useEffect(() => {
    if (detailModalTarget) {
      const fresh = getIndexedMemberByKey(detailModalTarget.email);
      if (fresh && fresh !== detailModalTarget) {
        setDetailModalTarget(fresh);
      }
    }
  }, [refreshTick, simTick, detailModalTarget]);

  const handleSelectRoleTab = useCallback((nextRole: MemberRoleFilter, scrollToTable = false) => {
    setRoleFilter(nextRole);
    setCurrentPage(1);
    setOpenMenuUid(null);
    if (scrollToTable && tableSectionRef.current) {
      tableSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleToggleSelectRow = useCallback((email: string) => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }, []);

  const selectableCurrentPageEmails = useMemo(
    () => items.filter(m => !m.isFounder).map(m => m.email),
    [items]
  );

  const isAllCurrentPageSelected =
    selectableCurrentPageEmails.length > 0 &&
    selectableCurrentPageEmails.every(em => selectedEmails.has(em));

  const handleToggleSelectAllCurrentPage = useCallback(() => {
    setSelectedEmails(prev => {
      const next = new Set(prev);
      if (isAllCurrentPageSelected) {
        for (const em of selectableCurrentPageEmails) next.delete(em);
      } else {
        for (const em of selectableCurrentPageEmails) next.add(em);
      }
      return next;
    });
  }, [isAllCurrentPageSelected, selectableCurrentPageEmails]);

  const handleOpenPermissionModal = useCallback((member: IndexedMemberRecord) => {
    setOpenMenuUid(null);
    setPermissionModalTarget(member);
    setPermWebChecked(Boolean(member.rawMember.canManageWeb));
    setPermMapsChecked(Boolean(member.rawMember.canManageMaps));
  }, []);

  const handleSavePermissionModal = () => {
    if (!permissionModalTarget) return;
    const res = updateMemberPermissionsUnified(permissionModalTarget.email, {
      canManageWeb: permWebChecked,
      canManageMaps: permMapsChecked,
    });
    if (!res.ok) {
      onShowToast(res.message, 'warn');
      return;
    }
    setPermissionModalTarget(null);
    setSimTick(t => t + 1);
    onRefresh();
    onShowToast(res.message, 'approve');
  };

  const handleOpenDetailModal = useCallback((member: IndexedMemberRecord) => {
    setOpenMenuUid(null);
    const fresh = getIndexedMemberByKey(member.email) || member;
    setDetailModalTarget(fresh);
  }, []);

  const handleToggleRowMenu = useCallback((uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuUid(prev => (prev === uid ? null : uid));
  }, []);

  const handleChangeMemberStatus = useCallback(
    (member: IndexedMemberRecord, nextStatus: 'active' | 'muted' | 'banned') => {
      setOpenMenuUid(null);
      const res = updateMemberStatusUnified(member.email, nextStatus);
      if (!res.ok) {
        onShowToast(res.message, 'warn');
        return;
      }
      setSimTick(t => t + 1);
      onRefresh();
      onShowToast(res.message, nextStatus === 'active' ? 'approve' : 'warn');
    },
    [onRefresh, onShowToast]
  );

  const handleDeleteMember = useCallback(
    (member: IndexedMemberRecord) => {
      setOpenMenuUid(null);
      const res = deleteMemberUnified(member.email);
      if (!res.ok) {
        onShowToast(res.message, 'warn');
        return;
      }
      setSelectedEmails(prev => {
        if (!prev.has(member.email)) return prev;
        const next = new Set(prev);
        next.delete(member.email);
        return next;
      });
      setSimTick(t => t + 1);
      onRefresh();
      onShowToast(res.message, 'warn');
    },
    [onRefresh, onShowToast]
  );

  const handleCreateNewMember = (e: React.FormEvent) => {
    e.preventDefault();
    const res = createMemberUnified({
      displayName: newMemberName,
      email: newMemberEmail,
      canManageWeb: newMemberWeb,
      canManageMaps: newMemberMaps,
    });
    if (!res.ok) {
      onShowToast(res.message, 'warn');
      return;
    }
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberWeb(false);
    setNewMemberMaps(false);
    setIsAddMemberModalOpen(false);
    setSimTick(t => t + 1);
    onRefresh();
    onShowToast(res.message, 'approve');
  };

  // Bulk Actions
  const handleBulkAction = (
    action:
      | { type: 'grant_roles'; canManageWeb: boolean; canManageMaps: boolean }
      | { type: 'revoke_roles' }
      | { type: 'status'; status: 'active' | 'muted' | 'banned' }
      | { type: 'delete' }
  ) => {
    const emails = Array.from(selectedEmails);
    const res = bulkUpdateMembersUnified(emails, action);
    setIsBulkMoreOpen(false);
    setIsBulkRoleModalOpen(false);
    if (!res.ok) {
      onShowToast(res.message, 'warn');
      return;
    }
    setSelectedEmails(new Set());
    setSimTick(t => t + 1);
    onRefresh();
    onShowToast(res.message, 'approve');
  };

  // Xây dựng dãy số trang chuẩn: ‹ 1 2 3 4 5 … 37 ›
  const paginationNumbers = useMemo(() => {
    const pages: Array<number | 'ellipsis-left' | 'ellipsis-right'> = [];
    const total = totalPages;
    const curr = queryResult.currentPage;

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    if (curr > 4) {
      pages.push('ellipsis-left');
    }

    const start = Math.max(2, Math.min(curr - 1, total - 4));
    const end = Math.min(total - 1, Math.max(curr + 1, 5));
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (curr < total - 3) {
      pages.push('ellipsis-right');
    }
    pages.push(total);
    return pages;
  }, [totalPages, queryResult.currentPage]);

  const roleTabs: Array<{ id: MemberRoleFilter; label: string; count: number }> = [
    { id: 'all', label: 'Tất cả', count: counts.all },
    { id: 'admin', label: 'Admin', count: counts.admin },
    { id: 'web', label: 'QL Web', count: counts.web },
    { id: 'maps', label: 'QL Maps', count: counts.maps },
    { id: 'member', label: 'Thành viên', count: counts.member },
    ...(counts.both > 0
      ? [{ id: 'both' as MemberRoleFilter, label: 'Web + Maps', count: counts.both }]
      : []),
  ];

  // Cột vận hành (Section A: QUẢN TRỊ & QUẢN LÝ)
  const operatorColumns: Array<{
    key: 'admin' | 'web' | 'maps';
    title: string;
    total: number;
    items: IndexedMemberRecord[];
    accentColor: string;
    badgeBg: string;
  }> = [
    {
      key: 'admin',
      title: 'ADMIN',
      total: operators.adminTotal,
      items: operators.admins.slice(0, 4),
      accentColor: '#B45309',
      badgeBg: '#FEF3C7',
    },
    {
      key: 'web',
      title: 'QUẢN LÝ WEB',
      total: operators.webTotal,
      items: operators.webManagers.slice(0, 4),
      accentColor: '#1D4ED8',
      badgeBg: '#DBEAFE',
    },
    {
      key: 'maps',
      title: 'QUẢN LÝ MAPS',
      total: operators.mapsTotal,
      items: operators.mapsManagers.slice(0, 4),
      accentColor: '#047857',
      badgeBg: '#D1FAE5',
    },
  ];

  return (
    <div className="xh-members-redesign" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* ===================================================================== */}
      {/* 1. HEADER TRANG + SEARCH + FILTER TABS (STICKY)                       */}
      {/* ===================================================================== */}
      <div
        style={{
          position: 'sticky',
          top: '52px',
          zIndex: 35,
          background: theme.bgCard,
          borderRadius: '12px',
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {/* Hàng 1: Tiêu đề trang + Nút [+ Thêm thành viên] */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2
              style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 800,
                letterSpacing: '0.01em',
                color: theme.textPrimary,
              }}
            >
              THÀNH VIÊN & PHÂN QUYỀN
            </h2>
            {simulatedCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: '#FEF3C7',
                  color: '#92400E',
                  border: '1px solid #F59E0B',
                  fontSize: '11px',
                  fontWeight: 700,
                }}
              >
                <span>Dataset giả lập: {simulatedCount.toLocaleString('vi-VN')} users</span>
                <button
                  type="button"
                  onClick={() => {
                    setSimulatedMembersDataset(null);
                    setSimTick(t => t + 1);
                    setCurrentPage(1);
                    onShowToast('Đã trở về dữ liệu thành viên thực tế');
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#92400E',
                    fontWeight: 800,
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowNickAccountsPanel(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '34px',
                padding: '0 11px',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                background: showNickAccountsPanel ? theme.accentSoft : theme.bgElevated,
                color: showNickAccountsPanel ? theme.accent : theme.textSecondary,
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Quản lý tài khoản đăng nhập bằng Nick & Mật khẩu riêng"
            >
              <KeyRound size={13} />
              <span>Nick Quản lý ({adminAccounts.length})</span>
            </button>

            <button
              type="button"
              data-testid="add-member-btn"
              onClick={() => setIsAddMemberModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '34px',
                padding: '0 13px',
                borderRadius: '8px',
                border: 'none',
                background: theme.accent,
                color: '#FFFFFF',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              <span>Thêm thành viên</span>
            </button>
          </div>
        </div>

        {/* Hàng 2: Search full width hợp lý */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Search
            size={15}
            style={{
              position: 'absolute',
              left: '11px',
              color: theme.textMuted,
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            data-testid="member-search-input"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Tìm tên, Gmail, UID, quyền..."
            style={{
              width: '100%',
              height: '36px',
              padding: '0 32px 0 34px',
              borderRadius: '8px',
              border: `1px solid ${theme.border}`,
              background: theme.bgInput,
              color: theme.textPrimary,
              fontSize: '12.5px',
              fontWeight: 500,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput('');
                setDebouncedSearch('');
                setCurrentPage(1);
              }}
              aria-label="Xóa tìm kiếm"
              style={{
                position: 'absolute',
                right: '8px',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                color: theme.textMuted,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Hàng 3: Filter Tabs có count đồng bộ từ cùng 1 nguồn */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <div
            role="tablist"
            aria-label="Lọc theo nhóm quyền"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              overflowX: 'auto',
              maxWidth: '100%',
              paddingBottom: '2px',
            }}
          >
            {roleTabs.map(tab => {
              const active = roleFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`role-tab-${tab.id}`}
                  onClick={() => handleSelectRoleTab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '30px',
                    padding: '0 10px',
                    borderRadius: '7px',
                    border: active ? `1.5px solid ${theme.accent}` : `1px solid ${theme.border}`,
                    background: active ? theme.accentSoft : theme.bgElevated,
                    color: active ? theme.accent : theme.textSecondary,
                    fontSize: '12px',
                    fontWeight: active ? 700 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      background: active ? theme.accent : theme.bgInput,
                      color: active ? '#FFFFFF' : theme.textSecondary,
                    }}
                  >
                    {tab.count.toLocaleString('vi-VN')}
                  </span>
                </button>
              );
            })}
          </div>

          {recentMembers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRecentBlock(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                height: '28px',
                padding: '0 9px',
                borderRadius: '6px',
                border: `1px solid ${theme.border}`,
                background: showRecentBlock ? theme.accentSoft : 'transparent',
                color: showRecentBlock ? theme.accent : theme.textMuted,
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>Mới tham gia ({recentMembers.length})</span>
              {showRecentBlock ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* PANEL TÀI KHOẢN NICK & MẬT KHẨU RIÊNG (MỞ KHI BẤM NÚT NICK QUẢN LÝ) */}
      {showNickAccountsPanel && (
        <div
          style={{
            background: theme.bgCard,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`,
            boxShadow: theme.shadow,
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              marginBottom: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 800 }}>
                Tài khoản đăng nhập bằng Nick & Mật khẩu ({adminAccounts.length})
              </div>
              <div style={{ fontSize: '11.5px', color: theme.textMuted }}>
                Dành cho quản trị viên/quản lý đăng nhập bằng tên tài khoản không dùng Google OAuth
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenNewAdminAccModal}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '30px',
                padding: '0 10px',
                borderRadius: '7px',
                border: 'none',
                background: theme.accent,
                color: '#FFFFFF',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Plus size={13} /> Cấp Nick mới
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '8px',
            }}
          >
            {adminAccounts.map(acc => (
              <div
                key={acc.id}
                style={{
                  padding: '9px 11px',
                  borderRadius: '9px',
                  background: theme.bgElevated,
                  border: `1px solid ${theme.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: theme.textPrimary }}>
                    {acc.displayName}
                  </div>
                  <div style={{ fontSize: '11px', color: theme.textMuted }}>
                    @{acc.username} •{' '}
                    {acc.role === 'superadmin'
                      ? 'Admin'
                      : acc.canManageWeb && acc.canManageMaps
                      ? 'Web + Maps'
                      : acc.canManageMaps
                      ? 'QL Maps'
                      : 'QL Web'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => onEditAdminAccModal(acc)}
                    style={{
                      padding: '4px 7px',
                      borderRadius: '6px',
                      border: `1px solid ${theme.border}`,
                      background: theme.bgCard,
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <Edit3 size={11} />
                  </button>
                  {adminAccounts.length > 1 && acc.username !== 'minhtt' && acc.username !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => onDeleteAdminAcc(acc)}
                      style={{
                        padding: '4px 7px',
                        borderRadius: '6px',
                        border: `1px solid ${theme.border}`,
                        background: theme.bgCard,
                        color: '#DC2626',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. PHẦN A: QUẢN TRỊ & QUẢN LÝ (3 CỘT TRÊN CÙNG, TỐI ĐA 4 NGƯỜI/CỘT)   */}
      {/* ===================================================================== */}
      <section aria-label="Quản trị và Quản lý">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 800,
              color: theme.textMuted,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            QUẢN TRỊ & QUẢN LÝ
          </span>
          <span style={{ fontSize: '11px', color: theme.textMuted }}>
            Chạm vào tên để xem hồ sơ hoặc chỉnh quyền nhanh
          </span>
        </div>

        <div className="xh-operators-grid">
          {operatorColumns.map(col => (
            <div
              key={col.key}
              data-testid={`operator-card-${col.key}`}
              style={{
                background: theme.bgCard,
                borderRadius: '12px',
                border: `1px solid ${theme.border}`,
                boxShadow: theme.shadow,
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minWidth: 0,
              }}
            >
              <div>
                {/* Header cột */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    paddingBottom: '8px',
                    marginBottom: '6px',
                    borderBottom: `1px solid ${theme.border}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      color: theme.textPrimary,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {col.title}
                  </span>
                  <span
                    data-testid={`operator-count-${col.key}`}
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: col.badgeBg,
                      color: col.accentColor,
                    }}
                  >
                    {col.total} người
                  </span>
                </div>

                {/* Danh sách tối đa 4 người */}
                {col.items.length === 0 ? (
                  <div
                    style={{
                      padding: '18px 8px',
                      textAlign: 'center',
                      fontSize: '12px',
                      color: theme.textMuted,
                    }}
                  >
                    Chưa có nhân sự trong nhóm này
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {col.items.map(person => (
                      <div
                        key={`${col.key}_${person.uid}`}
                        data-testid={`operator-row-${col.key}-${person.uid}`}
                        onClick={() => handleOpenDetailModal(person)}
                        style={{
                          height: '44px',
                          padding: '4px 8px',
                          borderRadius: '8px',
                          background: theme.bgElevated,
                          border: `1px solid transparent`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: col.badgeBg,
                              color: col.accentColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10.5px',
                              fontWeight: 800,
                              flexShrink: 0,
                            }}
                          >
                            {person.initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '12.5px',
                                fontWeight: 600,
                                color: theme.textPrimary,
                                lineHeight: '16px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {person.displayName}
                            </div>
                            <div
                              style={{
                                fontSize: '11px',
                                color: theme.textMuted,
                                lineHeight: '14px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={person.email}
                            >
                              {person.shortEmail}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          {person.isFounder && <RoleBadgeChip type="founder" />}
                          {person.isAdmin && <RoleBadgeChip type="admin" />}
                          {!person.isAdmin && person.isWebManager && <RoleBadgeChip type="web" />}
                          {!person.isAdmin && person.isMapsManager && <RoleBadgeChip type="maps" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer: Xem tất cả */}
              <div
                style={{
                  marginTop: '8px',
                  paddingTop: '6px',
                  borderTop: `1px dashed ${theme.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <button
                  type="button"
                  data-testid={`operator-view-all-${col.key}`}
                  onClick={() => {
                    if (col.total > 4) {
                      setOperatorDrawerGroup(col.key);
                    } else {
                      handleSelectRoleTab(col.key, true);
                    }
                  }}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: theme.accent,
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '2px 0',
                  }}
                >
                  Xem tất cả ({col.total}) →
                </button>
                {roleFilter === col.key && (
                  <span style={{ fontSize: '10.5px', color: theme.textMuted, fontWeight: 600 }}>
                    Đang lọc
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BLOCK COMPACT TÙY CHỌN: MỚI THAM GIA (5 NGƯỜI GẦN NHẤT) */}
      {showRecentBlock && recentMembers.length > 0 && (
        <div
          style={{
            background: theme.bgCard,
            borderRadius: '12px',
            border: `1px solid ${theme.border}`,
            padding: '10px 14px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 800, color: theme.textPrimary }}>
              MỚI THAM GIA (5 người gần nhất)
            </span>
            <button
              type="button"
              onClick={() => {
                setRoleFilter('member');
                setSortBy('newest');
                setCurrentPage(1);
                setShowRecentBlock(false);
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: theme.accent,
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Xem tất cả →
            </button>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: '8px',
            }}
          >
            {recentMembers.map(rm => (
              <div
                key={rm.uid}
                onClick={() => handleOpenDetailModal(rm)}
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  background: theme.bgElevated,
                  border: `1px solid ${theme.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: theme.textPrimary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {rm.displayName}
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: theme.textMuted,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {rm.shortEmail}
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: theme.textMuted, flexShrink: 0 }}>
                  {formatShortDateVi(rm.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. PHẦN B: DANH SÁCH THÀNH VIÊN (PAGINATED TABLE / COMPACT MOBILE)    */}
      {/* ===================================================================== */}
      <section
        ref={tableSectionRef}
        aria-label="Danh sách thành viên"
        style={{
          background: theme.bgCard,
          borderRadius: '12px',
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
          overflow: 'visible',
        }}
      >
        {/* Header Phần B: THÀNH VIÊN <count> + [Trạng thái ▾] [Sắp xếp ▾] */}
        <div
          style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${theme.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              data-testid="members-section-heading"
              style={{
                fontSize: '14px',
                fontWeight: 800,
                color: theme.textPrimary,
              }}
            >
              {roleFilter === 'all'
                ? `THÀNH VIÊN ${counts.member.toLocaleString('vi-VN')}`
                : roleFilter === 'member'
                ? `THÀNH VIÊN ${totalItems.toLocaleString('vi-VN')}`
                : roleFilter === 'admin'
                ? `ADMIN ${totalItems.toLocaleString('vi-VN')}`
                : roleFilter === 'web'
                ? `QUẢN LÝ WEB ${totalItems.toLocaleString('vi-VN')}`
                : roleFilter === 'maps'
                ? `QUẢN LÝ MAPS ${totalItems.toLocaleString('vi-VN')}`
                : `QUẢN LÝ WEB + MAPS ${totalItems.toLocaleString('vi-VN')}`}
            </span>
            {(debouncedSearch || statusFilter !== 'all' || roleFilter !== 'all') && (
              <span style={{ fontSize: '12px', color: theme.textMuted, fontWeight: 500 }}>
                • Hiển thị {totalItems.toLocaleString('vi-VN')} kết quả
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Dropdown Trạng thái */}
            <select
              data-testid="member-status-select"
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value as MemberStatusFilter);
                setCurrentPage(1);
              }}
              aria-label="Lọc theo trạng thái"
              style={{
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                background: theme.bgElevated,
                color: theme.textPrimary,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">Trạng thái: Tất cả</option>
              <option value="active">Trạng thái: Hoạt động ({counts.statusActive})</option>
              <option value="muted">Trạng thái: Mute ({counts.statusMuted})</option>
              <option value="banned">Trạng thái: Bị khóa ({counts.statusBanned})</option>
            </select>

            {/* Dropdown Sắp xếp */}
            <select
              data-testid="member-sort-select"
              value={sortBy}
              onChange={e => {
                setSortBy(e.target.value as MemberSortOption);
                setCurrentPage(1);
              }}
              aria-label="Sắp xếp thành viên"
              style={{
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                background: theme.bgElevated,
                color: theme.textPrimary,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="newest">Sắp xếp: Mới tham gia</option>
              <option value="oldest">Sắp xếp: Cũ nhất</option>
              <option value="name_asc">Sắp xếp: Tên A–Z</option>
              <option value="name_desc">Sắp xếp: Tên Z–A</option>
              <option value="last_active">Sắp xếp: Hoạt động gần đây</option>
            </select>
          </div>
        </div>

        {/* BULK ACTION BAR (CHỈ HIỆN KHI ĐÃ CHỌN >= 1 USER) */}
        {selectedEmails.size > 0 && (
          <div
            data-testid="bulk-action-bar"
            style={{
              padding: '8px 16px',
              background: theme.accentSoft,
              borderBottom: `1px solid ${theme.accentBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: theme.accent }}>
                Đã chọn {selectedEmails.size}
              </span>
              <button
                type="button"
                onClick={() => setSelectedEmails(new Set())}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: theme.textSecondary,
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Bỏ chọn
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsBulkRoleModalOpen(true)}
                style={bulkBarBtnStyle(theme)}
              >
                Cấp quyền
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction({ type: 'revoke_roles' })}
                style={bulkBarBtnStyle(theme)}
              >
                Gỡ quyền
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction({ type: 'status', status: 'muted' })}
                style={bulkBarBtnStyle(theme)}
              >
                Mute
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction({ type: 'status', status: 'banned' })}
                style={bulkBarBtnStyle(theme)}
              >
                Khóa
              </button>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setIsBulkMoreOpen(prev => !prev);
                }}
                style={bulkBarBtnStyle(theme)}
                aria-label="Thêm thao tác hàng loạt"
              >
                ⋯
              </button>

              {isBulkMoreOpen && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '34px',
                    zIndex: 85,
                    width: '165px',
                    background: theme.bgCard,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '10px',
                    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.14)',
                    padding: '5px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleBulkAction({ type: 'status', status: 'active' })}
                    style={menuItemBtnStyle(theme)}
                  >
                    <UserCheck size={13} />
                    <span>Mở hoạt động</span>
                  </button>
                  <div style={{ height: '1px', background: theme.border, margin: '4px 2px' }} />
                  <button
                    type="button"
                    onClick={() => handleBulkAction({ type: 'delete' })}
                    style={{ ...menuItemBtnStyle(theme), color: '#DC2626' }}
                  >
                    <Trash2 size={13} />
                    <span>Xóa đã chọn</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* DESKTOP TABLE (Ẩn trên mobile < 768px) */}
        <div className="xh-members-desktop-table-wrap">
          <table
            data-testid="members-desktop-table"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 10,
                  height: '38px',
                  background: theme.bgElevated,
                  borderBottom: `1px solid ${theme.border}`,
                  fontSize: '11px',
                  fontWeight: 800,
                  color: theme.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                }}
              >
                <th style={{ width: '38px', padding: '0 8px 0 12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={handleToggleSelectAllCurrentPage}
                    aria-label="Chọn tất cả trang này"
                    style={{
                      width: '15px',
                      height: '15px',
                      cursor: 'pointer',
                      accentColor: theme.accent,
                    }}
                  />
                </th>
                <th style={{ padding: '0 12px' }}>THÀNH VIÊN</th>
                <th style={{ padding: '0 12px' }}>QUYỀN</th>
                <th style={{ padding: '0 12px' }}>TRẠNG THÁI</th>
                <th style={{ padding: '0 12px' }}>THAM GIA</th>
                <th style={{ width: '48px', padding: '0 12px 0 6px', textAlign: 'right' }}>⋯</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: '36px 16px',
                      textAlign: 'center',
                      fontSize: '13px',
                      color: theme.textMuted,
                    }}
                  >
                    Không tìm thấy thành viên phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                items.map(member => (
                  <MemberTableRow
                    key={member.uid}
                    member={member}
                    isSelected={selectedEmails.has(member.email)}
                    isMenuOpen={openMenuUid === member.uid}
                    theme={theme}
                    onToggleSelect={handleToggleSelectRow}
                    onOpenPermissionModal={handleOpenPermissionModal}
                    onOpenDetailModal={handleOpenDetailModal}
                    onToggleMenu={handleToggleRowMenu}
                    onChangeStatus={handleChangeMemberStatus}
                    onDeleteMember={handleDeleteMember}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE COMPACT CARDS (Chỉ hiện trên màn hình < 768px) */}
        <div className="xh-members-mobile-list" data-testid="members-mobile-list">
          {items.length === 0 ? (
            <div
              style={{
                padding: '28px 16px',
                textAlign: 'center',
                fontSize: '13px',
                color: theme.textMuted,
              }}
            >
              Không tìm thấy thành viên phù hợp.
            </div>
          ) : (
            items.map(member => {
              const isSelected = selectedEmails.has(member.email);
              const isMenuOpen = openMenuUid === member.uid;
              return (
                <div
                  key={member.uid}
                  style={{
                    padding: '10px 12px',
                    borderBottom: `1px solid ${theme.border}`,
                    background: isSelected ? theme.accentSoft : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flex: 1 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={member.isFounder}
                      onChange={() => handleToggleSelectRow(member.email)}
                      style={{ width: '15px', height: '15px', accentColor: theme.accent, flexShrink: 0 }}
                    />
                    <div
                      onClick={() => handleOpenDetailModal(member)}
                      style={{ minWidth: 0, flex: 1, cursor: 'pointer' }}
                    >
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: theme.textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {member.displayName}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          color: theme.textMuted,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {member.email}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <div
                      onClick={() => handleOpenPermissionModal(member)}
                      style={{ display: 'flex', gap: '4px', cursor: 'pointer' }}
                    >
                      {member.isFounder && <RoleBadgeChip type="founder" />}
                      {member.isAdmin && <RoleBadgeChip type="admin" />}
                      {!member.isAdmin && member.isWebManager && <RoleBadgeChip type="web" />}
                      {!member.isAdmin && member.isMapsManager && <RoleBadgeChip type="maps" />}
                    </div>

                    <StatusDotBadge status={member.effectiveStatus} />

                    <button
                      type="button"
                      onClick={e => handleToggleRowMenu(member.uid, e)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '7px',
                        border: `1px solid ${theme.border}`,
                        background: theme.bgElevated,
                        color: theme.textSecondary,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </div>

                  {isMenuOpen && (
                    <div
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '46px',
                        zIndex: 85,
                        width: '170px',
                        background: theme.bgCard,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '10px',
                        boxShadow: '0 10px 28px rgba(15, 23, 42, 0.16)',
                        padding: '5px',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleOpenDetailModal(member)}
                        style={menuItemBtnStyle(theme)}
                      >
                        <Eye size={13} />
                        <span>Xem thông tin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenPermissionModal(member)}
                        style={menuItemBtnStyle(theme)}
                      >
                        <Shield size={13} />
                        <span>Cấp quyền</span>
                      </button>
                      {!member.isFounder && !member.isAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleChangeMemberStatus(
                                member,
                                member.effectiveStatus === 'muted' ? 'active' : 'muted'
                              )
                            }
                            style={menuItemBtnStyle(theme)}
                          >
                            <VolumeX size={13} />
                            <span>
                              {member.effectiveStatus === 'muted' ? 'Bỏ tắt tiếng' : 'Tắt tiếng'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleChangeMemberStatus(
                                member,
                                member.effectiveStatus === 'banned' ? 'active' : 'banned'
                              )
                            }
                            style={menuItemBtnStyle(theme)}
                          >
                            <Ban size={13} />
                            <span>{member.effectiveStatus === 'banned' ? 'Mở khóa' : 'Khóa'}</span>
                          </button>
                          <div style={{ height: '1px', background: theme.border, margin: '4px 2px' }} />
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(member)}
                            style={{ ...menuItemBtnStyle(theme), color: '#DC2626' }}
                          >
                            <Trash2 size={13} />
                            <span>Xóa</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* PAGINATION FOOTER: 25 / 50 / 100 người/trang + ‹ 1 2 3 4 5 … 37 › */}
        <div
          data-testid="members-pagination-bar"
          style={{
            padding: '10px 16px',
            borderTop: `1px solid ${theme.border}`,
            background: theme.bgElevated,
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <select
              data-testid="member-pagesize-select"
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value) as MemberPageSize);
                setCurrentPage(1);
              }}
              aria-label="Số người mỗi trang"
              style={{
                height: '30px',
                padding: '0 8px',
                borderRadius: '7px',
                border: `1px solid ${theme.border}`,
                background: theme.bgCard,
                color: theme.textPrimary,
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <option value={25}>25 người/trang</option>
              <option value={50}>50 người/trang</option>
              <option value={100}>100 người/trang</option>
            </select>

            <span style={{ fontSize: '12px', color: theme.textMuted }}>
              {totalItems > 0
                ? `${(queryResult.startIndex + 1).toLocaleString('vi-VN')}–${queryResult.endIndex.toLocaleString(
                    'vi-VN'
                  )} / ${totalItems.toLocaleString('vi-VN')} người (Trang ${
                    queryResult.currentPage
                  }/${totalPages})`
                : '0 người'}
            </span>
          </div>

          <div
            role="navigation"
            aria-label="Phân trang danh sách thành viên"
            style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}
          >
            <button
              type="button"
              disabled={queryResult.currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              aria-label="Trang trước"
              style={pageBtnStyle(theme, false, queryResult.currentPage <= 1)}
            >
              <ChevronLeft size={14} />
            </button>

            {paginationNumbers.map((item, idx) => {
              if (item === 'ellipsis-left' || item === 'ellipsis-right') {
                return (
                  <span
                    key={`${item}_${idx}`}
                    style={{
                      padding: '0 4px',
                      fontSize: '12px',
                      color: theme.textMuted,
                      fontWeight: 700,
                    }}
                  >
                    …
                  </span>
                );
              }
              const isCurrent = item === queryResult.currentPage;
              return (
                <button
                  key={item}
                  type="button"
                  data-testid={`page-btn-${item}`}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={() => setCurrentPage(item)}
                  style={pageBtnStyle(theme, isCurrent, false)}
                >
                  {item}
                </button>
              );
            })}

            <button
              type="button"
              disabled={queryResult.currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              aria-label="Trang sau"
              style={pageBtnStyle(theme, false, queryResult.currentPage >= totalPages)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* MODAL 1: CẤP QUYỀN THÀNH VIÊN (POPOVER / MODAL NHỎ GỌN)               */}
      {/* ===================================================================== */}
      {permissionModalTarget && (
        <div
          className="xh-modal-backdrop"
          onClick={() => setPermissionModalTarget(null)}
        >
          <div
            data-testid="member-permission-modal"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '360px',
              background: theme.bgCard,
              color: theme.textPrimary,
              borderRadius: '14px',
              border: `1px solid ${theme.border}`,
              padding: '18px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Quyền thành viên</h3>
              <button
                type="button"
                onClick={() => setPermissionModalTarget(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: theme.textMuted,
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                padding: '9px 11px',
                borderRadius: '9px',
                background: theme.bgElevated,
                border: `1px solid ${theme.border}`,
                marginBottom: '12px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 700 }}>
                {permissionModalTarget.displayName}
              </div>
              <div style={{ fontSize: '11.5px', color: theme.textMuted }}>
                {permissionModalTarget.email}
              </div>
              {(permissionModalTarget.isFounder || permissionModalTarget.isAdmin) && (
                <div style={{ display: 'flex', gap: '5px', marginTop: '6px' }}>
                  {permissionModalTarget.isFounder && <RoleBadgeChip type="founder" />}
                  {permissionModalTarget.isAdmin && <RoleBadgeChip type="admin" />}
                </div>
              )}
            </div>

            {permissionModalTarget.isFounder ? (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '9px',
                  background: '#FEF3C7',
                  border: '1px solid #F59E0B',
                  color: '#92400E',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '14px',
                }}
              >
                Tài khoản Founder (Sáng lập) được bảo vệ mặc định và sở hữu toàn quyền Quản trị hệ thống.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '9px',
                    border: permWebChecked
                      ? `1.5px solid #2563EB`
                      : `1px solid ${theme.border}`,
                    background: permWebChecked ? 'rgba(37, 99, 235, 0.07)' : theme.bgElevated,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    data-testid="perm-checkbox-web"
                    checked={permWebChecked}
                    onChange={e => setPermWebChecked(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#2563EB', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: theme.textPrimary }}>
                      Quản lý Web
                    </div>
                    <div style={{ fontSize: '11px', color: theme.textMuted }}>
                      Quản lý thông tin quán, thực đơn & món ăn
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '9px',
                    border: permMapsChecked
                      ? `1.5px solid #059669`
                      : `1px solid ${theme.border}`,
                    background: permMapsChecked ? 'rgba(5, 150, 105, 0.08)' : theme.bgElevated,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    data-testid="perm-checkbox-maps"
                    checked={permMapsChecked}
                    onChange={e => setPermMapsChecked(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#059669', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: theme.textPrimary }}>
                      Quản lý Maps
                    </div>
                    <div style={{ fontSize: '11px', color: theme.textMuted }}>
                      Định vị tọa độ, thêm & chỉnh sửa địa điểm Bản đồ số
                    </div>
                  </div>
                </label>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setPermissionModalTarget(null)}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: theme.bgElevated,
                  color: theme.textPrimary,
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
              {!permissionModalTarget.isFounder && (
                <button
                  type="button"
                  data-testid="perm-save-btn"
                  onClick={handleSavePermissionModal}
                  style={{
                    height: '34px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: theme.accent,
                    color: '#FFFFFF',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Lưu
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: XEM CHI TIẾT HỒ SƠ THÀNH VIÊN (CÙNG 1 RECORD DUY NHẤT)        */}
      {/* ===================================================================== */}
      {detailModalTarget && (
        <div
          className="xh-modal-backdrop"
          onClick={() => setDetailModalTarget(null)}
        >
          <div
            data-testid="member-detail-modal"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '400px',
              background: theme.bgCard,
              color: theme.textPrimary,
              borderRadius: '14px',
              border: `1px solid ${theme.border}`,
              padding: '18px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Thông tin thành viên</h3>
              <button
                type="button"
                onClick={() => setDetailModalTarget(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: theme.textMuted,
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px',
                borderRadius: '10px',
                background: theme.bgElevated,
                border: `1px solid ${theme.border}`,
                marginBottom: '12px',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: theme.accentSoft,
                  color: theme.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 800,
                  flexShrink: 0,
                }}
              >
                {detailModalTarget.initials}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 800 }}>{detailModalTarget.displayName}</div>
                <div style={{ fontSize: '12px', color: theme.textMuted, wordBreak: 'break-all' }}>
                  {detailModalTarget.email}
                </div>
                <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {detailModalTarget.isFounder && <RoleBadgeChip type="founder" />}
                  {detailModalTarget.isAdmin && <RoleBadgeChip type="admin" />}
                  {!detailModalTarget.isAdmin && detailModalTarget.isWebManager && (
                    <RoleBadgeChip type="web" />
                  )}
                  {!detailModalTarget.isAdmin && detailModalTarget.isMapsManager && (
                    <RoleBadgeChip type="maps" />
                  )}
                  <StatusDotBadge status={detailModalTarget.effectiveStatus} />
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                fontSize: '12px',
                marginBottom: '14px',
              }}
            >
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: theme.bgElevated,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <div style={{ fontSize: '10.5px', color: theme.textMuted }}>UID hệ thống</div>
                <div
                  data-testid="detail-modal-uid"
                  style={{
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={detailModalTarget.uid}
                >
                  {detailModalTarget.uid}
                </div>
              </div>
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: theme.bgElevated,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <div style={{ fontSize: '10.5px', color: theme.textMuted }}>Ngày tham gia</div>
                <div style={{ fontWeight: 700 }}>{formatShortDateVi(detailModalTarget.createdAt)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              {!detailModalTarget.isFounder && (
                <button
                  type="button"
                  onClick={() => {
                    const target = detailModalTarget;
                    setDetailModalTarget(null);
                    handleOpenPermissionModal(target);
                  }}
                  style={{
                    height: '34px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.accent}`,
                    background: theme.accentSoft,
                    color: theme.accent,
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Chỉnh quyền
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailModalTarget(null)}
                style={{
                  marginLeft: 'auto',
                  height: '34px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: theme.bgElevated,
                  color: theme.textPrimary,
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: XEM TẤT CẢ NHÂN SỰ TRONG NHÓM VẬN HÀNH (ADMIN / WEB / MAPS)  */}
      {/* ===================================================================== */}
      {operatorDrawerGroup && (
        <div
          className="xh-modal-backdrop"
          onClick={() => setOperatorDrawerGroup(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '500px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              background: theme.bgCard,
              color: theme.textPrimary,
              borderRadius: '14px',
              border: `1px solid ${theme.border}`,
              padding: '18px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>
                {operatorDrawerGroup === 'admin'
                  ? `Danh sách Admin (${operators.adminTotal})`
                  : operatorDrawerGroup === 'web'
                  ? `Danh sách Quản lý Web (${operators.webTotal})`
                  : `Danh sách Quản lý Maps (${operators.mapsTotal})`}
              </h3>
              <button
                type="button"
                onClick={() => setOperatorDrawerGroup(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: theme.textMuted,
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                paddingRight: '2px',
              }}
            >
              {(operatorDrawerGroup === 'admin'
                ? operators.admins
                : operatorDrawerGroup === 'web'
                ? operators.webManagers
                : operators.mapsManagers
              ).map(person => (
                <div
                  key={person.uid}
                  onClick={() => {
                    setOperatorDrawerGroup(null);
                    handleOpenPermissionModal(person);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: theme.bgElevated,
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: theme.accentSoft,
                        color: theme.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        flexShrink: 0,
                      }}
                    >
                      {person.initials}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{person.displayName}</div>
                      <div style={{ fontSize: '11px', color: theme.textMuted }}>{person.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {person.isFounder && <RoleBadgeChip type="founder" />}
                    {person.isAdmin && <RoleBadgeChip type="admin" />}
                    {!person.isAdmin && person.isWebManager && <RoleBadgeChip type="web" />}
                    {!person.isAdmin && person.isMapsManager && <RoleBadgeChip type="maps" />}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: '12px',
                paddingTop: '10px',
                borderTop: `1px solid ${theme.border}`,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const grp = operatorDrawerGroup;
                  setOperatorDrawerGroup(null);
                  handleSelectRoleTab(grp, true);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: theme.accent,
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Lọc dưới bảng chính →
              </button>
              <button
                type="button"
                onClick={() => setOperatorDrawerGroup(null)}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: theme.bgElevated,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: THÊM THÀNH VIÊN MỚI                                           */}
      {/* ===================================================================== */}
      {isAddMemberModalOpen && (
        <div
          className="xh-modal-backdrop"
          onClick={() => setIsAddMemberModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '390px',
              background: theme.bgCard,
              color: theme.textPrimary,
              borderRadius: '14px',
              border: `1px solid ${theme.border}`,
              padding: '18px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Thêm thành viên</h3>
              <button
                type="button"
                onClick={() => setIsAddMemberModalOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: theme.textMuted,
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateNewMember} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: '4px' }}>
                  Tên thành viên *
                </label>
                <input
                  type="text"
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`,
                    background: theme.bgInput,
                    fontSize: '12.5px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: '4px' }}>
                  Địa chỉ Gmail *
                </label>
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={e => setNewMemberEmail(e.target.value)}
                  placeholder="nguyenvana@gmail.com"
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`,
                    background: theme.bgInput,
                    fontSize: '12.5px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, marginBottom: '6px' }}>
                  Cấp quyền quản lý (tùy chọn)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <label
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${theme.border}`,
                      background: theme.bgElevated,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newMemberWeb}
                      onChange={e => setNewMemberWeb(e.target.checked)}
                    />
                    <span>Quản lý Web</span>
                  </label>
                  <label
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1px solid ${theme.border}`,
                      background: theme.bgElevated,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newMemberMaps}
                      onChange={e => setNewMemberMaps(e.target.checked)}
                    />
                    <span>Quản lý Maps</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddMemberModalOpen(false)}
                  style={{
                    height: '34px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    border: `1px solid ${theme.border}`,
                    background: theme.bgElevated,
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  style={{
                    height: '34px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: theme.accent,
                    color: '#FFFFFF',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: CẤP QUYỀN HÀNG LOẠT (BULK PERMISSION)                        */}
      {/* ===================================================================== */}
      {isBulkRoleModalOpen && (
        <div
          className="xh-modal-backdrop"
          onClick={() => setIsBulkRoleModalOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '350px',
              background: theme.bgCard,
              color: theme.textPrimary,
              borderRadius: '14px',
              border: `1px solid ${theme.border}`,
              padding: '18px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
            }}
          >
            <h3 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 800 }}>
              Cấp quyền cho {selectedEmails.size} thành viên
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 11px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: theme.bgElevated,
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={bulkWebRole}
                  onChange={e => setBulkWebRole(e.target.checked)}
                />
                <span>Quản lý Web</span>
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 11px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: theme.bgElevated,
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={bulkMapsRole}
                  onChange={e => setBulkMapsRole(e.target.checked)}
                />
                <span>Quản lý Maps</span>
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setIsBulkRoleModalOpen(false)}
                style={{
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: `1px solid ${theme.border}`,
                  background: theme.bgElevated,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() =>
                  handleBulkAction({
                    type: 'grant_roles',
                    canManageWeb: bulkWebRole,
                    canManageMaps: bulkMapsRole,
                  })
                }
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: theme.accent,
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .xh-operators-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .xh-members-desktop-table-wrap {
          display: block;
          overflow-x: auto;
        }
        .xh-members-mobile-list {
          display: none;
        }
        @media (max-width: 1024px) {
          .xh-operators-grid {
            display: flex;
            overflow-x: auto;
            gap: 10px;
            padding-bottom: 4px;
            scroll-snap-type: x mandatory;
          }
          .xh-operators-grid > div {
            min-width: 270px;
            flex: 0 0 280px;
            scroll-snap-align: start;
          }
        }
        @media (max-width: 767px) {
          .xh-members-desktop-table-wrap {
            display: none !important;
          }
          .xh-members-mobile-list {
            display: flex !important;
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

function bulkBarBtnStyle(theme: AdminMembersThemeTokens): React.CSSProperties {
  return {
    height: '28px',
    padding: '0 10px',
    borderRadius: '7px',
    border: `1px solid ${theme.border}`,
    background: theme.bgCard,
    color: theme.textPrimary,
    fontSize: '11.5px',
    fontWeight: 700,
    cursor: 'pointer',
  };
}

function pageBtnStyle(
  theme: AdminMembersThemeTokens,
  active: boolean,
  disabled: boolean
): React.CSSProperties {
  return {
    minWidth: '28px',
    height: '28px',
    padding: '0 6px',
    borderRadius: '7px',
    border: active ? `1.5px solid ${theme.accent}` : `1px solid ${theme.border}`,
    background: active ? theme.accent : theme.bgCard,
    color: active ? '#FFFFFF' : disabled ? theme.textMuted : theme.textPrimary,
    fontSize: '12px',
    fontWeight: active ? 700 : 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
  };
}
