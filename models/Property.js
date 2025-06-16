import mongoose from 'mongoose';

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  location: { type: String, required: true },
  type: { type: String, required: true }, // e.g., "apartment", "villa"
  status: { type: String, enum: ['available', 'sold', 'rented'], default: 'available' },
  features: [String],
  images: [String],
  broker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  bedrooms: { type: Number, required: true },
  halls: { type: Number, required: true },
  bathrooms: { type: Number, required: true }
}, { timestamps: true });

export default mongoose.model('Property', propertySchema);
