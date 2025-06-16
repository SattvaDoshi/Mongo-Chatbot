import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "dotenv";
config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function getMongoQueryFromPrompt(userPrompt, schemaDesc) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
You are a MongoDB expert. Convert the user's question into a MongoDB query that searches the 'properties' collection.

Schema:
${schemaDesc}

User Question: "${userPrompt}"

Return only the MongoDB query object in JSON format with no explanation. Wrap it in \`\`\`json ... \`\`\`
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const codeBlock = text.match(/```json([\s\S]*?)```/);
    const queryText = codeBlock ? codeBlock[1].trim() : text;

    return JSON.parse(queryText);
  } catch (err) {
    console.error("❌ Gemini Error:", err);
    return null;
  }
}

export default getMongoQueryFromPrompt;
