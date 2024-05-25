const fs = require("fs");

async function updateReadme() {
    const youtubeUrl = document.getElementById("youtubeVideoUrl").value;
    const youtubeTitle = document.getElementById("youtubeVideoTitle").value;
    const blogUrl = document.getElementById("blogPostUrl").value;
    const blogTitle = document.getElementById("blogPostTitle").value;

    // Find the existing sections for YouTube Videos and Blog Posts
    const youtubeRegex = /### YouTube Videos\n([\s\S]*?)(?=\n### |\n## |\n$)/;
    const blogRegex = /### Blog Posts\n([\s\S]*?)(?=\n## |\n$)/;

    let readmeContent = fs.readFileSync("README.md", "utf8");

    if (youtubeUrl && youtubeTitle) {
        const updatedYouTubeSection = readmeContent.replace(youtubeRegex, (match, p1) => {
            return `${match}\n- [${youtubeTitle}](${youtubeUrl})\n`;
        });

        fs.writeFileSync("README.md", updatedYouTubeSection);

        const youtubeList = document.getElementById("youtubeList");
        const listItem = document.createElement("li");
        listItem.innerHTML = `<a href="${youtubeUrl}" target="_blank">${youtubeTitle}</a>`;
        youtubeList.appendChild(listItem);
    }

    if (blogUrl && blogTitle) {
        const updatedBlogSection = readmeContent.replace(blogRegex, (match, p1) => {
            return `${match}\n- [${newBlogPost.title}](${newBlogPost.url})\n`;
        });

        fs.writeFileSync("README.md", updatedBlogSection);

        const blogList = document.getElementById("blogList");
        const listItem = document.createElement("li");
        listItem.innerHTML = `<a href="${blogUrl}" target="_blank">${blogTitle}</a>`;
        blogList.appendChild(listItem);
    }

    document.getElementById("researchForm").reset();
}

// updateReadme(newYouTubeVideo, newBlogPost);
