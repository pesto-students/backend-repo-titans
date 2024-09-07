import mongoose from 'mongoose';
import User from './models/UserSchema.js'; // Adjust the path as needed
import Gym from './models/GymSchema.js'; // Adjust the path as needed
import Booking from './models/BookingSchema.js'; // Adjust the path as needed
import Rating from './models/RatingSchema.js'; // Adjust the path as needed
import { faker } from '@faker-js/faker';
import connectDB from './config/db.js';
import config from './config/config.js';

connectDB(config.DB_CONFIG.DATABASE);

// Create Users
const createUsers = async (num) => {
  const users = [];
  for (let i = 0; i < num; i++) {
    const user = {
      profile_image: faker.image.avatar(),
      full_name: faker.name.fullName(),
      email: faker.internet.email(),
      password: faker.internet.password(), // Make sure to hash this in the actual implementation
      preferred_time: faker.helpers.arrayElement([
        'morning',
        'afternoon',
        'evening',
        'night',
      ]),
      age: faker.datatype.number({ min: 18, max: 100 }), // Age between 18 and 100
      role: faker.helpers.arrayElement(['moderator', 'owner', 'customer']),
      upi_id: faker.datatype.boolean() ? faker.finance.bic() : null,
    };
    users.push(user);
  }
  return User.insertMany(users);
};

// Create Gyms
const createGyms = async (num, ownerIds) => {
  const gyms = [];
  for (let i = 0; i < num; i++) {
    const gym = {
      owner_id: faker.helpers.arrayElement(ownerIds),
      gym_name: faker.company.name(),
      map_detail: {
        latitude: faker.location.latitude(),
        longitude: faker.location.longitude(),
      },
      address: {
        address_line_1: faker.location.streetAddress(),
        address_line_2: faker.location.secondaryAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        pin_code: parseInt(faker.string.numeric(6), 10),
      },
      description: faker.lorem.sentence(),
      images: Array.from({ length: 3 }, () => faker.image.imageUrl()),
      facilities: faker.helpers.arrayElements([
        'wifi',
        'parking',
        'shower',
        'steam',
        'pool',
      ]),
      gst_number: faker.finance.bic(),
      price: faker.finance.amount(),
      schedule: {
        frequency: faker.helpers.arrayElement(['weekly', 'monthly', 'yearly']),
        slots: {
          Monday: [{ from: '06:00', to: '08:00' }],
          Tuesday: [{ from: '07:00', to: '09:00' }],
          Wednesday: [{ from: '06:00', to: '08:00' }],
          Thursday: [{ from: '07:00', to: '09:00' }],
          Friday: [{ from: '06:00', to: '08:00' }],
          Saturday: [{ from: '08:00', to: '10:00' }],
          Sunday: [{ from: '09:00', to: '11:00' }],
        },
      },
      average_rating: faker.datatype.float({ min: 1, max: 5, precision: 0.1 }),
      total_ratings: faker.datatype.number({ min: 0, max: 100 }),
      total_occupancy: faker.datatype.number({ min: 10, max: 100 }),
      blocked_date: [faker.date.future()],
      status: faker.helpers.arrayElement(['active', 'inactive']),
      req_creation_Date: faker.date.past(),
    };
    gyms.push(gym);
  }
  return Gym.insertMany(gyms);
};

// Create Ratings
const createRatings = async (num, bookingIds) => {
  const ratings = [];
  for (let i = 0; i < num; i++) {
    ratings.push({
      booking_id: faker.helpers.arrayElement(bookingIds),
      rating: faker.datatype.number({ min: 1, max: 5 }),
    });
  }
  return Rating.insertMany(ratings);
};

// Create Bookings
const createBookings = async (num, userIds, gymIds, ratingIds) => {
  const timeSlots = [
    '00:00',
    '01:00',
    '02:00',
    '03:00',
    '04:00',
    '05:00',
    '06:00',
    '07:00',
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '12:00',
    '13:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00',
    '21:00',
    '22:00',
    '23:00',
  ];

  const bookings = [];
  for (let i = 0; i < num; i++) {
    const shuffledTimes = faker.helpers.shuffle(timeSlots);
    const fromTime = shuffledTimes[0];
    const toTime = shuffledTimes[1];

    const booking = {
      date: faker.date.between('2024-06-01', '2024-12-01'),
      from: fromTime,
      to: toTime,
      totalPrice: faker.finance.amount(),
      status: faker.helpers.arrayElement([
        'scheduled',
        'completed',
        'cancelled',
        'pending',
      ]),
      user_id: new mongoose.Types.ObjectId('66c0876c56353aa2e8e402e8'),
      gym_id: faker.helpers.arrayElement(gymIds),
      // ratings: faker.datatype.boolean() ? faker.helpers.arrayElement(ratingIds) : null,
      extensionId: null,
    };

    bookings.push(booking);
  }
  return Booking.insertMany(bookings);
};

// Main function to populate database
const populateDatabase = async () => {
  try {
    // console.log("Starting database population...");

    // Create Users
    const userDocs = await createUsers(30);
    const userIds = userDocs.map((user) => user._id.toString());

    // Filter owners
    const owners = userDocs.filter((user) => user.role === 'owner');
    const ownerIds = owners.map((owner) => owner._id.toString());

    // Create Gyms
    const gymDocs = await createGyms(30, ownerIds);
    const gymIds = gymDocs.map((gym) => gym._id.toString());

    // Create Bookings
    const bookingDocs = await createBookings(30, userIds, gymIds);
    const bookingIds = bookingDocs.map((booking) => booking._id.toString());

    // Create Ratings
    await createRatings(10, bookingIds);

    // console.log("Database populated successfully.");
    mongoose.connection.close();
  } catch (error) {
    console.error('Error populating database:', error);
  }
};

populateDatabase();
