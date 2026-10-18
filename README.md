\# Case Vault Backend



FastAPI + MongoDB Atlas backend for \*\*Case Vault: A Secure Web-Based Archive for

Analyzed Forensic Case Data\*\* (Group Metaguard, CCSFEN1L / COM243).



It authenticates users, enforces role-based permissions, stores PDF evidence

immutably with full version history and SHA-256 hashes, detects tampering, and

records an audit trail of important actions.



\## Requirements



\- Python \*\*3.12\*\*

\- A MongoDB Atlas cluster (free M0 works; it is a replica set, which the

&#x20; transactions in this project require)

\- Windows PowerShell commands are shown; adjust for other shells



\## Setup



```powershell

py -3.12 -m venv venv

.\\venv\\Scripts\\Activate.ps1

pip install -r requirements.txt

```



If script activation is blocked:

`Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned`



Create your environment file from the template and fill in real values:



```powershell

copy .env.example .env

notepad .env

```



| Key | Meaning |

|---|---|

| `MONGO\_URI` | Atlas connection string with your DB user and password filled in |

| `DB\_NAME` | Database name (default `case\_vault`) |

| `JWT\_SECRET` | Long random string used to sign login tokens |



Generate a secret with:

`python -c "import secrets; print(secrets.token\_hex(32))"`



\*\*Never commit `.env`.\*\* It is listed in `.gitignore`.



\## Seed the database (once)



Only admins can create accounts, so the first admin is created by script:



```powershell

python -m app.services.seed\_service

```



This creates the roles (`admin`, `analyst`, `reviewer`), the permissions, the

role-permission mapping, and one admin account:



\- Email: `admin@casevault.org`

\- Password: `ChangeMe123!`



\*\*Change that password after your first login\*\* (`PATCH /users/me/password`).

The seed is safe to run again; it skips anything that already exists.



\## Run



```powershell

uvicorn app.main:app --reload

```



Open http://127.0.0.1:8000/docs for the interactive API.



Startup may print `DB connection attempt N/6 failed ... TLSV1\_ALERT\_INTERNAL\_ERROR`

and then succeed. That is the built-in retry handling an intermittent handshake

failure. If all 6 attempts fail, restart the server.



\## Try it



1\. `POST /auth/login` with the admin credentials, copy `access\_token`.

2\. Click \*\*Authorize\*\* in `/docs` and paste the token.

3\. `GET /roles` to find role ids, then `POST /users` to create an analyst.

4\. `POST /cases`, then `POST /evidence` (upload a PDF), then

&#x20;  `POST /evidence/{id}/versions` to add a replacement version.

5\. `GET /evidence/{id}/versions/{version\_id}/verify` to check integrity.

6\. `GET /audit` to see the chain of custody.



\## Roles and permissions



| Permission | admin | analyst | reviewer |

|---|:-:|:-:|:-:|

| `case:create` | yes | yes | - |

| `case:view` | yes | yes | yes |

| `case:update\_status` | yes | - | yes |

| `case:delete` | yes | - | - |

| `evidence:upload` | yes | yes | - |

| `evidence:view` | yes | yes | yes |

| `user:manage` | yes | - | - |



Routes declare the permission they need with

`Depends(require\_permission("..."))`. What each role may do is defined in

`app/services/seed\_service.py`.



\## Project structure



```

app/

├── main.py            app entry point, router registration

├── core/              config (.env), database connection, security (hash + JWT)

├── models/            MongoDB collections (Beanie documents)

├── schemas/           request/response shapes (Pydantic)

├── dependencies/      get\_current\_user, require\_permission

├── services/          audit logging, user creation, storage (GridFS), seeding

└── routers/           HTTP endpoints

```



\## Key design points



\- \*\*No public registration.\*\* Admins create accounts.

\- \*\*Immutable evidence.\*\* `Evidence` is the record; each uploaded file is an

&#x20; `EvidenceVersion`. A re-upload adds a version and never overwrites one.

\- \*\*Tamper detection.\*\* Each version stores a SHA-256 hash. `verify` re-hashes

&#x20; the stored file and flags a mismatch.

\- \*\*Soft delete.\*\* Deleting a case sets `deleted\_at`; the document remains.

\- \*\*Audit trail.\*\* Important actions write an `AuditTransaction`. User creation,

&#x20; case creation, evidence upload and new versions are written in a single

&#x20; MongoDB transaction with their audit entry.



\## Git workflow



Branches: `main` (stable) and `develop` (integration). Create a

`feature/<name>` branch off `develop` for new work. Before every commit, run

`git status` and confirm `.env` is not listed.



\## Common problems



| Problem | Fix |

|---|---|

| `ModuleNotFoundError` | Activate the venv, then `pip install -r requirements.txt` |

| Email rejected as reserved (`.local`, `.test`) | Use a normal domain such as `.com` or `.org` |

| bcrypt "72 bytes" error | `pip install "bcrypt==4.0.1"` |

| 500 `Permission ... is not configured` | Run the seed script |

| 401 on everything | Token expired (8 h) or not authorized; log in again |

