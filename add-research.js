const fs = require("fs");

const dataInput = process.env.INPUT_DATA;

if (!dataInput) {
    console.error("Input data is required");
    process.exit(1);
}

let data;

try {
    data = JSON.parse(dataInput);
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
        let newResearchEntry = "";

        if (Array.isArray(newData)) {
            newData.forEach((data) => (newResearchEntry += `\n- [${data.title}](${data.url})\n`));
        } else {
            console.error("Invalid data type, must be array!");
            process.exit(1);
        }

        // Append the new research entry
        const updatedResearchContent = `${newResearchEntry}\n${existingResearchContent}`;

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

updateReadme(data);
