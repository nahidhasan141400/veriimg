# veriimg — Google-Only Admin Allowlist, Admin Manager & Standard Dashboard Layout

This update streamlines administrator authentication to exclusively use Google OAuth with a strict allowlist governed by Super Admin (`nahid.main.ai@gmail.com`), introduces a dedicated **Admin Manager** and **Overview** dashboard inside a standard sidebar admin layout, and removes all administrative links from the public verification header so consumers see only a discrete footer link.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following product and access-control decisions were confirmed during clarification and govern this implementation:

- **Confirmed Decision 1 — Super Admin Exclusive Delegation**: `nahid.main.ai@gmail.com` is the permanent Super Admin. Only the Super Admin can authorize new administrator Google emails or revoke existing delegated administrators in the **Admin Manager**. Delegated administrators can view the admin directory and operate all watermark tools (Overview, Image Inventory, Create Watermark, and R&D Lab).
- **Confirmed Decision 2 — Immediate Rejection for Unauthorized Accounts**: Authentication uses Google Sign-In exclusively (the email/passcode form is removed). If a user authenticates with a Google account that is neither the Super Admin nor present in the Firestore administrator allowlist, the session is immediately signed out and an **Access Denied** screen explains that their email is not authorized.
- **Confirmed Decision 3 — Standard Sidebar Admin Dashboard with Overview**: The Admin Console adopts a standard enterprise sidebar layout (`260px` sidebar + contextual top bar + main workspace) featuring five sections: **Overview**, **Image Inventory**, **Create Watermark**, **R&D Lab**, and **Admin Manager**.
- **Confirmed Decision 4 — Consumer-Pure Public Portal**: All admin navigation tabs and buttons are removed from the public verification page header. Public visitors only see a small, understated **Admin** link in the page footer.

---

### 1. Overview & Core Concept

- **What It Does**: Separates the consumer verification experience from the administrative back-office. Consumers land on a distraction-free verification portal with zero admin clutter in the top bar, while authorized administrators sign in with Google via a discrete footer link to access a full-featured sidebar dashboard with role-based access control.
- **Target Audience / Persona**:
  - **General Consumers**: Verify images and visit authentic destination URLs without encountering back-office controls or technical jargon.
  - **Super Admin (`nahid.main.ai@gmail.com`)**: Full governance over the watermark registry, R&D calibration tools, and the allowlist of delegated Google administrator accounts.
  - **Delegated Administrators**: Team members explicitly allowlisted by the Super Admin who manage watermarked assets and inspect extraction telemetry.
- **Key Value**: Enforces zero-trust Google identity verification, eliminates credential-form clutter, and upgrades the back-office experience to a cohesive multi-page enterprise dashboard.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Consumer Public Flow**: The visitor opens `veriimg` and sees a clean consumer header (`veriimg` brand mark, consumer jump links for Verify Image and How It Works, and an Upload Image action) with no admin links. At the bottom of the page, a quiet footer includes a small `Admin` link.
  2. **Google-Only Admin Sign-In & Allowlist Verification**: Clicking the footer `Admin` link opens the **Admin Sign In** gate featuring a single **Continue with Google** button. Upon Google OAuth completion:
     - If the user's verified email is `nahid.main.ai@gmail.com` or exists in the Firestore `/admins` allowlist, they enter the Admin Dashboard.
     - Otherwise, the app immediately signs out the unauthorized Google session and displays an **Access Denied** alert showing the rejected email address.
  3. **Standard Sidebar Admin Dashboard**:
     - **Left Sidebar (`260px` desktop, collapsible drawer on mobile)**: Brand header with role indicator (`Super Admin` or `Admin`), five navigation items (**Overview**, **Image Inventory**, **Create Watermark**, **R&D Lab**, **Admin Manager**), and bottom quick-return link to the Public Portal (`Exit to Public Portal`).
     - **Contextual Top Header**: Breadcrumb trail (`Admin Console / [Active Page]`) on the left; verified Google account identity, role label, theme toggle, and **Log Out** button on the right.
  4. **Overview Page**: Displays top-level KPI metrics (Total Registered Watermarks, Authorized Administrators, Average Luminance Strength $\Delta$, and Registry Capacity), a recent watermark activity table with 1-click verification/inspection, and quick navigation cards to create watermarks or manage admins.
  5. **Admin Manager Page**:
     - Displays the pinned **Super Admin** card (`nahid.main.ai@gmail.com` — immutable primary owner).
     - For the Super Admin: Provides an **Authorize Administrator** form (Google Email input, optional Display Name/Note, and **Add Admin** button) plus a searchable table of delegated administrators with a **Revoke Access** action on each row.
     - For Delegated Admins: Displays the authorized administrator directory in read-only mode with a clear notice that only the Super Admin can add or revoke administrator accounts.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-craft iOS and enterprise SaaS clarity — crisp 1px structural hairlines, generous whitespace, and zero decorative clutter.
  - *Color Palette & Mood*:
    - Light Mode: Cool alabaster canvas (`#F5F5F7`), pure white structural surfaces (`#FFFFFF`), slate ink typography (`#18181B`), iOS System Blue primary accent (`#007AFF`), Emerald verification state (`#34C759`), and Apple System Red destructive/logout state (`#FF3B30`).
    - Dark Mode: Deep obsidian canvas (`#09090B`), elevated zinc surfaces (`#121215`), crisp zinc-50 text, and matched semantic accents.
  - *Typography & Hierarchy*: Geometric display and UI structure (`Plus Jakarta Sans`) paired with tabular monospace numerals (`JetBrains Mono`, `tabular-nums`) for all 32-bit integer IDs, hex codes, timestamps, and dashboard counters.
  - *Component Styling & Layout*: Single-elevation surface cards with hairline borders (`border-black/6 dark:border-white/8`), compact high-density data tables (`40px`–`44px` row heights), and unboxed metadata using middle-dot (`·`) separators.

