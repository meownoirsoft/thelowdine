#!/bin/bash

# Test the restaurants API with PostgreSQL backend
# Usage: ./test-db-api.sh

echo "Testing restaurants API with coordinates..."
curl -X POST http://localhost:3000/api/restaurants \
  -H "Content-Type: application/json" \
  -d '{
    "coords": {"lat": 40.7128, "lon": -74.0060},
    "radiusMeters": 2000,
    "meal": "dinner"
  }' | jq .

echo -e "\n\nTesting with location query..."
curl -X POST http://localhost:3000/api/restaurants \
  -H "Content-Type: application/json" \
  -d '{
    "queryText": "New York, NY",
    "radiusMeters": 3000,
    "meal": "breakfast"
  }' | jq .
