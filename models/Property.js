import { Schema, model as _model } from 'mongoose';

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
  area: { type: Number },
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

export default Property;
