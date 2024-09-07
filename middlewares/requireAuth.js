import { verifyToken } from '../utils/tokenUtils.js';
import User from '../models/UserSchema.js';

// requireAuth middleware is applied to all routes except /login and /register
// to prevent unauthenticated users from accessing protected routes
const requireAuth = async (req, res, next) => {
  if (req.path === '/login' || req.path === '/register') {
    return next();
  }

  const authHeader = req.headers['authorization'];

  // console.log('AuthHeader : ', authHeader);

  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader && authHeader.split(' ')[1];

  try {
    // verify token
    if (authHeader && authHeader.startsWith('Bearer ') && token) {
      const decodedToken = verifyToken(token);

      // If the token is invalid, return an error
      if (!decodedToken) {
        return res.status(401).send({ message: 'Invalid token' });
      }

      // If the token is invalid, return an error
      if (decodedToken === 'expired') {
        return res.status(401).send({ message: 'Token expired' });
      }

      const { payload } = decodedToken;
      const user = await User.findOne({ _id: payload._id }).select('_id');

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: User not found' });
      }

      // Attach user to request object
      req.token = token;
      req.user = user;
      req.role = payload.role;

      next();
    } else {
      res.status(401).json({ error: 'Authorization token required' });
    }
  } catch (error) {
    // console.log('Error while authenticating : ', error);
    return res.status(401).json({ error: 'Request is not authorized' });
  }
};

export default requireAuth;
