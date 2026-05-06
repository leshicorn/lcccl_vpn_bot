# Security Specification for VPN Family Bot

## Data Invariants
1. A VPN config must belong to a registered nickname in the `mappings` collection.
2. Only the Admin can upload or modify configurations.
3. Users can only read their own configurations (identified by their Telegram ID mapped to a nickname).

## The Dirty Dozen Payloads
1. Attempt to create a mapping with a spoofed admin ID.
2. Attempt to read `configs` collection without authentication.
3. Attempt to read another user's `configs`.
4. Attempt to update a `config` that doesn't belong to the user.
5. Attempt to delete a `mapping` by a non-admin.
6. Attempt to inject a massive string into `content` (Denial of Wallet).
7. Attempt to create a config with a nickname that doesn't exist in `mappings`.
8. Attempt to update `updatedAt` to a past date.
9. Attempt to change the `nickname` of an existing config.
10. Attempt to upload a config with no `content`.
11. Attempt to read the entire `mappings` collection as a regular user.
12. Attempt to overwrite the admin's own mapping.

## The Test Runner (firestore.rules.test.ts)
(To be implemented if needed for automated verification, but here we focus on the rules)
