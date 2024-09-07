import express from 'express';
import requireAuth from '../middlewares/requireAuth.js';
import {
  deleteUserProfileImage,
  getGymImageByDate,
  getGymOwnedByUser,
  getUserAllBookings,
  getUserById,
  updateUserById,
} from '../controllers/userControlller.js';
import { uploadMiddleware } from '../utils/updateImageToS3.js';

const userRouter = express.Router();

// Middleware to validate the user data
const validateUpdateFields = (req, res, next) => {
  const allowedFields = [
    'profile_image',
    'full_name',
    'phone_number',
    'email',
    'age',
    'preferred_time',
  ];
  const keys = Object.keys(req.body);

  for (const key of keys) {
    // Handle nested fields by checking if they start with allowed fields
    const fieldExists = allowedFields.some((allowedField) => {
      const [rootField, nestedField] = allowedField.split('.');
      return (
        key === allowedField ||
        (key.startsWith(rootField) && nestedField && key.endsWith(nestedField))
      );
    });

    if (!fieldExists) {
      return res
        .status(400)
        .json({ error: `Field '${key}' is not allowed for update.` });
    }
  }
  next();
};

const generateFolderPath = (req) => {
  const { role } = req;
  // console.log('path from generateFolderPath : ' + role)

  return `${role}`;
};

// Retrieve details for a specific user by ID works for any user(role)
//just gives user's email. nothing else.
userRouter.get('/', requireAuth, getUserById);

//get gym owned by user
userRouter.get('/owners', requireAuth, getGymOwnedByUser);

// Update details of a specific user by ID
userRouter.patch(
  '/',
  requireAuth,
  validateUpdateFields,
  uploadMiddleware(generateFolderPath, 'profile_image', 1),
  updateUserById
);

// Get all bookings of a particular user
userRouter.get('/bookings', requireAuth, getUserAllBookings);

// Route to get gym image URLs by date
userRouter.get('/bookings/images', requireAuth, getGymImageByDate);

userRouter.delete('/', requireAuth, deleteUserProfileImage);

export default userRouter;
