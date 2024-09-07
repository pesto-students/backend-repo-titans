import mongoose from 'mongoose';

// Define Slot Schema if not already defined
const slotSchema = new mongoose.Schema(
  {
    from: { type: String, required: true }, // Time in "HH:MM" format
    to: { type: String, required: true }, // Time in "HH:MM" format
  },
  { _id: false }
); // Disable _id for subdocuments

// Define Schedule Schema
const scheduleSchema = new mongoose.Schema(
  {
    frequency: { type: String, enum: ['weekly', 'monthly'], default: 'weekly' }, // Frequency flag
    slots: {
      Monday: [slotSchema],
      Tuesday: [slotSchema],
      Wednesday: [slotSchema],
      Thursday: [slotSchema],
      Friday: [slotSchema],
      Saturday: [slotSchema],
      Sunday: [slotSchema],
    },
  },
  { _id: false }
); // Disable _id for subdocuments to avoid unnecessary fields

// Gym Schema
const gymSchema = new mongoose.Schema(
  {
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserDetails',
      required: true,
    },
    gym_name: { type: String, required: true },
    map_detail: {
      type: { type: String, default: 'Point' },
      coordinates: { type: [Number], index: '2dsphere' }, // Geospatial index
    },
    address: {
      address_line_1: { type: String, required: true },
      address_line_2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: Number, required: true },
    },
    description: { type: String },
    images: { type: [String] },
    facilities: { type: [String] },
    gst_number: { type: String, required: true },
    price: { type: Number, required: true },
    schedule: scheduleSchema, // Use scheduleSchema here
    average_rating: { type: Number },
    total_ratings: { type: Number },
    total_occupancy: { type: Number, required: true },
    booking_id: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'BookingDetails' },
    ],
    blocked_date: [{ type: Date }], // Dates owner doesn't want bookings
    status: {
      type: String,
      enum: ['active', 'inactive', 'rejected'],
      default: 'inactive',
    },
    req_creation_Date: { type: Date, required: true },
  },
  {
    timestamps: true, // This adds `createdAt` and `updatedAt` fields
  }
);

const Gyms = mongoose.model('GymDetails', gymSchema);
export default Gyms;
