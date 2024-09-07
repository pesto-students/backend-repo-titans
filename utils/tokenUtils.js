import jwt from 'jsonwebtoken'
import config from '../config/config.js'

/**
 * Generate a JWT token
 * @param {Object} payload - Data to be included in the token
 * @param {Object} options - JWT options (e.g., expiresIn)
 * @returns {String} - The generated JWT token
 */
export const generateToken = (payload, options = {}) => {
  return jwt.sign({ payload }, config.AUTH_CONFIG.JWT_SECRET_KEY, options)
}

/**
 * Verify a JWT token
 * @param {String} token - The JWT token to be verified
 * @returns {Object} - The decoded payload if the token is valid
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.AUTH_CONFIG.JWT_SECRET_KEY)
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return 'expired'
    } else if (err.name === 'JsonWebTokenError') {
      return false
    } else {
      throw new Error('Token verification failed: ' + err.message)
    }
  }
}
