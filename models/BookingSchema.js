import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    totalPrice: { type: Number },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'pending'],
    },
    rating: { type: Number, min: 1, max: 5 },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserDetails',
      required: true,
    },
    gym_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GymDetails',
      required: true,
    },
    extensionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExtendDetails' }, // Reference to ExtendDetails
  },
  {
    timestamps: true, // This adds `createdAt` and `updatedAt` fields
  }
);

const Bookings = mongoose.model('BookingDetails', bookingSchema);
export default Bookings;
