#!/bin/bash
set -e

echo "🚀 Initializing Spoolman development environment..."

# Install Python dependencies using PDM
echo "📦 Installing Python dependencies with PDM..."
pdm install --dev

# Install frontend dependencies
echo "📦 Installing Node.js dependencies..."
cd client
npm install
cd ..

# Install pre-commit hooks
echo "🔧 Setting up pre-commit hooks..."
if [ -f ".pre-commit-config.yaml" ]; then
    pdm run pre-commit install || echo "⚠️  Pre-commit setup skipped (optional)"
fi

echo "✅ Development environment initialized!"
echo ""
echo "Available commands:"
echo "  Backend development:"
echo "    pdm run uvicorn spoolman.main:app --reload"
echo ""
echo "  Frontend development:"
echo "    cd client && npm run dev"
echo ""
echo "  Run tests:"
echo "    pdm run pytest"
echo ""
echo "  Run type checks:"
echo "    pdm run ruff check ."
echo "    cd client && npm run lint"
echo ""
