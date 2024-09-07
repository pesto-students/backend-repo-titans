import mongoose from 'mongoose';
const extendSchema = new mongoose.Schema(
  {
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BookingDetails',
      required: true,
    },
    duration: { type: Number, required: true },
    status: {
      type: String,
      enum: ['approved', 'cancelled', 'pending'],
      default: 'pending',
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserDetails',
      required: true,
    },
  },
  {
    timestamps: true, // This adds `createdAt` and `updatedAt` fields
  }
);

const Extend = mongoose.model('ExtendDetails', extendSchema);

export default Extend;
