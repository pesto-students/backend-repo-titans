import moment from 'moment';
import Gyms from '../models/GymSchema.js';
import Extend from '../models/ExtendSchema.js';
import Bookings from '../models/BookingSchema.js';
import mongoose from 'mongoose';
import validator from 'validator';
import User from '../models/UserSchema.js';

// Create a new booking

export const addBookings = async (req, res) => {
  try {
    // console.log('Received booking request:', req.body);

    const user_id = req.user._id;
    const { date, from, to, totalPrice, gym_id } = req.body;
    const { role } = req;
    // console.log(role);
    if (role == 'owner') {
      return res.status(401).json({
        message: "Owners can't book a session. Create another account",
      });
    }

    const user = await User.findById(user_id);

    if (!user.full_name || !user.phone_number) {
      // console.log('User profile incomplete');
      return res.status(400).json({
        errors: {
          global: 'User profile incomplete',
        },
      });
    }

    // Validate required fields
    if (!date || !from || !to || !gym_id || totalPrice === undefined) {
      // console.log('Validation error: Missing required fields');
      return res.status(400).json({
        errors: {
          global: 'All the fields are required.',
        },
      });
    }

    // Validate date format
    if (!validator.isDate(date, { format: 'DD/MM/YYYY', strictMode: true })) {
      // console.log('Validation error: Invalid date format');
      return res.status(400).json({
        errors: {
          global: 'Invalid date format. Use DD/MM/YYYY.',
        },
      });
    }

    // Validate time format
    const isValidTimeFormat = (time) =>
      validator.matches(time, /^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!isValidTimeFormat(from) || !isValidTimeFormat(to)) {
      // console.log('Validation error: Invalid time format');
      return res.status(400).json({
        errors: {
          global: 'Invalid time format. Use HH:mm.',
        },
      });
    }

    // Validate and round totalPrice
    let parsedTotalPrice = parseFloat(totalPrice);
    if (isNaN(parsedTotalPrice)) {
      // console.log('Validation error: Total price is not a valid number');
      return res.status(400).json({
        errors: {
          global: 'Total price must be a valid number.',
        },
      });
    }
    parsedTotalPrice = Math.round(parsedTotalPrice * 100) / 100; // Round to 2 decimal places
    // console.log('Parsed total price:', parsedTotalPrice);

    const formattedDate = moment(date, 'DD/MM/YYYY').format('YYYY-MM-DD');
    const fromDateTime = moment(`${formattedDate} ${from}`, 'YYYY-MM-DD HH:mm');
    const toDateTime = moment(`${formattedDate} ${to}`, 'YYYY-MM-DD HH:mm');
    const currentDateTime = moment();

    // console.log('Formatted date:', formattedDate);
    // console.log('From date-time:', fromDateTime.format());
    // console.log('To date-time:', toDateTime.format());
    // console.log('Current date-time:', currentDateTime.format());

    if (fromDateTime.isBefore(currentDateTime)) {
      // console.log('Validation error: Attempting to book a session in the past');
      return res.status(400).json({
        errors: {
          global: "Sorry, you can't book a session in the past.",
        },
      });
    }

    if (toDateTime.isBefore(fromDateTime)) {
      // console.log('Validation error: End time is before start time');
      return res.status(400).json({
        errors: {
          global: 'End time cannot be before start time.',
        },
      });
    }

    // Check if the gym exists and is active
    const gym = await Gyms.findById(gym_id);
    if (!gym) {
      // console.log('Error: Gym not found');
      return res.status(404).json({ message: 'Gym not found.' });
    }

    // console.log(`Gym Status: ${gym.status}`);

    if (gym.status !== 'active') {
      // console.log('Error: Gym is not active');
      return res
        .status(400)
        .json({ message: 'Gym is not active. Cannot make bookings.' });
    }

    // Check if the gym has available slots for the given time
    const dayOfWeek = moment(date, 'DD/MM/YYYY').format('dddd');
    const gymSlots = gym.schedule.slots[dayOfWeek] || [];

    const isSlotAvailable = gymSlots.some((slot) => {
      const slotFrom = moment(
        `${formattedDate} ${slot.from}`,
        'YYYY-MM-DD HH:mm'
      );
      const slotTo = moment(`${formattedDate} ${slot.to}`, 'YYYY-MM-DD HH:mm');
      // console.log(
      //   `Checking Slot: From ${slotFrom.format()} To ${slotTo.format()}`
      // );
      return (
        fromDateTime.isSameOrAfter(slotFrom) &&
        toDateTime.isSameOrBefore(slotTo)
      );
    });

    // console.log(`Slot Available: ${isSlotAvailable}`);

    if (!isSlotAvailable) {
      // console.log('Error: No available slots for the given time');
      return res.status(400).json({
        errors: {
          global: 'No available slots for the given time.',
        },
      });
    }

    // Check for overlapping bookings
    const existingBookings = await Bookings.find({
      user_id,
      date: formattedDate,
      $or: [
        { from: { $lte: to }, to: { $gte: from } }, // Overlapping check
      ],
    });

    // console.log('Existing bookings:', existingBookings);

    if (existingBookings.length > 0) {
      // console.log('Error: Overlapping booking found');
      return res.status(400).json({
        errors: {
          global: 'You have an existing booking that overlaps.',
        },
      });
    }

    // Create the new booking
    const newBooking = new Bookings({
      date: formattedDate,
      from,
      to,
      totalPrice: parsedTotalPrice,
      user_id,
      gym_id,
      status: 'scheduled',
    });

    const response = await newBooking.save();

    const formattedResponseDate = moment(newBooking.date).format('DD/MM/YYYY');

    // console.log('Booking created successfully:', response);

    res.status(201).json({
      message: 'Booking created successfully.',
      booking: {
        ...response._doc,
        date: formattedResponseDate, // Replace the date with the formatted version
      },
    });
  } catch (error) {
    // console.log('Error creating booking:', error.message);
    res
      .status(500)
      .json({ message: 'Internal Server Error.', error: error.message });
  }
};

