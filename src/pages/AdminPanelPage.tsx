import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Edit3, MessageSquare, QrCode, Search, Trash2, Users } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { EditLinkModal } from '../components/EditLinkModal';
import { AnimatedNumber, EmptyStateGlass } from '../components/GlassUI';
import { useApp } from '../context/AppContext';
import {
  adminUpdateUserRecord,
  deleteQRCode,
  getResolvedDestination,
  subscribeAdminAllQRCodes,
  subscribeAdminAllScans,
  subscribeAdminAllUsers,
  subscribeAdminContactMessages,
} from '../firebase/firestore';
import type {
  ContactMessageRecord,
  QRCodeRecord,
  ScanEventRecord,
  UserProfile,
} from '../types';

export const AdminPanelPage: React.FC = () => {
  const { notify, confirm } = useApp();
  const [tab, setTab] = useState<'users' | 'qrcodes' | 'inbox'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [qrcodes, setQrcodes] = useState<QRCodeRecord[]>([]);
  const [scans, setScans] = useState<ScanEventRecord[]>([]);
  const [messages, setMessages] = useState<ContactMessageRecord[]>([]);
  const [search, setSearch] = useState('');
  const [editingQr, setEditingQr] = useState<QRCodeRecord | null>(null);

  useEffect(() => {
    const u1 = subscribeAdminAllUsers(setUsers);
    const u2 = subscribeAdminAllQRCodes(setQrcodes);
    const u3 = subscribeAdminAllScans(setScans);
    const u4 = subscribeAdminContactMessages(setMessages);
    return () => {
      u1();
      u2();
      u3();
      u4();
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
    );
  }, [users, search]);

  const filteredQRs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return qrcodes;
    return qrcodes.filter(
      (qr) =>
        qr.title.toLowerCase().includes(q) ||
        qr.qrId.toLowerCase().includes(q) ||
        qr.currentLink.toLowerCase().includes(q)
    );
  }, [qrcodes, search]);

  const totalScans = useMemo(
    () => qrcodes.reduce((sum, qr) => sum + (qr.scanCount || 0), 0),
    [qrcodes]
  );

  const handleToggleUserStatus = async (u: UserProfile) => {
    const next = u.status === 'active' ? 'suspended' : 'active';
    try {
      await adminUpdateUserRecord(u.uid, { status: next }, u.email);
      notify('User status updated', 'success', `${u.email} is now ${next}.`);
    } catch (err) {
      notify('Update failed', 'error', err instanceof Error ? err.message : 'Check admin permissions.');
    }
  };

  const handleToggleAdminRole = async (u: UserProfile) => {
    const nextRole = u.role === 'admin' ? 'user' : 'admin';
    const ok = await confirm({
      title: `${nextRole === 'admin' ? 'Grant' : 'Revoke'} Admin Access?`,
      message: `Change role for ${u.email} to ${nextRole}.`,
      confirmLabel: 'Confirm Role Change',
    });
    if (!ok) return;
    try {
      await adminUpdateUserRecord(u.uid, { role: nextRole }, u.email);
      notify('Role updated', 'success');
    } catch (err) {
      notify('Role update failed', 'error', err instanceof Error ? err.message : 'Error updating role.');
    }
  };

  const handleDeleteQR = async (qr: QRCodeRecord) => {
    const ok = await confirm({
      title: `Delete QR "${qr.title}"?`,
      message: `As administrator, permanently remove ${qr.qrId} from Firestore.`,
      confirmLabel: 'Delete QR Code',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteQRCode(qr.qrId);
      notify('QR Code deleted', 'success');
    } catch (err) {
      notify('Delete failed', 'error', err instanceof Error ? err.message : 'Error deleting QR.');
    }
  };

  return (
    <DashboardLayout title="Admin Console" breadcrumb="Admin Panel">
      {/* Platform Animated Glass KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            label: 'Registered Users',
            value: users.length,
            icon: Users,
            accent: 'from-blue-500/18 to-cyan-500/12 text-blue-600 dark:text-cyan-400',
          },
          {
            label: 'Total Dynamic QRs',
            value: qrcodes.length,
            icon: QrCode,
            accent: 'from-violet-500/18 to-pink-500/12 text-violet-600 dark:text-violet-400',
          },
          {
            label: 'Cumulative Scans',
            value: totalScans,
            icon: Activity,
            accent: 'from-cyan-500/18 to-emerald-500/12 text-cyan-600 dark:text-emerald-400',
          },
          {
            label: 'Logged Events',
            value: scans.length,
            icon: MessageSquare,
            accent: 'from-pink-500/18 to-blue-500/12 text-pink-600 dark:text-pink-400',
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="glass-panel glass-card-interactive rounded-[24px] p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {stat.label}
                </p>
                <div
                  className={`w-9 h-9 rounded-2xl bg-gradient-to-br ${stat.accent} flex items-center justify-center`}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
                <AnimatedNumber value={stat.value} />
              </p>
            </div>
          );
        })}
      </div>

      {/* Controls Bar */}
      <div className="mt-6 glass-panel rounded-[24px] p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 rounded-2xl glass-panel">
          {([
            { id: 'users', label: `Users (${users.length})` },
            { id: 'qrcodes', label: `QR Codes (${qrcodes.length})` },
            { id: 'inbox', label: `Support (${messages.length})` },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                tab === t.id
                  ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === 'users' ? 'Search users by name or email...' : 'Search QR ID or URL...'
            }
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl glass-input text-sm"
          />
        </div>
      </div>

      {/* Data Tables */}
      <div className="mt-6 glass-panel rounded-[26px] overflow-hidden">
        {tab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/6 dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-4 px-6 font-medium">User</th>
                  <th className="py-4 px-4 font-medium">Role</th>
                  <th className="py-4 px-4 font-medium">Plan</th>
                  <th className="py-4 px-4 font-medium">Status</th>
                  <th className="py-4 px-6 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/5 dark:divide-white/[0.06] text-sm">
                {filteredUsers.map((u) => (
                  <tr
                    key={u.uid}
                    className="hover:bg-white/45 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-4 px-6">
                      <p className="font-semibold text-slate-900 dark:text-white">{u.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                    </td>
                    <td className="py-4 px-4 text-xs capitalize text-slate-700 dark:text-slate-300">
                      {u.role}
                    </td>
                    <td className="py-4 px-4 text-xs capitalize text-slate-700 dark:text-slate-300">
                      {u.plan}
                    </td>
                    <td className="py-4 px-4 text-xs">
                      <span
                        className={
                          u.status === 'active'
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'text-rose-600 dark:text-rose-400 font-semibold'
                        }
                      >
                        {u.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => handleToggleAdminRole(u)}
                        className="px-3 py-1.5 rounded-xl glass-panel text-xs font-semibold hover:bg-white/90 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleUserStatus(u)}
                        className="px-3 py-1.5 rounded-xl glass-panel text-xs font-semibold hover:bg-white/90 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {u.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'qrcodes' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900/6 dark:border-white/[0.08] text-xs text-slate-500 dark:text-slate-400">
                  <th className="py-4 px-6 font-medium">QR Code</th>
                  <th className="py-4 px-4 font-medium">Destination</th>
                  <th className="py-4 px-4 font-medium">Status</th>
                  <th className="py-4 px-4 font-medium text-right">Scans</th>
                  <th className="py-4 px-6 font-medium text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/5 dark:divide-white/[0.06] text-sm">
                {filteredQRs.map((qr) => (
                  <tr
                    key={qr.qrId}
                    className="hover:bg-white/45 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <td className="py-4 px-6">
                      <p className="font-semibold text-slate-900 dark:text-white">{qr.title}</p>
                      <p className="text-xs font-mono-tabular text-slate-500">{qr.qrId}</p>
                    </td>
                    <td className="py-4 px-4 max-w-xs">
                      <p className="text-xs font-mono-tabular text-slate-600 dark:text-slate-300 truncate">
                        {getResolvedDestination(qr) || 'Unassigned'}
                      </p>
                    </td>
                    <td className="py-4 px-4 text-xs capitalize text-slate-700 dark:text-slate-300">
                      {qr.status}
                    </td>
                    <td className="py-4 px-4 text-right font-mono-tabular font-semibold">
                      {(qr.scanCount || 0).toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingQr(qr)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-600/12 dark:bg-cyan-400/15 text-blue-700 dark:text-cyan-300 text-xs font-semibold hover:bg-blue-600/20 cursor-pointer"
                          title="Edit destination URL"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit Link
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQR(qr)}
                          className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                          title="Delete QR Code"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'inbox' && (
          <div className="divide-y divide-slate-900/5 dark:divide-white/[0.06]">
            {messages.length === 0 ? (
              <EmptyStateGlass
                icon={MessageSquare}
                title="Inbox clear"
                description="Support messages submitted via the Contact page appear here."
              />
            ) : (
              messages.map((m) => (
                <div key={m.messageId} className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-950 dark:text-white">
                      {m.subject}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {m.name} · {m.email}
                    </p>
                  </div>
                  <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {m.message}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      <EditLinkModal
        qr={editingQr}
        onClose={() => setEditingQr(null)}
        onSaved={() => notify('Destination URL updated', 'success', 'Changes are live immediately.')}
      />
    </DashboardLayout>
  );
};
