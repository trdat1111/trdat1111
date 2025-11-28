#!/bin/bash

# Setup script for GitHub Profile Auto-Update Cronjob

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 GitHub Profile Auto-Update Cronjob Setup${NC}"
echo -e "${BLUE}============================================${NC}"

# Get current directory
CURRENT_DIR=$(pwd)
echo -e "${YELLOW}📍 Current directory: ${CURRENT_DIR}${NC}"

# Check if we're in the right directory
if [ ! -f "add-research.js" ] || [ ! -f "cronjob-automation.sh" ]; then
    echo -e "${RED}❌ Error: This doesn't look like the correct repository directory.${NC}"
    echo -e "${RED}   Make sure you're in the trdat1111 directory with add-research.js${NC}"
    exit 1
fi

# Update cronjob script with correct path
echo -e "${YELLOW}📝 Updating cronjob script with current directory...${NC}"
sed -i.bak "s|REPO_DIR=\".*\"|REPO_DIR=\"${CURRENT_DIR}\"|g" cronjob-automation.sh

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Updated cronjob script path${NC}"
    rm cronjob-automation.sh.bak 2>/dev/null
else
    echo -e "${RED}❌ Failed to update cronjob script${NC}"
    exit 1
fi

# Check GitHub token
TOKEN_FILE="$HOME/.github_token"
if [ ! -f "$TOKEN_FILE" ]; then
    echo -e "${YELLOW}🔑 GitHub token not found. Creating token file...${NC}"
    echo -e "${BLUE}Please enter your GitHub personal access token:${NC}"
    echo -e "${BLUE}(You can create one at: https://github.com/settings/tokens)${NC}"
    echo -e "${BLUE}Required scopes: repo, workflow${NC}"
    read -s GITHUB_TOKEN
    
    if [ -z "$GITHUB_TOKEN" ]; then
        echo -e "${RED}❌ No token provided. Exiting.${NC}"
        exit 1
    fi
    
    echo "$GITHUB_TOKEN" > "$TOKEN_FILE"
    chmod 600 "$TOKEN_FILE"
    echo -e "${GREEN}✅ GitHub token saved to ${TOKEN_FILE}${NC}"
else
    echo -e "${GREEN}✅ GitHub token already exists at ${TOKEN_FILE}${NC}"
fi

# Test the script
echo -e "${YELLOW}🧪 Testing cronjob script...${NC}"
if ./cronjob-automation.sh --dry-run 2>/dev/null; then
    echo -e "${GREEN}✅ Cronjob script test passed${NC}"
else
    echo -e "${YELLOW}⚠️ Script test had issues, but continuing setup...${NC}"
fi

# Propose crontab entries
echo -e "${BLUE}⏰ Recommended crontab entries:${NC}"
echo -e "${BLUE}================================${NC}"
echo
echo -e "${GREEN}# Option 1: Run every 6 hours (conservative)${NC}"
echo "0 */6 * * * ${CURRENT_DIR}/cronjob-automation.sh >/dev/null 2>&1"
echo
echo -e "${GREEN}# Option 2: Run 3 times daily at random hours${NC}"
echo "0 9 * * * ${CURRENT_DIR}/cronjob-automation.sh >/dev/null 2>&1"
echo "0 15 * * * ${CURRENT_DIR}/cronjob-automation.sh >/dev/null 2>&1"  
echo "0 21 * * * ${CURRENT_DIR}/cronjob-automation.sh >/dev/null 2>&1"
echo
echo -e "${GREEN}# Option 3: Random execution during business hours (advanced)${NC}"
echo "$(( RANDOM % 60 )) $(( 9 + RANDOM % 9 )) * * * ${CURRENT_DIR}/cronjob-automation.sh >/dev/null 2>&1"
echo

# Ask user if they want to add crontab entry
echo -e "${BLUE}Would you like to add a crontab entry automatically? (y/n)${NC}"
read -r ADD_CRON

if [ "$ADD_CRON" = "y" ] || [ "$ADD_CRON" = "Y" ]; then
    echo -e "${BLUE}Choose an option:${NC}"
    echo "1) Conservative (every 6 hours)"
    echo "2) Regular (3 times daily)" 
    echo "3) Random (business hours)"
    echo "4) Custom"
    read -r CRON_OPTION
    
    case $CRON_OPTION in
        1)
            CRON_ENTRY="0 */6 * * * ${CURRENT_DIR}/cronjob-automation.sh >/dev/null 2>&1"
            ;;
        2)
            CRON_ENTRY="0 15 * * * ${CURRENT_DIR}/cronjob-automation.sh >/dev/null 2>&1"
            ;;
        3)
            RANDOM_HOUR=$(( 9 + RANDOM % 9 ))
            RANDOM_MIN=$(( RANDOM % 60 ))
            CRON_ENTRY="${RANDOM_MIN} ${RANDOM_HOUR} * * * ${CURRENT_DIR}/cronjob-automation.sh >/dev/null 2>&1"
            ;;
        4)
            echo -e "${BLUE}Enter your custom cron schedule (e.g., '0 12 * * *'):${NC}"
            read -r CUSTOM_SCHEDULE
            CRON_ENTRY="${CUSTOM_SCHEDULE} ${CURRENT_DIR}/cronjob-automation.sh >/dev/null 2>&1"
            ;;
        *)
            echo -e "${YELLOW}Invalid option. Skipping crontab setup.${NC}"
            CRON_ENTRY=""
            ;;
    esac
    
    if [ -n "$CRON_ENTRY" ]; then
        # Add to crontab
        (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Added crontab entry: ${CRON_ENTRY}${NC}"
        else
            echo -e "${RED}❌ Failed to add crontab entry${NC}"
            echo -e "${YELLOW}Please add manually: ${CRON_ENTRY}${NC}"
        fi
    fi
else
    echo -e "${YELLOW}💡 To add manually later, run: crontab -e${NC}"
    echo -e "${YELLOW}   Then add one of the entries shown above${NC}"
fi

# Create logs directory
mkdir -p logs
echo -e "${GREEN}✅ Created logs directory${NC}"

# Final instructions
echo
echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo -e "${GREEN}=================${NC}"
echo
echo -e "${BLUE}📋 What was set up:${NC}"
echo -e "  ✅ Updated cronjob script with correct paths"
echo -e "  ✅ GitHub token configured"
echo -e "  ✅ Logs directory created"
echo -e "  ✅ Script permissions set"

if [ -n "$CRON_ENTRY" ]; then
    echo -e "  ✅ Crontab entry added"
fi

echo
echo -e "${BLUE}📖 Usage:${NC}"
echo -e "  • View logs: ${YELLOW}tail -f logs/cronjob.log${NC}"
echo -e "  • Check status: ${YELLOW}./automation-logger.js status${NC}" 
echo -e "  • Generate report: ${YELLOW}./automation-logger.js report${NC}"
echo -e "  • Manual run: ${YELLOW}./cronjob-automation.sh${NC}"
echo -e "  • View crontab: ${YELLOW}crontab -l${NC}"
echo
echo -e "${BLUE}🚀 Your GitHub profile will now auto-update with fresh tech articles!${NC}"