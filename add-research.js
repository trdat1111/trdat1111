const fs = require("fs");

const newYouTubeVideo = {
    title: "New JavaScript Tips",
    url: "https://sáasasasasasaddawww.youtube.com/watch?v=newvideo",
};
const newBlogPost = { title: "Understanding Async/Await", url: "https://blog.example.com/newpost" };

async function updateReadme(newYouTubeVideo, newBlogPost) {
    let readmeContent = fs.readFileSync("README.md", "utf8");

    // Find the existing sections for YouTube Videos and Blog Posts
    const youtubeRegex = /### YouTube Videos\n([\s\S]*?)(?=\n### |\n## |\n$)/;
    const blogRegex = /### Blog Posts\n([\s\S]*?)(?=\n## |\n$)/;

    if (newYouTubeVideo) {
        const updatedYouTubeSection = readmeContent.replace(youtubeRegex, (match, p1) => {
            return `${match}\n- [${newYouTubeVideo.title}](${newYouTubeVideo.url})\n`;
        });

        fs.writeFileSync("README.md", updatedYouTubeSection);
    }

    if (newBlogPost) {
        const updatedBlogSection = readmeContent.replace(blogRegex, (match, p1) => {
            return `${match}\n- [${newBlogPost.title}](${newBlogPost.url})\n`;
        });

        fs.writeFileSync("README.md", updatedBlogSection);
    }
}

updateReadme(newYouTubeVideo, newBlogPost);
