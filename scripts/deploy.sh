#!/bin/bash
# MANA88 CMS Deploy Script
# Deploys to AWS Lightsail at cms.manaakumal.com

set -e

# Configuration
SERVER_IP="44.241.184.228"
SSH_KEY="$HOME/Downloads/LightsailDefaultKey-us-west-2 (1).pem"
DEPLOY_PATH="/opt/bitnami/apache/htdocs/cms"
SERVER_USER="bitnami"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 MANA88 CMS Deployment${NC}"
echo "================================"

# Check if SSH key exists
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}❌ SSH key not found at: $SSH_KEY${NC}"
    exit 1
fi

# Build the project
echo -e "${YELLOW}📦 Building project...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Build failed - dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build complete${NC}"

# Create deployment directory on server
echo -e "${YELLOW}📁 Creating deployment directory...${NC}"
ssh -i "$SSH_KEY" $SERVER_USER@$SERVER_IP "sudo mkdir -p $DEPLOY_PATH && sudo chown -R bitnami:daemon $DEPLOY_PATH"

# Deploy files
echo -e "${YELLOW}📤 Uploading files...${NC}"
scp -i "$SSH_KEY" -r dist/* $SERVER_USER@$SERVER_IP:$DEPLOY_PATH/

# Create .htaccess for React Router
echo -e "${YELLOW}⚙️  Configuring Apache...${NC}"
ssh -i "$SSH_KEY" $SERVER_USER@$SERVER_IP "cat > $DEPLOY_PATH/.htaccess << 'EOF'
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>

# Cache static assets
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/css "access plus 1 year"
    ExpiresByType application/javascript "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/svg+xml "access plus 1 year"
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-XSS-Protection "1; mode=block"
</IfModule>
EOF"

# Set permissions
echo -e "${YELLOW}🔒 Setting permissions...${NC}"
ssh -i "$SSH_KEY" $SERVER_USER@$SERVER_IP "sudo chown -R bitnami:daemon $DEPLOY_PATH && sudo chmod -R 755 $DEPLOY_PATH"

# Restart Apache
echo -e "${YELLOW}🔄 Restarting Apache...${NC}"
ssh -i "$SSH_KEY" $SERVER_USER@$SERVER_IP "sudo /opt/bitnami/ctlscript.sh restart apache"

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "🌐 Site available at: https://cms.manaakumal.com"
echo ""
