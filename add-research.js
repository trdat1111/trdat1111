#!/usr/bin/env node
const fs = require("fs");
const https = require("https");

/**
 * Configuration constants
 */
const CONFIG = {
    MAX_RETRIES: 3,
    TIMEOUT: 10000,
    MIN_HN_SCORE: 10,
    MIN_DEVTO_REACTIONS: 5,
    MAX_ARTICLES_PER_SOURCE: 5,
    MAX_RESEARCH_ITEMS: 7,
    FETCH_BATCH_SIZE: 20,
    TECH_KEYWORDS: [
        'javascript', 'typescript', 'react', 'vue', 'angular', 'node', 'nodejs',
        'golang', 'python', 'rust', 'java', 'kotlin', 'swift',
        'database', 'postgresql', 'mongodb', 'redis', 'sql',
        'api', 'rest', 'graphql', 'grpc',
        'system', 'architecture', 'microservices', 'distributed',
        'devops', 'docker', 'kubernetes', 'aws', 'cloud', 'serverless',
        'ai', 'machine learning', 'ml', 'neural', 'algorithm',
        'security', 'encryption', 'auth', 'blockchain'
    ]
};

/**
 * Logger utility
 */
const Logger = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warn: (msg) => console.warn(`⚠️  ${msg}`),
    error: (msg) => console.error(`❌ ${msg}`),
    debug: (msg) => console.log(`🔍 ${msg}`)
};

/**
 * HTTP client with retry logic
 */
class HttpClient {
    static async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const request = https.get(url, { timeout: options.timeout || CONFIG.TIMEOUT }, (response) => {
                // Handle redirects
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    return HttpClient.makeRequest(response.headers.location, options)
                        .then(resolve)
                        .catch(reject);
                }
                
                if (response.statusCode !== 200) {
                    return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                }
                
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (error) {
                        reject(new Error(`Invalid JSON response: ${error.message}`));
                    }
                });
            });
            
            request.on('error', reject);
            request.on('timeout', () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });
    }
    
    static async makeRequestWithRetry(url, options = {}, retries = 0) {
        try {
            return await HttpClient.makeRequest(url, options);
        } catch (error) {
            if (retries < CONFIG.MAX_RETRIES) {
                const delay = Math.pow(2, retries) * 1000; // Exponential backoff
                Logger.warn(`Request failed for ${url}, retrying in ${delay}ms... (${retries + 1}/${CONFIG.MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return HttpClient.makeRequestWithRetry(url, options, retries + 1);
            }
            throw error;
        }
    }
}

/**
 * Utility functions
 */
class Utils {
    static getDayOfYear() {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        return Math.floor((now - start) / 86400000);
    }
    
    static hasRelevantKeywords(text) {
        const lowerText = text.toLowerCase();
        return CONFIG.TECH_KEYWORDS.some(keyword => lowerText.includes(keyword));
    }
    
    static shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    static getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
}

/**
 * Article sources
 */
class ArticleSources {
    static async fetchDevToArticles() {
        try {
            Logger.debug("Fetching from Dev.to API...");
            const articles = await HttpClient.makeRequestWithRetry(
                'https://dev.to/api/articles?per_page=20&state=fresh&top=7'
            );
            
            const filtered = articles
                .filter(article => {
                    const content = `${article.title} ${(article.tag_list || []).join(' ')} ${article.description || ''}`;
                    return Utils.hasRelevantKeywords(content) && 
                           article.positive_reactions_count >= CONFIG.MIN_DEVTO_REACTIONS;
                })
                .slice(0, CONFIG.MAX_ARTICLES_PER_SOURCE)
                .map(article => ({
                    title: article.title,
                    url: article.url,
                    source: 'Dev.to',
                    score: article.positive_reactions_count,
                    tags: article.tag_list
                }));
            
            Logger.success(`Found ${filtered.length} relevant Dev.to articles`);
            return filtered;
        } catch (error) {
            Logger.error(`Dev.to fetch failed: ${error.message}`);
            return [];
        }
    }
    
    static async fetchHackerNewsArticles() {
        try {
            Logger.debug("Fetching from Hacker News API...");
            
            // Rotate endpoints daily for variety
            const endpoints = [
                'https://hacker-news.firebaseio.com/v0/topstories.json',
                'https://hacker-news.firebaseio.com/v0/newstories.json',
                'https://hacker-news.firebaseio.com/v0/beststories.json'
            ];
            
            const dayOfYear = Utils.getDayOfYear();
            const selectedEndpoint = endpoints[dayOfYear % endpoints.length];
            const endpointName = selectedEndpoint.split('/').pop().replace('.json', '');
            
            Logger.debug(`Using ${endpointName} endpoint (rotates daily)`);
            
            const allStoryIds = await HttpClient.makeRequestWithRetry(selectedEndpoint);
            
            // Add daily offset for variety
            const offset = (dayOfYear * 7) % 50;
            const storyIds = allStoryIds.slice(offset, offset + CONFIG.FETCH_BATCH_SIZE);
            
            const articles = [];
            const concurrency = 3; // Limit concurrent requests
            
            for (let i = 0; i < storyIds.length && articles.length < CONFIG.MAX_ARTICLES_PER_SOURCE; i += concurrency) {
                const batch = storyIds.slice(i, i + concurrency);
                const promises = batch.map(async (storyId) => {
                    try {
                        return await HttpClient.makeRequestWithRetry(
                            `https://hacker-news.firebaseio.com/v0/item/${storyId}.json`
                        );
                    } catch (error) {
                        Logger.warn(`Skipping HN story ${storyId}: ${error.message}`);
                        return null;
                    }
                });
                
                const stories = await Promise.all(promises);
                
                for (const story of stories) {
                    if (!story || !story.url || !story.title || articles.length >= CONFIG.MAX_ARTICLES_PER_SOURCE) {
                        continue;
                    }
                    
                    if (story.score >= CONFIG.MIN_HN_SCORE && 
                        Utils.hasRelevantKeywords(`${story.title} ${story.url}`)) {
                        articles.push({
                            title: story.title,
                            url: story.url,
                            source: 'Hacker News',
                            score: story.score
                        });
                    }
                }
            }
            
            Logger.success(`Found ${articles.length} relevant Hacker News articles`);
            return articles;
        } catch (error) {
            Logger.error(`Hacker News fetch failed: ${error.message}`);
            return [];
        }
    }
}

