import React, { useState } from 'react';
import { User, UserRole } from '../../types/forensics';
import {
  Users,
  Shield,
  Plus,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Lock,
  UserCheck,
  UserX
} from 'lucide-react';
import { api } from '../../services/api';

interface UserManagementViewProps {
  users: User[];
  currentUser: User;
  onRefresh: () => void;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  currentUser,
  onRefresh
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Investigator');
  const [newBadge, setNewBadge] = useState('');
  const [newDept, setNewDept] = useState('Digital Forensics Unit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'Administrator';

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Forbidden: Only Administrators can provision user accounts.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await api.createUser({
        name: newName,
        email: newEmail,
        role: newRole,
        badgeNumber: newBadge || `DFIR-${Math.floor(1000 + Math.random() * 9000)}`,
        department: newDept
      });
      setShowAddModal(false);
      setNewName('');
      setNewEmail('');
      setNewBadge('');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: string, targetRole: string) => {
    try {
      await api.updateUserRole(userId, targetRole);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleStatusToggle = async (userId: string, currentActive: boolean) => {
    try {
      await api.updateUserStatus(userId, !currentActive);
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-cyan-400" />
            User Management & Role-Based Access Control
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Zero-Trust identity verification, granular role enforcement, and cryptographic audit accountability.
          </p>
        </div>

        {isAdmin ? (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg shadow-sm transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Provision User</span>
          </button>
        ) : (
          <div className="text-xs text-amber-400 bg-amber-950/40 border border-amber-900/60 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <Lock className="w-3.5 h-3.5" />
            <span>Read-Only mode: Switch to Administrator in top bar to edit users</span>
          </div>
        )}
      </div>

      {/* Role Matrix Card */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/90 text-xs space-y-3">
        <h3 className="font-semibold text-slate-200 flex items-center gap-2">
          <Shield className="w-4 h-4 text-cyan-400" />
          Enforced Role Authorization Matrix
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-slate-950 border border-rose-900/60">
            <div className="font-bold text-rose-400">Administrator</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Full control: user provisioning, case closure, settings, adversarial test harness.
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-cyan-900/60">
            <div className="font-bold text-cyan-400">Lead Investigator</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Open cases, register evidence, initiate and sign transfers, close cases.
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-blue-900/60">
            <div className="font-bold text-blue-400">Investigator</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Register evidence, verify hashes, initiate checkout transfers, download evidence.
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-amber-900/60">
            <div className="font-bold text-amber-400">Evidence Custodian</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Intake artifacts, physical custody receipt, transfer acknowledgments, vault logs.
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-950 border border-emerald-900/60">
            <div className="font-bold text-emerald-400">Read-Only Auditor</div>
            <div className="text-[11px] text-slate-400 mt-1">
              Inspect cases, verify audit chains, view custody history. Write actions strictly blocked.
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-medium">
                <th className="py-3 px-4">Operator Name</th>
                <th className="py-3 px-4">Badge Number</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4">Last Authenticated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {users.map(u => {
                const isCurrent = u.id === currentUser.id;
                return (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white flex items-center gap-2">
                        <span>{u.name}</span>
                        {isCurrent && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-cyan-400 font-medium">
                      #{u.badgeNumber}
                    </td>

                    <td className="py-3.5 px-4 text-slate-300">{u.department}</td>

                    <td className="py-3.5 px-4">
                      {isAdmin ? (
                        <select
                          value={u.role}
                          onChange={e => handleRoleChange(u.id, e.target.value)}
                          className="px-2 py-1 text-xs bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
                        >
                          <option value="Administrator">Administrator</option>
                          <option value="Lead Investigator">Lead Investigator</option>
                          <option value="Investigator">Investigator</option>
                          <option value="Evidence Custodian">Evidence Custodian</option>
                          <option value="Read-Only Auditor">Read-Only Auditor</option>
                        </select>
                      ) : (
                        <span className="font-semibold text-slate-200">{u.role}</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          u.active
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border-rose-800'
                        }`}
                      >
                        {u.active ? 'ACTIVE' : 'SUSPENDED'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                      {u.lastSignIn === 'Never'
                        ? 'Never'
                        : new Date(u.lastSignIn).toISOString().slice(0, 16).replace('T', ' ')}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {isAdmin ? (
                        <button
                          onClick={() => handleStatusToggle(u.id, u.active)}
                          disabled={isCurrent}
                          title={isCurrent ? 'Cannot deactivate your own account' : 'Toggle Access'}
                          className={`px-2.5 py-1 text-xs rounded transition-colors cursor-pointer ${
                            isCurrent
                              ? 'text-slate-600 cursor-not-allowed'
                              : u.active
                              ? 'text-rose-400 hover:bg-rose-950/60 border border-rose-900/60'
                              : 'text-emerald-400 hover:bg-emerald-950/60 border border-emerald-900/60'
                          }`}
                        >
                          {u.active ? 'Suspend' : 'Activate'}
                        </button>
                      ) : (
                        <span className="text-slate-600 text-xs">Locked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 text-xs">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Provision Forensic Operator Account
            </h2>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="text-slate-300 block mb-1 font-medium">Full Name</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Special Agent John Miller"
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="j.miller@forensics.internal"
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-medium">Role Assignment</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as UserRole)}
                  className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Lead Investigator">Lead Investigator</option>
                  <option value="Investigator">Investigator</option>
                  <option value="Evidence Custodian">Evidence Custodian</option>
                  <option value="Read-Only Auditor">Read-Only Auditor</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Badge Number</label>
                  <input
                    type="text"
                    value={newBadge}
                    onChange={e => setNewBadge(e.target.value)}
                    placeholder="DFIR-9921"
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 block mb-1 font-medium">Department</label>
                  <input
                    type="text"
                    value={newDept}
                    onChange={e => setNewDept(e.target.value)}
                    className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg cursor-pointer"
                >
                  {isSubmitting ? 'Provisioning...' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
