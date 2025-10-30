-- Create shared_results table for storing shared restaurant results
CREATE TABLE IF NOT EXISTS shared_results (
  id VARCHAR(255) PRIMARY KEY,
  restaurant_id INTEGER NOT NULL,
  restaurant_name VARCHAR(255) NOT NULL,
  restaurant_address TEXT,
  restaurant_cuisine VARCHAR(255),
  restaurant_distance VARCHAR(50),
  restaurant_lat DECIMAL(10, 8),
  restaurant_lon DECIMAL(11, 8),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on created_at for analytics
CREATE INDEX IF NOT EXISTS idx_shared_results_created_at ON shared_results(created_at);