/**
 * README manager
 */
class ReadmeManager {
    static getExistingTitles(content) {
        const sectionRegex = /## Recent Researches\n([\s\S]*?)(?=\n## |\n$)/;
        const match = content.match(sectionRegex);
        
        if (!match) return [];
        
        const titleMatches = match[1].matchAll(/\[([^\]]+)\]/g);
        return Array.from(titleMatches, m => m[1].toLowerCase());
    }
    
    static isDuplicate(newTitle, existingTitles) {
        const newLower = newTitle.toLowerCase();
        return existingTitles.some(existing => {
            // Check for substantial overlap (more than 50% of words)
            const newWords = newLower.split(/\s+/).filter(w => w.length > 2);
            const existingWords = existing.split(/\s+/).filter(w => w.length > 2);
            
            if (newWords.length === 0 || existingWords.length === 0) return false;
            
            const commonWords = newWords.filter(word => existingWords.includes(word));
            return commonWords.length / Math.max(newWords.length, existingWords.length) > 0.5;
        });
    }
    
    static updateContent(articles) {
        try {
            const content = fs.readFileSync("README.md", "utf8");
            const sectionRegex = /## Recent Researches\n([\s\S]*?)(?=\n## |\n$)/;
            const match = content.match(sectionRegex);
            
            if (!match) {
                throw new Error("No '## Recent Researches' section found in README.md");
            }
            
            // Build new entries
            const newEntries = articles.map(article => 
                `- [${article.title}](${article.url})`
            ).join('\n') + '\n';
            
            // Get existing content and combine
            const existingContent = match[1];
            const combined = newEntries + existingContent;
            
            // Keep only the most recent items
            const lines = combined.split('\n').filter(line => line.trim().length > 0);
            const limitedContent = lines.slice(0, CONFIG.MAX_RESEARCH_ITEMS).join('\n') + '\n';
            
            // Replace the section
            const updatedContent = content.replace(
                sectionRegex,
                `## Recent Researches\n${limitedContent}`
            );
            
            fs.writeFileSync("README.md", updatedContent, "utf8");
            Logger.success("README.md updated successfully");
        } catch (error) {
            throw new Error(`Failed to update README: ${error.message}`);
        }
    }
}

