import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';
import config from './config/config.js';
import validateConfig from './config/configValidator.js';
import connectDB from './config/db.js';
import authRouter from './routes/authRouter.js';
import userRouter from './routes/userRouter.js';
import bookingRouter from './routes/bookingRouter.js';
import gymRouter from './routes/gymRouter.js';
import { runCronJobs } from './utils/cronJob.js';
import { rateLimit } from 'express-rate-limit';
import compression from 'compression';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 500, // Limit each IP to 500 requests per `window` (here, per 15 minutes).
  standardHeaders: 'draft-7', // draft-6: `RateLimit-*` headers; draft-7: combined `RateLimit` header
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers.
  message: 'Too many requests, please wait for sometime',
});

const app = express();

// Checks all the env
validateConfig();

const port = config.GENERAL_CONFIG.PORT;

// Connecting to MongoDB
connectDB(config.DB_CONFIG.DATABASE);

// Middleware
app.use(limiter);
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// Use compression middleware
app.use(compression());

// Routes
app.use('/api/auth', authRouter);
app.use('/users', userRouter);
app.use('/bookings', bookingRouter);
app.use('/gyms', gymRouter);
// Other middlewares and routes
// app.use('/payments', paymentRouter);

app.get('/', (req, res) => {
  res.status(200).send('Application working fine');
});

runCronJobs();

// Start server
app.listen(port, () => {
  // console.log(`Listening to port : ${port}`)
});
