// configValidator.js

import config from './config.js'

// List of required configuration keys for each section
const requiredSettings = {
  DB_CONFIG: ['MONGODB_URI', 'DATABASE'],
  GOOGLE_CONFIG: ['CLIENT_ID', 'CLIENT_SECRET', 'USER_PROFILE_URL'],
  SESSION_CONFIG: ['SECRET_KEY'],
  AUTH_CONFIG: ['JWT_SECRET_KEY', 'HTTP_SECURE'],
  GENERAL_CONFIG: ['BASE_URL', 'REDIRECT_URL', 'PORT', 'PLATFORM_NAME'],
  EMAIL_CONFIG: ['ADMIN_EMAIL', 'SENDGRID_API_KEY'],
  AWS_CONFIG: [
    'ACCESS_KEY_ID',
    'SECRET_ACCESS_KEY',
    'REGION',
    'S3_BUCKET_NAME',
  ],
}

// Function to validate configurations
const validateConfig = () => {
  Object.keys(requiredSettings).forEach((section) => {
    requiredSettings[section].forEach((key) => {
      if (!config[section][key]) {
        throw new Error(`Missing required configuration: ${section}.${key}`)
      }
    })
  })

  // Additional validation checks can be added here if needed
}

export default validateConfig