/**
 * Main article fetcher and processor
 */
class ArticleFetcher {
    static async fetchAndSelectArticles() {
        Logger.info("Fetching articles from all sources...");
        
        // Fetch from all sources concurrently
        const [devToArticles, hnArticles] = await Promise.all([
            ArticleSources.fetchDevToArticles(),
            ArticleSources.fetchHackerNewsArticles()
        ]);
        
        const allArticles = [...devToArticles, ...hnArticles];
        
        if (allArticles.length === 0) {
            Logger.warn('No articles fetched from any source, trying fallback...');
            // Fallback to a curated list when APIs fail
            const fallbackArticles = [
                {
                    title: "The State of Developer Ecosystem 2024",
                    url: "https://www.jetbrains.com/lp/devecosystem-2024/",
                    source: "JetBrains",
                    score: 100
                },
                {
                    title: "React 19 Beta Release Notes",
                    url: "https://react.dev/blog/2024/12/05/react-19",
                    source: "React Team",
                    score: 95
                }
            ];
            
            Logger.info('Using fallback articles to ensure content freshness');
            return [fallbackArticles[Math.floor(Math.random() * fallbackArticles.length)]];
        }
        
        // Check for duplicates against existing content
        const readmeContent = fs.readFileSync("README.md", "utf8");
        const existingTitles = ReadmeManager.getExistingTitles(readmeContent);
        
        const uniqueArticles = allArticles.filter(article => 
            !ReadmeManager.isDuplicate(article.title, existingTitles)
        );
        
        if (uniqueArticles.length === 0) {
            Logger.warn('No unique articles found, selecting from all articles');
            const shuffled = Utils.shuffleArray(allArticles);
            return shuffled.slice(0, 1);
        }
        
        // Sort by score and select best ones
        uniqueArticles.sort((a, b) => b.score - a.score);
        
        // Select 1-2 articles randomly from top performers
        const topArticles = uniqueArticles.slice(0, Math.min(8, uniqueArticles.length));
        const selectedCount = Utils.getRandomInt(1, Math.min(2, topArticles.length));
        
        const selected = Utils.shuffleArray(topArticles).slice(0, selectedCount);
        
        Logger.success(`Selected ${selected.length} articles:`);
        selected.forEach(article => {
            Logger.info(`  • ${article.title} (${article.source}, score: ${article.score})`);
        });
        
        return selected;
    }
}

/**
 * Main application
 */
class App {
    static async run() {
        try {
            const dataInput = process.env.INPUT_DATA;
            
            if (dataInput) {
                // Manual mode
                Logger.info("Running in manual mode with provided data");
                const data = JSON.parse(dataInput);
                
                if (!Array.isArray(data)) {
                    throw new Error("Input data must be an array of articles");
                }
                
                ReadmeManager.updateContent(data);
                Logger.success('README updated with manual data');
            } else {
                // Automatic mode
                Logger.info("Running in automatic mode - fetching fresh articles");
                const articles = await ArticleFetcher.fetchAndSelectArticles();
                ReadmeManager.updateContent(articles);
                Logger.success('README updated with auto-fetched articles');
            }
        } catch (error) {
            Logger.error(`Application failed: ${error.message}`);
            process.exit(1);
        }
    }
}

// Run the application
if (require.main === module) {
    App.run();
}

module.exports = { App, CONFIG, ArticleSources, ReadmeManager };