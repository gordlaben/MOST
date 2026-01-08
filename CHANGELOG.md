# Changelog

## [0.2.0] - 2026-01-01

### Added
- **Stremio Installation UI**: Replaced the simple URL copy field with a user-friendly 3-button layout (Open in Desktop, Open in Web, Copy URL).
- **Stremio Configuration**: Added `behaviorHints` to the manifest to support configuration.
- **Stremio Versioning**: Implemented dynamic manifest versioning to force Stremio to recognize updates.
- **Dynamic Backgrounds**: The dashboard now features rotating background images based on the fanart of shows in your lists.
- **API Rate Limiting**: Implemented a smart rate-limit calculator that adjusts the refresh interval based on the number of API calls made.
- **Rate Limit UI**: Added an information box displaying the current refresh interval and API usage stats.
- **Refresh Timer**: The refresh button now includes a countdown timer and disables itself to enforce the safe refresh interval.
- **Client-Side Enforcement**: Refresh timers persist across page reloads using local storage.

### Fixed
- **Auth Redirect Loop**: Fixed an issue where users were redirected to a new profile instead of their existing one after Trakt login.
- **Database Migration**: Added missing migration for the `Profile` table to prevent production crashes.
- **Stremio Caching**: Unified cache keys between Dashboard and Stremio APIs to ensure data consistency and prevent "Scanning..." placeholders.
- **Prisma Crash**: Resolved a critical "Rust Panic" error caused by high-concurrency `upsert` operations by refactoring to a check-then-act pattern.
- **UI Layout**: Adjusted padding on the login screen and spacing around the logo for a cleaner look.
- **Image Handling**: Fixed issues where some Trakt images were missing the protocol (http/https).
- **Background Scrolling**: Fixed background images to be fixed-position, preventing them from scrolling with content.

### Changed
- **Minimum Refresh Interval**: Increased the absolute minimum refresh interval to 15 minutes to ensure stability.
