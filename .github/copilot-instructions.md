# Most Project Instructions

- [x] Verify that the copilot-instructions.md file in the .github directory is created.
- [x] Clarify Project Requirements
- [x] Scaffold the Project
- [x] Customize the Project
- [x] Install Required Extensions
- [x] Compile the Project
- [x] Create and Run Task
- [x] Launch the Project
- [x] Ensure Documentation is Complete

## Project Overview
Most is a Next.js application that helps users track TV shows and notifies them when a season is fully aired ("Binge Ready").

## Tech Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Trakt API
- ical-generator

## Key Files
- \src/lib/trakt.ts\: Trakt API client and logic.
- \src/app/api/calendar/route.ts\: Generates the ICS calendar feed.
- \src/app/page.tsx\: Main dashboard.