export const addExtension = async (req, res) => {
  try {
    const { bookingId, duration } = req.body;
    const userID = req.user._id;

    // Validate bookingId and duration
    if (!bookingId || !duration) {
      return res.status(400).json({
        errors: {
          message: 'Booking ID and duration are required.',
        },
      });
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        errors: {
          message: 'Invalid Booking ID format.',
        },
      });
    }

    if (typeof duration !== 'number' || duration <= 0) {
      return res.status(400).json({
        errors: {
          message: 'Duration must be a positive number.',
        },
      });
    }

    // Find the booking by ID and populate the gym owner
    const booking = await Bookings.findById(bookingId).populate({
      path: 'gym_id',
      select: 'owner_id',
    });

    if (!booking) {
      return res.status(404).json({
        errors: {
          message: 'Booking not found.',
        },
      });
    }

    // Check if the booking is either "scheduled" or "pending"
    if (booking.status !== 'scheduled' && booking.status !== 'pending') {
      return res.status(400).json({
        errors: {
          message:
            'Extension requests can only be raised for scheduled bookings.',
        },
      });
    }

    // Check if the booking was made by the current user
    if (userID.toString() !== booking.user_id.toString()) {
      return res.status(403).json({
        errors: {
          message: 'Access denied. You cannot extend this booking.',
        },
      });
    }

    // Check if the booking already has an extension
    if (booking.extensionId) {
      return res.status(400).json({
        errors: {
          message: 'Booking already has an extension.',
        },
      });
    }

    // Create a new extension request
    const newExtension = new Extend({
      booking_id: bookingId,
      duration,
      owner_id: booking.gym_id.owner_id,
    });

    // Save the new extension request
    await newExtension.save();

    // Update the booking with the new extension ID
    booking.extensionId = newExtension._id;
    await booking.save();

    // Return a successful response
    return res.status(201).json({
      message: 'Extension request successfully created.',
      owner_id: booking.gym_id.owner_id,
      extension: newExtension,
    });
  } catch (error) {
    console.error('Error creating extension request:', error);
    res.status(500).json({
      errors: {
        global: 'Internal Server Error. Extension request not created.',
        error: error.message,
      },
    });
  }
};

