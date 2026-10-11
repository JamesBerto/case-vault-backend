
import { useMemo, useState } from "react";
import {
  Search,
  ShieldCheck,
  Users,
  UserCheck,
  LockKeyhole,
  Eye,
  Fingerprint,
  X,
  Check,
  Minus,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import VaultLayout from "../layouts/VaultLayout";
import "./AccessControl.css";

const initialUsers = [
  {
    id: "USR-001",
    name: "T. Santos",
    email: "tsantos@example.com",
    role: "Analyst",
    status: "Active",
    lastActive: "2026-10-12 08:42 UTC",
  },
  {
    id: "USR-002",
    name: "M. Reyes",
    email: "mreyes@example.com",
    role: "Reviewer",
    status: "Active",
    lastActive: "2026-10-12 08:15 UTC",
  },
  {
    id: "USR-003",
    name: "J. Cruz",
    email: "jcruz@example.com",
    role: "Analyst",
    status: "Active",
    lastActive: "2026-10-11 16:28 UTC",
  },
  {
    id: "USR-004",
    name: "A. Garcia",
    email: "agarcia@example.com",
    role: "Administrator",
    status: "Active",
    lastActive: "2026-10-12 07:54 UTC",
  },
  {
    id: "USR-005",
    name: "R. Dela Cruz",
    email: "rdelacruz@example.com",
    role: "Reviewer",
    status: "Suspended",
    lastActive: "2026-10-08 11:20 UTC",
  },
];

const permissions = [
  {
    key: "view",
    label: "View case records",
    description: "Access case metadata and registered records.",
    Analyst: true,
    Reviewer: true,
    Administrator: true,
  },
  {
    key: "upload",
    label: "Register evidence",
    description: "Submit evidence files and supporting metadata.",
    Analyst: true,
    Reviewer: false,
    Administrator: true,
  },
  {
    key: "edit",
    label: "Modify case records",
    description: "Edit case information and descriptive metadata.",
    Analyst: true,
    Reviewer: false,
    Administrator: true,
  },
  {
    key: "verify",
    label: "Verify evidence integrity",
    description: "Run available evidence integrity verification.",
    Analyst: true,
    Reviewer: true,
    Administrator: true,
  },
  {
    key: "review",
    label: "Review case dossiers",
    description: "Inspect submitted records and review findings.",
    Analyst: false,
    Reviewer: true,
    Administrator: true,
  },
  {
    key: "users",
    label: "Manage user accounts",
    description: "View users and manage account status or roles.",
    Analyst: false,
    Reviewer: false,
    Administrator: true,
  },
];

function PermissionMark({ allowed }) {
  return allowed ? (
    <span className="access-permission-yes" aria-label="Allowed">
      <Check size={15} />
    </span>
  ) : (
    <span className="access-permission-no" aria-label="Not allowed">
      <Minus size={15} />
    </span>
  );
}

function AccessControl() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedUser, setSelectedUser] = useState(null);
  const [users] = useState(initialUsers);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch = [
        user.id,
        user.name,
        user.email,
        user.role,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);

      const matchesRole =
        roleFilter === "All" || user.role === roleFilter;

      const matchesStatus =
        statusFilter === "All" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const goTo = (tab) => {
    const routes = {
      Overview: "/welcome",
      "Case Library": "/cases",
      "Case Detail": "/cases/detail",
      "Secure Submission": "/submission",
      "Audit Trail": "/audit",
      "Access Control": "/access-control",
    };

    if (routes[tab]) navigate(routes[tab]);
  };

  const activeUsers = users.filter((user) => user.status === "Active").length;
  const suspendedUsers = users.filter(
    (user) => user.status === "Suspended"
  ).length;

  return (
    <VaultLayout activeTab="Access Control" onTabChange={goTo}>
      <div className="access-page">
        <div className="access-heading">
          <div>
            <div className="access-eyebrow">
              SECURITY ADMINISTRATION / PERMISSIONS
            </div>
            <h1>Role Access Security Matrix</h1>
            <p>
              Review role-based permissions and inspect the demonstration
              user directory.
            </p>
          </div>
          <div className="access-security-label">
            <ShieldCheck size={15} />
            ROLE-BASED ACCESS
          </div>
        </div>

        <div className="access-notice">
          <AlertTriangle size={17} />
          <p>
            <strong>Demonstration access configuration</strong>
            <span>
              These permissions and users are sample interface data. They do
              not enforce backend authorization or change real account access.
            </span>
          </p>
        </div>

        <div className="access-stats">
          <article className="access-stat-card">
            <span className="access-stat-icon">
              <Users size={18} />
            </span>
            <span className="access-stat-label">REGISTERED USERS</span>
            <strong>{String(users.length).padStart(2, "0")}</strong>
            <small>Sample user directory</small>
          </article>

          <article className="access-stat-card">
            <span className="access-stat-icon access-stat-green">
              <UserCheck size={18} />
            </span>
            <span className="access-stat-label">ACTIVE ACCOUNTS</span>
            <strong>{String(activeUsers).padStart(2, "0")}</strong>
            <small>Sample active status</small>
          </article>

          <article className="access-stat-card">
            <span className="access-stat-icon access-stat-red">
              <LockKeyhole size={18} />
            </span>
            <span className="access-stat-label">SUSPENDED ACCOUNTS</span>
            <strong>{String(suspendedUsers).padStart(2, "0")}</strong>
            <small>Sample suspended status</small>
          </article>

          <article className="access-stat-card">
            <span className="access-stat-icon">
              <Fingerprint size={18} />
            </span>
            <span className="access-stat-label">DEFINED ROLES</span>
            <strong>03</strong>
            <small>Analyst, Reviewer, Administrator</small>
          </article>
        </div>

        <section className="access-matrix-panel">
          <div className="access-panel-heading">
            <div>
              <span className="access-section-label">
                AUTHORIZATION REFERENCE
              </span>
              <h2>Permission Matrix</h2>
              <p>Compare capabilities across the three sample role types.</p>
            </div>
            <span className="access-matrix-tag">
              <LockKeyhole size={13} />
              RBAC MATRIX
            </span>
          </div>

          <div className="access-matrix-wrap">
            <table className="access-matrix">
              <thead>
                <tr>
                  <th>PERMISSION</th>
                  <th>ANALYST</th>
                  <th>REVIEWER</th>
                  <th>ADMINISTRATOR</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((permission) => (
                  <tr key={permission.key}>
                    <td>
                      <strong>{permission.label}</strong>
                      <small>{permission.description}</small>
                    </td>
                    <td>
                      <PermissionMark allowed={permission.Analyst} />
                    </td>
                    <td>
                      <PermissionMark allowed={permission.Reviewer} />
                    </td>
                    <td>
                      <PermissionMark allowed={permission.Administrator} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="access-matrix-legend">
            <span>
              <PermissionMark allowed={true} />
              Allowed in sample policy
            </span>
            <span>
              <PermissionMark allowed={false} />
              Not allowed in sample policy
            </span>
          </div>
        </section>

        <section className="access-users-panel">
          <div className="access-panel-heading">
            <div>
              <span className="access-section-label">IDENTITY DIRECTORY</span>
              <h2>Registered Users</h2>
              <p>Search sample accounts and inspect their assigned roles.</p>
            </div>
            <span className="access-user-count">
              {filteredUsers.length} USERS
            </span>
          </div>

          <div className="access-toolbar">
            <label className="access-search">
              <Search size={16} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, role, or ID..."
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch("")}
                >
                  <X size={14} />
                </button>
              )}
            </label>

            <label className="access-select">
              <span>Role</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                aria-label="Filter by role"
              >
                <option value="All">All roles</option>
                <option value="Analyst">Analyst</option>
                <option value="Reviewer">Reviewer</option>
                <option value="Administrator">Administrator</option>
              </select>
              <ChevronDown size={13} />
            </label>

            <label className="access-select">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Filter by account status"
              >
                <option value="All">All statuses</option>
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
              </select>
              <ChevronDown size={13} />
            </label>
          </div>

          <div className="access-user-list">
            {filteredUsers.map((user) => (
              <article className="access-user-row" key={user.id}>
                <div className="access-user-avatar">
                  <Users size={17} />
                </div>

                <div className="access-user-identity">
                  <strong>{user.name}</strong>
                  <span>{user.email}</span>
                  <small>{user.id}</small>
                </div>

                <span
                  className={`access-role-badge access-role-${user.role.toLowerCase()}`}
                >
                  {user.role}
                </span>

                <span
                  className={`access-account-status access-account-${user.status.toLowerCase()}`}
                >
                  <span />
                  {user.status}
                </span>

                <div className="access-user-last-active">
                  <small>LAST ACTIVE</small>
                  <span>{user.lastActive}</span>
                </div>

                <button
                  type="button"
                  className="access-inspect-button"
                  aria-label={`Inspect ${user.name}`}
                  onClick={() => setSelectedUser(user)}
                >
                  <Eye size={15} />
                </button>
              </article>
            ))}

            {filteredUsers.length === 0 && (
              <div className="access-empty">
                No user accounts match your search and filters.
              </div>
            )}
          </div>

          <div className="access-users-footer">
            <span>
              SHOWING {filteredUsers.length} OF {users.length} SAMPLE USERS
            </span>
            <span>IDENTITY NODE: APSY-IAM-01</span>
          </div>
        </section>

        <div className="access-footer-note">
          <LockKeyhole size={15} />
          <span>
            ROLE ENFORCEMENT MUST BE CONFIGURED ON THE BACKEND
          </span>
        </div>

        {selectedUser && (
          <div
            className="access-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedUser(null);
              }
            }}
          >
            <section
              className="access-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="access-modal-title"
            >
              <div className="access-modal-header">
                <div>
                  <span className="access-section-label">
                    IDENTITY RECORD / DETAIL VIEW
                  </span>
                  <h2 id="access-modal-title">User Details</h2>
                </div>
                <button
                  type="button"
                  className="access-modal-close"
                  aria-label="Close user details"
                  onClick={() => setSelectedUser(null)}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="access-user-modal-identity">
                <div className="access-user-avatar access-user-avatar-large">
                  <Users size={23} />
                </div>
                <div>
                  <h3>{selectedUser.name}</h3>
                  <p>{selectedUser.email}</p>
                  <span
                    className={`access-role-badge access-role-${selectedUser.role.toLowerCase()}`}
                  >
                    {selectedUser.role}
                  </span>
                </div>
              </div>

              <div className="access-user-detail-fields">
                <div>
                  <span>USER IDENTIFIER</span>
                  <strong>{selectedUser.id}</strong>
                </div>
                <div>
                  <span>ACCOUNT STATUS</span>
                  <strong>{selectedUser.status}</strong>
                </div>
                <div>
                  <span>LAST ACTIVE</span>
                  <strong>{selectedUser.lastActive}</strong>
                </div>
                <div>
                  <span>ASSIGNED ROLE</span>
                  <strong>{selectedUser.role}</strong>
                </div>
              </div>

              <div className="access-modal-notice">
                <AlertTriangle size={15} />
                This is a sample identity record. No actual account settings
                can be changed from this demonstration.
              </div>

              <div className="access-modal-footer">
                <button
                  type="button"
                  className="access-modal-secondary"
                  onClick={() => setSelectedUser(null)}
                >
                  Close
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </VaultLayout>
  );
}

export default AccessControl;
