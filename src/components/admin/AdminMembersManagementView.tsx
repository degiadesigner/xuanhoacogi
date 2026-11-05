'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  Plus,
  MoreHorizontal,
  Shield,
  ShieldAlert,
  ShieldCheck,
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
  History,
  Lock,
} from 'lucide-react';
import {
  IndexedMemberRecord,
  MemberRoleFilter,
  MemberStatusFilter,
  MemberVerificationFilter,
  MemberSortOption,
  MemberPageSize,
  queryMembersPage,
  getIndexedMemberByKey,
  updateMemberPermissionsUnified,
  cancelPendingRoleUnified,
  updateMemberStatusUnified,
  deleteMemberUnified,
  createMemberUnified,
  bulkUpdateMembersUnified,
  formatShortDateVi,
  getSimulatedMembersCount,
  setSimulatedMembersDataset,
} from '@/lib/member-query-engine';
import {
  getAdminState,
  getBackupFounderRecords,
  getEffectiveAdminRoleInfo,
  provisionBackupFounderAccount,
  setBackupFounderActiveState,
  resetBackupFounderPasswordViaBackend,
  revokeBackupFounderSessionsViaBackend,
  verifyBackupFounderRecoveryEmailViaBackend,
  runAccountsReconciliationClient,
  type AdminAccount,
} from '@/lib/admin-store';
import {
  getActivePolicyMetadata,
  publishPolicyVersionViaBackend,
  processDataRightsRequestViaBackend,
  DATA_RIGHTS_REQUEST_TYPE_LABELS,
  type DataRightsRequestRecord,
  type DataRightsRequestStatus,
} from '@/lib/legal-compliance';
import { getFirebaseAuth } from '@/lib/firebase';

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
type RoleBadgeChipType =
  | 'primary_founder'
  | 'backup_founder'
  | 'founder'
  | 'admin'
  | 'web'
  | 'maps'
  | 'unverified_uid'
  | 'verified_uid'
  | 'pending_verification'
  | 'conflict_uid'
  | 'pending_role_admin'
  | 'pending_role_web'
  | 'pending_role_maps'
  | 'pending_role_both';

