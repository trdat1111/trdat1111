const fs = require("fs");

// Example data sources
const youtubeLinks = ["https://www.youtube.com/watch?v=Dle_SpjHTio", "https://www.youtube.com/watch?v=xo7XrRVxH8Y"];

const blogLinks = [
    "https://github.com/gautamkrishnar/blog-post-workflow#popular-sources",
    "https://bytebytego.com/courses/system-design-interview/design-youtube",
];

async function updateReadme() {
    let readmeContent = fs.readFileSync("README.md", "utf8");

    // Add YouTube videos and blog posts
    const youtubeSection = `## Latest YouTube Videos\n${youtubeLinks
        .map((link) => `- [Watch Video](${link})`)
        .join("\n")}\n\n`;
    const blogSection = `## Latest Blog Posts\n${blogLinks.map((link) => `- [Read Post](${link})`).join("\n")}\n\n`;

    // Update the README content
    readmeContent = `${youtubeSection}${blogSection}${readmeContent}`;

    fs.writeFileSync("README.md", readmeContent);
}

updateReadme();