// Update the status of the booking extension request
export const updateExtension = async (req, res) => {
  try {
    const { extensionId, status } = req.body;
    const role = req.role;
    const user_id = req.user._id;

    if (role !== 'owner') {
      return res.status(401).json({
        errors: {
          message:
            'Unauthorized user. Only gym owners can respond to extension requests.',
        },
      });
    }

    // Validate status
    const validStatuses = ['approved', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        errors: {
          message:
            'Invalid status. Only "approved" or "cancelled" statuses are allowed.',
        },
      });
    }

    // Find the extension request
    const extensionRequest = await Extend.findById(extensionId).populate(
      'booking_id'
    );
    if (!extensionRequest) {
      return res.status(404).json({
        errors: {
          message: 'Extension request not found',
        },
      });
    }

    // console.log(extensionRequest.owner_id.toString());
    // console.log(user_id.toString());

    if (extensionRequest.owner_id.toString() !== user_id.toString()) {
      return res.status(401).json({
        errors: {
          message: 'Unauthorized to approve the request',
        },
      });
    }

    // Ensure the booking does not already have an extension before updating the status
    const booking = await Bookings.findById(
      extensionRequest.booking_id._id
    ).populate({
      path: 'gym_id',
      select: 'price owner_id',
    });

    if (!booking) {
      return res.status(404).json({
        errors: {
          message: 'Booking not found',
        },
      });
    }

    if (extensionRequest.status !== 'pending') {
      return res.status(404).json({
        errors: {
          message: 'extension already has a response',
        },
      });
    }
    // Update the extension request status
    extensionRequest.status = status;
    await extensionRequest.save();

    // Update the booking if the request is approved
    if (status === 'approved') {
      // Calculate extension price as 60% of the base price per minute
      // console.log(booking.gym_id);

      const basePricePerMinute = booking.gym_id.price / 60;
      const extensionPrice = (
        extensionRequest.duration * basePricePerMinute
      ).toFixed(2);

      // Update the booking with the new total price and link the extension request
      booking.totalPrice = (
        parseFloat(booking.totalPrice) + parseFloat(extensionPrice)
      ).toFixed(2);
      booking.extensionId = extensionRequest._id;
      await booking.save();
    }

    return res.status(200).json({
      message: `Extension request ${status}.`,
    });
  } catch (error) {
    console.error('Error updating extension request:', error);
    return res.status(500).json({
      errors: {
        global: 'An error occurred while processing the extension request.',
        error: error.message,
      },
    });
  }
};

// Get all bookings extension request for Owner
export const getAllOwnerExtension = async (req, res) => {
  try {
    const user_id = req.user._id;

    // Find all extension requests where owner_id matches the provided user_id
    const extensionRequests = await Extend.find({
      owner_id: user_id,
      status: 'pending',
    })
      .populate({
        path: 'booking_id',
        select: 'user_id date', // Include only the user_id field from BookingDetails
        populate: {
          path: 'user_id',
          select: 'full_name phone_number -_id', // Include full_name and phone_number, exclude _id
        },
      })
      .select('-owner_id -__v');

    // Sort extensionRequests by the date field inside booking_id
    const sortedExtensionRequests = extensionRequests.sort((a, b) => {
      // Ensure booking_id and date are defined before comparing
      const dateA = a.booking_id?.date
        ? new Date(a.booking_id.date)
        : new Date(0); // Default to epoch if not defined
      const dateB = b.booking_id?.date
        ? new Date(b.booking_id.date)
        : new Date(0); // Default to epoch if not defined
      return dateB - dateA; // Ascending order (earliest dates first)
    });

    // Transform the extensionRequests to include user details directly
    const transformedRequests = sortedExtensionRequests.map((extension) => ({
      _id: extension._id,
      customer: extension.booking_id.user_id.full_name, // Extract full_name as name
      mobile: extension.booking_id.user_id.phone_number, // Extract phone_number
      duration: extension.duration + ' mins',
      status: extension.status,
    }));

    // Respond with the list of extension requests
    return res.status(200).json({
      message: 'Extension requests retrieved successfully.',
      extensionRequests: transformedRequests,
    });
  } catch (error) {
    console.error('Internal Server Error:', error);
    res.status(500).json({
      errors: {
        global: '500 Internal Server Error, Extension request not created.',
        error: error,
      },
    });
  }
};

