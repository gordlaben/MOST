#!/bin/sh
set -e

# If the data directory is owned by root (which happens when Docker creates the volume),
# change ownership to the nextjs user.
if [ "$(id -u)" = "0" ]; then
    # Ensure the data directory exists
    mkdir -p /app/data
    
    # Change ownership of the data directory to nextjs user
    chown -R nextjs:nodejs /app/data
    
    # Also ensure the .next directory is writable (for cache)
    chown -R nextjs:nodejs /app/.next

    # Run migrations
    echo "Running database migrations..."
    su-exec nextjs prisma migrate deploy

    # Drop privileges and execute the command
    exec su-exec nextjs "$@"
fi

# If we are already running as non-root, just execute the command
exec "$@"
