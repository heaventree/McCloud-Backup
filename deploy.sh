#!/bin/bash

# WordPress Backup Application Deployment Script
# This script deploys the WordPress backup application to a server
# It sets up Node.js, installs dependencies, and configures environment variables

# Exit on any error
set -e

echo "========================================="
echo "WordPress Backup Application Deployment"
echo "========================================="

# Check if running with sudo/root
if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root or with sudo"
  exit 1
fi

# Configuration - Change these variables as needed
APP_DIR="/opt/wordpress-backup"
APP_PORT=5000
NODE_VERSION="20.x"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"

# If admin password wasn't provided, generate a secure one
if [ -z "$ADMIN_PASSWORD" ]; then
  ADMIN_PASSWORD=$(openssl rand -base64 12)
  echo "Generated admin password: $ADMIN_PASSWORD"
  echo "Please save this password securely!"
fi

# Create application directory
echo "Creating application directory..."
mkdir -p "$APP_DIR"

# Install Node.js if not already installed
if ! command -v node &> /dev/null; then
  echo "Installing Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION | bash -
  apt-get install -y nodejs
fi

# Install required packages
echo "Installing system dependencies..."
apt-get update
apt-get install -y git unzip curl

# Clone or download the application
echo "Downloading application code..."
cd "$APP_DIR"

# Option 1: Clone from Git repository (uncomment if using Git)
# git clone https://github.com/yourusername/wordpress-backup.git .

# Option 2: Download and extract ZIP archive
curl -L -o wp-backup.zip https://github.com/yourusername/wordpress-backup/archive/main.zip
unzip -q wp-backup.zip
mv wordpress-backup-main/* .
rm -rf wordpress-backup-main wp-backup.zip

# Install dependencies
echo "Installing Node.js dependencies..."
npm install --production

# Create environment file
echo "Setting up environment variables..."
cat > "$APP_DIR/.env" << EOL
# Server Configuration
PORT=$APP_PORT
NODE_ENV=production

# Admin Authentication
ADMIN_USERNAME=$ADMIN_USERNAME
ADMIN_PASSWORD=$ADMIN_PASSWORD

# OAuth Configuration (Add your OAuth credentials here)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
DROPBOX_CLIENT_ID=
DROPBOX_CLIENT_SECRET=
ONEDRIVE_CLIENT_ID=
ONEDRIVE_CLIENT_SECRET=

# Database Configuration (if using a database)
DATABASE_URL=
EOL

# Update file permissions
chown -R $(whoami):$(whoami) "$APP_DIR"
chmod 600 "$APP_DIR/.env"

# Create systemd service for auto-start
echo "Creating systemd service..."
cat > /etc/systemd/system/wordpress-backup.service << EOL
[Unit]
Description=WordPress Backup Application
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$APP_DIR
ExecStart=$(which npm) start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOL

# Reload systemd, enable and start the service
systemctl daemon-reload
systemctl enable wordpress-backup.service
systemctl start wordpress-backup.service

echo "========================================="
echo "WordPress Backup Application has been deployed!"
echo "Access the application at: http://your-server-ip:$APP_PORT"
echo "Admin username: $ADMIN_USERNAME"
echo "Admin password: $ADMIN_PASSWORD"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Update OAuth credentials in $APP_DIR/.env if you want to enable cloud storage integration"
echo "2. Configure your WordPress sites to connect to this backup service"
echo "3. Set up HTTPS using a reverse proxy like Nginx or Apache"
echo "========================================="