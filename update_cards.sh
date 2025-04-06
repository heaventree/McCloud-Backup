#!/bin/bash

# Backup the file
cp client/src/pages/settings.tsx client/src/pages/settings.tsx.bak

# Replace all remaining Card components with proper bg classes
sed -i 's/<Card>/<Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">/g' client/src/pages/settings.tsx

# Replace the span-3 Card components to keep their md:col-span-3 class
sed -i 's/<Card className="md:col-span-3">/<Card className="md:col-span-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700">/g' client/src/pages/settings.tsx

# Run the script
chmod +x update_cards.sh
./update_cards.sh
