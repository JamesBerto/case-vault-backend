import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Check,
  CircleHelp,
  Clock3,
  Eye,
  FileText,
  Fingerprint,
  LayoutDashboard,
  LockKeyhole,
  KeyRound,
  Search,
  ShieldCheck,
  ShieldUser,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import "./AdminPanel.css";

const ADMIN_EMAIL = "tsantos@casevault.test";

const initialUsers = [
  { id: "USR-001", name: "T. Santos", email: ADMIN_EMAIL, role: "Admin", active: true, joined: "Oct 01, 2026" },
  { id: "USR-002", name: "M. Reyes", email: "mreyes@casevault.test", role: "Analyst", active: true, joined: "Oct 02, 2026" },
  { id: "USR-003", name: "A. Garcia", email: "agarcia@casevault.test", role: "Reviewer", active: true, joined: "Oct 04, 2026" },
  { id: "USR-004", name: "J. Cruz", email: "jcruz@casevault.test", role: "Analyst", active: false, joined: "Oct 05, 2026" },
  { id: "USR-005", name: "R. Mendoza", email: "rmendoza@casevault.test", role: "Reviewer", active: true, joined: "Oct 07, 2026" },
];

const initialActivities = [
  { action: "Evidence uploaded", detail: "Network Traffic Analysis Report", user: "M. Reyes", time: "10:42 AM", type: "upload" },
  { action: "User account created", detail: "USR-005 · R. Mendoza", user: "T. Santos", time: "09:18 AM", type: "user" },
  { action: "Evidence integrity verified", detail: "APSY-2026-001 · Version 1", user: "M. Reyes", time: "Yesterday", type: "verify" },
  { action: "Case status updated", detail: "APSY-2026-003 · Under Review", user: "A. Garcia", time: "Yesterday", type: "case" },
];

function StatCard({ icon: Icon, label, value, note, trend, tone }) {
  return (
    <article className="admin-stat-card">
      <div className={`admin-stat-icon ${tone}`}><Icon size={19} /></div>
      <div className="admin-stat-label">{label}</div>
      <div className="admin-stat-value">{value}</div>
      <div className="admin-stat-note">
        {trend && <span className="admin-stat-trend"><ArrowUpRight size={14} /> {trend}</span>}
        {note}
      </div>
    </article>
  );
}

