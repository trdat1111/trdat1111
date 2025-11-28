# 🤖 GitHub Profile Automation System

This repository includes a comprehensive automation system to keep your GitHub profile fresh with trending tech articles.

## 🚀 Features

### 📊 **Dual Automation Methods**
- **GitHub Actions**: Primary automation with random scheduling (9am-6pm UTC)
- **Cronjob Backup**: Local machine backup when GitHub Actions fail

### 🧠 **Intelligent Article Selection**
- Multi-source fetching (Dev.to, Hacker News) with daily rotation
- Smart keyword filtering for tech relevance
- Duplicate detection with word overlap analysis  
- Quality scoring based on engagement metrics
- Fallback articles when APIs fail

### 📝 **Comprehensive Logging**
- Detailed execution logs with timestamps
- API call tracking and error reporting
- Daily execution reports with statistics
- Automatic log cleanup (keeps 7 days)

### ⚡ **Rate Limiting & Reliability**
- Smart rate limiting (4+ hour gaps between runs)
- Random execution delays to spread load
- Graceful fallback mechanisms
- Auto-retry with exponential backoff

## 🛠️ Setup

### GitHub Actions (Primary)
The GitHub Actions automation is already configured and runs automatically:
- **Schedule**: 6 random times daily between 9am-6pm UTC
- **Auto-merge**: Scheduled runs merge automatically
- **Manual trigger**: Available via workflow dispatch

### Cronjob Backup (Recommended)
Set up a local cronjob as backup:

```bash
# Run the setup script
./setup-cronjob.sh

# Or manually add to crontab
crontab -e

# Add one of these lines:
# Conservative (every 6 hours)
0 */6 * * * /path/to/repo/cronjob-automation.sh >/dev/null 2>&1

# Regular (3 times daily)  
0 9,15,21 * * * /path/to/repo/cronjob-automation.sh >/dev/null 2>&1

# Random (business hours)
$(( RANDOM % 60 )) $(( 9 + RANDOM % 9 )) * * * /path/to/repo/cronjob-automation.sh >/dev/null 2>&1
```

## 📊 Monitoring & Logs

### View Real-time Status
```bash
# Check recent execution status
node automation-logger.js status

# Generate detailed execution report  
node automation-logger.js report

# View live logs
tail -f logs/general-$(date +%Y-%m-%d).log
```

### Log Files Location
- `logs/general-YYYY-MM-DD.log` - General application logs
- `logs/execution-YYYY-MM-DD.log` - Execution tracking  
- `logs/articles-YYYY-MM-DD.log` - Article processing
- `logs/api-YYYY-MM-DD.log` - API call tracking
- `logs/debug-YYYY-MM-DD.log` - Debug information

### Cronjob Logs
```bash
# View cronjob execution logs
tail -f logs/cronjob.log

# Check crontab entries
crontab -l
```

## 🔧 Configuration

### Environment Variables
- `INPUT_DATA` - JSON array for manual article input (optional)
- `GITHUB_TOKEN` - GitHub personal access token (for cronjob)
- `GH_TOKEN` - GitHub Actions token (automatic)

### Script Configuration
Edit `add-research.js` to modify:
- `CONFIG.MAX_RESEARCH_ITEMS` - Number of articles to keep (default: 7)
- `CONFIG.TECH_KEYWORDS` - Keywords for article filtering
- `CONFIG.MIN_HN_SCORE` - Minimum Hacker News score threshold
- `CONFIG.MIN_DEVTO_REACTIONS` - Minimum Dev.to engagement threshold

## 🐛 Troubleshooting

### GitHub Actions Not Running
1. Check workflow runs: `gh run list --workflow=research-workflow.yml`
2. View recent logs: `gh run view [run-id] --log`
3. Verify rate limiting in logs
4. Use force run option: `gh workflow run research-workflow.yml -f force_run=true`

### Cronjob Not Working
1. Check crontab: `crontab -l`
2. View cronjob logs: `tail logs/cronjob.log`  
3. Test manually: `./cronjob-automation.sh`
4. Verify GitHub token: `cat ~/.github_token`

### API Failures
1. Check API status in logs: `grep "fetch failed" logs/general-*.log`
2. Review fallback activation: `grep "fallback" logs/general-*.log`
3. Verify network connectivity
4. Check rate limiting from API providers

### No Articles Found
1. Review keyword filtering in logs
2. Check API response content
3. Verify minimum score thresholds
4. Fallback system should activate automatically

## 📈 Performance Metrics

The system tracks:
- **Execution Success Rate**: Target >95%
- **Article Quality Score**: Engagement-based filtering
- **API Response Times**: Average <5 seconds  
- **Duplicate Prevention**: Word overlap analysis
- **Source Diversity**: Daily rotation ensures variety

## 🔄 Maintenance

### Automatic Maintenance
- Log cleanup (7-day retention)
- Duplicate article prevention
- Failed execution retry logic
- Rate limiting enforcement

### Manual Maintenance
```bash
# Clean old logs manually
node automation-logger.js cleanup

# Test automation manually  
node add-research.js

# Force GitHub Actions run
gh workflow run research-workflow.yml
```

## 📁 File Structure

```
├── add-research.js           # Main automation script
├── automation-logger.js     # Logging system
├── cronjob-automation.sh    # Cronjob backup script
├── setup-cronjob.sh         # Cronjob setup helper
├── test-fetch.js            # Testing utility
├── logs/                    # Log files directory
│   ├── general-YYYY-MM-DD.log
│   ├── execution-YYYY-MM-DD.log
│   └── cronjob.log
└── .github/workflows/
    └── research-workflow.yml # GitHub Actions workflow
```

---

*🤖 This automation system ensures your GitHub profile stays fresh with trending tech articles 24/7 with zero manual intervention.*