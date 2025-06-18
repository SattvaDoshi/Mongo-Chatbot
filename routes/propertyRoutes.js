import express from 'express';
import Property from '../models/Property.js';

const router = express.Router();

router.get('/', async (req, res) => {
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

export default router;