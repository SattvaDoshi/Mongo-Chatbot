import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import getMongoQueryFromPrompt from './gemini.js';
import schemaDesc from './prompt-engineering.js';
import Property from './models/Property.js';

dotenv.config();
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
app.use(cors());


app.post('/chat', async (req, res) => {
  const { message } = req.body;

  try {
    res.json({ result : "How can I help you ???", message: message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to execute query.' });
  }
});

app.listen(PORT, async () => {
  try {
    console.log("Server running on Port:", PORT)
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
});
