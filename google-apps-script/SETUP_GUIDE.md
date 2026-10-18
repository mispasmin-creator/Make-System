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
- **FMS Workflow Requests**: Every request creation, introduction approval, development progress update, testing QA decision, and MIS completion synchronizes in real time both ways.
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
