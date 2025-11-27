const fs = require("fs");
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

// Check if running in manual mode (with input data)
const dataInput = process.env.INPUT_DATA;
let data = null;

if (dataInput) {
    // Manual mode - use provided data
    try {
        data = JSON.parse(dataInput);
        console.log("Running in manual mode with provided data");
    } catch (error) {
        console.error("Error parsing input data:", error);
        process.exit(1);
    }
} else {
    // Automatic mode - fetch articles
    console.log("Running in automatic mode - fetching articles...");
}

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

// Fetch articles from Dev.to
async function fetchDevToArticles() {
    try {
        console.log("Fetching articles from Dev.to...");
        const articles = await makeRequestWithRetry('https://dev.to/api/articles?per_page=20&state=fresh');
        
        return articles
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
                score: article.positive_reactions_count
            }));
    } catch (error) {
        console.error('Error fetching Dev.to articles:', error.message);
        return [];
    }
}

// Fetch articles from Hacker News with daily rotation
async function fetchHackerNewsArticles() {
    try {
        console.log("Fetching articles from Hacker News...");
        
        // Rotate between different story types for daily variety
        const endpoints = [
            'https://hacker-news.firebaseio.com/v0/topstories.json',
            'https://hacker-news.firebaseio.com/v0/newstories.json', 
            'https://hacker-news.firebaseio.com/v0/beststories.json'
        ];
        
        // Use current day to determine which endpoint to use (changes daily)
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
        const endpointIndex = dayOfYear % endpoints.length;
        const selectedEndpoint = endpoints[endpointIndex];
        
        console.log(`Using ${selectedEndpoint.split('/').pop().replace('.json', '')} endpoint (rotates daily)`);
        
        const allStoryIds = await makeRequestWithRetry(selectedEndpoint);
        
        const articles = [];
        
        // Add randomization - start from different positions each day for more variety
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
                            score: story.score
                        });
                    }
                }
            } catch (error) {
                console.log(`Skipping story ${storyId}: ${error.message}`);
                continue;
            }
        }
        
        return articles;
    } catch (error) {
        console.error('Error fetching Hacker News articles:', error.message);
        return [];
    }
}

// Get existing research titles to avoid duplicates
function getExistingResearchTitles(readmeContent) {
    const researchSectionRegex = /## Recent Researches\n([\s\S]*?)(?=\n## |\n$)/;
    const match = readmeContent.match(researchSectionRegex);
    
    if (match) {
        const existingContent = match[1];
        const titleRegex = /\[([^\]]+)\]/g;
        const titles = [];
        let titleMatch;
        
        while ((titleMatch = titleRegex.exec(existingContent)) !== null) {
            titles.push(titleMatch[1].toLowerCase());
        }
        
        return titles;
    }
    
    return [];
}

// Main function to fetch articles from all sources
async function fetchRandomTechArticles() {
    const allArticles = [];
    
    // Fetch from all sources
    const [devToArticles, hnArticles] = await Promise.all([
        fetchDevToArticles(),
        fetchHackerNewsArticles()
    ]);
    
    allArticles.push(...devToArticles, ...hnArticles);
    
    if (allArticles.length === 0) {
        throw new Error('No articles fetched from any source');
    }
    
    // Read existing README to check for duplicates
    const readmeContent = fs.readFileSync("README.md", "utf8");
    const existingTitles = getExistingResearchTitles(readmeContent);
    
    // Filter out duplicates and select random articles
    const uniqueArticles = allArticles.filter(article => {
        const titleLower = article.title.toLowerCase();
        return !existingTitles.some(existing => {
            // Check for similar titles (simple similarity check)
            const similarity = titleLower.includes(existing) || existing.includes(titleLower);
            return similarity;
        });
    });
    
    if (uniqueArticles.length === 0) {
        console.log('No new unique articles found, using random selection from all articles');
        return allArticles.slice(0, 1); // Return at least one article
    }
    
    // Sort by score/engagement and randomize
    uniqueArticles.sort((a, b) => b.score - a.score);
    
    // Select 1-2 random articles from top performers
    const topArticles = uniqueArticles.slice(0, Math.min(10, uniqueArticles.length));
    const selectedCount = Math.floor(Math.random() * 2) + 1; // 1 or 2 articles
    
    const selectedArticles = [];
    for (let i = 0; i < selectedCount && i < topArticles.length; i++) {
        const randomIndex = Math.floor(Math.random() * topArticles.length);
        const selectedArticle = topArticles.splice(randomIndex, 1)[0];
        selectedArticles.push(selectedArticle);
    }
    
    console.log(`Selected ${selectedArticles.length} articles:`);
    selectedArticles.forEach(article => {
        console.log(`- ${article.title} (${article.source}) - Score: ${article.score}`);
    });
    
    return selectedArticles;
}

async function updateReadme(newData) {
    let readmeContent = fs.readFileSync("README.md", "utf8");

    const researchSectionRegex = /## Recent Researches\n([\s\S]*?)(?=\n## |\n$)/;
    const match = readmeContent.match(researchSectionRegex);

    if (match) {
        const existingResearchContent = match[1];
        let newResearchEntry = "";

        if (Array.isArray(newData)) {
            newData.forEach((data) => (newResearchEntry += `\n- [${data.title}](${data.url})\n`));
        } else {
            console.error("Invalid data type, must be array!");
            process.exit(1);
        }

        // Append the new research entry
        let updatedResearchContent = `${newResearchEntry}\n${existingResearchContent}`;

        // List exceed 7 bullet points
        const listResearchContent = updatedResearchContent.split("\n").filter((line) => line.trim().length > 0);
        if (listResearchContent.length >= 7) {
            // Remove the oldest entries to keep exactly 7
            const linesToRemove = listResearchContent.length - 7 + 1; // +1 because we're adding new ones
            for (let i = 0; i < linesToRemove; i++) {
                const lastLine = listResearchContent.pop();
                updatedResearchContent = updatedResearchContent.replace(lastLine, "").trim();
            }
        }

        // Replace the old research section with the updated one
        const updatedReadmeContent = readmeContent.replace(
            researchSectionRegex,
            `## Recent Researches\n${updatedResearchContent}`
        );

        fs.writeFileSync("README.md", updatedReadmeContent, "utf8");
    } else {
        console.error("No '## Recent Researches' section found in README.md.");
        process.exit(1);
    }
}

// Main execution
async function main() {
    try {
        if (data) {
            // Manual mode
            await updateReadme(data);
            console.log('README updated successfully with manual data');
        } else {
            // Automatic mode
            const fetchedArticles = await fetchRandomTechArticles();
            await updateReadme(fetchedArticles);
            console.log('README updated successfully with auto-fetched articles');
        }
    } catch (error) {
        console.error('Error updating README:', error.message);
        
        // If automatic mode fails, try to continue with a fallback
        if (!data) {
            console.log('Attempting fallback - using existing research section...');
            // Could implement a fallback here, like keeping the existing content
        }
        
        process.exit(1);
    }
}

main();
