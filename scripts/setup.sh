#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo "🔧 AutoQuotes Free for Linux - Setup"
echo "============================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is required but not installed."
  echo "   Install via: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
  echo "                sudo apt-get install -y nodejs"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
  echo "❌ Node.js 20+ required (found: $(node -v)); Node.js 22 is recommended."
  exit 1
fi

echo "✅ Node.js $(node -v)"
echo ""

# Install npm dependencies
echo "📦 Installing npm dependencies..."
npm ci
echo ""

# Install Playwright browsers
echo "🎭 Setting up Playwright (headless Chromium for scraping + PDF)..."
npx playwright install chromium
echo "If Chromium cannot start, install Linux dependencies with: npx playwright install-deps chromium"
echo ""

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data uploads exports
echo ""

# Initialize database
echo "🗄️  Initializing SQLite database..."
npx tsx src/config/database.ts --init
echo ""

# Build the frontend and server, including the templates and migrations.
echo "🏗️  Building application..."
npm run build
echo ""

echo "============================================"
echo "✅ Setup complete!"
echo ""
echo "🚀 Start the application:"
echo "   npm run dev          (development with hot-reload)"
echo "   npm run build && npm start  (production)"
echo ""
echo "📋 Then open in Chrome:"
echo "   google-chrome http://127.0.0.1:3000"
echo "============================================"
