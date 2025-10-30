-- Add short_id column to shared_results for shorter, cleaner URLs
ALTER TABLE shared_results ADD COLUMN IF NOT EXISTS short_id VARCHAR(12) UNIQUE;

-- Create index on short_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_shared_results_short_id ON shared_results(short_id);