export default function AdminPanel() {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "Analyst",
  });

  const filteredUsers = useMemo(() => {
    const term = query.toLowerCase().trim();

    return users.filter((user) => {
      const matchesSearch = [user.id, user.name, user.email, user.role]
        .some((value) => value.toLowerCase().includes(term));

      const matchesRole =
        roleFilter === "All roles" || user.role === roleFilter;

      const matchesStatus =
        statusFilter === "All statuses" ||
        (statusFilter === "Active" ? user.active : !user.active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, query, roleFilter, statusFilter]);

  const activeUsers = users.filter((user) => user.active).length;

  function showNotice(message) {
    setNotice(message);
  }

  function createUser(event) {
    event.preventDefault();

    const normalizedEmail = newUser.email.trim().toLowerCase();

    if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
      showNotice("That email already exists in this mock list.");
      return;
    }

    const created = {
      id: `USR-${String(users.length + 1).padStart(3, "0")}`,
      name: newUser.name.trim(),
      email: newUser.email.trim(),
      role: newUser.role,
      active: true,
      joined: "Oct 13, 2026",
    };

    setUsers((current) => [created, ...current]);
    setNewUser({ name: "", email: "", role: "Analyst" });
    setShowCreate(false);
    showNotice("Demo account added to the current page.");
  }

  function toggleUserStatus(user) {
    if (user.role === "Admin") {
      showNotice("The primary Admin account is protected.");
      return;
    }

    const updatedUser = { ...user, active: !user.active };

    setUsers((current) =>
      current.map((item) => item.id === user.id ? updatedUser : item)
    );

    setSelectedUser((current) =>
      current?.id === user.id ? updatedUser : current
    );

    showNotice(
      `${user.name}'s account is now ${updatedUser.active ? "active" : "inactive"}.`
    );
  }

  function openPasswordModal() {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setPasswordError("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowChangePassword(true);
  }

  function handleChangePassword(event) {
    event.preventDefault();
    setPasswordError("");

    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Please complete all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Your new password must contain at least 8 characters.");
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError("Your new password must differ from your current password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("The new password and confirmation do not match.");
      return;
    }

    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    setShowChangePassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);

    showNotice(
      "Password change simulated for T. Santos. No real password was changed."
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <div className="admin-eyebrow"><ShieldCheck size={14} /> PRIVILEGED ACCESS</div>
          <h1>Admin Panel</h1>
          <p>Manage user access, review system activity, and oversee archive integrity.</p>
        </div>
        <div className="admin-heading-badge"><LockKeyhole size={15} /> ADMINISTRATOR</div>
      </div>

      {notice && (
        <div className="admin-toast" role="status">
          <Check size={16} />
          {notice}
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        </div>
      )}

      <section className="admin-welcome">
        <div className="admin-welcome-mark"><Fingerprint size={27} /></div>
        <div className="admin-welcome-copy">
          <span>ADMINISTRATIVE OVERVIEW</span>
          <h2>Archive oversight, at a glance.</h2>
          <p>Review account activity and maintain visibility across the forensic archive.</p>
        </div>
        <div className="admin-welcome-meta">
          <span><span className="admin-live-dot" /> DEMO ENVIRONMENT</span>
          <small>Tuesday, October 13, 2026</small>
        </div>
      </section>

      <section className="admin-stats-grid">
        <StatCard icon={Users} label="REGISTERED USERS" value={users.length} note="Across all assigned roles" tone="brown" />
        <StatCard icon={UserCheck} label="ACTIVE ACCOUNTS" value={activeUsers} note={`${users.length - activeUsers} inactive account(s)`} tone="green" />
        <StatCard icon={FileText} label="CASE RECORDS" value="24" note="Illustrative mock total" tone="blue" />
        <StatCard icon={ShieldCheck} label="INTEGRITY STATUS" value="Monitored" note="No live verification performed" tone="gold" />
      </section>

      <section className="admin-main-grid">
        <article className="admin-panel-card admin-users-card">
          <div className="admin-card-heading">
            <div>
              <span className="admin-section-label">ACCESS MANAGEMENT</span>
              <h3>Registered Users</h3>
              <p>Review accounts and their assigned access roles.</p>
            </div>
            <button type="button" className="admin-primary-btn" onClick={() => setShowCreate(true)}>
              <UserPlus size={16} /> Add User
            </button>
          </div>

          <div className="admin-filter-row">
            <label className="admin-search">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, email, ID..."
                aria-label="Search users"
              />
            </label>

            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role">
              <option>All roles</option>
              <option>Admin</option>
              <option>Analyst</option>
              <option>Reviewer</option>
            </select>

            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status">
              <option>All statuses</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-user-table">
              <thead>
                <tr>
                  <th>USER</th>
                  <th>ROLE</th>
                  <th>STATUS</th>
                  <th className="admin-action-head">VIEW</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="admin-user-cell">
                        <span className="admin-avatar">
                          {user.name.split(" ").map((part) => part[0]).join("").replace(".", "").slice(0, 2)}
                        </span>
                        <span className="admin-user-text">
                          <strong>{user.name}</strong>
                          <small>{user.email}</small>
                        </span>
                      </div>
                    </td>
                    <td><span className={`admin-role-chip ${user.role.toLowerCase()}`}>{user.role}</span></td>
                    <td>
                      <span className={`admin-status ${user.active ? "active" : "inactive"}`}>
                        <span />{user.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="admin-action-cell">
                      <button
                        type="button"
                        className="admin-icon-btn"
                        onClick={() => setSelectedUser(user)}
                        aria-label={`View ${user.name}`}
                        title="View user details"
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="4" className="admin-empty">
                      No users match your search or filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="admin-table-footer">
            Showing {filteredUsers.length} of {users.length} accounts
            <span>MOCK DATA</span>
          </div>
        </article>

        <div className="admin-side-stack">
          <article className="admin-panel-card admin-roles-card">
            <div className="admin-card-heading compact">
              <div>
                <span className="admin-section-label">PERMISSION OVERVIEW</span>
                <h3>System Roles</h3>
              </div>
              <ShieldUser size={19} className="admin-muted-icon" />
            </div>

            {[
              { role: "Admin", desc: "Manage users and review audit records", icon: LockKeyhole },
              { role: "Analyst", desc: "Manage cases and upload evidence", icon: FileText },
              { role: "Reviewer", desc: "Review cases and evidence records", icon: Eye },
            ].map(({ role, desc, icon: Icon }) => (
              <div className="admin-role-row" key={role}>
                <span className="admin-role-icon"><Icon size={16} /></span>
                <span><strong>{role}</strong><small>{desc}</small></span>
                <span className="admin-role-count">{users.filter((user) => user.role === role).length}</span>
              </div>
            ))}

            <div className="admin-permission-note">
              <CircleHelp size={15} />
              Permission descriptions are a UI summary. Backend rules remain authoritative.
            </div>
          </article>

          <article className="admin-integrity-card">
            <div className="admin-integrity-top">
              <span className="admin-section-label">ARCHIVE MONITOR</span>
              <ShieldCheck size={20} />
            </div>
            <h3>Evidence Integrity</h3>
            <p>Use evidence details to review file versions and their recorded integrity checks.</p>
            <div className="admin-integrity-state"><span /> Awaiting live verification</div>
            <small>Mock indicator · Not connected to backend</small>
          </article>
        </div>
      </section>

      <section className="admin-panel-card admin-activity-card">
        <div className="admin-card-heading">
          <div>
            <span className="admin-section-label">RECENT RECORDS</span>
            <h3>Activity Ledger</h3>
            <p>Illustrative events for the administrator's overview.</p>
          </div>
          <span className="admin-readonly-chip"><Activity size={14} /> READ ONLY</span>
        </div>

        <div className="admin-activity-list">
          {initialActivities.map((item, index) => (
            <div className="admin-activity-row" key={`${item.action}-${index}`}>
              <span className={`admin-activity-icon ${item.type}`}>
                {item.type === "upload" ? <FileText size={17} /> :
                  item.type === "user" ? <Users size={17} /> :
                    item.type === "verify" ? <ShieldCheck size={17} /> :
                      <LayoutDashboard size={17} />}
              </span>
              <div className="admin-activity-copy">
                <strong>{item.action}</strong>
                <span>{item.detail}</span>
              </div>
              <span className="admin-activity-user">{item.user}</span>
              <span className="admin-activity-time"><Clock3 size={13} />{item.time}</span>
            </div>
          ))}
        </div>

        <div className="admin-activity-footer">
          <AlertTriangle size={14} />
          Sample activity only. Live audit records require backend integration.
        </div>
      </section>

      {selectedUser && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedUser(null)}>
          <section
            className="admin-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-modal-title"
          >
            <div className="admin-modal-header">
              <div>
                <span className="admin-section-label">ACCOUNT RECORD</span>
                <h3 id="admin-user-modal-title">User Details</h3>
              </div>
              <button type="button" className="admin-icon-btn" onClick={() => setSelectedUser(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="admin-profile">
              <span className="admin-profile-avatar">
                {selectedUser.name.split(" ").map((part) => part[0]).join("").replace(".", "").slice(0, 2)}
              </span>
              <div>
                <h4>{selectedUser.name}</h4>
                <p>{selectedUser.email}</p>
                <span className={`admin-status ${selectedUser.active ? "active" : "inactive"}`}>
                  <span />{selectedUser.active ? "Active account" : "Inactive account"}
                </span>
              </div>
            </div>

            <div className="admin-detail-grid">
              <div><small>USER ID</small><strong>{selectedUser.id}</strong></div>
              <div><small>ASSIGNED ROLE</small><strong>{selectedUser.role}</strong></div>
              <div><small>DATE REGISTERED</small><strong>{selectedUser.joined}</strong></div>
              <div><small>ACCOUNT STATUS</small><strong>{selectedUser.active ? "Active" : "Inactive"}</strong></div>
            </div>

            <div className="admin-modal-note">
              <LockKeyhole size={15} />
              Passwords and password hashes are never displayed.
            </div>

            {selectedUser.email === ADMIN_EMAIL && selectedUser.role === "Admin" && (
              <button
                type="button"
                className="admin-secondary-btn admin-change-password-trigger"
                onClick={openPasswordModal}
              >
                <KeyRound size={15} />
                Change Admin Password
              </button>
            )}

            <div className="admin-modal-actions">
              <button type="button" className="admin-secondary-btn" onClick={() => setSelectedUser(null)}>
                Close
              </button>
              <button
                type="button"
                className={`admin-primary-btn ${selectedUser.active ? "danger-btn" : ""}`}
                onClick={() => toggleUserStatus(selectedUser)}
              >
                {selectedUser.active ? "Deactivate Account" : "Activate Account"}
              </button>
            </div>
          </section>
        </div>
      )}

      {showCreate && (
        <div className="admin-modal-backdrop" onClick={() => setShowCreate(false)}>
          <section
            className="admin-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-create-title"
          >
            <div className="admin-modal-header">
              <div>
                <span className="admin-section-label">USER ADMINISTRATION</span>
                <h3 id="admin-create-title">Create Account</h3>
              </div>
              <button type="button" className="admin-icon-btn" onClick={() => setShowCreate(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <p className="admin-modal-description">
              Add a sample account to the current mock interface.
            </p>

            <form className="admin-create-form" onSubmit={createUser}>
              <label>
                Full name
                <input
                  required
                  minLength={2}
                  value={newUser.name}
                  onChange={(event) => setNewUser({ ...newUser, name: event.target.value })}
                  placeholder="e.g. L. Dela Cruz"
                />
              </label>

              <label>
                Email address
                <input
                  required
                  type="email"
                  value={newUser.email}
                  onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
                  placeholder="name@casevault.test"
                />
              </label>

              <label>
                Assigned role
                <select value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}>
                  <option>Analyst</option>
                  <option>Reviewer</option>
                  <option>Admin</option>
                </select>
              </label>

              <div className="admin-modal-note">
                <AlertTriangle size={15} />
                Demo only. This does not create a real authenticated account or password.
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary-btn" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button className="admin-primary-btn" type="submit">
                  <UserPlus size={15} /> Add User
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {showChangePassword && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setShowChangePassword(false)}
        >
          <section
            className="admin-modal admin-password-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-password-title"
          >
            <div className="admin-modal-header">
              <div>
                <span className="admin-section-label">PRIVILEGED ACCOUNT</span>
                <h3 id="admin-password-title">Change Admin Password</h3>
              </div>
              <button
                type="button"
                className="admin-icon-btn"
                onClick={() => setShowChangePassword(false)}
                aria-label="Close change password dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-password-account">
              <span className="admin-password-icon"><ShieldCheck size={22} /></span>
              <div>
                <strong>T. Santos</strong>
                <span>{ADMIN_EMAIL}</span>
                <small>Primary Administrator</small>
              </div>
            </div>

            <p className="admin-modal-description">
              Enter the current password and choose a new password for this administrator account.
            </p>

            <form className="admin-create-form admin-password-form" onSubmit={handleChangePassword}>
              <label>
                Current password
                <input
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })}
                  placeholder="Enter current password"
                  required
                />
              </label>

              <label>
                New password
                <div className="admin-password-input">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })}
                    placeholder="Enter new password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((value) => !value)}
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  >
                    <Eye size={16} />
                  </button>
                </div>
                <small className="admin-password-hint">Use at least 8 characters.</small>
              </label>

              <label>
                Confirm new password
                <div className="admin-password-input">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })}
                    placeholder="Re-enter new password"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    aria-label={showConfirmPassword ? "Hide confirmation" : "Show confirmation"}
                  >
                    <Eye size={16} />
                  </button>
                </div>
              </label>

              {passwordError && (
                <div className="admin-password-error" role="alert">
                  <AlertTriangle size={15} />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="admin-modal-note">
                <AlertTriangle size={15} />
                UI demonstration only. Password verification and persistence require backend integration.
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-secondary-btn"
                  onClick={() => setShowChangePassword(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-primary-btn">
                  <KeyRound size={15} />
                  Confirm Change
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
