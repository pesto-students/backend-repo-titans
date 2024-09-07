import User from '../models/UserSchema.js';
import { getPincodeDetails } from 'indian-pincodes';
import { getCordinates } from '../utils/getCordinates.js';
import citiesArray from '../utils/cityLists.js';
import mongoose from 'mongoose';
import Bookings from '../models/BookingSchema.js';
import moment from 'moment';
import {
  getCitiesWithGyms,
  getDistinctCities,
  normalizeDayName,
  validateSlots,
} from '../utils/heperFunctions.js';
import Gyms from '../models/GymSchema.js';
import {
  sortByDistance,
  sortByPrice,
  sortByRating,
  sortByTime,
} from '../utils/searchUtils.js';
import validator from 'validator';
import { sendTemplatedEmail } from '../utils/emailUtils.js';

/*
 * Search gyms by city, latitude, longitude, and maxDistance
 * Example: /gyms?latitude=18.6305414&longitude=73.8152941&sort_by=distance&maxDistance=100000000
 * Example: /gyms?city=Pune&sort_by=distance
 *
 * Example: /gyms?sort_by=price
 * Example: /gyms?sort_by=rating
 * Example: /gyms?sort_by=time
 */
export const searchGyms = async (req, res) => {
  try {
    let {
      city,
      page = 1,
      limit = 10,
      sort_by,
      order_by = 'asc',
      latitude,
      longitude,
      maxDistance = 500000,
    } = req.query;

    const todaysDay = moment().format('dddd');
    // console.log(`Request parameters:`, req.query);

    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    // Prepare query filters, including status and city
    const query = {
      status: 'active', // Only fetch gyms with status 'active'
      ...(city && { 'address.city': new RegExp(city, 'i') }), // Filter by city if provided
    };
    // console.log(`Query filters:`, query);

    let gyms;

    if (sort_by === 'distance') {
      if (!longitude || !latitude) {
        return res.status(400).json({
          message: 'Latitude and longitude are required to sort by distance!',
        });
      }

      // Geospatial Query
      gyms = await Gyms.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)],
            },
            distanceField: 'distance',
            maxDistance: parseFloat(maxDistance) * 1000, // MongoDB uses meters for distance
            spherical: true,
            query: query, // Only fetch active gyms
          },
        },
        {
          $project: {
            _id: 1,
            gym_name: 1,
            'address.city': 1,
            price: 1,
            images: 1,
            average_rating: 1,
            status: 1,
            distance: 1,
            slots: {
              $ifNull: [
                {
                  $filter: {
                    input: `$schedule.slots.${todaysDay}`,
                    as: 'slot',
                    cond: { $ne: ['$$slot', null] },
                  },
                },
                [],
              ],
            },
          },
        },
      ]).exec();

      gyms = sortByDistance(gyms, order_by);
    } else {
      // Fetch all active gyms with basic details
      gyms = await Gyms.find(query, {
        _id: 1,
        gym_name: 1,
        'address.city': 1,
        price: 1,
        images: 1,
        average_rating: 1,
        status: 1,
        schedule: 1,
        description: 1,
      }).exec();

      // Sort by the requested parameter
      if (sort_by === 'price') {
        gyms = sortByPrice(gyms, order_by);
      } else if (sort_by === 'rating') {
        gyms = sortByRating(gyms, order_by);
      } else if (sort_by === 'time') {
        gyms = sortByTime(gyms, order_by);
      }
    }

    // Pagination
    const total = gyms.length;
    const paginatedGyms = gyms.slice(skip, skip + limit);

    // Response
    res.json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / limit),
      gyms: paginatedGyms,
    });
  } catch (error) {
    console.error('Error fetching gyms:', error);
    res
      .status(500)
      .json({ message: 'Internal Server Error.', error: error.message });
  }
};

export const getAllGyms = async (req, res) => {
  try {
    const gyms = await Gyms.find(
      {},
      {
        _id: 1, // gym id
        averageRating: 1,
        gym_name: 1, // gym name
        distance: 1,
        city: 1,
        slots: 1,
        price: 1,
        map_detail: 1, // location
        images: 1,
        address: 1,
        average_rating: 1,
        description: 1,
      }
    );
    res.send(gyms);
  } catch (error) {
    res.status(500).send(error);
  }
};

