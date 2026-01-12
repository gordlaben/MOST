## [0.8.5] - 2026-01-12
- Merge branch 'dev' Fix: Explicitly split Watchlist into Series/Movies in Dashboard and Stremio, support per-list sorting on homepage - Fix: Explicitly split Watchlist into Series/Movies in Dashboard and Stremio, support per-list sorting on homepage

## [0.8.4] - 2026-01-12
- Merge branch 'dev' fix: Apply sort and filters to Stremio catalog refresh to match Web UI - fix: Apply sort and filters to Stremio catalog refresh to match Web UI - fix: Stremio search and 404 error handling for most_search catalog

## [0.8.3] - 2026-01-09
- fix: enable Title (Z-A) sorting, fix deploy_dev script and type definitions - feat: setup deployment scripts and increase Trakt cache TTL to 3h - chore: bump version to 0.8.2 [skip ci] - Implement auto-token refresh on 401 errors in TraktClient - Fix image caching error by handling missing protocol in URLs - chore: bump version to 0.8.1 [skip ci] - chore: bump version to 0.8.0 [skip ci] - chore: bump version to 0.7.9 [skip ci] - chore: stop tracking maintainer script - docs: fix README formatting - docs: update readme - docs: rewrite content for a more natural tone - docs: improve project description and add gallery screenshots - feat: add ENABLE_REGISTRATION env var and update docs - feat: redesign sidebar and add community links - docs: reorder features list and fix formatting - docs: update README.md - chore: upload logo and screenshots assets - docs: use github specific logo in README - docs: finalize readme with screenshots, badges, and disclaimer - Docs: Update README with improved description and config options - chore: bump version to 0.7.8 [skip ci]

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



