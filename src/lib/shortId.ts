// Generate a short, URL-safe ID using base36
// This converts a number to base36 (0-9, a-z) for compact representation
export function generateShortId(): string {
  // Generate a random number and convert to base36
  // Using 32-bit random number gives us ~6-7 character IDs
  const randomNum = Math.floor(Math.random() * 2176782336); // max 32-bit value in base36
  let shortId = randomNum.toString(36);
  
  // Ensure minimum length of 6 characters for collision resistance
  while (shortId.length < 6) {
    shortId = '0' + shortId;
  }
  
  return shortId;
}

// Generate a short ID from a restaurant ID to ensure consistency
// Same restaurant always gets roughly the same "feel" of ID
export function generateShortIdFromRestaurantId(restaurantId: number): string {
  // Use restaurant ID as seed but add randomness for different shares of same restaurant
  const random = Math.floor(Math.random() * 46656); // 36^3
  const combined = (restaurantId * 46656) + random;
  const shortId = combined.toString(36);
  
  return shortId.slice(-6); // Last 6 chars ensure consistent length
}