const RoleBadgeChip: React.FC<{
  type: RoleBadgeChipType;
}> = React.memo(function RoleBadgeChip({ type }) {
  const styles: Record<
    RoleBadgeChipType,
    { label: string; bg: string; color: string; border: string }
  > = {
    primary_founder: {
      label: '👑 Primary Founder',
      bg: '#FEF3C7',
      color: '#92400E',
      border: '#F59E0B',
    },
    backup_founder: {
      label: '🛡️ Backup Founder',
      bg: '#EDE9FE',
      color: '#5B21B6',
      border: '#C4B5FD',
    },
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
    unverified_uid: {
      label: '⏳ Chờ xác minh',
      bg: '#F3F4F6',
      color: '#4B5563',
      border: '#D1D5DB',
    },
    verified_uid: {
      label: '✓ Đã xác minh',
      bg: '#ECFDF5',
      color: '#047857',
      border: '#A7F3D0',
    },
    pending_verification: {
      label: '⏳ Chờ xác minh',
      bg: '#F3F4F6',
      color: '#4B5563',
      border: '#D1D5DB',
    },
    conflict_uid: {
      label: '⚠️ Xung đột',
      bg: '#FEF2F2',
      color: '#B91C1C',
      border: '#FECACA',
    },
    pending_role_admin: {
      label: '🕐 Chờ kích hoạt: Admin',
      bg: '#FEF3C7',
      color: '#92400E',
      border: '#F59E0B',
    },
    pending_role_web: {
      label: '🕐 Chờ kích hoạt: QL Web',
      bg: '#EFF6FF',
      color: '#1D4ED8',
      border: '#93C5FD',
    },
    pending_role_maps: {
      label: '🕐 Chờ kích hoạt: QL Maps',
      bg: '#ECFDF5',
      color: '#047857',
      border: '#6EE7B7',
    },
    pending_role_both: {
      label: '🕐 Chờ kích hoạt: QL Web + Maps',
      bg: '#F5F3FF',
      color: '#5B21B6',
      border: '#C4B5FD',
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

        {/* 3. Quyền & Xác minh (Click để mở popover/modal cấp quyền) */}
        <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
          <button
            type="button"
            data-testid={`member-role-cell-${member.email}`}
            onClick={() => onOpenPermissionModal(member)}
            title={
              member.isFounder
                ? 'Founder có toàn quyền hệ thống'
                : 'Bấm để chỉnh quyền Quản lý Web / Maps / Admin'
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
            {member.isPrimaryFounder && <RoleBadgeChip type="primary_founder" />}
            {member.isBackupFounder && <RoleBadgeChip type="backup_founder" />}
            {!member.isFounder && member.isAdmin && <RoleBadgeChip type="admin" />}
            {!member.isAdmin && member.isWebManager && <RoleBadgeChip type="web" />}
            {!member.isAdmin && member.isMapsManager && <RoleBadgeChip type="maps" />}
            {!hasAnyRole && member.pendingRoleAssignment && (
              <RoleBadgeChip
                type={
                  member.pendingRoleAssignment.makeAdmin ||
                  member.pendingRoleAssignment.requestedRole === 'admin'
                    ? 'pending_role_admin'
                    : member.pendingRoleAssignment.canManageWeb &&
                      member.pendingRoleAssignment.canManageMaps
                    ? 'pending_role_both'
                    : member.pendingRoleAssignment.canManageWeb
                    ? 'pending_role_web'
                    : 'pending_role_maps'
                }
              />
            )}
            {member.identityStatus === 'CONFLICT' ? (
              <RoleBadgeChip type="conflict_uid" />
            ) : member.isUidVerified ? (
              <RoleBadgeChip type="verified_uid" />
            ) : (
              <RoleBadgeChip type="pending_verification" />
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
                <span>Cấp / Thu hồi quyền</span>
              </button>

              {!member.isFounder && (
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
  const [verificationFilter, setVerificationFilter] = useState<MemberVerificationFilter>('all');
  const [sortBy, setSortBy] = useState<MemberSortOption>('newest');
  const [pageSize, setPageSize] = useState<MemberPageSize>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [reconcilingAccounts, setReconcilingAccounts] = useState(false);

  // Bulk selection
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(() => new Set());
  const [isBulkMoreOpen, setIsBulkMoreOpen] = useState(false);
  const [isBulkRoleModalOpen, setIsBulkRoleModalOpen] = useState(false);
  const [bulkWebRole, setBulkWebRole] = useState(true);
  const [bulkMapsRole, setBulkMapsRole] = useState(false);

  // Row menu & Modals
  const [openMenuUid, setOpenMenuUid] = useState<string | null>(null);
  const [permissionModalTarget, setPermissionModalTarget] = useState<IndexedMemberRecord | null>(null);
  const [permAdminChecked, setPermAdminChecked] = useState(false);
  const [permWebChecked, setPermWebChecked] = useState(false);
  const [permMapsChecked, setPermMapsChecked] = useState(false);
  const [permConfirmIntent, setPermConfirmIntent] = useState(false);

  const [detailModalTarget, setDetailModalTarget] = useState<IndexedMemberRecord | null>(null);
  const [operatorDrawerGroup, setOperatorDrawerGroup] = useState<'admin' | 'web' | 'maps' | null>(null);

  // Add Member Modal
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberWeb, setNewMemberWeb] = useState(false);
  const [newMemberMaps, setNewMemberMaps] = useState(false);

  useEffect(() => {
    const onOpenAccordion = (ev: Event) => {
      const detail = (ev as CustomEvent<string>).detail;
      if (detail === 'founder') {
        setShowBackupFounderPanel(true);
      } else if (detail === 'legal') {
        setShowLegalCompliancePanel(true);
      } else if (detail === 'nicks') {
        setShowNickAccountsPanel(true);
      }
    };
    window.addEventListener('xuanhoa-open-member-accordion', onOpenAccordion);
    return () => window.removeEventListener('xuanhoa-open-member-accordion', onOpenAccordion);
  }, []);

  // PANEL 1A: ACCORDION "FOUNDER & BẢO MẬT" (MẶC ĐỊNH ĐÓNG, MỞ ĐẦY ĐỦ 7 MỤC)
  const [showBackupFounderPanel, setShowBackupFounderPanel] = useState(false);
  const [showOperatorsSummary, setShowOperatorsSummary] = useState(false);
  const [isProvisionBackupModalOpen, setIsProvisionBackupModalOpen] = useState(false);
  const [bfUsername, setBfUsername] = useState('');
  const [bfPassword, setBfPassword] = useState('');
  const [bfDisplayName, setBfDisplayName] = useState('Founder Dự Phòng');
  const [bfRecoveryEmail, setBfRecoveryEmail] = useState('');
  const [bfConfirmIntent, setBfConfirmIntent] = useState(false);
  const [bfSubmitting, setBfSubmitting] = useState(false);
  const [copiedBfUid, setCopiedBfUid] = useState<string | null>(null);

  // Reset Password Modal cho Backup Founder (Primary Founder đặt mật khẩu mới không cần mật khẩu cũ)
  const [resetPwdTargetUid, setResetPwdTargetUid] = useState<string | null>(null);
  const [resetPwdTargetUsername, setResetPwdTargetUsername] = useState<string>('');
  const [newBfPassword, setNewBfPassword] = useState('');
  const [confirmNewBfPassword, setConfirmNewBfPassword] = useState('');
  const [resetPwdRecentAuthConfirmed, setResetPwdRecentAuthConfirmed] = useState(true);
  const [resetPwdSubmitting, setResetPwdSubmitting] = useState(false);

  // Verify / Update Recovery Email Modal
  const [verifyEmailTargetUid, setVerifyEmailTargetUid] = useState<string | null>(null);
  const [verifyEmailInput, setVerifyEmailInput] = useState('');
  const [verifyEmailSubmitting, setVerifyEmailSubmitting] = useState(false);

  const [showRoleAuditLogsPanel, setShowRoleAuditLogsPanel] = useState(false);

  // Legal Compliance & Data Rights Management Panel (Founder / Admin — mặc định thu gọn thành Accordion)
  const [showLegalCompliancePanel, setShowLegalCompliancePanel] = useState(false);
  const [activePolicyMeta, setActivePolicyMeta] = useState(() => getActivePolicyMetadata());
  const [newPolicyVersionInput, setNewPolicyVersionInput] = useState('');
  const [newPolicyTitleInput, setNewPolicyTitleInput] = useState('');
  const [newPolicyChangesInput, setNewPolicyChangesInput] = useState('');
  const [newPolicyRequiresReconsent, setNewPolicyRequiresReconsent] = useState(false);
  const [publishingPolicy, setPublishingPolicy] = useState(false);
  const [dataRightsQueue, setDataRightsQueue] = useState<DataRightsRequestRecord[]>([]);
  const [consentStatsSummary, setConsentStatsSummary] = useState<{
    totalConsentedUsers: number;
    currentVersionCount: number;
    optionalTasteGranted: number;
    optionalAnalyticsGranted: number;
    optionalMarketingGranted: number;
    withdrawnCount: number;
  }>({
    totalConsentedUsers: 0,
    currentVersionCount: 0,
    optionalTasteGranted: 0,
    optionalAnalyticsGranted: 0,
    optionalMarketingGranted: 0,
    withdrawnCount: 0,
  });
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);
  const [resolutionStatusInput, setResolutionStatusInput] =
    useState<DataRightsRequestStatus>('completed');
  const [resolutionNoteInput, setResolutionNoteInput] = useState('');

  // Optional blocks: Mới tham gia (compact) & Nick/Pass Accounts drawer
  const [showRecentBlock, setShowRecentBlock] = useState(false);
  const [showNickAccountsPanel, setShowNickAccountsPanel] = useState(false);
  const [simTick, setSimTick] = useState(0);

  const tableSectionRef = useRef<HTMLDivElement | null>(null);
  const currentRoleInfo = useMemo(() => getEffectiveAdminRoleInfo(), [refreshTick, simTick]);
  const backupFounderRecords = useMemo(() => getBackupFounderRecords(), [refreshTick, simTick]);
  const roleAuditLogs = useMemo(() => {
    const state = getAdminState();
    return (state.auditLogs || [])
      .filter(
        l =>
          l.type === 'user' ||
          l.eventCategory === 'founder_security' ||
          l.eventCategory === 'role_management' ||
          l.eventCategory === 'role_change'
      )
      .slice(0, 15);
  }, [refreshTick, simTick]);

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

  // Tải thống kê Consent & Hàng đợi Yêu cầu Quyền Dữ liệu Cá nhân từ Backend
  const fetchLegalComplianceSummary = useCallback(async () => {
    setActivePolicyMeta(getActivePolicyMetadata());
    try {
      const auth = getFirebaseAuth();
      const idToken = auth?.currentUser ? await auth.currentUser.getIdToken() : null;
      const res = await fetch('/api/founder-security/data-rights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({ action: 'list' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.ok) {
          if (Array.isArray(data.requests)) {
            setDataRightsQueue(data.requests);
          }
          if (data.consentStats) {
            setConsentStatsSummary(data.consentStats);
          }
          if (data.activePolicy) {
            setActivePolicyMeta(data.activePolicy);
          }
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchLegalComplianceSummary();
  }, [fetchLegalComplianceSummary, refreshTick, simTick]);

  // Query dữ liệu trang hiện tại từ Member Query Engine
  const queryResult = useMemo(() => {
    return queryMembersPage({
      page: currentPage,
      pageSize,
      roleFilter,
      statusFilter,
      verificationFilter,
      search: debouncedSearch,
      sortBy,
    });
  }, [currentPage, pageSize, roleFilter, statusFilter, verificationFilter, debouncedSearch, sortBy, refreshTick, simTick]);

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
    const fresh = getIndexedMemberByKey(member.email) || member;
    setPermissionModalTarget(fresh);
    if (fresh.pendingRoleAssignment) {
      const isPendingAdm = Boolean(
        fresh.pendingRoleAssignment.makeAdmin ||
          fresh.pendingRoleAssignment.requestedRole === 'admin'
      );
      setPermAdminChecked(isPendingAdm);
      setPermWebChecked(Boolean(fresh.pendingRoleAssignment.canManageWeb || isPendingAdm));
      setPermMapsChecked(Boolean(fresh.pendingRoleAssignment.canManageMaps || isPendingAdm));
    } else {
      setPermAdminChecked(Boolean(fresh.isAdmin && !fresh.isFounder));
      setPermWebChecked(Boolean(fresh.rawMember.canManageWeb || fresh.isAdmin));
      setPermMapsChecked(Boolean(fresh.rawMember.canManageMaps || fresh.isAdmin));
    }
    setPermConfirmIntent(false);
  }, []);

  const handleSavePermissionModal = () => {
    if (!permissionModalTarget) return;
    if (!currentRoleInfo.canManageRoles && !getSimulatedMembersCount()) {
      onShowToast('Chỉ Primary Founder hoặc Backup Founder mới có quyền cấp/thu hồi Admin & Quản lý.', 'warn');
      return;
    }
    if (permissionModalTarget.identityStatus === 'CONFLICT') {
      onShowToast(
        `Tài khoản đang ở trạng thái XUNG ĐỘT (${permissionModalTarget.conflictReason || 'cần kiểm tra'}). Không thể kích hoạt quyền trước khi xử lý.`,
        'warn'
      );
      return;
    }
    const res = updateMemberPermissionsUnified(permissionModalTarget.email, {
      makeAdmin: permAdminChecked,
      canManageWeb: permAdminChecked ? true : permWebChecked,
      canManageMaps: permAdminChecked ? true : permMapsChecked,
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

  const handleCancelPendingRole = () => {
    if (!permissionModalTarget) return;
    const res = cancelPendingRoleUnified(permissionModalTarget.email);
    if (!res.ok) {
      onShowToast(res.message, 'warn');
      return;
    }
    setPermissionModalTarget(null);
    setSimTick(t => t + 1);
    onRefresh();
    onShowToast(res.message, 'approve');
  };

  const handleRunReconciliation = async () => {
    if (reconcilingAccounts) return;
    setReconcilingAccounts(true);
    try {
      const res = await runAccountsReconciliationClient('apply');
      setSimTick(t => t + 1);
      onRefresh();
      onShowToast(res.message, res.ok ? 'approve' : 'warn');
    } finally {
      setReconcilingAccounts(false);
    }
  };

  const handleCopyBackupUsername = async (uid: string, username: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(username);
      }
      setCopiedBfUid(uid);
      onShowToast(`Đã sao chép tên đăng nhập dự phòng: ${username}`, 'approve');
      window.setTimeout(() => {
        setCopiedBfUid(prev => (prev === uid ? null : prev));
      }, 2200);
    } catch {
      onShowToast(`Tên đăng nhập dự phòng: ${username}`, 'approve');
    }
  };

  const handleOpenResetBackupPasswordModal = (uid: string, username: string) => {
    setResetPwdTargetUid(uid);
    setResetPwdTargetUsername(username);
    setNewBfPassword('');
    setConfirmNewBfPassword('');
    setResetPwdRecentAuthConfirmed(true);
  };

  const handleSubmitResetBackupPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdTargetUid) return;
    setResetPwdSubmitting(true);
    try {
      const res = await resetBackupFounderPasswordViaBackend({
        backupUid: resetPwdTargetUid,
        newPassword: newBfPassword,
        confirmNewPassword: confirmNewBfPassword,
        recentAuthConfirmed: resetPwdRecentAuthConfirmed,
      });
      if (!res.ok) {
        onShowToast(res.message, 'warn');
        setResetPwdSubmitting(false);
        return;
      }
      setNewBfPassword('');
      setConfirmNewBfPassword('');
      setResetPwdTargetUid(null);
      setSimTick(t => t + 1);
      onRefresh();
      onShowToast(res.message, 'approve');
    } finally {
      setResetPwdSubmitting(false);
    }
  };

  const handleRevokeBackupSessionsOnly = async (backupUid: string) => {
    try {
      const res = await revokeBackupFounderSessionsViaBackend(
        backupUid,
        'Primary Founder thu hồi phiên đăng nhập trên Founder Security Panel'
      );
      if (!res.ok) {
        onShowToast(res.message, 'warn');
        return;
      }
      setSimTick(t => t + 1);
      onRefresh();
      onShowToast(res.message, 'approve');
    } catch (err: any) {
      onShowToast(err?.message || 'Không thể thu hồi phiên đăng nhập.', 'warn');
    }
  };

  const handleSubmitVerifyRecoveryEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyEmailTargetUid) return;
    setVerifyEmailSubmitting(true);
    try {
      const res = await verifyBackupFounderRecoveryEmailViaBackend(
        verifyEmailTargetUid,
        verifyEmailInput
      );
      if (!res.ok) {
        onShowToast(res.message, 'warn');
        setVerifyEmailSubmitting(false);
        return;
      }
      setVerifyEmailTargetUid(null);
      setVerifyEmailInput('');
      setSimTick(t => t + 1);
      onRefresh();
      onShowToast(res.message, 'approve');
    } finally {
      setVerifyEmailSubmitting(false);
    }
  };

  const handleProvisionBackupFounder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bfConfirmIntent) {
      onShowToast('Vui lòng tích xác nhận chủ đích tạo Backup Founder của Primary Founder.', 'warn');
      return;
    }
    setBfSubmitting(true);
    try {
      const res = await provisionBackupFounderAccount({
        username: bfUsername,
        password: bfPassword,
        displayName: bfDisplayName,
        recoveryEmail: bfRecoveryEmail,
        confirmPrimaryFounderIntent: bfConfirmIntent,
      });
      if (!res.ok) {
        onShowToast(res.message, 'warn');
        setBfSubmitting(false);
        return;
      }
      setBfUsername('');
      setBfPassword('');
      setBfConfirmIntent(false);
      setIsProvisionBackupModalOpen(false);
      setSimTick(t => t + 1);
      onRefresh();
      onShowToast(res.message, 'approve');
    } finally {
      setBfSubmitting(false);
    }
  };

  const handleToggleBackupFounderActive = async (
    backupUid: string,
    nextActive: boolean,
    revokeSessions = false
  ) => {
    try {
      const res = await setBackupFounderActiveState(backupUid, nextActive, {
        revokeSessions,
        lockUid: !nextActive && revokeSessions,
        reason: nextActive
          ? 'Primary Founder kích hoạt lại trên Founder Dashboard'
          : 'Primary Founder thu hồi phiên / tạm ngưng trên Founder Dashboard',
      });
      setSimTick(t => t + 1);
      onRefresh();
      onShowToast(res.message, nextActive ? 'approve' : 'warn');
    } catch (err: any) {
      onShowToast(err?.message || 'Không thể thay đổi trạng thái Backup Founder.', 'warn');
    }
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
    { id: 'founder', label: 'Founder', count: counts.founder },
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
      title: 'FOUNDER & ADMIN',
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
    <div className="xh-members-redesign" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* ===================================================================== */}
      {/* 1. HEADER TRANG + SEARCH + FILTER TABS (COMPACT)                      */}
      {/* ===================================================================== */}
      <div
        style={{
          position: 'relative',
          zIndex: 20,
          background: theme.bgCard,
          borderRadius: '12px',
          border: `1px solid ${theme.border}`,
          boxShadow: theme.shadow,
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="reconcile-accounts-btn"
              disabled={reconcilingAccounts}
              onClick={handleRunReconciliation}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '34px',
                padding: '0 11px',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                background: theme.bgElevated,
                color: theme.textSecondary,
                fontSize: '12px',
                fontWeight: 700,
                cursor: reconcilingAccounts ? 'wait' : 'pointer',
              }}
              title="Tự động đối soát và liên kết UID Firebase Auth cho các tài khoản cũ đã đăng nhập"
            >
              <ShieldCheck size={13} />
              <span>{reconcilingAccounts ? 'Đang đối soát...' : 'Đối soát UID'}</span>
            </button>

            <button
              type="button"
              data-testid="toggle-role-audit-logs-btn"
              onClick={() => setShowRoleAuditLogsPanel(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                height: '34px',
                padding: '0 11px',
                borderRadius: '8px',
                border: `1px solid ${theme.border}`,
                background: showRoleAuditLogsPanel ? theme.accentSoft : theme.bgElevated,
                color: showRoleAuditLogsPanel ? theme.accent : theme.textSecondary,
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Xem lịch sử thay đổi quyền và sự kiện bảo mật Founder"
            >
              <History size={13} />
              <span>Lịch sử quyền ({roleAuditLogs.length})</span>
            </button>

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

      {/* ===================================================================== */}
      {/* PANEL 1A: ACCORDION "FOUNDER & BẢO MẬT" (7 MỤC — MẶC ĐỊNH ĐÓNG)        */}
      {/* ===================================================================== */}
      <div
        data-testid="founder-security-accordion"
        style={{
          background: theme.bgCard,
          borderRadius: '10px',
          border: `1px solid ${showBackupFounderPanel ? '#C4B5FD' : theme.border}`,
          boxShadow: theme.shadow,
          overflow: 'hidden',
        }}
      >
        <div
          data-testid="founder-security-accordion-header"
          onClick={() => setShowBackupFounderPanel(prev => !prev)}
          style={{
            padding: '9px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap',
            cursor: 'pointer',
            background: showBackupFounderPanel ? '#F5F3FF' : theme.bgCard,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#5B21B6' }}>
              🛡️ Founder & Bảo mật
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                background: '#FEF3C7',
                color: '#92400E',
                border: '1px solid #F59E0B',
              }}
            >
              👑 Founder: Dê Già Designer
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '999px',
                background: '#EDE9FE',
                color: '#5B21B6',
              }}
            >
              {backupFounderRecords.length} Backup Founder • 7 mục bảo mật
            </span>
          </div>
          <button
            type="button"
            data-testid="toggle-backup-founder-panel-btn"
            onClick={e => {
              e.stopPropagation();
              setShowBackupFounderPanel(prev => !prev);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              height: '26px',
              padding: '0 10px',
              borderRadius: '7px',
              border: `1px solid ${showBackupFounderPanel ? '#C4B5FD' : theme.border}`,
              background: showBackupFounderPanel ? '#EDE9FE' : theme.bgElevated,
              color: showBackupFounderPanel ? '#5B21B6' : theme.textPrimary,
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>{showBackupFounderPanel ? 'Thu gọn' : 'Mở Founder & Bảo mật'}</span>
            {showBackupFounderPanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>

        {showBackupFounderPanel && (
        <div
          data-testid="backup-founder-panel"
          style={{
            background: theme.bgCard,
            borderTop: `1px solid #DDD6FE`,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#5B21B6' }}>
                  🛡️ Bảng Bảo mật tài khoản (Founder Security Panel)
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: '#FEF3C7',
                    color: '#92400E',
                    border: '1px solid #F59E0B',
                  }}
                >
                  👑 Primary Founder: Dê Già Designer
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: '#EDE9FE',
                    color: '#5B21B6',
                    border: '1px solid #C4B5FD',
                  }}
                >
                  Privileged Backend + Firebase Auth
                </span>
              </div>
              <div style={{ fontSize: '11.5px', color: theme.textMuted, marginTop: '3px' }}>
                Quản lý tập trung tài khoản <b>Backup Founder</b> (Tên đăng nhập, Trạng thái Active/Locked, Email khôi phục thực, Đặt lại mật khẩu không cần mật khẩu cũ, Khóa/Mở khóa, Thu hồi phiên & Nhật ký bảo mật). Mật khẩu tuyệt đối không bao giờ hiển thị hay lưu trong RTDB/LocalStorage/Git.
              </div>
            </div>

            {currentRoleInfo.isPrimaryFounder ? (
              <button
                type="button"
                data-testid="open-provision-backup-founder-btn"
                onClick={() => setIsProvisionBackupModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  height: '32px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#6D28D9',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Plus size={13} /> Khởi tạo Backup Founder
              </button>
            ) : (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#92400E',
                  background: '#FEF3C7',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid #F59E0B',
                }}
              >
                Chỉ Primary Founder (Dê Già Designer) có quyền điều khiển bảo mật Backup Founder
              </span>
            )}
          </div>

          {backupFounderRecords.length === 0 ? (
            <div
              style={{
                padding: '12px',
                borderRadius: '9px',
                background: theme.bgElevated,
                border: `1px dashed ${theme.border}`,
                fontSize: '12px',
                color: theme.textSecondary,
              }}
            >
              Chưa khởi tạo tài khoản Backup Founder nào. Primary Founder bấm <b>"Khởi tạo Backup Founder"</b> để thiết lập tài khoản dự phòng bằng tên đăng nhập, mật khẩu và email khôi phục thực.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                gap: '10px',
              }}
            >
              {backupFounderRecords.map(bf => (
                <div
                  key={bf.uid}
                  data-testid={`backup-founder-card-${bf.uid}`}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    background: theme.bgElevated,
                    border: `1.5px solid ${bf.active ? '#C4B5FD' : '#FCA5A5'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  {/* 1. Tên đăng nhập dự phòng (xem & sao chép) + 2. Trạng thái tài khoản (Active / Locked) */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: theme.textPrimary }}>
                        {bf.displayName || `Backup Founder (@${bf.username})`}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11.5px', color: theme.textSecondary }}>
                          1. Tên đăng nhập dự phòng:{' '}
                          <b data-testid={`backup-founder-username-${bf.uid}`} style={{ color: '#5B21B6' }}>
                            @{bf.username}
                          </b>
                        </span>
                        <button
                          type="button"
                          data-testid={`copy-backup-username-btn-${bf.uid}`}
                          onClick={() => handleCopyBackupUsername(bf.uid, bf.username)}
                          style={{
                            height: '22px',
                            padding: '0 8px',
                            borderRadius: '6px',
                            border: '1px solid #C4B5FD',
                            background: copiedBfUid === bf.uid ? '#D1FAE5' : '#EDE9FE',
                            color: copiedBfUid === bf.uid ? '#065F46' : '#5B21B6',
                            fontSize: '10.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {copiedBfUid === bf.uid ? '✓ Đã sao chép' : 'Sao chép'}
                        </button>
                      </div>
                    </div>

                    {/* 2. Trạng thái tài khoản — Active / Locked */}
                    <span
                      data-testid={`backup-founder-status-badge-${bf.uid}`}
                      style={{
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: '999px',
                        background: bf.active ? '#D1FAE5' : '#FEE2E2',
                        color: bf.active ? '#065F46' : '#991B1B',
                        border: `1px solid ${bf.active ? '#6EE7B7' : '#FCA5A5'}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      2. {bf.active ? 'Active (Hoạt động)' : 'Locked (Đã khóa)'}
                    </span>
                  </div>

                  {/* 3. Email khôi phục — hiển thị và xác minh */}
                  <div
                    style={{
                      padding: '7px 10px',
                      borderRadius: '8px',
                      background: theme.bgCard,
                      border: `1px solid ${theme.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      flexWrap: 'wrap',
                      fontSize: '11.5px',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span style={{ color: theme.textMuted }}>3. Email khôi phục: </span>
                      <b
                        data-testid={`backup-founder-recovery-email-${bf.uid}`}
                        style={{ color: theme.textPrimary, wordBreak: 'break-all' }}
                      >
                        {bf.recoveryEmail || 'Chưa cấu hình email thực'}
                      </b>{' '}
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '999px',
                          background: bf.recoveryEmailVerified ? '#D1FAE5' : '#FEF3C7',
                          color: bf.recoveryEmailVerified ? '#065F46' : '#92400E',
                        }}
                      >
                        {bf.recoveryEmailVerified ? '✓ Đã xác minh' : 'Chưa xác minh'}
                      </span>
                    </div>
                    {currentRoleInfo.isPrimaryFounder && (
                      <button
                        type="button"
                        data-testid={`verify-recovery-email-btn-${bf.uid}`}
                        onClick={() => {
                          setVerifyEmailTargetUid(bf.uid);
                          setVerifyEmailInput(bf.recoveryEmail || '');
                        }}
                        style={{
                          height: '24px',
                          padding: '0 8px',
                          borderRadius: '6px',
                          border: `1px solid ${theme.border}`,
                          background: theme.bgElevated,
                          color: theme.textPrimary,
                          fontSize: '10.5px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {bf.recoveryEmailVerified ? 'Đổi / Xác minh lại' : 'Xác minh email'}
                      </button>
                    )}
                  </div>

                  {/* Thông tin phiên bảo mật */}
                  <div style={{ fontSize: '11px', color: theme.textMuted, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                    <span>
                      UID: <code>{bf.uid.slice(0, 6)}...{bf.uid.slice(-4)}</code> • Phiên (Epoch): <b>#{bf.sessionEpoch || 1}</b>
                    </span>
                    {bf.lastPasswordResetAt && (
                      <span>Đặt lại MK gần nhất: {formatShortDateVi(bf.lastPasswordResetAt)}</span>
                    )}
                  </div>

                  {/* 4. Nút Đặt lại mật khẩu + 5. Nút Khóa / Mở khóa tài khoản + 6. Nút Thu hồi phiên đăng nhập */}
                  {currentRoleInfo.isPrimaryFounder && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                      {/* 4. Nút Đặt lại mật khẩu */}
                      <button
                        type="button"
                        data-testid={`open-reset-backup-password-btn-${bf.uid}`}
                        onClick={() => handleOpenResetBackupPasswordModal(bf.uid, bf.username)}
                        style={{
                          flex: '1 1 130px',
                          height: '30px',
                          borderRadius: '7px',
                          border: '1px solid #C4B5FD',
                          background: '#6D28D9',
                          color: '#FFFFFF',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        4. Đặt lại mật khẩu
                      </button>

                      {/* 5. Nút Khóa / Mở khóa tài khoản */}
                      {bf.active ? (
                        <button
                          type="button"
                          data-testid={`toggle-lock-backup-founder-btn-${bf.uid}`}
                          onClick={() => handleToggleBackupFounderActive(bf.uid, false, true)}
                          style={{
                            flex: '1 1 120px',
                            height: '30px',
                            borderRadius: '7px',
                            border: '1px solid #FCA5A5',
                            background: '#FEF2F2',
                            color: '#DC2626',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          5. Khóa tài khoản
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid={`toggle-lock-backup-founder-btn-${bf.uid}`}
                          onClick={() => handleToggleBackupFounderActive(bf.uid, true, false)}
                          style={{
                            flex: '1 1 120px',
                            height: '30px',
                            borderRadius: '7px',
                            border: '1px solid #6EE7B7',
                            background: '#ECFDF5',
                            color: '#047857',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          5. Mở khóa tài khoản
                        </button>
                      )}

                      {/* 6. Nút Thu hồi phiên đăng nhập */}
                      <button
                        type="button"
                        data-testid={`revoke-backup-sessions-btn-${bf.uid}`}
                        onClick={() => handleRevokeBackupSessionsOnly(bf.uid)}
                        style={{
                          flex: '1 1 135px',
                          height: '30px',
                          borderRadius: '7px',
                          border: '1px solid #F59E0B',
                          background: '#FFFBEB',
                          color: '#B45309',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        6. Thu hồi phiên đăng nhập
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 7. Lịch sử thao tác bảo mật (nhúng trực tiếp trong Founder Security Panel) */}
          <div
            data-testid="founder-security-history-list"
            style={{
              padding: '10px 12px',
              borderRadius: '10px',
              background: theme.bgElevated,
              border: `1px solid ${theme.border}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 800, color: theme.textPrimary }}>
                7. 📜 Lịch sử thao tác bảo mật & phân quyền gần nhất ({roleAuditLogs.length})
              </span>
              <span style={{ fontSize: '10.5px', color: theme.textMuted }}>
                Không bao giờ ghi mật khẩu/token vào nhật ký
              </span>
            </div>
            {roleAuditLogs.length === 0 ? (
              <div style={{ fontSize: '11.5px', color: theme.textMuted }}>
                Chưa có thao tác bảo mật nào được ghi nhận.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '140px', overflowY: 'auto' }}>
                {roleAuditLogs.slice(0, 6).map(log => (
                  <div
                    key={log.id}
                    style={{
                      padding: '5px 8px',
                      borderRadius: '6px',
                      background: theme.bgCard,
                      border: `1px solid ${theme.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      fontSize: '11px',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: theme.textPrimary }}>{log.action}</span>{' '}
                      <span style={{ color: theme.textSecondary }}>— {log.target}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: theme.textMuted, whiteSpace: 'nowrap' }}>
                      {formatShortDateVi(log.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* PANEL 1C: ACCORDION "PHÁP LÝ & QUYỀN DỮ LIỆU" (MẶC ĐỊNH ĐÓNG)          */}
      {/* (Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15 & Nghị định 356/2025/NĐ-CP) */}
      {/* ===================================================================== */}
      {(currentRoleInfo.isFounder || currentRoleInfo.roleTier === 'admin') && (
        <div
          data-testid="founder-legal-compliance-panel"
          style={{
            background: theme.bgCard,
            borderRadius: '10px',
            border: `1px solid ${showLegalCompliancePanel ? theme.accentBorder : theme.border}`,
            boxShadow: theme.shadow,
            overflow: 'hidden',
          }}
        >
          <div
            data-testid="legal-compliance-accordion-header"
            onClick={() => setShowLegalCompliancePanel(prev => !prev)}
            style={{
              padding: '9px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexWrap: 'wrap',
              cursor: 'pointer',
              background: showLegalCompliancePanel ? theme.accentSoft : theme.bgCard,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: theme.textPrimary }}>
                ⚖️ Pháp lý & Quyền dữ liệu
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: '#ECFDF5',
                  color: '#065F46',
                  border: '1px solid #A7F3D0',
                }}
              >
                Chính sách {activePolicyMeta.version}
              </span>
              <span style={{ fontSize: '11px', color: theme.textMuted }}>
                {consentStatsSummary.totalConsentedUsers} đồng ý · {dataRightsQueue.length} yêu cầu dữ liệu
              </span>
            </div>
            <button
              type="button"
              data-testid="toggle-legal-compliance-panel-btn"
              onClick={e => {
                e.stopPropagation();
                setShowLegalCompliancePanel(prev => !prev);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                height: '26px',
                padding: '0 10px',
                borderRadius: '7px',
                border: `1px solid ${theme.border}`,
                background: theme.bgElevated,
                color: theme.textPrimary,
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <span>{showLegalCompliancePanel ? 'Thu gọn' : 'Mở Pháp lý & Quyền dữ liệu'}</span>
              {showLegalCompliancePanel ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {showLegalCompliancePanel && (
            <div style={{ padding: '14px 16px', borderTop: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* 1. Thống kê trạng thái xác nhận (Ẩn danh, không lộ dữ liệu nhạy cảm) */}
              <div
                data-testid="founder-consent-stats-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    padding: '9px 11px',
                    borderRadius: '9px',
                    background: theme.bgElevated,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <div style={{ fontSize: '10.5px', color: theme.textMuted }}>Đã lưu Consent Record</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: theme.textPrimary }}>
                    {consentStatsSummary.totalConsentedUsers} thành viên
                  </div>
                  <div style={{ fontSize: '10px', color: '#059669' }}>
                    Đúng phiên bản hiện tại: {consentStatsSummary.currentVersionCount}
                  </div>
                </div>

                <div
                  style={{
                    padding: '9px 11px',
                    borderRadius: '9px',
                    background: theme.bgElevated,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <div style={{ fontSize: '10.5px', color: theme.textMuted }}>Đồng ý tùy chọn D1 (Khẩu vị/SĐT)</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: theme.textPrimary }}>
                    {consentStatsSummary.optionalTasteGranted}
                  </div>
                  <div style={{ fontSize: '10px', color: theme.textMuted }}>Tự nguyện bật</div>
                </div>

                <div
                  style={{
                    padding: '9px 11px',
                    borderRadius: '9px',
                    background: theme.bgElevated,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <div style={{ fontSize: '10.5px', color: theme.textMuted }}>Đồng ý tùy chọn D2 (Phân tích)</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: theme.textPrimary }}>
                    {consentStatsSummary.optionalAnalyticsGranted}
                  </div>
                  <div style={{ fontSize: '10px', color: theme.textMuted }}>Tự nguyện bật</div>
                </div>

                <div
                  style={{
                    padding: '9px 11px',
                    borderRadius: '9px',
                    background: theme.bgElevated,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <div style={{ fontSize: '10.5px', color: theme.textMuted }}>Đã rút lại đồng ý / Yêu cầu dữ liệu</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#D97706' }}>
                    {consentStatsSummary.withdrawnCount} rút · {dataRightsQueue.length} yêu cầu
                  </div>
                  <div style={{ fontSize: '10px', color: theme.textMuted }}>Theo dõi thời gian thực</div>
                </div>
              </div>

              {/* 2. Quản lý Yêu cầu Quyền Dữ liệu Cá nhân (Data Rights Requests Queue) */}
              <div
                data-testid="founder-data-rights-queue"
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: theme.bgElevated,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, color: theme.textPrimary }}>
                    📋 Hàng đợi Yêu cầu Quyền Dữ liệu Cá nhân ({dataRightsQueue.length})
                  </span>
                  <button
                    type="button"
                    onClick={fetchLegalComplianceSummary}
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      color: theme.accent,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Làm mới
                  </button>
                </div>

                {dataRightsQueue.length === 0 ? (
                  <div style={{ fontSize: '11.5px', color: theme.textMuted }}>
                    Hiện không có yêu cầu quyền dữ liệu cá nhân nào đang chờ xử lý.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {dataRightsQueue.slice(0, 8).map(req => (
                      <div
                        key={req.requestId}
                        style={{
                          padding: '8px 10px',
                          borderRadius: '8px',
                          background: theme.bgCard,
                          border: `1px solid ${theme.border}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '5px',
                          fontSize: '11.5px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                          <div>
                            <span style={{ fontWeight: 800, color: theme.textPrimary }}>
                              [{DATA_RIGHTS_REQUEST_TYPE_LABELS[req.requestType]?.label || req.requestType}]
                            </span>{' '}
                            <span style={{ color: theme.textSecondary }}>
                              — {req.userDisplayName} (<code>{req.firebaseAuthUid.slice(0, 6)}...</code>)
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 700,
                              padding: '1px 7px',
                              borderRadius: '999px',
                              background:
                                req.status === 'completed'
                                  ? '#D1FAE5'
                                  : req.status === 'rejected_legal_obligation'
                                  ? '#FEE2E2'
                                  : '#FEF3C7',
                              color:
                                req.status === 'completed'
                                  ? '#065F46'
                                  : req.status === 'rejected_legal_obligation'
                                  ? '#991B1B'
                                  : '#92400E',
                            }}
                          >
                            {req.status}
                          </span>
                        </div>
                        <div style={{ color: theme.textSecondary }}>{req.details}</div>
                        {req.resolutionNote && (
                          <div style={{ fontSize: '11px', color: '#059669' }}>
                            Kết quả xử lý: {req.resolutionNote}
                          </div>
                        )}
                        {req.status === 'pending' || req.status === 'in_progress' ? (
                          resolvingRequestId === req.requestId ? (
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                              <select
                                value={resolutionStatusInput}
                                onChange={e =>
                                  setResolutionStatusInput(e.target.value as DataRightsRequestStatus)
                                }
                                style={{
                                  height: '28px',
                                  borderRadius: '6px',
                                  border: `1px solid ${theme.border}`,
                                  padding: '0 6px',
                                  fontSize: '11px',
                                }}
                              >
                                <option value="in_progress">Đang xử lý (in_progress)</option>
                                <option value="completed">Đã hoàn tất (completed)</option>
                                <option value="rejected_legal_obligation">
                                  Giữ lại theo nghĩa vụ pháp lý (rejected_legal_obligation)
                                </option>
                              </select>
                              <input
                                type="text"
                                placeholder="Ghi chú kết quả xử lý (ghi vào Audit Log)..."
                                value={resolutionNoteInput}
                                onChange={e => setResolutionNoteInput(e.target.value)}
                                style={{
                                  flex: 1,
                                  minWidth: '180px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  border: `1px solid ${theme.border}`,
                                  padding: '0 8px',
                                  fontSize: '11px',
                                }}
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  const res = await processDataRightsRequestViaBackend({
                                    requestId: req.requestId,
                                    status: resolutionStatusInput,
                                    resolutionNote:
                                      resolutionNoteInput.trim() ||
                                      'Đã xử lý theo quy trình Bảo vệ dữ liệu cá nhân.',
                                  });
                                  onShowToast(res.message);
                                  if (res.ok) {
                                    setResolvingRequestId(null);
                                    setResolutionNoteInput('');
                                    fetchLegalComplianceSummary();
                                    onRefresh();
                                  }
                                }}
                                style={{
                                  height: '28px',
                                  padding: '0 10px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: '#059669',
                                  color: '#FFF',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Lưu xử lý
                              </button>
                            </div>
                          ) : (
                            <div>
                              <button
                                type="button"
                                onClick={() => {
                                  setResolvingRequestId(req.requestId);
                                  setResolutionStatusInput('completed');
                                  setResolutionNoteInput('');
                                }}
                                style={{
                                  height: '24px',
                                  padding: '0 8px',
                                  borderRadius: '6px',
                                  border: `1px solid ${theme.border}`,
                                  background: theme.bgElevated,
                                  color: theme.textPrimary,
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                }}
                              >
                                Xử lý yêu cầu & Ghi nhật ký
                              </button>
                            </div>
                          )
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Quản lý Phiên bản Chính sách (Chỉ dành cho Primary Founder) */}
              {currentRoleInfo.isPrimaryFounder && (
                <div
                  data-testid="founder-policy-version-manager"
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: theme.bgElevated,
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 800, color: theme.textPrimary }}>
                    🔖 Phát hành Phiên bản Chính sách mới (Chỉ yêu cầu xác nhận lại khi có thay đổi trọng yếu)
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Mã phiên bản mới (VD: 2026.12.01-v3.1)"
                      value={newPolicyVersionInput}
                      onChange={e => setNewPolicyVersionInput(e.target.value)}
                      style={{
                        flex: '1 1 160px',
                        height: '30px',
                        borderRadius: '7px',
                        border: `1px solid ${theme.border}`,
                        padding: '0 9px',
                        fontSize: '11.5px',
                        background: theme.bgCard,
                        color: theme.textPrimary,
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Tiêu đề cập nhật..."
                      value={newPolicyTitleInput}
                      onChange={e => setNewPolicyTitleInput(e.target.value)}
                      style={{
                        flex: '2 1 220px',
                        height: '30px',
                        borderRadius: '7px',
                        border: `1px solid ${theme.border}`,
                        padding: '0 9px',
                        fontSize: '11.5px',
                        background: theme.bgCard,
                        color: theme.textPrimary,
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Tóm tắt nội dung thay đổi (Changelog)..."
                      value={newPolicyChangesInput}
                      onChange={e => setNewPolicyChangesInput(e.target.value)}
                      style={{
                        flex: '2 1 220px',
                        height: '30px',
                        borderRadius: '7px',
                        border: `1px solid ${theme.border}`,
                        padding: '0 9px',
                        fontSize: '11.5px',
                        background: theme.bgCard,
                        color: theme.textPrimary,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: theme.textSecondary, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={newPolicyRequiresReconsent}
                        onChange={e => setNewPolicyRequiresReconsent(e.target.checked)}
                      />
                      <span>Yêu cầu người dùng xác nhận lại ở lần đăng nhập tiếp theo (<code>requiresReconsent</code>)</span>
                    </label>
                    <button
                      type="button"
                      disabled={publishingPolicy}
                      onClick={async () => {
                        if (!newPolicyVersionInput.trim() || !newPolicyTitleInput.trim()) {
                          onShowToast('Vui lòng nhập mã phiên bản và tiêu đề cập nhật.');
                          return;
                        }
                        setPublishingPolicy(true);
                        try {
                          const res = await publishPolicyVersionViaBackend({
                            version: newPolicyVersionInput.trim(),
                            privacyNoticeVersion: newPolicyVersionInput.trim(),
                            communityGuidelinesVersion: newPolicyVersionInput.trim(),
                            effectiveDate: new Date().toISOString().slice(0, 10),
                            title: newPolicyTitleInput.trim(),
                            changes: [
                              newPolicyChangesInput.trim() ||
                                'Cập nhật điều khoản và thông báo bảo vệ dữ liệu cá nhân.',
                            ],
                            requiresReconsent: newPolicyRequiresReconsent,
                          });
                          onShowToast(res.message);
                          if (res.ok && res.policy) {
                            setActivePolicyMeta(res.policy);
                            setNewPolicyVersionInput('');
                            setNewPolicyTitleInput('');
                            setNewPolicyChangesInput('');
                          }
                        } finally {
                          setPublishingPolicy(false);
                        }
                      }}
                      style={{
                        height: '30px',
                        padding: '0 12px',
                        borderRadius: '7px',
                        border: 'none',
                        background: '#B45309',
                        color: '#FFF',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {publishingPolicy ? 'Đang phát hành...' : 'Phát hành phiên bản chính sách'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* PANEL 1B: LỊCH SỬ THAY ĐỔI QUYỀN & NHẬT KÝ BẢO MẬT FOUNDER            */}
      {/* ===================================================================== */}
      {showRoleAuditLogsPanel && (
        <div
          data-testid="role-audit-logs-panel"
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
              marginBottom: '8px',
            }}
          >
            <div style={{ fontSize: '13.5px', fontWeight: 800 }}>
              📜 Lịch sử Thay đổi Phân quyền & Bảo mật Founder
            </div>
            <button
              type="button"
              onClick={() => setShowRoleAuditLogsPanel(false)}
              style={{
                border: 'none',
                background: 'transparent',
                color: theme.textMuted,
                cursor: 'pointer',
              }}
            >
              <X size={15} />
            </button>
          </div>
          {roleAuditLogs.length === 0 ? (
            <div style={{ fontSize: '12px', color: theme.textMuted }}>
              Chưa có nhật ký thay đổi phân quyền nào.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
              {roleAuditLogs.map(log => (
                <div
                  key={log.id}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '8px',
                    background: theme.bgElevated,
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    fontSize: '11.5px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 700, color: theme.textPrimary }}>{log.action}</span>{' '}
                    <span style={{ color: theme.textSecondary }}>— {log.target}</span>
                  </div>
                  <span style={{ fontSize: '10.5px', color: theme.textMuted, whiteSpace: 'nowrap' }}>
                    {formatShortDateVi(log.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
      {/* 2. ACCORDION TÓM TẮT NHÂN SỰ VẬN HÀNH (THU GỌN MẶC ĐỊNH ĐỂ TRÁNH TRÙNG) */}
      {/* ===================================================================== */}
      <section aria-label="Quản trị và Quản lý" data-testid="operators-summary-accordion">
        <div
          onClick={() => setShowOperatorsSummary(prev => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 14px',
            borderRadius: '10px',
            background: theme.bgCard,
            border: `1px solid ${theme.border}`,
            cursor: 'pointer',
            marginBottom: showOperatorsSummary ? '8px' : 0,
          }}
        >
          <span
            style={{
              fontSize: '12px',
              fontWeight: 800,
              color: theme.textSecondary,
            }}
          >
            👥 Tóm tắt Nhân sự Vận hành (Admin: {counts.admin} · QL Web: {counts.web} · QL Maps: {counts.maps})
          </span>
          <button
            type="button"
            data-testid="toggle-operators-summary-btn"
            onClick={e => {
              e.stopPropagation();
              setShowOperatorsSummary(prev => !prev);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              height: '24px',
              padding: '0 8px',
              borderRadius: '6px',
              border: `1px solid ${theme.border}`,
              background: theme.bgElevated,
              color: theme.textSecondary,
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span>{showOperatorsSummary ? 'Ẩn sơ đồ' : 'Xem sơ đồ 3 cột'}</span>
            {showOperatorsSummary ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {showOperatorsSummary && (
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
        )}
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
            {/* Dropdown Trạng thái xác minh V6 */}
            <select
              data-testid="members-verification-filter"
              value={verificationFilter}
              onChange={e => {
                setVerificationFilter(e.target.value as MemberVerificationFilter);
                setCurrentPage(1);
              }}
              aria-label="Lọc theo trạng thái xác minh UID"
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
              <option value="all">Tất cả xác minh ({counts.all})</option>
              <option value="verified">Đã xác minh ({counts.verifiedCount})</option>
              <option value="pending_verification">Chờ xác minh ({counts.pendingVerificationCount})</option>
              <option value="pending_role_activation">
                Chờ kích hoạt quyền ({counts.pendingRoleActivationCount})
              </option>
              <option value="conflict">Xung đột — cần xử lý ({counts.conflictCount})</option>
            </select>

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
                      style={{ display: 'flex', gap: '4px', cursor: 'pointer', flexWrap: 'wrap', justifyContent: 'flex-end' }}
                    >
                      {member.isFounder && <RoleBadgeChip type="founder" />}
                      {member.isAdmin && <RoleBadgeChip type="admin" />}
                      {!member.isAdmin && member.isWebManager && <RoleBadgeChip type="web" />}
                      {!member.isAdmin && member.isMapsManager && <RoleBadgeChip type="maps" />}
                      {!member.isFounder &&
                        !member.isAdmin &&
                        !member.isWebManager &&
                        !member.isMapsManager &&
                        member.pendingRoleAssignment && (
                          <RoleBadgeChip
                            type={
                              member.pendingRoleAssignment.makeAdmin ||
                              member.pendingRoleAssignment.requestedRole === 'admin'
                                ? 'pending_role_admin'
                                : member.pendingRoleAssignment.canManageWeb &&
                                  member.pendingRoleAssignment.canManageMaps
                                ? 'pending_role_both'
                                : member.pendingRoleAssignment.canManageWeb
                                ? 'pending_role_web'
                                : 'pending_role_maps'
                            }
                          />
                        )}
                      {member.identityStatus === 'CONFLICT' ? (
                        <RoleBadgeChip type="conflict_uid" />
                      ) : member.isUidVerified ? (
                        <RoleBadgeChip type="verified_uid" />
                      ) : (
                        <RoleBadgeChip type="pending_verification" />
                      )}
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
      {/* MODAL 1: CẤP QUYỀN THÀNH VIÊN (FOUNDER DASHBOARD — 5 TIER RBAC)        */}
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
              maxWidth: '410px',
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
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Phân quyền thành viên</h3>
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
              <div style={{ fontSize: '10.5px', color: theme.textMuted, marginTop: '4px', lineHeight: 1.5 }}>
                {permissionModalTarget.identityStatus === 'CONFLICT' ? (
                  <span style={{ color: '#B91C1C', fontWeight: 700 }}>
                    ⚠️ Xung đột danh tính ({permissionModalTarget.conflictReason || 'cần kiểm tra'})
                  </span>
                ) : permissionModalTarget.isUidVerified ? (
                  <>
                    <span style={{ color: '#047857', fontWeight: 700 }}>✓ Đã xác minh</span> • Firebase UID:{' '}
                    <code style={{ fontWeight: 700 }}>{permissionModalTarget.uid}</code>
                    {permissionModalTarget.legacyUid &&
                      permissionModalTarget.legacyUid !== permissionModalTarget.uid && (
                        <span>
                          {' '}
                          • Legacy ID: <code>{permissionModalTarget.legacyUid}</code>
                        </span>
                      )}
                  </>
                ) : (
                  <>
                    <span style={{ color: '#B45309', fontWeight: 700 }}>⏳ Chờ xác minh</span> • Legacy ID:{' '}
                    <code style={{ fontWeight: 700 }}>
                      {permissionModalTarget.legacyUid || permissionModalTarget.uid}
                    </code>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                {permissionModalTarget.isPrimaryFounder && <RoleBadgeChip type="primary_founder" />}
                {permissionModalTarget.isBackupFounder && <RoleBadgeChip type="backup_founder" />}
                {!permissionModalTarget.isFounder && permissionModalTarget.isAdmin && (
                  <RoleBadgeChip type="admin" />
                )}
                {!permissionModalTarget.isAdmin && permissionModalTarget.isWebManager && (
                  <RoleBadgeChip type="web" />
                )}
                {!permissionModalTarget.isAdmin && permissionModalTarget.isMapsManager && (
                  <RoleBadgeChip type="maps" />
                )}
                {permissionModalTarget.pendingRoleAssignment && (
                  <RoleBadgeChip
                    type={
                      permissionModalTarget.pendingRoleAssignment.makeAdmin ||
                      permissionModalTarget.pendingRoleAssignment.requestedRole === 'admin'
                        ? 'pending_role_admin'
                        : permissionModalTarget.pendingRoleAssignment.canManageWeb &&
                          permissionModalTarget.pendingRoleAssignment.canManageMaps
                        ? 'pending_role_both'
                        : permissionModalTarget.pendingRoleAssignment.canManageWeb
                        ? 'pending_role_web'
                        : 'pending_role_maps'
                    }
                  />
                )}
                {permissionModalTarget.identityStatus === 'CONFLICT' ? (
                  <RoleBadgeChip type="conflict_uid" />
                ) : permissionModalTarget.isUidVerified ? (
                  <RoleBadgeChip type="verified_uid" />
                ) : (
                  <RoleBadgeChip type="pending_verification" />
                )}
              </div>
            </div>

            {permissionModalTarget.isPrimaryFounder ? (
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
                👑 Tài khoản <b>Primary Founder (Dê Già Designer)</b> sở hữu toàn quyền hệ thống tối cao. Không tài khoản nào (kể cả Backup Founder hay Admin) được phép hạ quyền, khóa hoặc xóa.
              </div>
            ) : permissionModalTarget.isBackupFounder ? (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '9px',
                  background: '#EDE9FE',
                  border: '1px solid #C4B5FD',
                  color: '#5B21B6',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '14px',
                }}
              >
                🛡️ Đây là tài khoản <b>Backup Founder</b>. Primary Founder có thể kích hoạt / tạm ngưng hoặc thu hồi phiên trong bảng <b>"Founder & Bảo mật"</b>.
              </div>
            ) : permissionModalTarget.identityStatus === 'CONFLICT' ? (
              <div
                data-testid="permission-modal-conflict-box"
                style={{
                  padding: '10px 12px',
                  borderRadius: '9px',
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  color: '#991B1B',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '14px',
                }}
              >
                ⚠️ Tài khoản này đang ở trạng thái <b>Xung đột — cần xử lý</b> (<code>{permissionModalTarget.conflictReason || 'IDENTITY_CONFLICT'}</code>). Hệ thống tạm chặn kích hoạt quyền cho đến khi xác minh rõ danh tính.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                {!currentRoleInfo.canManageRoles && !getSimulatedMembersCount() && (
                  <div
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: '#FEF3C7',
                      border: '1px solid #F59E0B',
                      color: '#92400E',
                      fontSize: '11.5px',
                      fontWeight: 600,
                    }}
                  >
                    🔒 Chỉ Primary Founder hoặc Backup Founder mới có quyền cấp/thu hồi vai trò Admin & Quản lý.
                  </div>
                )}

                {!permissionModalTarget.isUidVerified && (
                  <div
                    data-testid="pending-verification-info-banner"
                    style={{
                      padding: '9px 11px',
                      borderRadius: '8px',
                      background: '#FFFBEB',
                      border: '1px solid #FCD34D',
                      color: '#92400E',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      lineHeight: 1.45,
                    }}
                  >
                    ⏳ Tài khoản này sẽ nhận quyền ngay khi chủ tài khoản đăng nhập Google thành công.
                  </div>
                )}

                {permissionModalTarget.pendingRoleAssignment && (
                  <div
                    data-testid="pending-role-status-box"
                    style={{
                      padding: '9px 11px',
                      borderRadius: '8px',
                      background: '#EFF6FF',
                      border: '1px solid #93C5FD',
                      color: '#1E3A8A',
                      fontSize: '11.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>
                        🕐 Đang có quyền chờ kích hoạt (v{permissionModalTarget.pendingRoleAssignment.revision || 1}):{' '}
                        {permissionModalTarget.pendingRoleAssignment.makeAdmin ||
                        permissionModalTarget.pendingRoleAssignment.requestedRole === 'admin'
                          ? 'Admin'
                          : permissionModalTarget.pendingRoleAssignment.canManageWeb &&
                            permissionModalTarget.pendingRoleAssignment.canManageMaps
                          ? 'Quản lý Web + Maps'
                          : permissionModalTarget.pendingRoleAssignment.canManageWeb
                          ? 'Quản lý Web'
                          : 'Quản lý Maps'}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#1D4ED8' }}>
                        Bạn có thể chỉnh vai trò bên dưới rồi bấm Lưu quyền chờ để cập nhật, hoặc hủy quyền chờ.
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid="cancel-pending-role-btn"
                      onClick={handleCancelPendingRole}
                      style={{
                        height: '26px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: '1px solid #FCA5A5',
                        background: '#FEF2F2',
                        color: '#B91C1C',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Hủy quyền chờ
                    </button>
                  </div>
                )}

                {/* Chọn nhanh vai trò 1 chạm (Fast Role Assignment) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '2px' }}>
                  {[
                    { label: 'Thành viên', admin: false, web: false, maps: false },
                    { label: 'Quản lý Web', admin: false, web: true, maps: false },
                    { label: 'Quản lý Maps', admin: false, web: false, maps: true },
                    { label: 'Web + Maps', admin: false, web: true, maps: true },
                    { label: '👑 Admin', admin: true, web: true, maps: true },
                  ].map(preset => {
                    const isPresetActive =
                      permAdminChecked === preset.admin &&
                      (preset.admin || (permWebChecked === preset.web && permMapsChecked === preset.maps));
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setPermAdminChecked(preset.admin);
                          setPermWebChecked(preset.web);
                          setPermMapsChecked(preset.maps);
                        }}
                        style={{
                          height: '26px',
                          padding: '0 9px',
                          borderRadius: '999px',
                          border: isPresetActive ? `1.5px solid ${theme.accent}` : `1px solid ${theme.border}`,
                          background: isPresetActive ? theme.accentSoft : theme.bgElevated,
                          color: isPresetActive ? theme.accent : theme.textSecondary,
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Cấp quyền ADMIN */}
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '9px',
                    border: permAdminChecked
                      ? `1.5px solid #DC2626`
                      : `1px solid ${theme.border}`,
                    background: permAdminChecked ? 'rgba(220, 38, 38, 0.07)' : theme.bgElevated,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    data-testid="perm-checkbox-admin"
                    checked={permAdminChecked}
                    onChange={e => {
                      const checked = e.target.checked;
                      setPermAdminChecked(checked);
                      if (checked) {
                        setPermWebChecked(true);
                        setPermMapsChecked(true);
                      }
                    }}
                    style={{ width: '16px', height: '16px', accentColor: '#DC2626', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: theme.textPrimary }}>
                      Cấp quyền Admin (Quản trị viên)
                    </div>
                    <div style={{ fontSize: '11px', color: theme.textMuted }}>
                      Duyệt đề xuất, quản lý địa điểm Web + Maps (Không được tự ý sửa Founder)
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
                    disabled={permAdminChecked}
                    onChange={e => setPermWebChecked(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#2563EB', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: theme.textPrimary }}>
                      Quản lý Web (Manager)
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
                    disabled={permAdminChecked}
                    onChange={e => setPermMapsChecked(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#059669', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: theme.textPrimary }}>
                      Quản lý Maps (Manager)
                    </div>
                    <div style={{ fontSize: '11px', color: theme.textMuted }}>
                      Đề xuất định vị tọa độ, thêm & chỉnh sửa địa điểm Bản đồ số
                    </div>
                  </div>
                </label>

                {/* Chỉ yêu cầu xác nhận thêm khi nâng quyền lên ADMIN */}
                {permAdminChecked && !Boolean(permissionModalTarget.isAdmin && !permissionModalTarget.isFounder) && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: '#FEF3C7',
                      border: '1px solid #F59E0B',
                      color: '#92400E',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      data-testid="perm-confirm-intent-checkbox"
                      checked={permConfirmIntent}
                      onChange={e => setPermConfirmIntent(e.target.checked)}
                      style={{ marginTop: '2px', accentColor: '#D97706' }}
                    />
                    <span>
                      Xác nhận của Founder: Tôi đồng ý nâng quyền Quản trị (ADMIN) cho UID đã xác minh này và ghi nhận vào nhật ký bảo mật.
                    </span>
                  </label>
                )}
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
              {!permissionModalTarget.isFounder &&
                permissionModalTarget.identityStatus !== 'CONFLICT' && (
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
                    {permissionModalTarget.isUidVerified ? 'Lưu quyền' : 'Lưu quyền chờ'}
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1B: KHỞI TẠO BACKUP FOUNDER MỘT LẦN (ONE-TIME SETUP)             */}
      {/* ===================================================================== */}
      {isProvisionBackupModalOpen && (
        <div
          className="xh-modal-backdrop"
          onClick={() => !bfSubmitting && setIsProvisionBackupModalOpen(false)}
        >
          <div
            data-testid="provision-backup-founder-modal"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              background: theme.bgCard,
              color: theme.textPrimary,
              borderRadius: '14px',
              border: `1.5px solid #C4B5FD`,
              padding: '18px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.22)',
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
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#5B21B6' }}>
                🛡️ Khởi tạo Backup Founder (One-Time Setup)
              </h3>
              <button
                type="button"
                disabled={bfSubmitting}
                onClick={() => setIsProvisionBackupModalOpen(false)}
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
                padding: '9px 11px',
                borderRadius: '8px',
                background: '#EDE9FE',
                border: '1px solid #C4B5FD',
                color: '#5B21B6',
                fontSize: '11.5px',
                marginBottom: '12px',
              }}
            >
              Tài khoản này được tạo trực tiếp trên <b>Firebase Authentication (Email/Password)</b> để đăng nhập dự phòng khi Google OAuth gặp sự cố. Mật khẩu tuyệt đối <b>không</b> lưu trong RTDB, LocalStorage hay Git.
            </div>

            <form
              onSubmit={handleProvisionBackupFounder}
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                  Tên đăng nhập (Username) *
                </label>
                <input
                  type="text"
                  data-testid="bf-username-input"
                  value={bfUsername}
                  onChange={e => setBfUsername(e.target.value)}
                  placeholder="VD: founder_duphong_xh"
                  required
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
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                  Mật khẩu mạnh (≥ 12 ký tự, chữ hoa, thường, số, ký tự đặc biệt) *
                </label>
                <input
                  type="password"
                  data-testid="bf-password-input"
                  value={bfPassword}
                  onChange={e => setBfPassword(e.target.value)}
                  placeholder="Nhập mật khẩu bảo mật cao..."
                  autoComplete="new-password"
                  required
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
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  value={bfDisplayName}
                  onChange={e => setBfDisplayName(e.target.value)}
                  placeholder="Founder Dự Phòng"
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
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                  Email khôi phục thực (Bắt buộc — dùng để nhận email khôi phục) *
                </label>
                <input
                  type="email"
                  data-testid="bf-recovery-email-input"
                  value={bfRecoveryEmail}
                  onChange={e => setBfRecoveryEmail(e.target.value)}
                  placeholder="email-khoi-phuc-thuc@gmail.com"
                  required
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

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: '#FEF3C7',
                  border: '1px solid #F59E0B',
                  color: '#92400E',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  data-testid="bf-confirm-checkbox"
                  checked={bfConfirmIntent}
                  onChange={e => setBfConfirmIntent(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: '#D97706' }}
                />
                <span>
                  Tôi (Primary Founder — Dê Già Designer) xác nhận khởi tạo tài khoản Backup Founder này và đã lưu giữ mật khẩu ở nơi an toàn.
                </span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  disabled={bfSubmitting}
                  onClick={() => setIsProvisionBackupModalOpen(false)}
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
                  data-testid="bf-submit-btn"
                  disabled={bfSubmitting}
                  style={{
                    height: '34px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#6D28D9',
                    color: '#FFFFFF',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: bfSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {bfSubmitting ? 'Đang khởi tạo...' : 'Khởi tạo Backup Founder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1C: ĐẶT LẠI MẬT KHẨU BACKUP FOUNDER (KHÔNG CẦN MẬT KHẨU CŨ)      */}
      {/* ===================================================================== */}
      {resetPwdTargetUid && (
        <div
          className="xh-modal-backdrop"
          onClick={() => !resetPwdSubmitting && setResetPwdTargetUid(null)}
        >
          <div
            data-testid="reset-backup-password-modal"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              background: theme.bgCard,
              color: theme.textPrimary,
              borderRadius: '14px',
              border: `1.5px solid #C4B5FD`,
              padding: '18px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.22)',
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
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#5B21B6' }}>
                🔑 Đặt lại mật khẩu Backup Founder (@{resetPwdTargetUsername})
              </h3>
              <button
                type="button"
                disabled={resetPwdSubmitting}
                onClick={() => setResetPwdTargetUid(null)}
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
                padding: '9px 11px',
                borderRadius: '8px',
                background: '#EDE9FE',
                border: '1px solid #C4B5FD',
                color: '#5B21B6',
                fontSize: '11.5px',
                marginBottom: '12px',
              }}
            >
              Primary Founder đặt mật khẩu mới cho <b>@{resetPwdTargetUsername}</b> qua <b>Privileged Backend</b> mà <b>không cần nhập mật khẩu cũ</b>. Ngay sau khi đổi, mật khẩu cũ bị vô hiệu hóa tức thì và mọi phiên đăng nhập cũ bị thu hồi.
            </div>

            <form
              onSubmit={handleSubmitResetBackupPassword}
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                  Mật khẩu mới (tối thiểu 10 ký tự) *
                </label>
                <input
                  type="password"
                  data-testid="reset-bf-new-password-input"
                  value={newBfPassword}
                  onChange={e => setNewBfPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  autoComplete="new-password"
                  required
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
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                  Xác nhận mật khẩu mới *
                </label>
                <input
                  type="password"
                  data-testid="reset-bf-confirm-password-input"
                  value={confirmNewBfPassword}
                  onChange={e => setConfirmNewBfPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  autoComplete="new-password"
                  required
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

              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: '#FEF3C7',
                  border: '1px solid #F59E0B',
                  color: '#92400E',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  data-testid="reset-bf-confirm-auth-checkbox"
                  checked={resetPwdRecentAuthConfirmed}
                  onChange={e => setResetPwdRecentAuthConfirmed(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: '#D97706' }}
                />
                <span>
                  Xác thực phiên Primary Founder (Dê Già Designer): Đặt mật khẩu mới và thu hồi toàn bộ phiên cũ của Backup Founder.
                </span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  disabled={resetPwdSubmitting}
                  onClick={() => setResetPwdTargetUid(null)}
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
                  data-testid="reset-bf-submit-btn"
                  disabled={resetPwdSubmitting}
                  style={{
                    height: '34px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#6D28D9',
                    color: '#FFFFFF',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: resetPwdSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {resetPwdSubmitting ? 'Đang cập nhật...' : 'Xác nhận đặt mật khẩu mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1D: XÁC MINH / CẬP NHẬT EMAIL KHÔI PHỤC BACKUP FOUNDER          */}
      {/* ===================================================================== */}
      {verifyEmailTargetUid && (
        <div
          className="xh-modal-backdrop"
          onClick={() => !verifyEmailSubmitting && setVerifyEmailTargetUid(null)}
        >
          <div
            data-testid="verify-recovery-email-modal"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '400px',
              background: theme.bgCard,
              color: theme.textPrimary,
              borderRadius: '14px',
              border: `1.5px solid #C4B5FD`,
              padding: '18px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.22)',
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
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#5B21B6' }}>
                ✉️ Xác minh Email khôi phục thực
              </h3>
              <button
                type="button"
                disabled={verifyEmailSubmitting}
                onClick={() => setVerifyEmailTargetUid(null)}
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

            <form
              onSubmit={handleSubmitVerifyRecoveryEmail}
              style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, marginBottom: '4px' }}>
                  Địa chỉ Email khôi phục nhận thư thực tế *
                </label>
                <input
                  type="email"
                  data-testid="verify-recovery-email-input"
                  value={verifyEmailInput}
                  onChange={e => setVerifyEmailInput(e.target.value)}
                  placeholder="email-khoi-phuc-thuc@gmail.com"
                  required
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  disabled={verifyEmailSubmitting}
                  onClick={() => setVerifyEmailTargetUid(null)}
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
                  data-testid="verify-recovery-email-submit-btn"
                  disabled={verifyEmailSubmitting}
                  style={{
                    height: '34px',
                    padding: '0 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#6D28D9',
                    color: '#FFFFFF',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: verifyEmailSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {verifyEmailSubmitting ? 'Đang xác minh...' : 'Lưu & Xác minh Email'}
                </button>
              </div>
            </form>
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
                <div style={{ fontSize: '10.5px', color: theme.textMuted }}>
                  {detailModalTarget.isUidVerified ? 'Firebase UID (Đã xác minh)' : 'Legacy ID (Chờ xác minh)'}
                </div>
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
                {detailModalTarget.legacyUid && detailModalTarget.legacyUid !== detailModalTarget.uid && (
                  <div style={{ fontSize: '10px', color: theme.textMuted, marginTop: '2px' }}>
                    Legacy ID: <code>{detailModalTarget.legacyUid}</code>
                  </div>
                )}
              </div>
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: theme.bgElevated,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <div style={{ fontSize: '10.5px', color: theme.textMuted }}>Trạng thái & Ngày tham gia</div>
                <div style={{ fontWeight: 700 }}>
                  {detailModalTarget.isUidVerified ? '✓ Đã xác minh' : '⏳ Chờ xác minh'} •{' '}
                  {formatShortDateVi(detailModalTarget.createdAt)}
                </div>
                {detailModalTarget.pendingRoleAssignment && (
                  <div style={{ fontSize: '10.5px', color: '#1D4ED8', fontWeight: 700, marginTop: '2px' }}>
                    🕐 Quyền chờ:{' '}
                    {detailModalTarget.pendingRoleAssignment.makeAdmin ||
                    detailModalTarget.pendingRoleAssignment.requestedRole === 'admin'
                      ? 'Admin'
                      : detailModalTarget.pendingRoleAssignment.canManageWeb &&
                        detailModalTarget.pendingRoleAssignment.canManageMaps
                      ? 'QL Web + Maps'
                      : detailModalTarget.pendingRoleAssignment.canManageWeb
                      ? 'QL Web'
                      : 'QL Maps'}
                  </div>
                )}
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
        @media (max-width: 900px) {
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
