Farm Craft fixes in this package

1. Admin Settings save fix
- Settings now saves through PUT /api/company instead of relying on the /api/admin/company path.
- Backend provides the protected PUT /api/company endpoint and keeps /api/admin/company as a compatibility alias.
- Existing admin authentication/login flow is unchanged.
- Company/profile details continue to be stored in MongoDB and returned to the customer site through GET /api/company.

2. Customer purchase email
- Email in the purchase details step is explicitly optional.
- Blank email is accepted; if an email is entered, it is still validated as an email address.
- Name, mobile number, and delivery address remain required.

Validation performed
- Backend Python source compiled successfully.
- Customer JavaScript source passed node syntax checks.

Note: The repository source is the authoritative build input. The environment used to prepare this archive did not have the complete npm dependency cache needed to regenerate the React/Vite admin bundle, so run the normal npm install/build commands after extracting if you deploy the dist output.
