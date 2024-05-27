const fs = require("fs");

const dataInput = process.env.INPUT_DATA;

if (!dataInput) {
    console.error("Input data is required");
    process.exit(1);
}

let data;

try {
    data = JSON.parse(dataInput);
    console.log("🚀 ~ data:", data);
} catch (error) {
    console.error("Error parsing input data:", error);
    process.exit(1);
}

async function updateReadme(newData) {
    let readmeContent = fs.readFileSync("README.md", "utf8");

    const researchSectionRegex = /## Recent Researches\n([\s\S]*?)(?=\n## |\n$)/;
    const match = readmeContent.match(researchSectionRegex);

    if (match) {
        const existingResearchContent = match[1];
        const newResearchEntry = "";

        if (Array.isArray(newData)) {
            newResearchEntry = newData.map((data) => `- [${data.title}](${data.url})`);
        } else newResearchEntry = `- [${newData.title}](${newData.url})\n`;

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

const newBlogPost = { title: "Understanding Async/Await", url: "https://blog.example.com/newpost" };

updateReadme(data);
