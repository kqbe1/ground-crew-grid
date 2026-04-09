ALTER TABLE profiles DISABLE TRIGGER trg_restrict_user_profile_update;
UPDATE profiles SET role = 'bureau' WHERE email = 'admin@pmeterrain.test';
ALTER TABLE profiles ENABLE TRIGGER trg_restrict_user_profile_update;