import cron from 'node-cron';
import moment from 'moment';
import Bookings from '../models/BookingSchema.js';
import Extend from '../models/ExtendSchema.js';

// Schedule a cron job to run every hour
export const runCronJobs = () => {
  // First Cron Job: Update completed bookings every hour
  cron.schedule('0 * * * *', async () => {
    try {
      // console.log("Running scheduled task to update completed bookings...");

      const now = moment().utc();

      const completedBookings = await Bookings.updateMany(
        {
          to: { $lt: now.format('HH:mm') },
          date: { $lte: now.startOf('day').toDate() },
          status: { $in: ['pending', 'ongoing'] },
        },
        { $set: { status: 'completed' } }
      );

      // console.log(`Updated ${completedBookings.modifiedCount} bookings to 'completed'`);
    } catch (error) {
      console.error('Error updating completed bookings:', error);
    }
  });

  // Second Cron Job: Reject pending extension requests after 60 minutes
  cron.schedule('0 * * * *', async () => {
    try {
      // console.log("Running scheduled task to reject pending extension requests...");

      const now = moment().utc();

      // Find bookings that have passed the 60-minute mark after their end time
      const bookingsToCheck = await Bookings.find({
        to: { $lt: now.subtract(60, 'minutes').format('HH:mm') },
        date: { $lte: now.startOf('day').toDate() },
        extensionId: { $exists: true },
      }).populate('extensionId');

      // Iterate over the bookings and check if the extension request is still pending
      for (const booking of bookingsToCheck) {
        const extension = await Extend.findById(booking.extensionId);
        if (extension && extension.status === 'pending') {
          extension.status = 'cancelled';
          await extension.save();

          // console.log(`Rejected extension request for booking ID ${booking._id}`);
        }
      }
    } catch (error) {
      console.error('Error rejecting pending extension requests:', error);
    }
  });
};
