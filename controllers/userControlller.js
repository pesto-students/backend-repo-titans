import Bookings from '../models/BookingSchema.js';
import Gyms from '../models/GymSchema.js';
import moment from 'moment';
import User from '../models/UserSchema.js';
import mongoose from 'mongoose';
import validator from 'validator';

export const getUserById = async (req, res) => {
  try {
    const { _id } = req.user;

    // Validate if _id is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(_id).select(
      '-_id full_name profile_image email phone_number age preferred_time'
    );

    res.status(200).json({ message: 'User data retrieved successfully', user });
  } catch (error) {
    console.error('Error retrieving user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const updateUserById = async (req, res) => {
  try {
    // Check if files are uploaded and extract image URL
    const imageUrl = req.files && req.files[0] ? req.files[0].location : null;

    // Merge imageUrl with existing request body
    const updatedBody = {
      ...req.body,
      ...(imageUrl && { profile_image: imageUrl }), // Only add profile_image if imageUrl exists
    };

    // Validate email if it exists
    if (updatedBody.email && !validator.isEmail(updatedBody.email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    // Validate phone number if it exists
    if (
      updatedBody.phone_number &&
      !validator.isMobilePhone(updatedBody.phone_number, 'en-IN')
    ) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    // Validate UPI ID if it exists
    if (updatedBody.upi_id && !updatedBody.upi_id.includes('@')) {
      return res
        .status(400)
        .json({ message: 'Invalid UPI ID. Must contain "@"' });
    }

    // Validate if req.user._id is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.user._id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Update user details
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id },
      { $set: updatedBody },
      { new: true, runValidators: true }
    ).select(
      '-_id full_name profile_image email phone_number age preferred_time'
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'User details updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: {
          global: 'Validation error.',
          details: error.errors,
        },
      });
    }
    if (error.name === 'CastError') {
      return res.status(400).json({
        error: {
          global: 'Invalid data type or value',
          details: error.errors,
        },
      });
    }

    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

export const getUserAllBookings = async (req, res) => {
  try {
    // console.log('Received request to fetch user bookings');

    const user_id = req.user._id;

    // Validate if req.user._id is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(user_id)) {
      // console.log('Invalid user ID:', user_id);
      return res.status(400).json({ message: 'Invalid user' });
    }

    // Find all bookings for this user
    // console.log('Fetching bookings for user:', user_id);
    const bookings = await Bookings.find({
      user_id: user_id,
      status: { $ne: 'cancelled' },
    })
      .sort({ date: 1 })
      .populate('gym_id')
      .exec();

    // console.log('Fetched bookings:', bookings);

    if (!bookings || bookings.length === 0) {
      // console.log('No bookings found for this user');
      return res.status(200).json({
        bookingsWithGymName: bookings,
        message: `No bookings found for this user!`,
      });
    }

    // Format bookings with gym names
    // console.log('Formatting bookings with gym names');
    const bookingsWithGymName = bookings.map((booking) => {
      const {
        user_id,
        gym_id,
        extensionId,
        __v,
        totalPrice,
        gym_name,
        from,
        to,
        status,
        ...rest
      } = booking.toObject(); // Exclude user_id, gym_id, and __v

      // Format the date using moment
      const formattedDate = moment(booking.date).format('DD-MM-YYYY');

      return {
        ...rest,
        date: formattedDate, // Add formatted date
        gym: booking?.gym_id?.gym_name || 'Unknown Gym', // Add gym_name
        from: from, // Rename totalprice to price
        to: to, // Rename totalprice to price
        price: totalPrice, // Rename totalprice to price
        status: status, // Rename totalprice to price
      };
    });

    // console.log('Formatted bookings:', bookingsWithGymName);

    res.status(200).json({ bookingsWithGymName });
  } catch (error) {
    console.error('Error fetching user bookings:', error.message);
    res
      .status(500)
      .json({ message: 'An error occurred while fetching bookings.' });
  }
};

