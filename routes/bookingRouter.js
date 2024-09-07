import express from 'express';
import requireAuth from '../middlewares/requireAuth.js';
import {
  addBookings,
  addExtension,
  addRatings,
  cancelUserBooking,
  updateExtension,
} from '../controllers/bookingController.js';

const bookingRouter = express.Router();

bookingRouter.post('/', requireAuth, addBookings);

// To cancell the booking , only allowed till prior 30 mins (Customer)
bookingRouter.patch('/cancel', requireAuth, cancelUserBooking);

// To request extension to gym owners from the user (Customer)
bookingRouter.post('/extends', requireAuth, addExtension);

// To approve or deny the extension request (Owner)
bookingRouter.patch('/extends', requireAuth, updateExtension);

// Create Rating and Update Gym's Average Rating and Booking Document (Customer)
bookingRouter.patch('/ratings', requireAuth, addRatings);

export default bookingRouter;
