import express from 'express';
import {
  registerController,
  loginController,
  reqForgetPwdController,
  resetPwdController,
} from '../controllers/authController.js';

const authRouter = express.Router();

// User's Register route
authRouter.post('/register', registerController('customer'));
// User's Login route
authRouter.post('/login', loginController('customer'));
// Owner's Register route
authRouter.post('/owners/register', registerController('owner'));
// Owner's Login route
authRouter.post('/owners/login', loginController('owner'));
// Request Password Reset (Generate Link)
authRouter.post('/forgetPassword', reqForgetPwdController);
// Reset Password
authRouter.post('/resetpassword/:token', resetPwdController);

export default authRouter;