export const getGymImageByDate = async (req, res) => {
  try {
    const userID = req.user._id; // Extract userID from the request
    const { date, page = 1, limit = 5 } = req.query; // Added pagination parameters

    if (!date) {
      return res
        .status(400)
        .json({ message: 'Date query parameter is required.' });
    }

    // Validate date format
    if (!moment(date, 'DD/MM/YYYY', true).isValid()) {
      return res
        .status(400)
        .json({ message: 'Invalid date format. Use DD/MM/YYYY.' });
    }

    // Convert the date from 'DD/MM/YYYY' to a JavaScript Date object
    const [day, month, year] = date.split('/').map(Number);
    const startDate = moment([year, month - 1, day])
      .startOf('day')
      .toDate();
    const endDate = moment(startDate).endOf('day').toDate();

    // Find bookings for the user on the specified date with pagination
    const bookings = await Bookings.find({
      date: { $gte: startDate, $lt: endDate },
      user_id: userID,
      status: { $ne: 'cancelled' },
    })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .select('gym_id');

    if (bookings.length === 0) {
      return res
        .status(404)
        .json({ message: 'No bookings found for the given date.' });
    }

    // Extract gym IDs from the bookings
    const gymIds = bookings.map((booking) => booking.gym_id);

    // Find gyms that match the gym IDs
    const gyms = await Gyms.find({
      _id: { $in: gymIds },
    }).select('images');

    // Map gyms to their image URLs
    const gymImages = gyms.map((gym) => ({
      gym_id: gym._id,
      image_urls: gym.images || [], // Ensure image_urls is always an array
    }));

    // Combine booking information with gym image URLs
    const bookingsWithImages = bookings.map((booking) => ({
      gym_id: booking.gym_id,
      image_urls:
        gymImages.find((image) => image.gym_id.equals(booking.gym_id))
          ?.image_urls || [],
    }));

    res.status(200).json({
      bookingsWithImages,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(
          (await Bookings.countDocuments({
            date: { $gte: startDate, $lt: endDate },
            user_id: userID,
          })) / limit
        ),
      },
    });
  } catch (error) {
    console.error('Error fetching gym images by date:', error.message);
    res
      .status(500)
      .json({ message: 'Internal Server Error', error: error.message });
  }
};

export const getGymOwnedByUser = async (req, res) => {
  const { _id } = req.user;
  const role = req.role;

  // Ensure user has owner privileges
  if (role !== 'owner') {
    return res
      .status(403)
      .json({ success: false, message: 'Unauthorized User' });
  }

  try {
    // Find the gym owned by the user and select specific fields
    const gym = await Gyms.findOne({ owner_id: _id }).select(
      'gym_name description address price total_occupancy gst_number images facilities map_detail'
    ); // Specify the fields to return

    if (!gym) {
      return res.status(404).json({ message: 'Gym not found' });
    }

    // Format the response to include only the required fields
    const response = {
      gym_name: gym.gym_name,
      address: {
        address_line_1: gym.address.address_line_1,
        address_line_2: gym.address.address_line_2,
        city: gym.address.city,
        state: gym.address.state,
        pincode: gym.address.pincode,
      },
      description: gym.description,
      price: gym.price,
      total_occupancy: gym.total_occupancy,
      gst_number: gym.gst_number,
      facilities: gym.facilities,
      images: gym.images,
      map_detail: gym.map_detail,
    };
    return res.status(200).json({ message: 'successful', ...response });
  } catch (error) {
    console.error('Error fetching gym:', error.message);
    return res
      .status(500)
      .json({ message: 'Internal Server Error', error: error.message });
  }
};

export const deleteUserProfileImage = async (req, res) => {
  const { _id } = req.user;

  // Validate if _id is a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  try {
    // Find the user by _id and update the profile_image field to null
    const user = await User.findByIdAndUpdate(
      _id,
      { profile_image: null }, // Set profile_image to null to "delete" it
      { new: true } // Return the updated user document
    );

    // If user is not found
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return a success response
    return res.status(200).json({
      message: 'Profile image deleted successfully',
      user, // Optionally return the updated user document
    });
  } catch (error) {
    // Handle any potential errors
    return res.status(500).json({
      message: 'An error occurred while deleting the profile image',
      error: error.message,
    });
  }
};
