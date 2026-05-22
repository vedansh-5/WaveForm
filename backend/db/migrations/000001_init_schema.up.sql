-- Enable uuid-ossp extension for high-performance unique identifiers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generatev4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- null allowed for Oauth only signups
    name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- indexing emails to make login searches instantaneous
CREATE INDEX IF NOT EXISTS idx_users_email on users(email);


-- 2. Audio recordings table
CREATE TABLE IF NOT EXISTS recordings(
    id UUID PRIMARY KEY DEFAULT uuid_generatev4(),
    user_id UUID NOT NULL REFERENCES users(id) on DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    file_path TEXT NOT NULL,
    file_size INT NOT NULL,
    duration NUMERIC(5,2) NOT NULL, -- max 30 s
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexing user_id so reading user history is fast
CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON recordings(user_id);

-- 3. Mathematical Fourier Approximations table
CREATE TABLE IF NOT EXISTS equations (
    id UUID PRIMARY KEY DEFAULT uuid_generatev4(),
    recording_id UUID NOT NULL UNIQUE REFERENCES recordings(id) ON DELETE CASCADE,
    a_0 DOUBLE PRECISION NOT NULL, -- DC offset / average sound level
    a_n DOUBLE PRECISION[] NOT NULL, --cosine coefficients
    b_n DOUBLE PRECISION[] NOT NULL, -- sine coefficients
    fundamental_frequency DOUBLE PRECISION NOT NULL, --core pitch in Hz
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);