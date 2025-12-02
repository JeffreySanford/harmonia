#!/bin/bash
# Setup MongoDB automated backup with WSL/Linux cron
# Run this script in WSL/Git Bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-mongo.sh"
CRON_TIME="0 2 * * *"  # 2:00 AM daily

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔧 Setting up automated MongoDB backups with cron...${NC}"
echo -e "${GRAY}   Repository: $REPO_ROOT${NC}"
echo -e "${GRAY}   Backup script: $BACKUP_SCRIPT${NC}"
echo -e "${GRAY}   Schedule: Daily at 2:00 AM${NC}"
echo ""

# Check if backup script exists
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo -e "${RED}❌ Backup script not found: $BACKUP_SCRIPT${NC}"
    exit 1
fi

# Make backup script executable
chmod +x "$BACKUP_SCRIPT"

# Create cron job entry
CRON_JOB="$CRON_TIME cd $REPO_ROOT && $BACKUP_SCRIPT >> $REPO_ROOT/backups/mongo/backup.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "backup-mongo.sh"; then
    echo -e "${YELLOW}⚠️  Existing backup cron job found${NC}"
    echo -e "${GRAY}   Removing old entry...${NC}"
    crontab -l 2>/dev/null | grep -v "backup-mongo.sh" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo ""
echo -e "${GREEN}✅ Automated backup configured successfully!${NC}"
echo ""
echo -e "${CYAN}📋 Cron Job Details:${NC}"
echo -e "${GRAY}   Schedule: Daily at 2:00 AM${NC}"
echo -e "${GRAY}   Retention: Last 7 days${NC}"
echo -e "${GRAY}   Location: backups/mongo/${NC}"
echo -e "${GRAY}   Log: backups/mongo/backup.log${NC}"
echo ""
echo -e "${CYAN}🔍 To verify:${NC}"
echo -e "${GRAY}   crontab -l | grep backup-mongo${NC}"
echo ""
echo -e "${CYAN}🧪 To test manually:${NC}"
echo -e "${GRAY}   bash $BACKUP_SCRIPT${NC}"
echo ""
echo -e "${CYAN}🗑️  To remove:${NC}"
echo -e "${GRAY}   crontab -l | grep -v backup-mongo.sh | crontab -${NC}"
echo ""

# Check Docker status
if docker ps --filter "name=harmonia-mongo-i9" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
    echo -e "${GREEN}✅ MongoDB container is running${NC}"
else
    echo -e "${YELLOW}⚠️  MongoDB container is not running${NC}"
    echo -e "${GRAY}   Start it with: docker compose -f docker-compose.mongo.yml up -d${NC}"
fi

echo ""
echo -e "${CYAN}📝 Next steps:${NC}"
echo -e "   ${NC}1. Ensure MongoDB container is running before backup time${NC}"
echo -e "   ${NC}2. Verify .env file contains MONGO_ROOT_PASSWORD${NC}"
echo -e "   ${NC}3. Test backup manually with: bash scripts/backup-mongo.sh${NC}"
echo -e "   ${NC}4. Monitor logs at: backups/mongo/backup.log${NC}"
echo ""
echo -e "${GRAY}Note: For WSL, ensure cron service is running:${NC}"
echo -e "${GRAY}      sudo service cron start${NC}"
echo ""
