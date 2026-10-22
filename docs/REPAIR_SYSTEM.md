# Repair System integration

## Repair Sheet connection (current)

The configured Apps Script endpoint now supplies the live adapter automatically. Deploy the updated `google-apps-script/Code.gs` before using it. Older deployments fail explicitly; they do not silently save local demo data. Live operations have not been verified against a deployed workbook in this session.

The existing `Repair` tab must match the supplied screenshot: row 6 headings, row 7+ records, A Timestamp, B Sr No., C Name Of The Person, D Company, E Things Not Working, F Location Of Problem, G Planned, H Actual, I Problem, J Where Have To Solve, K Time Delay, L Planned, M Actual, N Status, O Time Delay. Duplicate Planned/Actual/Time Delay headings are disambiguated by their template positions. A mismatch blocks writes instead of guessing.

G/K/L/O are read-only to the backend; existing formulas at every other write target are checked before any values are written. Formulas are not generated or copied. The template must provide its own planned/delay formulas. Approval writes H/I/J/N, resolution writes M/N. Resolution remarks, submission idempotency key and optimistic version are stored as JSON in the B cell note, since the screenshot contains no remarks column. This note is reserved for application metadata. Script locking protects serial allocation and transitions. As with the existing Apps Script API, frontend permission checks are not server-side authentication; deployment access must be restricted appropriately.

Current local verification: `node google-apps-script/repair.test.cjs`, `node src/services/repairService.test.mjs`, targeted service ESLint and production build pass. The historical unconfigured-mode adapter notes below are superseded by this connection.

Navigation: only New Issue Request (`repair-new`), Approval For Repair (`repair-system`) and Repair Problem (`repair-problem`) appear in the Repair sidebar. New Issue Request redirects to Approval For Repair after saving. Both records pages have separate Pending and History tables. Approval actions require Problem (Yes/No) and Where Have To Solve; assessed records enter approval History. Only Yes assessments enter Repair Problem Pending. Resolving requires Problem Resolve Remark and moves the record into repair History. Base columns are Sr No., Name Of The Person, Company, Things Not Working and Location Of Problem. New serials use `RS - 001`, `RS - 002` etc.; existing historical serials are preserved. The backend adapter must allocate this format atomically.

No router or dependency was added. Existing Modal, Pagination, company master, authentication and UI styles are reused. Legacy management, overview and MIS calculations remain internal for compatibility, but no longer have sidebar pages. Repair History uses the repair completion timestamp, not the legacy overall management completion status.

Default mode is unconfigured and blocks writes. The explicit “Open development demo” button enables browser-only data. Demo storage has its own key; writes and SNW sequence allocation use Web Locks across tabs. Demo mode resets on page reload (stored demo records remain available when selected again). No Google Sheet headers, URLs or mappings have been invented or added to Code.gs.

## Responsibilities

Any active signed-in user can open the module and create an issue. Admin has all actions. Grant the existing Admin Master permission entries `repair-approval`, `repair-work`, `repair-management` to users responsible for DME 1, DME 2 and Management respectively. In this module these explicit responsibility entries permit their named action; unrelated Make System edit restrictions remain unchanged. No employee names are hardcoded. Existing Apps Script user parsing currently only round-trips the original workflow stage names, so these new responsibility grants must be persisted by the eventual backend integration; non-admin demo grants may be replaced by the existing background user sync. Admin demo works without grants.

## Backend adapter contract

Register a trusted adapter using `configureRepairAdapter` from `src/services/repairService.js`. Required methods: listIssues(), getIssueDetails(id), createIssue({data,idempotencyKey}), submitAssessment({id,data,expectedVersion}), completeRepair({id,data,expectedVersion}), acknowledgeCompletion({id,data,expectedVersion}). Methods return canonical issue objects (list returns an array). Dashboard and MIS use the same shared calculations on those issues.

Issue object: id, serial, requester, company, description, location, createdAt (ISO timestamp), version (number), approval/repair/management objects with planned and actual ISO timestamps, assessment {repairRequired: Yes or No, whereToSolve}, repair.remarks, activity [{action,stageKey,actor,actorId,timestamp}]. Preserve imported planned timestamps exactly; do not recalculate on reads/imports.

The production adapter must authenticate the user server-side (do not trust frontend actor/role claims), enforce responsibility and prerequisite checks, compare expectedVersion atomically, allocate SNW serials under a backend lock/transaction, persist create idempotency keys, generate actual timestamps on the backend, and record actors/activity. Frontend permission checks alone are not backend enforcement. No real backend is connected yet.

Needed next: spreadsheet identifier/link, tab name, header row, exact headers and field mappings, formula/protected columns, authenticated backend/session mechanism, and user responsibility source. Working timezone is Asia/Kolkata; Monday–Saturday working, Sunday excluded, seconds zero for planned times. No holiday calendar or notifications. “No” assessment closes as No Repair Required, not Rejected. Repair and management activity keys are SRIF-2 and SRIF-3.

Verification: `node src/utils/repairWorkflow.test.mjs`, `npm.cmd run build`, `npm.cmd run lint`. Local tests do not verify live Sheet operations.
