import dotenv from 'dotenv'

// Load environment variables from a .env file into process.env
dotenv.config()

// Database Configuration
const DB_CONFIG = {
  MONGODB_URI: process.env.MONGODB_URI,
  DATABASE: process.env.DATABASE,
  REMAINING_URI: '?retryWrites=true&w=majority&appName=Cluster0',
}

// Google OAuth Configuration
const GOOGLE_CONFIG = {
  CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  USER_PROFILE_URL: process.env.USER_PROFILE_URL,
}

// Session Configuration
const SESSION_CONFIG = {
  SECRET_KEY: process.env.SECRET_SESSION_KEY,
}

// Authentication Configuration
const AUTH_CONFIG = {
  JWT_SECRET_KEY: process.env.JWT_SECRET_KEY,
  TOKEN_EXPIRY: '1d',
  COOKIE_EXPIRY: 24 * 60 * 60 * 1000,
  HTTP_SECURE: process.env.HTTP_SECURE,
  RESET_PASSWORD_EXPIRATION: 3600,
}

// General Configuration
const GENERAL_CONFIG = {
  BASE_URL: process.env.BASE_URL,
  REDIRECT_URL: process.env.REDIRECT_URL,
  PORT: process.env.PORT || 3000,
  PLATFORM_NAME: process.env.PLATFORM_NAME,
}

// SendGrid Configuration
const EMAIL_CONFIG = {
  ADMIN_EMAIL: process.env.ADMIN_EMAIL_ADDRESS,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
}

// AWS Configuration
const AWS_CONFIG = {
  ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  REGION: process.env.AWS_REGION,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
}

// Export all configuration settings
export default {
  DB_CONFIG,
  GOOGLE_CONFIG,
  SESSION_CONFIG,
  AUTH_CONFIG,
  GENERAL_CONFIG,
  EMAIL_CONFIG,
  AWS_CONFIG,
}
