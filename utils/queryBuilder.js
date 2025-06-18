export function buildMongoQuery(criteria) {
  const query = { status: 'available' };
  if (criteria.location) query.location = { $regex: criteria.location, $options: 'i' };
  if (criteria.type) query.type = { $regex: criteria.type, $options: 'i' };
  if (criteria.minPrice || criteria.maxPrice) {
    query.price = {};
    if (criteria.minPrice) query.price.$gte = criteria.minPrice;
    if (criteria.maxPrice) query.price.$lte = criteria.maxPrice;
  }
  if (criteria.bedrooms !== undefined) query.bedrooms = criteria.bedrooms;
  if (criteria.halls !== undefined) query.halls = criteria.halls;
  if (criteria.bathrooms !== undefined) query.bathrooms = criteria.bathrooms;
  if (criteria.minArea || criteria.maxArea) {
    query.area = {};
    if (criteria.minArea) query.area.$gte = criteria.minArea;
    if (criteria.maxArea) query.area.$lte = criteria.maxArea;
  }
  if (criteria.status) query.status = criteria.status;
  if (criteria.furnished !== undefined) query.furnished = criteria.furnished;
  if (criteria.parking !== undefined) query.parking = criteria.parking;
  if (criteria.balcony !== undefined) query.balcony = criteria.balcony;
  if (criteria.features && criteria.features.length > 0) query.features = { $in: criteria.features };
  return query;
}