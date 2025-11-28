#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Comprehensive logging system for automation
 */
class AutomationLogger {
    constructor(logDir = './logs') {
        this.logDir = logDir;
        this.ensureLogDirectory();
    }
    
    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
    
    getLogFilePath(type = 'general') {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.logDir, `${type}-${date}.log`);
    }
    
    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            data: data || undefined
        };
        return JSON.stringify(logEntry) + '\n';
    }
    
    writeLog(type, level, message, data = null) {
        const logFile = this.getLogFilePath(type);
        const formattedMessage = this.formatMessage(level, message, data);
        
        try {
            fs.appendFileSync(logFile, formattedMessage);
            console.log(`[${level.toUpperCase()}] ${message}`);
        } catch (error) {
            console.error(`Failed to write to log file: ${error.message}`);
        }
    }
    
    // Main logging methods
    info(message, data = null) {
        this.writeLog('general', 'info', message, data);
    }
    
    success(message, data = null) {
        this.writeLog('general', 'success', message, data);
    }
    
    warn(message, data = null) {
        this.writeLog('general', 'warn', message, data);
    }
    
    error(message, data = null) {
        this.writeLog('general', 'error', message, data);
    }
    
    debug(message, data = null) {
        this.writeLog('debug', 'debug', message, data);
    }
    
    // Specialized logging methods
    execution(status, trigger, details = {}) {
        this.writeLog('execution', status, `Automation ${status}`, {
            trigger,
            ...details
        });
    }
    
    api(method, url, status, duration, error = null) {
        this.writeLog('api', status === 'success' ? 'info' : 'error', 
            `${method} ${url}`, {
                status,
                duration,
                error: error?.message
            });
    }
    
    article(action, articles) {
        this.writeLog('articles', 'info', `Articles ${action}`, {
            count: Array.isArray(articles) ? articles.length : 1,
            articles: Array.isArray(articles) ? 
                articles.map(a => ({ title: a.title, source: a.source, score: a.score })) : 
                [articles]
        });
    }
    
    // Get recent logs
    getRecentLogs(type = 'general', hours = 24) {
        const logFile = this.getLogFilePath(type);
        
        if (!fs.existsSync(logFile)) {
            return [];
        }
        
        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
        const logContent = fs.readFileSync(logFile, 'utf8');
        
        return logContent
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(entry => entry && new Date(entry.timestamp) > cutoffTime)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    
    // Generate execution report
    generateExecutionReport() {
        const today = new Date().toISOString().split('T')[0];
        const executions = this.getRecentLogs('execution', 24);
        const apiCalls = this.getRecentLogs('api', 24);
        const articles = this.getRecentLogs('articles', 24);
        
        const report = {
            date: today,
            summary: {
                total_executions: executions.length,
                successful_executions: executions.filter(e => e.level === 'SUCCESS').length,
                failed_executions: executions.filter(e => e.level === 'ERROR').length,
                api_calls: apiCalls.length,
                articles_processed: articles.reduce((sum, a) => sum + (a.data?.count || 0), 0)
            },
            executions: executions.slice(0, 10), // Last 10 executions
            recent_errors: [...executions, ...apiCalls]
                .filter(e => e.level === 'ERROR')
                .slice(0, 5)
        };
        
        // Save report
        const reportFile = path.join(this.logDir, `execution-report-${today}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
        
        return report;
    }
    
    // Clean old logs (keep last 7 days)
    cleanup() {
        const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const cutoffString = cutoffDate.toISOString().split('T')[0];
        
        if (!fs.existsSync(this.logDir)) return;
        
        const files = fs.readdirSync(this.logDir);
        let cleanedCount = 0;
        
        files.forEach(file => {
            const match = file.match(/(\\w+)-(\\d{4}-\\d{2}-\\d{2})\\.(log|json)$/);
            if (match && match[2] < cutoffString) {
                fs.unlinkSync(path.join(this.logDir, file));
                cleanedCount++;
            }
        });
        
        if (cleanedCount > 0) {
            this.info(`Cleaned up ${cleanedCount} old log files`);
        }
    }
}

module.exports = AutomationLogger;

// CLI interface
if (require.main === module) {
    const logger = new AutomationLogger();
    const command = process.argv[2];
    
    switch (command) {
        case 'report':
            const report = logger.generateExecutionReport();
            console.log('\\n📊 Execution Report:');
            console.log(`Date: ${report.date}`);
            console.log(`Total Executions: ${report.summary.total_executions}`);
            console.log(`Successful: ${report.summary.successful_executions}`);
            console.log(`Failed: ${report.summary.failed_executions}`);
            console.log(`API Calls: ${report.summary.api_calls}`);
            console.log(`Articles Processed: ${report.summary.articles_processed}`);
            
            if (report.recent_errors.length > 0) {
                console.log('\\n❌ Recent Errors:');
                report.recent_errors.forEach(error => {
                    console.log(`  • ${error.message} (${error.timestamp})`);
                });
            }
            break;
            
        case 'cleanup':
            logger.cleanup();
            console.log('✅ Log cleanup completed');
            break;
            
        case 'status':
            const recent = logger.getRecentLogs('execution', 24);
            console.log(`\\n📋 Last 24 Hours Status:`);
            console.log(`Executions: ${recent.length}`);
            if (recent.length > 0) {
                const latest = recent[0];
                console.log(`Latest: ${latest.message} at ${latest.timestamp}`);
                console.log(`Trigger: ${latest.data?.trigger || 'unknown'}`);
            }
            break;
            
        default:
            console.log('Usage:');
            console.log('  node automation-logger.js report   - Generate execution report');
            console.log('  node automation-logger.js cleanup  - Clean old logs');
            console.log('  node automation-logger.js status   - Show recent status');
    }
}