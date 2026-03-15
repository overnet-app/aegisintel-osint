#!/bin/sh
set -e

# Fix Caddyfile if it's a directory
if [ -d /workspace/Caddyfile ]; then
    echo "Removing Caddyfile directory..."
    rm -rf /workspace/Caddyfile
fi

# Create Caddyfile if it doesn't exist
if [ ! -f /workspace/Caddyfile ]; then
    echo "Creating Caddyfile..."
    cat > /workspace/Caddyfile << 'EOF'
{
    # Global options block
    auto_https off
    local_certs
}

# SearXNG reverse proxy
localhost {
    reverse_proxy searxng:8080 {
        header_up Host {host}
        header_up X-Real-IP {remote}
        header_up X-Forwarded-For {remote}
        header_up X-Forwarded-Proto {scheme}
    }
}
EOF
    chmod 644 /workspace/Caddyfile
    echo "Caddyfile created successfully"
fi

# Start Caddy
exec caddy run --config /etc/caddy/Caddyfile
