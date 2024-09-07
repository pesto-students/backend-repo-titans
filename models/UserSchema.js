import mongoose from 'mongoose';

// User Schema
const userSchema = new mongoose.Schema(
  {
    profile_image: { type: String }, // S3 URL to image
    full_name: { type: String, trim: true },
    phone_number: {
      type: Number,
      min: [1000000000, 'Phone number is too short'],
      max: [9999999999, 'Phone number is too long'],
    }, // Example for a 10-digit phone number
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true, // Ensure emails are stored in lowercase
    },
    password: { type: String }, // Make sure to hash the password before saving
    preferred_time: {
      type: String,
      enum: ['morning', 'afternoon', 'evening', 'night'],
    },
    age: {
      type: Number,
      min: [16, 'Minimum age 16'],
      max: [100, 'Age must be at most 100'],
    },
    role: {
      type: String,
      enum: ['moderator', 'owner', 'customer', 'admin'],
    },
    upi_id: { type: String, trim: true },
  },
  {
    timestamps: true, // This adds `createdAt` and `updatedAt` fields
  }
);

const User = mongoose.model('UserDetails', userSchema);

export default User;
