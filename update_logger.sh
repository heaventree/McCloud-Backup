#!/bin/bash

# Update all logger imports in the server directory
echo "Updating logger imports..."

# Update createLogger import patterns
find server -type f -name "*.ts" | xargs sed -i 's/import { createLogger } from/import logger from/g'

# Update createLogger usages
find server -type f -name "*.ts" | xargs sed -i 's/const logger = createLogger([^;]*);/\/\/ Use the default logger instance/g'

echo "Logger imports updated."
