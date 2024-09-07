import bcrypt from 'bcrypt';
import config from '../config/config.js';
import User from '../models/UserSchema.js';
import Gym from '../models/GymSchema.js';
import { sendTemplatedEmail } from '../utils/emailUtils.js';
import { generateToken, verifyToken } from '../utils/tokenUtils.js'; // Import utility functions
import validator from 'validator';
import axios from 'axios';

const VALID_ROLES = ['admin', 'customer', 'owner', 'moderator']; // Add more roles as needed
export const registerController = (role) => async (req, res) => {
  try {
    let { email, password } = req.body;
    let googleData = false;
    // console.log(role);

    // gogole-auth
    if (req.body.googleAccessToken) {
      const { googleAccessToken } = req.body;

      // console.log(googleAccessToken);

      // Make the request to Google API to get user info
      const response = await axios.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: {
            Authorization: `Bearer ${googleAccessToken.access_token}`,
          },
        }
      );

      // Extract the user information from the response
      googleData = response.data;

      email = response.data.email;
      password = 'Google@123'; // hard-coded password for google
    }

    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        errors: { global: 'Please fill all the required fields.' },
      });
    }

    // Sanitize the email input
    const sanitizedEmail = validator.normalizeEmail(email);

    // Validate email format
    if (!validator.isEmail(sanitizedEmail)) {
      return res.status(400).json({
        errors: { global: 'Invalid email format.' },
      });
    }

    // Validate password strength
    if (
      !validator.isStrongPassword(password, {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
      })
    ) {
      return res.status(400).json({
        errors: {
          global:
            'Password must be at least 8 characters long, include uppercase, lowercase, numbers, and special characters.',
        },
      });
    }

    // Validate the role
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        errors: { global: 'Invalid role provided.' },
      });
    }

    // Check if the email is already registered
    const existingUser = await User.findOne({ email: sanitizedEmail });
    if (existingUser) {
      return res.status(400).json({
        errors: { global: 'Email is already registered.' },
      });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Initialize the user data object with common properties
    const createUserObject = {
      email: sanitizedEmail,
      password: hashedPassword,
      role: role,
    };

    // Check if Google login data is available
    // if (googleData && googleData?.picture) {
    //   Object.assign(createUserObject, {
    //     full_name: googleData.name || '',
    //     profile_image: googleData?.picture || '',
    //   });
    // } else
    if (googleData && googleData?.name) {
      Object.assign(createUserObject, {
        full_name: googleData.name,
      });
    }

    // Create a new user
    const newUser = new User(createUserObject);

    // Save the user to the database
    await newUser.save();

    // Send a welcome email
    const userName = sanitizedEmail.split('@')[0];
    await sendTemplatedEmail(sanitizedEmail, 'welcome', {
      userName: userName,
    });

    // Respond with success
    res.status(200).json({ message: 'Registration successful.' });
  } catch (error) {
    console.error('Internal Server Error:', error);
    res.status(500).json({
      errors: { global: '500 Internal Server Error, User not created.' },
    });
  }
};

/**
 * Controller function for handling user login requests.
 * Authenticates user credentials, sets a secure cookie with a token, and returns appropriate responses.
 *
 * @param {String} role - The role to be verified for the user (e.g., 'customer', 'owner').
 * @returns {Function} - Returns an asynchronous Express.js middleware function.
 *
 * @param {Object} req - The Express.js request object containing user input data (e.g., email, password).
 * @param {Object} res - The Express.js response object used to send responses to the client.
 * @throws {Error} - Logs and returns a 500 Internal Server Error response if an unexpected error occurs.
 *
 * @example
 * // Example usage in an Express route
 * app.post('/login', loginController('role'));
 */
export const loginController = (role) => async (req, res) => {
  try {
    let { email, password } = req.body;

    // console.log('login body', req.body);

    // gogole-auth
    if (req.body.googleAccessToken) {
      const { googleAccessToken } = req.body;

      // console.log(googleAccessToken);

      const response = await axios.get(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: {
            Authorization: `Bearer ${googleAccessToken.access_token}`,
          },
        }
      );

      email = response.data.email;
      password = 'Google@123';

      // Log the values after they are updated
      // console.log(email, password);
    }

    // Sanitize email
    email = validator.normalizeEmail(email);

    // Validate email and password
    if (!validator.isEmail(email) || validator.isEmpty(password)) {
      return res.status(400).json({ global: 'Invalid email or password.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ global: 'Invalid credentials.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ global: 'Invalid credentials.' });
    }

    if (user.role !== role) {
      return res
        .status(403)
        .json({ global: `Access denied. User is not a ${role}.` });
    }

    const token = generateToken(
      {
        _id: user._id,
        role: user.role,
        profile_image: user?.profile_image || false,
      },
      { expiresIn: config.AUTH_CONFIG.TOKEN_EXPIRY }
    );

    // Owner Reirection Response
    if (user.role === 'owner') {
      // To check if a gym with the specified owner_id exists
      const gym = await Gym.findOne({ owner_id: user._id });

      // Construct the response object based on the gym status
      const response = {
        token,
        status: 'unknown', // Default status
      };

      if (gym) {
        // console.log(gym?.status);
        if (gym.status === 'active') {
          // Active owner
          response.status = 'active';
        } else if (gym.status === 'inactive') {
          // Inactive owner
          response.status = 'inactive';
          response.reason = 'Your gym registration is still under review.';
        } else if (gym.status === 'rejected') {
          // Denied owner
          response.status = 'rejected';
          response.reason = 'Your gym registration has been denied.';
        }

        return res.status(200).json(response);
      } else {
        // Unregistered gym (new owner or hasn't submitted the form)
        return res.status(200).json({
          token,
          status: 'new',
          reason: 'You have not submitted your gym registration form yet.',
        });
      }
    }

    res.status(200).json({ token, message: 'Login successful.' });
  } catch (error) {
    console.error('Internal Server Error:', error);
    res.status(500).json({
      errors: { global: 'Internal server error, please try again later.' },
    });
  }
};

