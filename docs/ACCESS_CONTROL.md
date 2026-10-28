# System and stage access

The Login Page sheet remains the source of truth. Existing users and passwords are preserved; do not delete the sheet to migrate.

## Apply the update

1. Deploy the updated `google-apps-script/Code.gs` as a new version of the existing Apps Script web app.
2. Log out and log in again. Connected logins now validate sheet credentials on the server and require a session token.
3. As Admin, open Admin Master and select **Update Access Columns**, or run `formatLoginPageSheet` in the Apps Script editor.
4. Edit a user, enable the required systems, and select View and Update / Submit separately for their stages.

Migration appends named system Access columns and stage View/Update columns. The old Permitted Stages column is no longer used or written (it can be deleted); access comes only from those columns. Created values and custom columns are preserved. Legacy view permissions are migrated; non-admin Update defaults to No unless explicitly granted.

## Rules

- Disabled systems hide their sidebar sections and stages.
- View does not grant submission, approval, resolution, or workflow updates.
- Update requires View. Only an active Admin can manage user accounts and permissions.
- Passwords no longer change access. Pages come only from the role defaults and the View/Update ticks saved in Admin Master (or the Login Page sheet).
- The backend checks current sheet permissions for each authenticated action. Cached server sessions last up to six hours and may expire sooner; log in again if a session expires.
- Never share session tokens or sheet passwords. This retains the existing sheet-password model rather than introducing a separate identity provider.

Local policy, mocked sheet/API tests, and production builds do not replace testing the deployed web app against the live spreadsheet. No live sheet reset or deployment is performed by these code changes.