// Create Rating and Update Gym's average Rating and Booking Document
export const addRatings = async (req, res) => {
  try {
    const { booking_id, rating } = req.body;
    const role = req.role;
    const user_id = req.user._id;

    // console.log('Inside ratings');

    // Check user role
    if (role !== 'customer') {
      return res.status(401).json({ message: 'Not an authorized User' });
    }

    // Validate rating value
    if (!booking_id || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Invalid Booking ID or Rating' });
    }

    // Fetch the booking to check the user_id
    const booking = await Bookings.findOne({
      _id: booking_id,
      user_id: user_id,
    }).exec();

    if (!booking) {
      return res.status(404).json({
        message: 'Unauthorized to access Booking or Booking not found',
      });
    }

    const existingRating = booking.rating;

    // Fetch the gym associated with the booking
    const gym = await Gyms.findById(booking.gym_id);
    if (!gym) {
      return res.status(404).json({ message: 'Gym not found' });
    }

    if (existingRating !== undefined) {
      // Update the existing rating
      const totalRatings = gym.total_ratings || 0;
      const currentAverage = gym.average_rating || 0;

      // Calculate the new average rating
      const newAverage =
        (currentAverage * totalRatings - existingRating + rating) /
        totalRatings;

      // Update the gym document with the new average rating
      gym.average_rating = newAverage;

      await gym.save();

      // Update the booking document with the new rating
      booking.rating = rating;
      await booking.save();

      return res.status(200).json({
        message: 'Rating updated and gym average rating adjusted successfully.',
        rating: booking.rating,
      });
    } else {
      // Add a new rating
      const updatedBooking = await Bookings.findOneAndUpdate(
        { _id: booking_id, rating: { $exists: false } },
        { $set: { rating: rating } },
        { new: true }
      );

      if (!updatedBooking) {
        return res
          .status(404)
          .json({ message: 'Booking not found or Rating exists' });
      }

      const totalRatings = gym.total_ratings || 0;
      const currentAverage = gym.average_rating || 0;

      // Calculate the new average rating
      const newAverage =
        (currentAverage * totalRatings + rating) / (totalRatings + 1);

      // Update the gym document with the new average rating and total ratings count
      gym.average_rating = newAverage;
      gym.total_ratings = totalRatings + 1;

      await gym.save();

      return res.status(201).json({
        message: 'Rating added and gym average rating updated successfully.',
        rating: updatedBooking.rating,
      });
    }
  } catch (error) {
    console.error('Error adding rating:', error);
    res
      .status(500)
      .json({ message: 'Internal Server Error.', error: error.message });
  }
};

export const cancelUserBooking = async (req, res) => {
  try {
    // console.log('Inside cancelUserBooking');

    const userID = req.user._id;
    const { bookingId } = req.body;

    // console.log(`Booking ID: ${bookingId}`);

    const bookingobjectId = new mongoose.Types.ObjectId(bookingId);
    const userobjectId = new mongoose.Types.ObjectId(userID);

    const { role } = req;

    if (role !== 'customer') {
      // console.log('Unauthorized user trying to cancel booking');
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Find the booking by ID
    const booking = await Bookings.findById(bookingobjectId);
    if (!booking) {
      // console.log('Booking not found');
      return res.status(404).json({ message: 'Booking not found' });
    }

    // console.log(`Found booking: ${JSON.stringify(booking)}`);

    // Check if the booking belongs to the current user
    if (!booking.user_id.equals(userobjectId)) {
      // console.log("User trying to cancel someone else's booking");
      return res
        .status(403)
        .json({ message: 'You can only cancel your own bookings' });
    }

    // Check if the booking is already cancelled or completed
    if (booking.status === 'cancelled') {
      // console.log('Booking already cancelled');
      return res
        .status(400)
        .json({ message: 'Your booking has already been canceled.' });
    }

    if (booking.status === 'completed') {
      // console.log('Booking already completed');
      return res.status(400).json({
        message:
          'Unfortunately, the booking is completed and cannot be canceled.',
      });
    }

    // Construct the booking DateTime and current DateTime
    const bookingDateTime = moment(booking.date).set({
      hour: parseInt(booking.from.split(':')[0], 10),
      minute: parseInt(booking.from.split(':')[1], 10),
    });
    const currentDateTime = moment().utc();
    // console.log(`Booking DateTime: ${bookingDateTime.format()}`);
    // console.log(`Current DateTime: ${currentDateTime.format()}`);

    // Check if the booking date is in the past
    if (bookingDateTime.isBefore(currentDateTime)) {
      // console.log('Cannot cancel a past booking');
      return res
        .status(400)
        .json({ message: 'Cannot cancel a past date booking' });
    }

    // Check if the booking can be canceled (only allowed until 30 minutes before the start time)
    const thirtyMinutesBefore = bookingDateTime.subtract(30, 'minutes');
    // console.log(`Thirty Minutes Before: ${thirtyMinutesBefore.format()}`);

    if (currentDateTime.isAfter(thirtyMinutesBefore)) {
      // console.log(
      //   'Cannot cancel booking less than 30 minutes before start time'
      // );
      return res.status(400).json({
        message:
          'Cannot cancel a booking less than 30 minutes before the start time',
      });
    }

    // Update the booking status to 'cancelled'
    booking.status = 'cancelled';
    await booking.save();

    // console.log('Booking successfully canceled');
    return res
      .status(200)
      .json({ message: 'Booking has been cancelled', booking });
  } catch (error) {
    console.error('Error canceling booking:', error);
    return res
      .status(500)
      .json({ message: 'Internal Server Error', error: error.message });
  }
};