/**
 * Controller function for handling password reset requests.
 * Validates the provided email, checks the email pattern, and triggers a password reset request.
 *
 * @param {Object} req - The Express.js request object containing user input data (e.g., email).
 * @param {Object} res - The Express.js response object used to send responses to the client.
 * @returns {void} - Sends a JSON response with appropriate status and message.
 *
 * @throws {Error} - Logs and returns a 500 Internal Server Error response if an unexpected error occurs.
 *
 * @example
 * // Example usage in an Express route
 * app.post('/forgot-password', reqForgetPwdController);
 */
export const reqForgetPwdController = async (req, res) => {
  const { email } = req.body;

  try {
    // Sanitize email
    const sanitizedEmail = validator.normalizeEmail(email);

    // Validate email field
    if (validator.isEmpty(sanitizedEmail)) {
      return res.status(400).json({
        errors: {
          global: 'Email is required.',
        },
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        errors: {
          global: 'Invalid Email Address',
        },
      });
    }

    const user = await User.findOne({ email: sanitizedEmail });

    if (!user) {
      return res.status(404).json({
        errors: {
          global: 'No user found with this email.',
        },
      });
    }

    // Generate JWT token
    const resetToken = generateToken(
      { _id: user._id },
      { expiresIn: config.AUTH_CONFIG.RESET_PASSWORD_EXPIRATION }
    );

    // Send the reset email with the JWT token
    const resetLink = `${config.GENERAL_CONFIG.REDIRECT_URL}/resetpassword?token=${resetToken}`;
    await sendTemplatedEmail(email, 'passwordReset', {
      userName: user?.full_name || email.split('@')[0],
      resetLink,
    });

    res.status(200).json({ message: 'Password reset email sent.' });
  } catch (error) {
    // Check if response already sent before sending an error response
    if (!res.headersSent) {
      console.error(
        'Unhandled error in Error requesting password reset : ',
        error
      );
      res.status(500).json({
        errors: {
          global: 'Internal Server Error.',
        },
      });
    }
  }
};

/**
 * Controller function for handling password reset requests using a token.
 * Validates the provided token and new password, then updates the password if valid.
 *
 * @param {Object} req - The Express.js request object containing the new password in the body and the reset token in the URL parameters.
 * @param {Object} res - The Express.js response object used to send responses to the client.
 * @returns {void} - Sends a JSON response with an appropriate status and message.
 *
 * @throws {Error} - Logs and returns a 500 Internal Server Error response if an unexpected error occurs.
 *
 * @example
 * // Example usage in an Express route
 * app.post('/reset-password/:token', resetPwdController);
 */
export const resetPwdController = async (req, res) => {
  const { password } = req.body;
  const { token } = req.params;

  try {
    // Validate input fields
    if (validator.isEmpty(password)) {
      return res.status(400).json({
        errors: {
          global: 'New password is required.',
        },
      });
    }

    // Validate token
    if (validator.isEmpty(token)) {
      return res.status(400).json({
        errors: {
          global: 'Reset token is required.',
        },
      });
    }

    // Verify the JWT token
    const decodedToken = verifyToken(token);

    // If the token is invalid or expired, return an error
    if (!decodedToken) {
      return res.status(401).json({
        errors: {
          global: 'Invalid token',
        },
      });
    }

    if (decodedToken === 'expired') {
      return res.status(401).json({
        errors: {
          global: 'Token expired',
        },
      });
    }

    // Find the user by ID
    const user = await User.findOne({ _id: decodedToken.payload._id }).select(
      '_id'
    );

    if (!user) {
      return res.status(404).json({
        errors: {
          global: 'User not found.',
        },
      });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update the user's password
    user.password = hashedPassword;
    await user.save();

    res
      .status(200)
      .json({ message: 'Password has been updated successfully.' });
  } catch (error) {
    // Check if response already sent before sending an error response
    if (!res.headersSent) {
      console.error('Unhandled error in Error resetting password:', error);
      res.status(500).json({
        errors: {
          global: 'Internal Server Error.',
        },
      });
    }
  }
};
