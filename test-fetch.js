const https = require("https");
const http = require("http");

// Configuration
const CONFIG = {
    MAX_RETRIES: 3,
    TIMEOUT: 10000,
    MIN_ARTICLE_SCORE: 10, // For HN articles
    MAX_ARTICLES_TO_FETCH: 10,
    TECH_KEYWORDS: ['javascript', 'typescript', 'react', 'node', 'golang', 'python', 'database', 'api', 'system', 'architecture', 'microservices', 'devops', 'aws', 'docker']
};

// Utility functions for HTTP requests with retry logic
async function makeRequestWithRetry(url, options = {}, retries = 0) {
    try {
        return await makeRequest(url, options);
    } catch (error) {
        if (retries < CONFIG.MAX_RETRIES) {
            console.log(`Request failed for ${url}, retrying... (${retries + 1}/${CONFIG.MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1))); // Exponential backoff
            return makeRequestWithRetry(url, options, retries + 1);
        }
        throw error;
    }
}

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https:') ? https : http;
        const timeout = options.timeout || CONFIG.TIMEOUT;
        
        const req = lib.get(url, { timeout }, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return makeRequest(res.headers.location, options).then(resolve).catch(reject);
            }
            
            if (res.statusCode !== 200) {
                return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
            
            let data = '';
            
            res.on('data', chunk => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error(`Failed to parse JSON: ${error.message}`));
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// Alternative tech sources when Dev.to blocks us
async function fetchAlternativeTechArticles() {
    try {
        console.log("🔍 Fetching from alternative tech sources...");
        
        // Different tech sources for variety (we'll implement these as fallbacks)
        const sources = [
            { name: 'GitHub Trending', url: 'https://api.github.com/search/repositories?q=language:javascript+created:>2024-11-01&sort=stars&order=desc&per_page=10' },
            { name: 'Reddit Programming', endpoint: 'programming' }
        ];
        
        // For now, let's try GitHub trending repositories as tech content
        const response = await makeRequestWithRetry(sources[0].url);
        
        const articles = response.items
            .filter(repo => repo.description && repo.stargazers_count > 5)
            .slice(0, 5)
            .map(repo => ({
                title: `${repo.name}: ${repo.description}`,
                url: repo.html_url,
                source: 'GitHub Trending',
                score: repo.stargazers_count
            }));
            
        console.log(`✅ Found ${articles.length} trending repositories`);
        return articles;
    } catch (error) {
        console.error('❌ Error fetching alternative sources:', error.message);
        return [];
    }
}

// Fetch articles from Dev.to (keeping original for when it works)
async function fetchDevToArticles() {
    try {
        console.log("🔍 Fetching articles from Dev.to...");
        const articles = await makeRequestWithRetry('https://dev.to/api/articles?per_page=20&state=fresh');
        
        const filtered = articles
            .filter(article => {
                // Filter by tech keywords and engagement
                const titleAndTags = (article.title + ' ' + (article.tag_list || []).join(' ')).toLowerCase();
                const hasRelevantKeywords = CONFIG.TECH_KEYWORDS.some(keyword => titleAndTags.includes(keyword));
                const hasMinEngagement = article.positive_reactions_count >= 5;
                
                return hasRelevantKeywords && hasMinEngagement;
            })
            .slice(0, 5)
            .map(article => ({
                title: article.title,
                url: article.url,
                source: 'Dev.to',
                score: article.positive_reactions_count,
                tags: article.tag_list
            }));
        
        console.log(`✅ Found ${filtered.length} relevant articles from Dev.to`);
        return filtered;
    } catch (error) {
        console.error('❌ Error fetching Dev.to articles:', error.message);
        return [];
    }
}

// Fetch articles from Hacker News
async function fetchHackerNewsArticles() {
    try {
        console.log("🔍 Fetching articles from Hacker News...");
        
        // Rotate between different story types for variety
        const endpoints = [
            'https://hacker-news.firebaseio.com/v0/topstories.json',
            'https://hacker-news.firebaseio.com/v0/newstories.json', 
            'https://hacker-news.firebaseio.com/v0/beststories.json'
        ];
        
        // Use current day to determine which endpoint to use (changes daily)
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
        const endpointIndex = dayOfYear % endpoints.length;
        const selectedEndpoint = endpoints[endpointIndex];
        
        console.log(`📡 Using endpoint: ${selectedEndpoint.split('/').pop().replace('.json', '')} (rotates daily)`);
        
        const allStoryIds = await makeRequestWithRetry(selectedEndpoint);
        
        const articles = [];
        
        // Add randomization - start from different positions each day
        const startOffset = (dayOfYear * 7) % 50; // Different starting point each day
        const storyIds = allStoryIds.slice(startOffset, startOffset + 20); // Get 20 stories from random offset
        
        for (const storyId of storyIds) {
            if (articles.length >= 5) break;
            
            try {
                const story = await makeRequestWithRetry(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
                
                if (story && story.url && story.title && story.score >= CONFIG.MIN_ARTICLE_SCORE) {
                    const titleAndUrl = (story.title + ' ' + (story.url || '')).toLowerCase();
                    const hasRelevantKeywords = CONFIG.TECH_KEYWORDS.some(keyword => titleAndUrl.includes(keyword));
                    
                    if (hasRelevantKeywords) {
                        articles.push({
                            title: story.title,
                            url: story.url,
                            source: 'Hacker News',
                            score: story.score,
                            comments: story.descendants || 0
                        });
                    }
                }
            } catch (error) {
                console.log(`⏭️  Skipping story ${storyId}: ${error.message}`);
                continue;
            }
        }
        
        console.log(`✅ Found ${articles.length} relevant articles from Hacker News`);
        return articles;
    } catch (error) {
        console.error('❌ Error fetching Hacker News articles:', error.message);
        return [];
    }
}

// Main test function
async function testFetch() {
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
    
    console.log("🚀 Starting article fetch test...");
    console.log(`📅 Today is day ${dayOfYear} of ${today.getFullYear()} - this determines source rotation\n`);
    
    try {
        // Fetch from all sources (including alternatives)
        const [devToArticles, hnArticles, altArticles] = await Promise.all([
            fetchDevToArticles(),
            fetchHackerNewsArticles(),
            fetchAlternativeTechArticles()
        ]);
        
        const allArticles = [...devToArticles, ...hnArticles, ...altArticles];
        
        if (allArticles.length === 0) {
            console.log("❌ No articles fetched from any source");
            return;
        }
        
        console.log(`\n🎯 Total articles found: ${allArticles.length}\n`);
        
        // Sort by score and display
        allArticles.sort((a, b) => b.score - a.score);
        
        console.log("📋 Fetched Articles:");
        console.log("=" .repeat(80));
        
        allArticles.forEach((article, index) => {
            console.log(`${index + 1}. 📄 ${article.title}`);
            console.log(`   🔗 ${article.url}`);
            console.log(`   📊 Source: ${article.source} | Score: ${article.score}${article.comments ? ` | Comments: ${article.comments}` : ''}`);
            if (article.tags && article.tags.length > 0) {
                console.log(`   🏷️  Tags: ${article.tags.join(', ')}`);
            }
            console.log("");
        });
        
        // Simulate random selection (like in the main script)
        const topArticles = allArticles.slice(0, Math.min(10, allArticles.length));
        const selectedCount = Math.floor(Math.random() * 2) + 1; // 1 or 2 articles
        
        const selectedArticles = [];
        for (let i = 0; i < selectedCount && i < topArticles.length; i++) {
            const randomIndex = Math.floor(Math.random() * topArticles.length);
            const selectedArticle = topArticles.splice(randomIndex, 1)[0];
            selectedArticles.push(selectedArticle);
        }
        
        console.log("🎲 Randomly Selected Articles (would be added to README):");
        console.log("=" .repeat(60));
        selectedArticles.forEach((article, index) => {
            console.log(`${index + 1}. 🌟 ${article.title}`);
            console.log(`   🔗 ${article.url}`);
            console.log(`   📊 ${article.source} (Score: ${article.score})`);
            console.log("");
        });
        
        console.log("✅ Test completed successfully!");
        
    } catch (error) {
        console.error("💥 Test failed:", error.message);
        process.exit(1);
    }
}

// Run the test
testFetch();