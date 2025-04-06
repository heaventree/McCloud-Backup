#!/bin/bash

# McCloud WordPress Backup - Installation Script
echo "==============================================="
echo "  McCloud WordPress Backup Installation Script "
echo "==============================================="
echo ""

# Check for Node.js installation
echo "Checking for Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Please install Node.js version 16 or higher."
    echo "Visit https://nodejs.org/ for installation instructions."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "Node.js version is $NODE_VERSION. Please upgrade to version 16 or higher."
    echo "Visit https://nodejs.org/ for upgrade instructions."
    exit 1
fi
echo "Node.js version $(node -v) found. Proceeding..."

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Create .env file with default values if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env file with default values..."
    cat > .env << EOL
PORT=5000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=securepassword
# Uncomment and update these lines when configuring OAuth providers
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=
# DROPBOX_APP_KEY=
# DROPBOX_APP_SECRET=
# ONEDRIVE_CLIENT_ID=
# ONEDRIVE_CLIENT_SECRET=
EOL
    echo ".env file created with default values."
    echo "Please update it with your own configuration."
fi

# Build the application
echo ""
echo "Building the application..."
npm run build

echo ""
echo "Installation complete!"
echo ""
echo "To start the application, run:"
echo "  npm run dev   # for development"
echo "  npm start     # for production"
echo ""
echo "The application will be available at http://localhost:5000"
echo ""
echo "Default admin credentials:"
echo "  Username: admin"
echo "  Password: securepassword"
echo ""
echo "Please change these default credentials after first login."
echo "==============================================="