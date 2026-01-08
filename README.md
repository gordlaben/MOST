# Most

<div align="center">

**The TV Show Tracker for Patient Watchers**

[![Docker Pulls](https://img.shields.io/docker/pulls/gordlaben/most)](https://hub.docker.com/r/gordlaben/most)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Trakt.tv](https://img.shields.io/badge/Data-Trakt.tv-red)](https://trakt.tv)

<p align="center">
  <img src="public/logo.png" alt="Most Logo" width="128" height="128" />
</p>

Most is a self-hosted Next.js application that revolutionizes how you track TV shows. Instead of chasing weekly episodes, **Most** helps you wait. It monitors your active shows and notifies you only when a season is **fully aired and ready to binge**.

[Features](#features) • [Installation](#installation) • [Stremio](#stremio-integration) • [Configuration](#configuration)

</div>

---

## ✨ Features

*   **🎯 Binge Ready Logic**: Intelligently calculates season finale dates. A show only appears in your "Binge Ready" list when the *entire* season has aired.
*   **📅 Smart Calendar Feed**: Generates a personal `.ics` subscription link for Google/Apple Calendar. See exactly when your shows become binge-able.
*   **🎬 Stremio Addon**: Native integration with Stremio. Adds "Binge Ready" and "Episodes Left" catalogs directly to your streaming hub.
*   **🔄 Two-Way Sync**: Seamlessly syncs your watchlist and watched history with Trakt.tv.
*   **👥 Multi-Profile**: Create separate profiles for every member of the household, each with their own Trakt account and preferences.
*   **📱 PWA Ready**: Install on your phone or desktop as a native-like app.
*   **⚡ Local Caching**: Fast UI responsiveness and reduced API usage thanks to a local SQLite database and smart caching.
*   **🛡️ Privacy First**: Self-hosted. Your data stays on your server.

---

## 🚀 Getting Started

### Prerequisites

*   **Trakt.tv API App**: You need a Trakt API Client ID and Secret.
    1.  Go to [trakt.tv/oauth/applications](https://trakt.tv/oauth/applications)
    2.  Click "New Application"
    3.  Name: `Most` (or anything you like)
    4.  Redirect URI: `http://<your-domain-or-ip>:3000/api/auth/callback`
    5.  Javascript (CORS) origins: `http://<your-domain-or-ip>:3000`

### 🐳 Installation (Docker)

The recommended way to run Most is via Docker Compose.

1.  Create a `docker-compose.yml` file:

```yaml
services:
  most:
    image: gordlaben/most:latest
    container_name: most
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      # Required: Database location
      - DATABASE_URL=file:/app/data/prod.db
      
      # Optional: Pre-configure Trakt (can also be done in UI)
      - TRAKT_CLIENT_ID=your_client_id
      - TRAKT_CLIENT_SECRET=your_client_secret
      
      # Required: Your public URL for Stremio/Calendar links
      - NEXT_PUBLIC_BASE_URL=http://localhost:3000
    volumes:
      - ./data:/app/data
```

2.  Run the container:

```bash
docker-compose up -d
```

3.  Open `http://localhost:3000` in your browser.

### 🛠️ Installation (Manual)

<details>
<summary>Click to expand manual installation steps</summary>

1.  **Clone the repository**
    ```bash
    git clone https://github.com/gordlaben/most.git
    cd most
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Setup Environment**
    ```bash
    cp .env.local.example .env.local
    # Edit .env.local with your database URL and Trakt keys
    ```

4.  **Initialize Database**
    ```bash
    npx prisma generate
    npx prisma db push
    ```

5.  **Run Development Server**
    ```bash
    npm run dev
    ```
</details>

---

## ⚙️ Configuration

You can configure Most using environment variables in your `docker-compose.yml` or `.env` file.

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Connection string for Prisma. Use `file:/app/data/prod.db` for SQLite in Docker. | `file:./dev.db` |
| `NEXT_PUBLIC_BASE_URL` | The public URL of your installation. Used for generating calendar and Stremio links. | `http://localhost:3000` |
| `TRAKT_CLIENT_ID` | Your Trakt.tv Application Client ID. | - |
| `TRAKT_CLIENT_SECRET` | Your Trakt.tv Application Client Secret. | - |
| `ADMIN_PASSWORD` | (Optional) Password for accessing the `/admin` dashboard to manage users. | - |

---

## 📺 Integrations

### Stremio Integration
Most acts as a Stremio addon server. To add it to Stremio:
1.  Log in to your Most dashboard.
2.  Click the **Stremio** button in the navigation or settings.
3.  Click "Install on Stremio".
4.  This adds two new catalogs to your Stremio Board:
    *   **Binge Ready**: Shows with completed seasons waiting for you.
    *   **Episodes Left**: Shows you are currently in the middle of watching.

### Calendar Feed
Never miss a binge date. Most provides a standard ICS subscription link.
1.  Log in to your Most dashboard.
2.  Click the **Calendar** icon/button.
3.  Copy the provided URL.
4.  Paste it into Google Calendar ("Add from URL") or Apple Calendar ("New Calendar Subscription").

---

## 🛠️ Tech Stack

*   **Framework**: [Next.js 15](https://nextjs.org/) (App Router)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **Database**: SQLite with [Prisma ORM](https://www.prisma.io/)
*   **Authentication**: Custom Auth + Trakt OAuth
*   **Containerization**: Docker

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
