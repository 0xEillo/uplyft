-- Add subscription tracking columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS revenue_cat_user_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMPTZ;

-- Add index for faster subscription status queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_revenue_cat_user_id ON profiles(revenue_cat_user_id);

-- Add comment for documentation
COMMENT ON COLUMN profiles.subscription_status IS 'Subscription status: active, inactive, cancelled, or trial';
COMMENT ON COLUMN profiles.subscription_expires_at IS 'When the current subscription period expires';
COMMENT ON COLUMN profiles.revenue_cat_user_id IS 'RevenueCat customer identifier for webhook integration';
COMMENT ON COLUMN profiles.trial_start_date IS 'When the user started their free trial';
COMMENT ON COLUMN profiles.trial_end_date IS 'When the user free trial ends';

