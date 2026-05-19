#!/bin/bash
# FutureMail Install Script
# Usage: chmod +x install.sh && ./install.sh

set -e  # Exit immediately if any command fails

echo ""
echo "╔══════════════════════════════════════╗"
echo "║        FutureMail Installer          ║"
echo "╚══════════════════════════════════════╝"
echo ""

rm -rf ~/future-mail
mkdir ~/future-mail && cd ~/future-mail
unzip ~/Downloads/future-mail-v4.7.zip
mv future-mail/* . && mv future-mail/.* . 2>/dev/null
rm -rf future-mail

echo ""
echo "Installing server dependencies..."
npm install

echo ""
echo "Installing client dependencies..."
cd client && npm install && cd ..

echo ""
echo "╔══════════════════════════════════════╗"
echo "║      Installation Complete!          ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "  To start FutureMail:"
echo ""
echo "    cd ~/future-mail"
echo "    npm run dev"
echo ""
echo "  Then open http://localhost:5173 in your browser."
echo ""
echo "  First time? You will be guided to:"
echo "    1. Create your admin account"
echo "    2. Save your backup encryption key"
echo "    3. Configure email settings in the admin console"
echo ""