- **Interactive Feedback & Motion**:
  - Instant loading states during Google OAuth handshake and Firestore allowlist verification.
  - Immediate visual confirmation banners when authorizing or revoking an administrator email.
  - Smooth tab and sidebar transitions settling within `150ms`.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Email-Keyed Firestore Admin Allowlist (`/admins/{adminEmail}`)**
  - *Chosen Approach*: Store delegated administrator records in Firestore under `/admins/{normalizedEmail}` where the document ID is the lowercase Google email address and fields include `email`, `displayName`, `role` (`'admin'`), `addedBy` (`'nahid.main.ai@gmail.com'`), and `createdAt`.
  - *Why*: The Super Admin authorizes people by their Google email address before those users have ever logged in (so their Firebase UID is not yet known in advance). Keying `/admins` by lowercase email allows both client-side checks and Firestore Security Rules (`exists(/databases/$(database)/documents/admins/$(request.auth.token.email))`) to verify admin status synchronously on first Google sign-in.
  - *Alternatives Considered*: Keying `/admins` by Firebase `uid` was replaced because the Super Admin only knows a new colleague's Google email address when inviting them, not their internal Firebase UID.

- **Decision 2: Strict Super Admin Gate on `/admins` Mutations**
  - *Chosen Approach*: Enforce `isSuperAdmin()` (`request.auth.token.email_verified == true && request.auth.token.email == 'nahid.main.ai@gmail.com'`) on `create`, `update`, and `delete` rules for `/admins/{adminEmail}` in `firestore.rules` as well as in the Admin Manager UI.
  - *Why*: Prevents privilege escalation—delegated admins can manage watermarks in `/watermarks`, but cannot add new admins or delete the Super Admin.

- **Decision 3: Decoupled Public Header vs. Footer Admin Entry**
  - *Chosen Approach*: Strip all admin navigation links and the Admin Login CTA from the public top bar; place a small `Admin` link in the right-hand cluster of the footer.
  - *Why*: Keeps the consumer verification portal focused on a single task (verifying an image) while giving administrators a predictable, standard entry point.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                           veriimg Application Shell                        │
