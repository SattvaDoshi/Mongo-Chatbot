import express from 'express';
import Property from '../models/Property.js';
import { extractSearchCriteria, generateAIResponse } from '../utils/ai.js';
import { buildMongoQuery } from '../utils/queryBuilder.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { message, sessionId, useGroq = true } = req.body;
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }
    console.log(`Processing message: "${message}" with ${useGroq ? 'Groq' : 'Gemini'}`);
    const criteria = await extractSearchCriteria(message, useGroq);
    console.log('Extracted criteria:', criteria);
    const query = buildMongoQuery(criteria);
    console.log('MongoDB query:', query);
    const properties = await Property.find(query)
      .sort({ createdAt: -1 })
      .limit(20);
    console.log(`Found ${properties.length} properties`);
    const aiResponse = await generateAIResponse(message, properties, criteria, useGroq, sessionId);
    res.json({
      message: aiResponse,
      searchCriteria: criteria,
      propertiesFound: properties.length,
      properties: properties.slice(0, 5),
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

export default router;