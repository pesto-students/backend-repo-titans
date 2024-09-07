import express from 'express';
import {
  deactivateGym,
  // getAllGyms,
  searchGyms,
  getGymById,
  addGym,
  updateGymById,
  getUpcomingBookingsForGym,
  getGymStats,
  addNewSchedule,
  getPopularGyms,
  getCitiesForGyms,
  getPendingGyms,
  respondToGymForm,
  resubmitGym,
} from '../controllers/gymController.js';
import requireAuth from '../middlewares/requireAuth.js';
import { uploadMiddleware } from '../utils/updateImageToS3.js';
import { getAllOwnerExtension } from '../controllers/bookingController.js';

const gymRouter = express.Router();

const generateFolderPath = (req) => {
  // console.log("req.body in generate folder Path  : " + JSON.stringify(req.body, null, 2)) // Log the entire body
  const { role } = req; // assuming req.user is populated by requireAuth middleware
  const { gymName } = req.body;
  return `${role}/${gymName}`;
};

// * Get all the gyms
// gymRouter.get('/', getAllGyms) // Replaced by search

// * Get all gyms based on search input
gymRouter.get('/', searchGyms);

// * Add new gym
gymRouter.post(
  '/',
  requireAuth,
  uploadMiddleware(generateFolderPath, 'images', 10),
  addGym
);

// Add slots/schedule by the gyms for the users.
gymRouter.post('/schedule', requireAuth, addNewSchedule);

// For admin to get all the pending gyms
gymRouter.get('/admin/pending', requireAuth, getPendingGyms);

// Popular gyms for homePage
//its not completely tested our gyms need to have real latitude , longitude I suppose.
//http://localhost:3000/gyms/popular?latitude=28.6344 &longitude=77.2410 check with this for now
gymRouter.get('/popular', getPopularGyms);

// o get all the available gym cities
gymRouter.get('/cities', getCitiesForGyms);

// Dashboard for owners to see their stats
gymRouter.get('/owners/stats', requireAuth, getGymStats);

// * Get all the upcoming booking for particular Gym (Owner)
gymRouter.get('/bookings/upcoming', requireAuth, getUpcomingBookingsForGym);

// * To get all the extension requests for a particular gym (Owner)
gymRouter.get('/extensions', requireAuth, getAllOwnerExtension);

// * Get the all details of the particular Gym (All)
gymRouter.get('/:gym_id', getGymById);

// * Update the gym details of the particular Gym (Customer)
gymRouter.patch(
  '/',
  requireAuth,
  uploadMiddleware(generateFolderPath, 'images', 10),
  updateGymById
);
gymRouter.patch(
  '/resubmit',
  requireAuth,
  uploadMiddleware(generateFolderPath, 'images', 10),
  resubmitGym
);

// * Update the gym status (Delete)
gymRouter.patch('/:gym_id/inactive', requireAuth, deactivateGym);
gymRouter.patch('/:gym_id/response', requireAuth, respondToGymForm);

export default gymRouter;
