import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const conversationContext = new Map();

export async function extractSearchCriteria(userMessage, useGroq = false) {
  try {
    const prompt = `
You are a property search assistant. Extract search criteria from this user message and return ONLY a valid JSON object.

User message: "${userMessage}"

Extract these fields if mentioned (include only if explicitly stated or strongly implied):
- location: string (city, area, neighborhood, locality)
- type: string (apartment, house, villa, studio, penthouse, townhouse, condo, duplex)
- minPrice: number (minimum budget in your currency)
- maxPrice: number (maximum budget in your currency)
- bedrooms: number (number of bedrooms: 1, 2, 3, etc.)
- halls: number (number of halls/living rooms)
- bathrooms: number (number of bathrooms)
- status: string (available, sold, rented, pending)
- features: array of strings (parking, gym, pool, garden, security, etc.)
- furnished: boolean (if furnished/unfurnished is mentioned)
- parking: boolean (if parking is mentioned)
- balcony: boolean (if balcony is mentioned)
- minArea: number (minimum area in sq ft)
- maxArea: number (maximum area in sq ft)

Examples:
- "2 bedroom apartment in Mumbai under 50 lakhs" → {"location": "Mumbai", "type": "apartment", "bedrooms": 2, "maxPrice": 5000000}
- "furnished house with parking" → {"furnished": true, "parking": true, "type": "house"}
- "villa in Gurgaon" → {"type": "villa", "location": "Gurgaon"}

Return ONLY the JSON object, no other text:`;

    let response;
    if (useGroq && process.env.GROQ_API_KEY) {
      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama3-8b-8192",
        temperature: 0.1,
        max_tokens: 500
      });
      response = completion.choices[0]?.message?.content || '{}';
    } else {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const geminiResponse = await result.response;
      response = geminiResponse.text();
    }
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : '{}';
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Error extracting search criteria:', error);
    return {};
  }
}

export async function generateAIResponse(userMessage, properties, searchCriteria, useGroq = false, sessionId = null) {
  try {
    let prompt;
    const context = conversationContext.get(sessionId) || [];
    const contextStr = context.length > 0 ? 
      `Previous conversation:\n${context.slice(-3).map(c => `User: ${c.user}\nBot: ${c.bot}`).join('\n')}\n\n` : '';
    if (properties.length === 0) {
      prompt = `${contextStr}Current user message: "${userMessage}"
Search criteria extracted: ${JSON.stringify(searchCriteria)}

No properties were found matching the user's criteria. As a helpful property assistant, provide a conversational response that:

1. Acknowledges their specific request
2. Explains why no results were found (be specific about the criteria)
3. Suggests practical alternatives:
   - Adjusting budget range
   - Considering nearby locations
   - Looking at different property types
   - Modifying room requirements
4. Ask what they'd like to adjust in their search
5. Keep the tone friendly and helpful

Make it conversational, not robotic.`;
    } else {
      const propertyData = properties.slice(0, 5).map(p => ({
        id: p._id,
        title: p.title,
        price: p.price,
        location: p.location,
        type: p.type,
        bedrooms: p.bedrooms,
        halls: p.halls,
        bathrooms: p.bathrooms,
        area: p.area,
        features: p.features,
        furnished: p.furnished,
        parking: p.parking,
        status: p.status
      }));
      prompt = `${contextStr}Current user message: "${userMessage}"
Search criteria: ${JSON.stringify(searchCriteria)}

Found ${properties.length} matching properties. Here are the top results:
${JSON.stringify(propertyData, null, 2)}

As a professional property consultant, provide a response that:

1. Acknowledges their request naturally
2. Summarizes the search results (mention total count)
3. Highlight 2-3 most relevant properties with key details:
   - Title, price, location
   - Bedrooms, bathrooms, area if available
   - Notable features
4. Mention why these properties match their criteria
5. Ask if they want:
   - More details about specific properties
   - To see more options
   - To refine their search
   - Contact information for any property

Keep the response conversational, helpful, and professional. Use Indian Rupees format for prices (₹).`;
    }

    let response;
    if (useGroq && process.env.GROQ_API_KEY) {
      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama3-8b-8192",
        temperature: 0.7,
        max_tokens: 1000
      });
      response = completion.choices[0]?.message?.content;
    } else {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const geminiResponse = await result.response;
      response = geminiResponse.text();
    }
    if (sessionId) {
      const userContext = conversationContext.get(sessionId) || [];
      userContext.push({
        user: userMessage,
        bot: response,
        timestamp: new Date()
      });
      if (userContext.length > 10) userContext.shift();
      conversationContext.set(sessionId, userContext);
    }
    return response;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return "I'm sorry, I'm having trouble processing your request right now. Please try again or contact our support team.";
  }
}