#!/bin/bash
# WalletConnect Project ID Setup Script
# This script helps you add your WalletConnect Project ID to .env.local

set -e

echo "🔐 WalletConnect Project ID Setup"
echo "===================================="
echo ""

# Check if .env.local exists
ENV_FILE="apps/web-dapp/.env.local"

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: $ENV_FILE not found"
    echo "Run this script from the repository root directory"
    exit 1
fi

echo "📝 Current .env.local location: $ENV_FILE"
echo ""

# Prompt for Project ID
echo "Please enter your WalletConnect Project ID:"
echo "(You can get this from https://cloud.walletconnect.com/)"
echo ""
read -p "Project ID: " PROJECT_ID

# Validate input
if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: Project ID cannot be empty"
    exit 1
fi

# Check if already exists
if grep -q "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=" "$ENV_FILE"; then
    echo ""
    echo "⚠️  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID already exists in $ENV_FILE"
    read -p "Do you want to replace it? (y/n): " REPLACE
    
    if [ "$REPLACE" = "y" ] || [ "$REPLACE" = "Y" ]; then
        # Replace existing value
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=.*|NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$PROJECT_ID|" "$ENV_FILE"
        else
            # Linux
            sed -i "s|NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=.*|NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$PROJECT_ID|" "$ENV_FILE"
        fi
        echo "✅ Updated NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in $ENV_FILE"
    else
        echo "ℹ️  Skipped updating. Your .env.local file was not changed."
        exit 0
    fi
else
    # Add new value
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=|NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$PROJECT_ID|" "$ENV_FILE"
    else
        # Linux
        sed -i "s|NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=|NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$PROJECT_ID|" "$ENV_FILE"
    fi
    echo "✅ Added NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to $ENV_FILE"
fi

echo ""
echo "🎉 Success! Your WalletConnect Project ID has been configured."
echo ""
echo "Next steps:"
echo "1. Restart your dev server: pnpm dev"
echo "2. Test wallet connection at http://localhost:3000/studio"
echo "3. Deploy to Vercel with the same Project ID"
echo ""