├───────────────────────────────────┬────────────────────────────────────────┤
│      Public Verification Mode     │          Admin Console Mode            │
│  ┌─────────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ Consumer Top Bar            │  │  │ Google-Only Admin Login Gate     │  │
│  │ (Brand · Verify · Upload)   │  │  │  ├─ Firebase Google OAuth Popup  │  │
│  ├─────────────────────────────┤  │  │  └─ Allowlist Check (/admins)    │  │
│  │ PublicVerificationPortal    │  │  │     ├─ Allowed -> Open Dashboard │  │
│  │  ├─ Drag & Drop / Camera    │  │  │     └─ Denied  -> Auto Sign-Out  │  │
│  │  ├─ Web Worker 20x20 Scan   │  │  ├──────────────────────────────────┤  │
│  │  └─ Firestore ID Lookup     │  │  │ Standard Sidebar Admin Layout    │  │
│  ├─────────────────────────────┤  │  │  ├─ Left Sidebar Navigation      │  │
│  │ Quiet Footer                │  │  │  ├─ Top Header (Breadcrumb/Exit) │  │
│  │  └─ Small "Admin" Link ─────┼──┼─►│  └─ Active Workspace View:       │  │
│  └─────────────────────────────┘  │  │      ├─ 1. AdminOverviewTab      │  │
│                                   │  │      ├─ 2. AdminInventoryTab     │  │
│                                   │  │      ├─ 3. AdminCreateTab        │  │
│                                   │  │      ├─ 4. AdminLabTab           │  │
│                                   │  │      └─ 5. AdminManagerTab       │  │
│                                   │  └──────────────────────────────────┘  │
└───────────────────────────────────┴────────────────────────────────────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                Firebase Authentication & Cloud Firestore                   │
│  ├─ Auth: GoogleAuthProvider (email_verified == true)                      │
│  ├─ /watermarks/{id}: Public read, Admin/SuperAdmin create/update/delete   │
│  └─ /admins/{email}:  SuperAdmin ('nahid.main.ai@gmail.com') write-only,   │
│                       Verified Admin read/list                             │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **Super Admin Constant**: `SUPER_ADMIN_EMAIL = 'nahid.main.ai@gmail.com'` (immutable root administrator).
  - **AdminRecord (`/admins/{email}`)**:
    - `email` (`string`, lowercase email matching document ID, 5–128 chars)
    - `displayName` (`string`, 1–80 chars, e.g. `"Alex Rivera"`)
    - `role` (`'admin'`)
    - `addedBy` (`string`, `'nahid.main.ai@gmail.com'`)
    - `createdAt` (`timestamp`, server timestamp)
  - **WatermarkRecord (`/watermarks/{watermarkId}`)**:
    - Existing 32-bit integer ID (`0` to `4294967295`), `hex`, `binary`, `targetUrl`, `title`, `thumbnailDataUrl`, `delta`, `createdBy`, and `createdAt`.

- **Interactive Component & State Mapping**:
  - **Public Header & Footer**:
    - Public header renders consumer-only navigation (`Verify Image`, `How It Works`, `Sample Assets`) and a primary `Verify an Image` trigger that focuses/opens the file picker.
    - Footer renders a subtle `Admin` link (`text-xs text-zinc-400 hover:text-zinc-700`) that switches the view mode to `admin`.
  - **Google-Only Login & Allowlist Guard**:
    - Clicking **Continue with Google** triggers `signInWithPopup(auth, googleProvider)`.
    - On auth state change or popup resolution, the app normalizes `user.email.toLowerCase()`.
    - If `email === 'nahid.main.ai@gmail.com'`, `role` is set to `'super_admin'` and dashboard access is granted immediately.
    - Otherwise, the app performs a `getDoc(doc(db, 'admins', email))` check. If the document exists, `role` is set to `'admin'` and dashboard access is granted. If it does not exist, `firebaseSignOut(auth)` is called immediately and `authError` is set to a clear Access Denied message identifying the unauthorized email.
  - **Standard Admin Dashboard Shell**:
    - Left sidebar switches `activeAdminTab` across `'overview' | 'inventory' | 'create' | 'lab' | 'admins'`.
    - Top header displays the current section title, the signed-in user's Google email and role (`Super Admin` or `Admin`), Dark/Light theme toggle, and **Log Out** button.
  - **AdminOverviewTab**:
    - Computes live metrics from `mergedRecords` and `adminRecords` (total watermarks, authorized admins count, mean $\Delta$ intensity, latest registration timestamp).
    - Renders a 5-row recent registrations table with direct `Verify` and `Open URL` actions plus quick-launch buttons for **Create Watermark** and **Admin Manager**.
  - **AdminManagerTab**:
    - Subscribes to `/admins` collection when authenticated as an authorized admin.
    - Super Admin form validates email format (`^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$`), prevents duplicate or self-addition of `nahid.main.ai@gmail.com`, and writes the new `/admins/{email}` document to Firestore.
    - **Revoke** button deletes `/admins/{email}` from Firestore and updates the live table immediately.