export const getGymById = async (req, res) => {
  try {
    const { gym_id } = req.params;

    const gymDetails = await Gyms.findById(gym_id)
      .populate({
        path: 'owner_id', // Path to the referenced model
        select: 'email phone_number', // Specify the fields to include
      })
      .select('-req_creation_Date -__v -booking_id -status'); // add necessary fields if needed

    if (!gymDetails || gymDetails.status === 'inactive')
      return res.status(404).json({ message: 'Gym not found' });

    res.status(200).json(gymDetails);
  } catch (error) {
    // console.log(error);

    res.status(500).json({ message: 'Internal Server Error', error: error });
  }
};

export const addGym = async (req, res) => {
  try {
    // console.log('Request received:', req.body);

    const {
      fullName,
      contactInfo,
      gymName,
      upiId,
      gstNumber,
      price,
      description,
      addressLine1,
      addressLine2,
      pincode,
      googleMapsLink,
      facilities,
      maxOccupants,
      agreement,
    } = req.body;
    let { city, state } = req.body;
    // console.log('Parsed request body:', {
    //   fullName,
    //   contactInfo,
    //   gymName,
    //   upiId,
    //   gstNumber,
    //   price,
    //   description,
    //   addressLine1,
    //   addressLine2,
    //   city,
    //   state,
    //   pincode,
    //   googleMapsLink,
    //   facilities,
    //   maxOccupants,
    //   agreement,
    // });
    const userid = req.user._id;
    const ownedgym = await Gyms.findOne({ owner_id: userid });
    if (ownedgym) {
      return res
        .status(400)
        .json({ message: 'User already has a gym own his name' });
    }

    // Validate agreement
    if (agreement !== 'true') {
      // console.log('Agreement validation failed');
      return res.status(400).json({ message: 'Agreement must be signed' });
    }

    // Validate required fields
    let missingFields = [];

    if (!fullName || !validator.isAlpha(fullName.replace(/\s/g, ''))) {
      missingFields.push('fullName');
    }
    if (!contactInfo || !validator.isNumeric(contactInfo.toString())) {
      missingFields.push('contactInfo');
    }
    if (!gymName || !validator.isAlpha(gymName.replace(/\s/g, ''))) {
      missingFields.push('gymName');
    }
    if (!upiId || !validator.isAlphanumeric(upiId.replace(/@/g, ''))) {
      missingFields.push('upiId');
    }
    if (!gstNumber || !validator.isAlphanumeric(gstNumber)) {
      missingFields.push('gstNumber');
    }
    if (!price || !validator.isNumeric(price.toString())) {
      missingFields.push('price');
    }
    if (
      !addressLine1 ||
      !validator.matches(addressLine1, /^[0-9a-zA-Z\s,.'-]+$/)
    ) {
      missingFields.push('addressLine1');
    }
    if (
      addressLine2 &&
      !validator.matches(addressLine2, /^[0-9a-zA-Z\s,.'-]+$/)
    ) {
      missingFields.push('addressLine2');
    }
    if (!city || !validator.isAlpha(city.replace(/\s/g, ''))) {
      missingFields.push('city');
    }
    if (!state || !validator.isAlpha(state.replace(/\s/g, ''))) {
      missingFields.push('state');
    }
    if (!pincode || !validator.isNumeric(pincode.toString())) {
      missingFields.push('pincode');
    }
    if (!googleMapsLink || !validator.isURL(googleMapsLink)) {
      missingFields.push('googleMapsLink');
    }
    if (!facilities) {
      missingFields.push('facilities');
    }
    if (!maxOccupants || !validator.isNumeric(maxOccupants.toString())) {
      missingFields.push('maxOccupants');
    }

    // Check if any fields are missing
    if (missingFields.length > 0) {
      // console.log('Required fields validation failed:', missingFields);
      return res.status(400).json({
        message: `The following required fields must be provided: ${missingFields.join(
          ', '
        )}`,
      });
    }

    // console.log('Validation successful');

    const formattedPincode = getPincodeDetails(Number(pincode));
    city = formattedPincode.name || city;
    state = formattedPincode.state || state;

    // Handle images
    const images = req.files;
    if (!images || images.length === 0) {
      // console.log('Image validation failed');
      return res
        .status(400)
        .json({ message: 'At least one image is required' });
    }
    const imageUrls = images.map((file) => file.location);
    // console.log('Images processed:', imageUrls);

    // Extract latitude and longitude from the Google Maps link
    const { latitude, longitude } = await getCordinates(googleMapsLink);
    // console.log('Coordinates extracted:', { latitude, longitude });

    // Find and update the user
    const user_id = req.user._id;
    // console.log('User ID:', user_id);

    const user = await User.findById(user_id);
    if (!user) {
      // console.log('User not found');
      return res.status(404).json({ message: 'User not found' });
    }

    user.full_name = fullName;
    user.phone_number = Number(contactInfo); // Assumes contactInfo contains only the phone number
    user.upi_id = upiId;
    await user.save();
    // console.log('User details updated:', user);

    // Create a new gym entry
    const newGym = new Gyms({
      owner_id: user_id,
      gym_name: gymName,
      map_detail: {
        coordinates: [longitude, latitude],
      },
      address: {
        address_line_1: addressLine1,
        address_line_2: addressLine2,
        city,
        state,
        pincode,
      },
      description,
      images: imageUrls,
      facilities,
      gst_number: gstNumber,
      price: Number(price),
      total_occupancy: Number(maxOccupants),
      req_creation_Date: new Date(),
    });

    // console.log('New gym entry created:', newGym);

    await newGym.save();
    // console.log('New gym entry saved successfully');

    res.status(201).json({
      token: req.token,
      message: 'Gym details saved successfully. Please wait for the approval.',
    });
  } catch (error) {
    console.error('Error adding gym:', error);
    res
      .status(500)
      .json({ message: 'Failed to onboard gym', error: error.message });
  }
};

export const updateGymById = async (req, res) => {
  try {
    const userId = req.user;
    // console.log('userID: ', userId);

    const role = req.role;
    const {
      fullName,
      contactInfo,
      upiId,
      gymName,
      gstNumber,
      price,
      description,
      addressLine1,
      addressLine2,
      pincode,
      googleMapsLink,
      facilities,
      maxOccupants,
    } = req.body;
    const images = req.files;
    let { city, state } = req.body;
    // Validation
    const errors = [];
    const addressRegex = /^[0-9a-zA-Z\s,.'-]+$/; // Updated regex for address validation

    if (fullName && !validator.isAlpha(fullName.replace(/\s/g, ''))) {
      errors.push('Full name must contain only letters and spaces.');
    }
    if (contactInfo && !validator.isNumeric(contactInfo.toString())) {
      errors.push('Contact info must be a number.');
    }
    if (upiId && !validator.isAlphanumeric(upiId.replace(/@/g, ''))) {
      errors.push('UPI ID must be alphanumeric.');
    }
    if (gymName && !validator.isAlpha(gymName.replace(/\s/g, ''))) {
      errors.push('Gym name must contain only letters and spaces.');
    }
    if (gstNumber && !validator.isAlphanumeric(gstNumber)) {
      errors.push('GST Number must be alphanumeric.');
    }
    if (price && !validator.isNumeric(price.toString())) {
      errors.push('Price must be a number.');
    }
    if (addressLine1 && !addressRegex.test(addressLine1)) {
      errors.push('Address Line 1 must be a valid address format.');
    }
    if (addressLine2 && !addressRegex.test(addressLine2)) {
      errors.push('Address Line 2 must be a valid address format.');
    }
    if (city && !validator.isAlpha(city.replace(/\s/g, ''))) {
      errors.push('City must contain only letters and spaces.');
    }
    if (state && !validator.isAlpha(state.replace(/\s/g, ''))) {
      errors.push('State must contain only letters and spaces.');
    }
    if (pincode && !validator.isNumeric(pincode.toString())) {
      errors.push('Pincode must be a number.');
    }
    if (googleMapsLink && !validator.isURL(googleMapsLink)) {
      errors.push('Google Maps link must be a valid URL.');
    }
    if (facilities && !Array.isArray(facilities)) {
      errors.push('Facilities must be an array.');
    }
    if (maxOccupants && !validator.isNumeric(maxOccupants.toString())) {
      errors.push('Max occupants must be a number.');
    }

    if (pincode) {
      const formattedPincode = getPincodeDetails(Number(pincode));

      city = formattedPincode?.name;
      state = formattedPincode?.state;

      if (!city || !state) {
        errors.push('Please enter a valid pincode.');
      }

      // console.log('city : ', city);
      // console.log('state : ', state);
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      // console.log(errors);
      return res.status(400).json({ errors });
    }

    // Find the gym by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the gym by ID
    const gym = await Gyms.findOne({ owner_id: user._id });
    if (!gym) {
      return res.status(404).json({ message: 'Gym not found' });
    }

    // Ensure that the user is the owner of the gym or has the proper role to update it
    if (gym.owner_id.toString() !== user._id.toString() && role !== 'owner') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Update Owner profile details only if provided in the request
    if (fullName) user.full_name = fullName;
    if (contactInfo) user.phone_number = Number(contactInfo);
    if (upiId) user.upi_id = upiId;

    await user.save();

    // Update gym details only if provided in the request
    if (gymName) gym.gym_name = gymName;
    if (description) gym.description = description;
    if (addressLine1) gym.address.address_line_1 = addressLine1;
    if (addressLine2) gym.address.address_line_2 = addressLine2;
    if (city) gym.address.city = city;
    if (state) gym.address.state = state;
    if (pincode) gym.address.pincode = pincode;
    if (price) gym.price = Number(price);
    if (maxOccupants) gym.total_occupancy = Number(maxOccupants);
    if (gstNumber) gym.gst_number = gstNumber;
    if (facilities) gym.facilities = facilities;

    if (googleMapsLink) {
      // Extract latitude and longitude from the Google Maps link
      const { latitude, longitude } = await getCordinates(googleMapsLink);
      gym.map_detail = {
        coordinates: [longitude, latitude],
      };
    }

    if (images && images.length > 0) {
      // Update the image URLs if new images are provided
      const imageUrls = images.map((file) => file.location);
      gym.images = imageUrls;
    }

    await gym.save();

    res.status(200).json({
      message: 'Gym details updated successfully.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update gym', error });
  }
};

export const resubmitGym = async (req, res) => {
  try {
    const userId = req.user;
    // console.log('userID: ', userId);

    const role = req.role;
    const {
      fullName,
      contactInfo,
      upiId,
      gymName,
      gstNumber,
      price,
      description,
      addressLine1,
      addressLine2,
      pincode,
      googleMapsLink,
      facilities,
      maxOccupants,
    } = req.body;
    const images = req.files;
    let { city, state } = req.body;
    // Validation
    const errors = [];
    const addressRegex = /^[0-9a-zA-Z\s,.'-]+$/; // Updated regex for address validation

    if (fullName && !validator.isAlpha(fullName.replace(/\s/g, ''))) {
      errors.push('Full name must contain only letters and spaces.');
    }
    if (contactInfo && !validator.isNumeric(contactInfo.toString())) {
      errors.push('Contact info must be a number.');
    }
    if (upiId && !validator.isAlphanumeric(upiId.replace(/@/g, ''))) {
      errors.push('UPI ID must be alphanumeric.');
    }
    if (gymName && !validator.isAlpha(gymName.replace(/\s/g, ''))) {
      errors.push('Gym name must contain only letters and spaces.');
    }
    if (gstNumber && !validator.isAlphanumeric(gstNumber)) {
      errors.push('GST Number must be alphanumeric.');
    }
    if (price && !validator.isNumeric(price.toString())) {
      errors.push('Price must be a number.');
    }
    if (addressLine1 && !addressRegex.test(addressLine1)) {
      errors.push('Address Line 1 must be a valid address format.');
    }
    if (addressLine2 && !addressRegex.test(addressLine2)) {
      errors.push('Address Line 2 must be a valid address format.');
    }
    if (city && !validator.isAlpha(city.replace(/\s/g, ''))) {
      errors.push('City must contain only letters and spaces.');
    }
    if (state && !validator.isAlpha(state.replace(/\s/g, ''))) {
      errors.push('State must contain only letters and spaces.');
    }
    if (pincode && !validator.isNumeric(pincode.toString())) {
      errors.push('Pincode must be a number.');
    }
    if (googleMapsLink && !validator.isURL(googleMapsLink)) {
      errors.push('Google Maps link must be a valid URL.');
    }
    if (facilities && !Array.isArray(facilities)) {
      errors.push('Facilities must be an array.');
    }
    if (maxOccupants && !validator.isNumeric(maxOccupants.toString())) {
      errors.push('Max occupants must be a number.');
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      // console.log(errors);
      return res.status(400).json({ errors });
    }

    if (pincode) {
      const formattedPincode = getPincodeDetails(Number(pincode));
      city = formattedPincode.name;
      state = formattedPincode.state;
      // console.log('city : ', city);
      // console.log('state : ', state);
    }

    // Find the gym by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the gym by ID
    const gym = await Gyms.findOne({ owner_id: user._id });
    if (!gym) {
      return res.status(404).json({ message: 'Gym not found' });
    }

    // Ensure that the user is the owner of the gym or has the proper role to update it
    if (gym.owner_id.toString() !== user._id.toString() && role !== 'owner') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Update Owner profile details only if provided in the request
    if (fullName) user.full_name = fullName;
    if (contactInfo) user.phone_number = Number(contactInfo);
    if (upiId) user.upi_id = upiId;

    await user.save();

    // Update gym details only if provided in the request
    if (gymName) gym.gym_name = gymName;
    if (description) gym.description = description;
    if (addressLine1) gym.address.address_line_1 = addressLine1;
    if (addressLine2) gym.address.address_line_2 = addressLine2;
    if (city) gym.address.city = city;
    if (state) gym.address.state = state;
    if (pincode) gym.address.pincode = pincode;
    if (price) gym.price = Number(price);
    if (maxOccupants) gym.total_occupancy = Number(maxOccupants);
    if (gstNumber) gym.gst_number = gstNumber;
    if (facilities) gym.facilities = facilities;

    if (googleMapsLink) {
      // Extract latitude and longitude from the Google Maps link
      const { latitude, longitude } = await getCordinates(googleMapsLink);
      gym.map_detail = {
        coordinates: [longitude, latitude],
      };
    }

    if (images && images.length > 0) {
      // Update the image URLs if new images are provided
      const imageUrls = images.map((file) => file.location);
      gym.images = imageUrls;
    }
    gym.status = 'inactive';
    await gym.save();

    res.status(200).json({
      message: 'Gym details updated successfully.',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update gym', error });
  }
};

export const deactivateGym = async (req, res) => {
  try {
    const gym = await Gyms.findById(req.params.id);
    if (!gym) {
      return res.status(404).send();
    }
    gym.status = 'inactive';
    await gym.save();
    res.send(gym);
  } catch (error) {
    res.status(500).send(error);
  }
};

export const getUpcomingBookingsForGym = async (req, res) => {
  try {
    const userID = req.user._id;
    const objectId = new mongoose.Types.ObjectId(userID);
    const { role } = req;

    if (role !== 'owner') {
      return res.status(401).json({ message: 'Unauthorized user' });
    }

    // Find the gym that belongs to the current user
    const gym = await Gyms.findOne({ owner_id: objectId });

    if (!gym) {
      return res
        .status(404)
        .json({ message: 'Gym not found for the current user.' });
    }

    // Get today's date using moment
    const today = moment().startOf('day').toDate();

    // Find all bookings for the gym that are in the future
    const bookings = await Bookings.find({
      gym_id: gym._id,
      date: { $gte: today }, // Find bookings where the date is today or in the future
    })
      .sort({ date: 1, from: 1, to: 1 }) // Sort by date and slot time in ascending order
      .populate('user_id', 'full_name phone_number'); // Populate user's full_name and phone_number

    if (bookings.length === 0) {
      return res.status(404).json({ message: 'No upcoming bookings.' });
    }

    // Transform the bookings to include only the necessary fields
    const formattedBookings = bookings.map((booking) => ({
      booking_id: booking._id,
      date: moment(booking.date).format('DD-MM-YYYY'), // Format the date as dd/mm/yy
      customer: booking.user_id.full_name, // Extract the user's full name
      slot: `${booking.from} - ${booking.to}`,
      mobile: booking.user_id.phone_number, // Extract the user's contact info
    }));

    return res.status(200).json({
      message: 'Upcoming bookings fetched successfully',
      bookings: formattedBookings,
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return res
      .status(500)
      .json({ message: 'Internal Server Error', error: error.message });
  }
};

export const getGymStats = async (req, res) => {
  try {
    const user_id = req.user._id;
    const { role } = req;

    // console.log(user_id);
    // console.log(role);

    if (role !== 'owner') {
      return res.status(401).json({ message: 'unauthorized Access' });
    }

    // Ensure the userId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(user_id)) {
      return res.status(400).json({ message: 'Invalid User ID' });
    }

    // Find the gym where the owner_id matches the user_id
    const gym = await Gyms.findOne({ owner_id: user_id });
    if (!gym) {
      return res.status(404).json({ message: 'Gym not found' });
    }

    const gym_id = gym._id;

    // Get the current date and calculate the start and end dates for the current and previous week
    const now = moment();
    const startOfWeek = now.clone().startOf('week').add(1, 'days').toDate(); // Monday of the current week
    const endOfWeek = now.clone().endOf('week').toDate(); // Sunday of the current week

    const startOfLastWeek = now
      .clone()
      .subtract(1, 'week')
      .startOf('week')
      .add(1, 'days')
      .toDate(); // Monday of the previous week
    const endOfLastWeek = now
      .clone()
      .subtract(1, 'week')
      .endOf('week')
      .toDate(); // Sunday of the previous week

    // Debug statements to verify date ranges
    // console.log('Current Week:', startOfWeek, endOfWeek);
    // console.log('Previous Week:', startOfLastWeek, endOfLastWeek);

    // Calculate total bookings for the current week
    const totalBookingsCurrent = await Bookings.countDocuments({
      gym_id,
      date: { $gte: startOfWeek, $lte: endOfWeek },
    });

    // Calculate total bookings for the previous week
    const totalBookingsPrevious = await Bookings.countDocuments({
      gym_id,
      date: { $gte: startOfLastWeek, $lte: endOfLastWeek },
    });

    // Calculate total revenue for the current week
    const totalRevenueCurrent = await Bookings.aggregate([
      {
        $match: {
          gym_id: new mongoose.Types.ObjectId(gym_id),
          date: { $gte: startOfWeek, $lte: endOfWeek },
        },
      },
      { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } },
    ]);

    // Calculate total revenue for the previous week
    const totalRevenuePrevious = await Bookings.aggregate([
      {
        $match: {
          gym_id: new mongoose.Types.ObjectId(gym_id),
          date: { $gte: startOfLastWeek, $lte: endOfLastWeek },
        },
      },
      { $group: { _id: null, totalRevenue: { $sum: '$totalPrice' } } },
    ]);

    // Calculate total hours for the current week
    const totalHoursCurrent = await Bookings.aggregate([
      {
        $match: {
          gym_id: new mongoose.Types.ObjectId(gym_id),
          date: { $gte: startOfWeek, $lte: endOfWeek },
        },
      },
      {
        $group: {
          _id: null,
          totalHours: {
            $sum: {
              $divide: [
                {
                  $subtract: [
                    {
                      $toDate: { $concat: ['2024-01-01T', '$to', ':00.000Z'] },
                    },
                    {
                      $toDate: {
                        $concat: ['2024-01-01T', '$from', ':00.000Z'],
                      },
                    },
                  ],
                },
                3600000, // Convert milliseconds to hours
              ],
            },
          },
        },
      },
    ]);

    // Calculate total hours for the previous week
    const totalHoursPrevious = await Bookings.aggregate([
      {
        $match: {
          gym_id: new mongoose.Types.ObjectId(gym_id),
          date: { $gte: startOfLastWeek, $lte: endOfLastWeek },
        },
      },
      {
        $group: {
          _id: null,
          totalHours: {
            $sum: {
              $divide: [
                {
                  $subtract: [
                    {
                      $toDate: { $concat: ['2024-01-01T', '$to', ':00.000Z'] },
                    },
                    {
                      $toDate: {
                        $concat: ['2024-01-01T', '$from', ':00.000Z'],
                      },
                    },
                  ],
                },
                3600000, // Convert milliseconds to hours
              ],
            },
          },
        },
      },
    ]);

    // Calculate total unique users for the current week
    const totalUniqueUsersCurrent = await Bookings.distinct('user_id', {
      gym_id,
      date: { $gte: startOfWeek, $lte: endOfWeek },
    });

    // Calculate total unique users for the previous week
    const totalUniqueUsersPrevious = await Bookings.distinct('user_id', {
      gym_id,
      date: { $gte: startOfLastWeek, $lte: endOfLastWeek },
    });

    // Calculate growth percentages
    const calculateGrowthPercentage = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      const growthPercentage = ((current - previous) / previous) * 100;
      return Number(growthPercentage.toFixed(2));
    };

    const response = {
      totalBookings: {
        current: totalBookingsCurrent,
        growthPercentage: calculateGrowthPercentage(
          totalBookingsCurrent,
          totalBookingsPrevious
        ),
      },
      totalRevenue: {
        current: totalRevenueCurrent[0]?.totalRevenue || 0,
        growthPercentage: calculateGrowthPercentage(
          totalRevenueCurrent[0]?.totalRevenue || 0,
          totalRevenuePrevious[0]?.totalRevenue || 0
        ),
      },
      totalHours: {
        current: totalHoursCurrent[0]?.totalHours || 0,
        growthPercentage: calculateGrowthPercentage(
          totalHoursCurrent[0]?.totalHours || 0,
          totalHoursPrevious[0]?.totalHours || 0
        ),
      },
      totalUniqueUsers: {
        current: totalUniqueUsersCurrent.length,
        growthPercentage: calculateGrowthPercentage(
          totalUniqueUsersCurrent.length,
          totalUniqueUsersPrevious.length
        ),
      },
    };

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const addNewSchedule = async (req, res) => {
  try {
    // Extract user ID from the request (assuming auth middleware adds user info to req)
    const user_id = req.user._id;

    // Find the gym owned by this user
    const gym = await Gyms.findOne({ owner_id: user_id });

    if (!gym) {
      return res.status(404).json({ message: 'Gym not found for this user' });
    }

    // Get schedule details from the request body
    const { frequency, slots } = req.body;

    // Validate frequency
    const validFrequencies = ['daily', 'weekly']; // Adjust as needed
    if (!validFrequencies.includes(frequency)) {
      return res.status(400).json({ message: 'Invalid frequency' });
    }

    // Validate slots for each day
    const validationErrors = [];
    for (const day in slots) {
      const daySlots = slots[day];
      const errors = validateSlots(daySlots);

      if (errors.length > 0) {
        validationErrors.push({
          day,
          errors,
        });
      }
    }

    // If there are validation errors, return them
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Schedule validation failed',
        errors: validationErrors,
      });
    }

    // If validation passes, normalize the day names and save the schedule
    const normalizedSlots = {};
    for (const day in slots) {
      const normalizedDay = normalizeDayName(day);
      normalizedSlots[normalizedDay] = slots[day];
    }

    // Initialize the schedule if it does not exist
    const updatedSchedule = gym.schedule || { frequency: 'weekly', slots: {} };

    // Update the slots and frequency
    updatedSchedule.slots = { ...updatedSchedule.slots, ...normalizedSlots };
    updatedSchedule.frequency = frequency;

    // Save the updated gym document
    gym.schedule = updatedSchedule;
    await gym.save();

    res.status(200).json({ message: 'Schedule updated successfully' });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

export const getPopularGyms = async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.query;

    // Ensure latitude and longitude are provided
    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ message: 'Latitude and longitude are required' });
    }

    // Set a default radius if not provided
    const radiusNum = radius ? parseFloat(radius) : 100; // Default to 100 km if no radius is provided

    // Fetch gyms with valid map details
    const gyms = await Gyms.find({
      'map_detail.coordinates[1]': { $exists: true },
      'map_detail.cooridnates[0]': { $exists: true },
    });

    // console.log(gyms);

    // Calculate distance and popularity score
    const gymsWithScores = gyms
      .map((gym) => {
        const distance = haversineDistance(
          latitude,
          longitude,
          gym.map_detail.coordinates[1],
          gym.map_detail.coordinates[0]
        );

        // Skip gyms outside the radius
        if (distance > radiusNum) return null;

        // Popularity score calculation (customize as needed)
        const popularityScore =
          (gym.total_occupancy || 0) +
          (gym.average_rating || 0) * 10 +
          (gym.total_occupancy || 0) * 0.5;

        return {
          gym_id: gym._id,
          gym_name: gym.gym_name,
          average_rating: gym.average_rating,
          distance, // Optional, for additional context
          popularityScore, // Optional, for additional context
        };
      })
      .filter((gym) => gym !== null);

    // Sort by popularity score in descending order
    gymsWithScores.sort((a, b) => b.popularityScore - a.popularityScore);

    // Respond with only the required details
    res.json(
      gymsWithScores.map(({ gym_id, gym_name, average_rating }) => ({
        gym_id,
        gym_name,
        average_rating,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Route handler for getting cities with gyms
export const getCitiesForGyms = async (req, res) => {
  try {
    let distinctCities = getDistinctCities(citiesArray);

    // Filter out any cities without a name before sorting
    distinctCities = distinctCities.filter((city) => city.name);

    // Get cities where gyms are present
    distinctCities = await getCitiesWithGyms(distinctCities);

    // Sort the distinct cities in ascending order by name
    distinctCities.sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json(distinctCities);
  } catch (error) {
    return res
      .status(500)
      .json({ message: 'Server error', error: error.message });
  }
};

//get gyms with pending status to approve for admin/moderator only
/* http://localhost:3000/gyms/admin/pending?limit=1 
 Parameters:
  •	limit: Number of gyms per page (default is 5). Example: ?limit=1
  •	page: Page number for pagination. Example: ?page=2
  •	search: Search by gym name or id (case-insensitive) or valid ObjectId. Example: ?search=GymName or ?search=2123asdasd
  •	Examples:
  •	Get one gym: GET /gyms/admin/pending?limit=1
  •	Paginate: GET /gyms/admin/pending?page=2
  •	Search: GET /gyms/admin/pending?search=GymName or gymId
*/
export const getPendingGyms = async (req, res) => {
  try {
    const { search, page = 1, limit = 5 } = req.query;
    const role = req.role;

    // Ensure user has admin privileges
    if (role !== 'admin' && role !== 'customer') {
      return res
        .status(403)
        .json({ success: false, message: 'Unauthorized User' });
    }

    // Define search criteria for pending gyms
    const searchCriteria = {
      status: 'inactive', // Assuming 'inactive' represents pending gyms
    };

    // Modify search criteria if a search query is provided
    if (search) {
      searchCriteria.$or = [
        { gym_name: new RegExp(search, 'i') }, // Case-insensitive search by gym name
      ];

      // If the search string is a valid ObjectId, add it to the criteria
      if (mongoose.Types.ObjectId.isValid(search)) {
        searchCriteria.$or.push({ _id: search });
      }
    }

    // Fetch total count of gyms that match the criteria
    const totalGyms = await Gyms.countDocuments(searchCriteria);

    // Calculate the total number of pages
    const totalPages = Math.ceil(totalGyms / limit);

    // Fetch the gyms based on the criteria, excluding specific fields, with pagination
    const gyms = await Gyms.find(searchCriteria)
      .sort({ req_creation_Date: 1 }) // Oldest requests first
      .select(
        '-schedule -total_ratings -average_rating -__v -blocked_date -price -facilities -owner_id -booking_id'
      ) // Exclude fields
      .populate('owner_id', 'full_name email phone_number upi_id -_id ')
      .skip((page - 1) * limit) // Skip gyms based on the current page
      .limit(parseInt(limit)); // Limit to the number of gyms per page

    // Respond with the gyms and pagination details
    return res.status(200).json({
      success: true,
      pagination: {
        totalGyms,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit),
      },
      data: gyms.map((gym) => {
        // Reorder the gym object so that gym_name appears right after _id
        const { _id, gym_name, ...rest } = gym.toObject();
        return { _id, gym_name, ...rest };
      }),
    });
  } catch (error) {
    console.error('Error fetching pending gyms:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

export const respondToGymForm = async (req, res) => {
  try {
    const { gym_id } = req.params;
    const { status, reason } = req.body; // New status from the request body
    const role = req.role;

    if (role !== 'admin' && role !== 'customer') {
      return res
        .status(400)
        .json({ success: false, message: 'Unauthorized User' });
    }

    if (!gym_id || !status) {
      return res
        .status(400)
        .json({ success: false, message: 'Gym ID and status are required' });
    }

    if (status !== 'approve' && status !== 'reject') {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be "approve" or "reject"',
      });
    }

    const statusToSave = status === 'approve' ? 'active' : 'rejected';

    const updatedGym = await Gyms.findByIdAndUpdate(
      gym_id,
      { status: statusToSave },
      { new: true }
    );

    const emailGym = await Gyms.findById(gym_id).populate('owner_id', 'email');
    const emailID = emailGym.owner_id.email;
    // console.log("email ID : ", emailID);

    const reasonArray =
      typeof reason === 'string' && reason.length > 0
        ? reason
            .split('.')
            .map((sentence) => sentence.trim())
            .filter((sentence) => sentence.length > 0)
        : []; // Default to an empty array if reason is not valid

    // console.log("reasonArray : ", reasonArray);

    if (statusToSave == 'rejected') {
      await sendTemplatedEmail(emailID, 'resubmission', {
        reason: reasonArray,
        userName: emailID,
      });
    }

    if (statusToSave == 'active') {
      await sendTemplatedEmail(emailID, 'approval', { userName: emailID });
    }

    if (!updatedGym) {
      return res.status(404).json({ success: false, message: 'Gym not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Gym status updated successfully',
      gymId: updatedGym._id,
      updatedStatus: updatedGym.status,
    });
  } catch (error) {
    console.error('Error updating gym status:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};
