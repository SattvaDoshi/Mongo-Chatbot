export default `
Collection: properties
{
  title: String,
  description: String,
  price: Number,
  location: String,
  type: String,
  status: 'available' | 'sold' | 'rented',
  features: [String],
  images: [String],
  bedrooms: Number,
  halls: Number,
  bathrooms: Number
}
`;
