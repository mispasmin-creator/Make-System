# Google Sheets ↔ Make System Two-Way Sync Setup Guide

Follow these simple steps to connect your Google Sheet with the Make System React application for automatic real-time two-way synchronization:

---

## Step 1: Create a Google Sheet
1. Open [Google Sheets](https://sheets.new) in your browser.
2. Name your spreadsheet **"Make System - Production Database"** (or any name you prefer).

---

## Step 2: Add Google Apps Script
1. In your Google Sheet, click **Extensions** in the top menu → **Apps Script**.
2. Delete any default code in the editor (`myFunction()`).
3. Copy all code from the file:
   `google-apps-script/Code.gs`
   and paste it into the Apps Script editor.
4. Click the **Save** (💾) icon or press `Ctrl + S`.

---

## Step 3: Deploy as Web App (One-Time Setup)
1. In the Apps Script editor, click the blue **Deploy** button (top right) → **New deployment**.
2. Click the gear icon (⚙) next to "Select type" → choose **Web app**.
3. Fill in the deployment details:
   - **Description**: `Make System Live Sync`
   - **Execute as**: `Me (your email address)`
   - **Who has access**: `Anyone` *(Crucial: allows the React frontend to communicate with your sheet securely)*
4. Click **Deploy**.
5. If prompted, click **Authorize access**, select your Google account, click **Advanced** → **Go to Untitled project (unsafe)**, and click **Allow**.
6. Copy the **Web App URL** shown (it looks like `https://script.google.com/macros/s/AKfycb.../exec`).

---

## Step 4: Connect to React App
1. Open the Make System React app in your browser (e.g. `http://localhost:5173/`).
2. Click the Google Sheets connection badge in the top header.
3. Paste your Web App URL into the **Google Apps Script Web App URL** input.
4. Click **"Save & Connect Google Sheets"**.

---

## Updating an Existing Deployment
If you already deployed Apps Script before, whenever you update `Code.gs`:
1. In the Apps Script editor, click **Deploy** → **Manage deployments**.
2. Click the **Edit** icon (pencil ✏️) next to the active Web App deployment.
3. Under **Version**, select **New version**.
4. Click **Deploy**.

---

## Automatic Two-Way Synchronization Features
- **FMS Workflow Requests**: Every request creation, assignment approval, development progress update, system introduction completion, and MIS completion synchronizes in real time both ways.
- **Admin Master ↔ Login Page Sheet**:
  - Tab name: **`Login Page`**
  - Standard 8-Column Layout:
    1. **`Full Name`**: Full display name only (e.g. `System Administrator`, `Ahitesh Tandon`)
    2. **`User`**: Username only (e.g. `admin`, `ahitesh`)
    3. **`Role`**: `ADMIN` / `USER`
    4. **`Password`**: `password123`
    5. **`Status`**: `ACTIVE` / `INACTIVE`
    6. **`Department`**: e.g. `IT & Infrastructure`, `Engineering`
    7. **`Created`**: Date & time (e.g. `01 Oct 2026, 2:30 PM`)
    8. **`Permitted Stages`**: Permitted stages list (e.g. `All Stages (Admin Full Access)`, `3 of 6 Stages (Requests, Create, Revise)`)
  - **One-Click Format & Auto-Align**:
    - In Apps Script editor, run function `formatLoginPageSheet` to align existing rows immediately.
    - Or reload the Google Sheet and click **⚡ Make System** → **🔄 Format & Align Login Page**.
    - Or click **"Sync Sheet"** button inside React Admin Master!
  - When you create, edit, deactivate, or delete any user in React Admin Master, it updates the `Login Page` sheet immediately.
  - When you add, edit, or remove rows in the `Login Page` sheet, the React app detects the change automatically and updates live!

### Five-step Make System workflow

The workflow is **System Request -> Assign System -> Create System -> Introduce System -> Update in MIS System**.

Deploy the updated `Code.gs` as a new version of the existing Apps Script web app before releasing the frontend. Keep the existing deployment URL and spreadsheet. The backend maps the updated FMS headings by name; no data reset is needed. Older layouts remain supported.

- The former introduction approval is now Assign System. Its existing `approveIntroduction` API, `introduction` audit object, and assignment Actual column remain compatible.
- Completed development enters the new Introduce System queue. The `completeIntroduction` action requires remarks, writes the completion timestamp to `Actual 2` (W) and `Completed` to `Status` (Y), and retains the independent `systemIntroduction` audit record in Script Properties. Finishing development sets this Status to `Pending`.
- MIS can close a new-workflow request only after system introduction. In the updated layout, `Actual 2` or a completed introduction `Status` determines MIS eligibility. Existing Closed rows remain closed.
- Existing Introduce System permissions also preserve assignment access until explicit Assign System permissions are saved. Admin Master supports separate access for both pages.

For the updated FMS layout: assignment uses `Actual` (J), development uses `Actual 1` (O), introduction uses `Actual 2` (W) / `Status` (Y), and MIS uses `Actual 4` (AA) / `Final Status` (AC). `Work Status` (H) remains separate from introduction `Status`. All `Planned` / `Delay` columns (I, K, N, P, V, X, Z, AB) are read-only to the backend, including empty cells without formulas. The backend never saves values or clears formulas in these columns.

### Development completion response / blank introduction Status

Deploy this backend **and** the updated frontend together. Completion now uses the dedicated `completeDevelopment` action, which saves development and introduction `Status = Pending` in one request; an older deployment rejects that action before writing. In-progress and hold updates retain the existing action. The ping response identifies this backend as `workflowBuild: targeted-save-v4`.

If a previous completion saved development but showed the old frontend error (for example SM-0065), run `syncPendingIntroductionStatus` once from the Apps Script editor, then refresh the app. It fills only blank introduction Status cells on completed requests still awaiting introduction. It preserves existing management statuses, Closed requests, metadata, and all Planned/Delay cells. This function is safe to repeat.

### Targeted saves (optimized backend)

Deploy `Code.gs` and the frontend together. Existing sheet data and formulas need no reset or migration. The app sends `requestId`, `requestNo`, and `sheetRowIndex` on each existing-request update. The backend reads row 6 once to map current headers, verifies the hinted row's Request No. and internal ID, loads only `REQMETA_<requestNo>`, and writes only changed required cells. A stale row hint falls back to searching the Request No. column; it never reads the full FMS table to save one record. Legacy clients without a reference retain a slower identifier-column fallback.

Permission checks read the current user's Login Page row, with only the username-to-row location cached. Role, status and permissions are reread on every request, so deactivation and sheet edits take effect immediately. Header positions are read fresh to support moved columns. These checks are preserved, not bypassed for speed.

In the performance fixture (200 FMS records, 100 users), a normal save uses four single-row value reads: Login header/user and FMS header/request. A progress-only change writes zero sheet cells when Work Status is unchanged; its progress/remarks/history are saved in that request's metadata. On Hold changes three cells when status, reason and hold date change. Individual changed cells are checked for formulas before any values are written. Planned/Delay columns, including blank cells, are excluded.

The normal save is one app-to-Apps-Script POST and returns the changed record. A success-only compatibility response uses `getRequest` to read just that record. Initial listing and explicit Sync Sheet still load the requested dataset; workflow page navigation reuses the loaded list and applies save responses locally. Use Sync Sheet or reload to fetch changes made directly in the spreadsheet. Setup, admin user listing and one-time repair/cleanup utilities intentionally inspect larger ranges and are not called on normal saves.

Removed the unused seed-user generator and consolidated duplicate workflow state handling. Repair, Technical Help, login/permissions, attachments, legacy-history compatibility and the five-step Make System workflow remain available in the shared backend.

Existing Repair assessments and resolution updates also locate their serial in one column, read only that issue and its metadata, and preserve version/idempotency and formula checks. New Repair issue allocation retains the existing scan needed to assign the next serial and recognize legacy submission keys. New FMS requests scan only the Request No. column once for allocation and the empty slot.
