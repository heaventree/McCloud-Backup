#!/bin/bash

# McCloud Backup - Deployment Script
# This script handles the installation and setup of the McCloud Backup application
# on a production server. It installs dependencies, builds the application, and
# configures the environment for production use.

set -e  # Exit on error

echo "=== McCloud Backup Deployment Script ==="
echo "Starting deployment process..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Check Node.js version
NODE_VERSION=$(node -v)
echo "Using Node.js version: $NODE_VERSION"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Installing PostgreSQL..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
fi

# Install PM2 for process management if not already installed
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2 process manager..."
    npm install -g pm2
fi

# Install project dependencies
echo "Installing project dependencies..."
npm install

# Create production build
echo "Creating production build..."
npm run build

# Setup database if needed
echo "Would you like to set up a PostgreSQL database for the application? (y/n)"
read setup_db

if [ "$setup_db" = "y" ]; then
    echo "Setting up PostgreSQL database..."
    echo "Enter PostgreSQL superuser (postgres) password:"
    read -s pg_password
    
    echo "Creating database 'mccloud_backup'..."
    PGPASSWORD=$pg_password createdb -U postgres mccloud_backup
    
    echo "Creating application database user..."
    echo "Enter new password for application database user:"
    read -s app_db_password
    
    PGPASSWORD=$pg_password psql -U postgres -c "CREATE USER mccloud_user WITH PASSWORD '$app_db_password';"
    PGPASSWORD=$pg_password psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE mccloud_backup TO mccloud_user;"
    
    # Update environment configuration
    echo "Updating environment configuration with database settings..."
    echo "DATABASE_URL=postgresql://mccloud_user:$app_db_password@localhost:5432/mccloud_backup" >> .env
fi

# Ask for OAuth credentials
echo "Do you want to set up OAuth integration for cloud storage providers? (y/n)"
read setup_oauth

if [ "$setup_oauth" = "y" ]; then
    echo "Setting up OAuth credentials..."
    
    echo "Enter Google Drive API Client ID (leave blank to skip):"
    read google_client_id
    echo "Enter Google Drive API Client Secret (leave blank to skip):"
    read -s google_client_secret
    
    echo "Enter Dropbox API Client ID (leave blank to skip):"
    read dropbox_client_id
    echo "Enter Dropbox API Client Secret (leave blank to skip):"
    read -s dropbox_client_secret
    
    echo "Enter OneDrive API Client ID (leave blank to skip):"
    read onedrive_client_id
    echo "Enter OneDrive API Client Secret (leave blank to skip):"
    read -s onedrive_client_secret
    
    # Update environment configuration with OAuth credentials
    if [ ! -z "$google_client_id" ]; then
        echo "GOOGLE_CLIENT_ID=$google_client_id" >> .env
        echo "GOOGLE_CLIENT_SECRET=$google_client_secret" >> .env
    fi
    
    if [ ! -z "$dropbox_client_id" ]; then
        echo "DROPBOX_CLIENT_ID=$dropbox_client_id" >> .env
        echo "DROPBOX_CLIENT_SECRET=$dropbox_client_secret" >> .env
    fi
    
    if [ ! -z "$onedrive_client_id" ]; then
        echo "ONEDRIVE_CLIENT_ID=$onedrive_client_id" >> .env
        echo "ONEDRIVE_CLIENT_SECRET=$onedrive_client_secret" >> .env
    fi
fi

# Start application with PM2
echo "Starting application with PM2..."
pm2 start npm --name "mccloud-backup" -- run start
pm2 save

# Setup PM2 to start on system boot
echo "Configuring PM2 to start on system boot..."
pm2 startup | tail -n 1 > setup_command.txt
echo "Run the following command to enable startup on boot:"
cat setup_command.txt
rm setup_command.txt

echo ""
echo "=== Deployment Complete ==="
echo "McCloud Backup is now running at http://localhost:5000"
echo "To view logs, run: pm2 logs mccloud-backup"
echo "To stop the application, run: pm2 stop mccloud-backup"
echo "To restart the application, run: pm2 restart mccloud-backup"
echo ""
echo "For additional configuration options, please refer to the documentation."
echo "Thank you for using McCloud Backup!"