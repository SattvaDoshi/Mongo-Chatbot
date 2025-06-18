import express, { json } from 'express';
import { connect, Schema, model as _model } from 'mongoose';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { config } from 'dotenv';

config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(json());
app.use(cors());

// MongoDB connection with better error handling
const connectDB = async () => {
  try {
    await connect(process.env.MONGO_URI || 'mongodb://localhost:27017/properties');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

// Enhanced Property Schema
const propertySchema = new Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  location: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: ['apartment', 'house', 'villa', 'studio', 'penthouse', 'townhouse', 'condo', 'duplex']
  },
  status: { 
    type: String, 
    enum: ['available', 'sold', 'rented', 'pending'], 
    default: 'available' 
  },
  features: [String],
  images: [String],
  bedrooms: { type: Number, default: 0 },
  halls: { type: Number, default: 0 },
  bathrooms: { type: Number, default: 0 },
  area: { type: Number }, // in sq ft
  furnished: { type: Boolean, default: false },
  parking: { type: Boolean, default: false },
  balcony: { type: Boolean, default: false },
  contactInfo: {
    name: String,
    phone: String,
    email: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Property = _model('Property', propertySchema);

// Initialize AI models
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Enhanced conversation context storage (in production, use Redis or DB)
const conversationContext = new Map();

// Helper function to extract search criteria with better prompting
async function extractSearchCriteria(userMessage, useGroq = false) {
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
    
    // Clean the response to extract JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : '{}';
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Error extracting search criteria:', error);
    return {};
  }
}

// Enhanced MongoDB query builder
function buildMongoQuery(criteria) {
  const query = { status: 'available' }; // Default to available properties
  
  if (criteria.location) {
    query.location = { $regex: criteria.location, $options: 'i' };
  }
  
  if (criteria.type) {
    query.type = { $regex: criteria.type, $options: 'i' };
  }
  
  // Price range handling
  if (criteria.minPrice || criteria.maxPrice) {
    query.price = {};
    if (criteria.minPrice) query.price.$gte = criteria.minPrice;
    if (criteria.maxPrice) query.price.$lte = criteria.maxPrice;
  }
  
  // Exact matches for room counts
  if (criteria.bedrooms !== undefined) {
    query.bedrooms = criteria.bedrooms;
  }
  
  if (criteria.halls !== undefined) {
    query.halls = criteria.halls;
  }
  
  if (criteria.bathrooms !== undefined) {
    query.bathrooms = criteria.bathrooms;
  }
  
  // Area range
  if (criteria.minArea || criteria.maxArea) {
    query.area = {};
    if (criteria.minArea) query.area.$gte = criteria.minArea;
    if (criteria.maxArea) query.area.$lte = criteria.maxArea;
  }
  
  if (criteria.status) {
    query.status = criteria.status;
  }
  
  // Boolean fields
  if (criteria.furnished !== undefined) {
    query.furnished = criteria.furnished;
  }
  
  if (criteria.parking !== undefined) {
    query.parking = criteria.parking;
  }
  
  if (criteria.balcony !== undefined) {
    query.balcony = criteria.balcony;
  }
  
  // Features array matching
  if (criteria.features && criteria.features.length > 0) {
    query.features = { $in: criteria.features };
  }
  
  return query;
}

// Enhanced AI response generation
async function generateAIResponse(userMessage, properties, searchCriteria, useGroq = false, sessionId = null) {
  try {
    let prompt;
    
    // Get conversation context
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
    
    // Store conversation context
    if (sessionId) {
      const userContext = conversationContext.get(sessionId) || [];
      userContext.push({
        user: userMessage,
        bot: response,
        timestamp: new Date()
      });
      
      // Keep only last 10 exchanges
      if (userContext.length > 10) {
        userContext.shift();
      }
      
      conversationContext.set(sessionId, userContext);
    }
    
    return response;
  } catch (error) {
    console.error('Error generating AI response:', error);
    return "I'm sorry, I'm having trouble processing your request right now. Please try again or contact our support team.";
  }
}

// Routes

// Get all properties with pagination and filters
app.get('/api/properties', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.location) filter.location = { $regex: req.query.location, $options: 'i' };
    
    const properties = await Property.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    const total = await Property.countDocuments(filter);
    
    res.json({
      properties,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: properties.length,
        totalProperties: total
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Enhanced main chatbot endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, useGroq = false } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`Processing message: "${message}" with ${useGroq ? 'Groq' : 'Gemini'}`);

    // Extract search criteria using AI
    const criteria = await extractSearchCriteria(message, useGroq);
    console.log('Extracted criteria:', criteria);
    
    // Build MongoDB query
    const query = buildMongoQuery(criteria);
    console.log('MongoDB query:', query);
    
    // Search properties
    const properties = await Property.find(query)
      .sort({ createdAt: -1 })
      .limit(20);
    
    console.log(`Found ${properties.length} properties`);
    
    // Generate AI response
    const aiResponse = await generateAIResponse(message, properties, criteria, useGroq, sessionId);
    
    res.json({
      message: aiResponse,
      searchCriteria: criteria,
      propertiesFound: properties.length,
      properties: properties.slice(0, 5), // Return top 5 properties with full details
      sessionId: sessionId || `session_${Date.now()}`,
      model: useGroq ? 'groq' : 'gemini'
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Sorry, I encountered an error while processing your request. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});


// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    models: {
      gemini: !!process.env.GEMINI_API_KEY,
      groq: !!process.env.GROQ_API_KEY
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(port, () => {
  console.log(`Property chatbot server running on port ${port}`);
  console.log(`Models available: Gemini: ${!!process.env.GEMINI_API_KEY}, Groq: ${!!process.env.GROQ_API_KEY}`);
});

export default app;