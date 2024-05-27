const fs = require("fs");

const newBlogPost = { title: "Understanding Async/Await", url: "https://blog.example.com/newpost" };

async function updateReadme(newData) {
    let readmeContent = fs.readFileSync("README.md", "utf8");

    const researchSectionRegex = /## Recent Researches\n([\s\S]*?)(?=\n## |\n$)/;
    const match = readmeContent.match(researchSectionRegex);

    if (match) {
        const existingResearchContent = match[1];
        const newResearchEntry = `- [${newData.title}](${newData.url})\n`;

        // Append the new research entry
        const updatedResearchContent = `${existingResearchContent}\n${newResearchEntry}`;

        // Replace the old research section with the updated one
        const updatedReadmeContent = readmeContent.replace(
            researchSectionRegex,
            `## Recent Researches\n${updatedResearchContent}`
        );

        fs.writeFileSync("README.md", updatedReadmeContent, "utf8");
    } else {
        console.error("No '## Recent Researches' section found in README.md.");
    }
}

updateReadme(newBlogPost);
