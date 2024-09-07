// file: imageUploader.js

import multer from 'multer';
import multerS3 from 'multer-s3';
import s3 from '../config/awsConfig.js';
import config from '../config/config.js';

// Function to validate file type
const fileFilter = (req, file, cb) => {
  // Allowed mime types
  const allowedTypes = [
    'image/jpeg', // for jpg, jpeg
    'image/png', // for png
    'image/svg+xml', // for svg
    'image/heic', // for heic
    'image/webp', // for webp
  ];

  // Check if file type is allowed
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.error(`[fileFilter] Invalid file type: ${file.mimetype}`);
    return cb(
      new Error(
        'Only image files are allowed (jpg, jpeg, svg, png, heic, webp)'
      ),
      false
    );
  }
};

/**
 * Configure multer to upload files to S3
 * @param {string} folderPath - The folder path in the S3 bucket where images should be stored
 * @returns {multer} - Configured multer instance
 */
const upload = (folderPath) => {
  // console.log(`[upload] Initializing multer with folderPath: ${folderPath}`)

  return multer({
    storage: multerS3({
      s3: s3,
      bucket: config.AWS_CONFIG.S3_BUCKET_NAME,
      metadata: (req, file, cb) => {
        // console.log(`[upload -> metadata] Setting metadata for file: ${file.originalname}`)
        cb(null, { fieldName: file.fieldname });
      },
      key: (req, file, cb) => {
        const fileName = `${Date.now().toString()}_${file.originalname}`;
        const filePath = `${folderPath}/${fileName}`;
        // console.log(`[upload -> key] Setting file key: ${filePath}`)
        cb(null, filePath);
      },
    }),
    fileFilter: fileFilter,
    limits: { fileSize: 12 * 1024 * 1024 }, // Limit file size to 12 MB
  });
};

/**
 * Upload images to S3 and return their URLs
 * @param {Array} files - Array of files to be uploaded
 * @returns {Promise<Array>} - Array of URLs of uploaded images
 */
export const uploadImages = async (files) => {
  // console.log('[uploadImages] Uploading images...')

  return new Promise((resolve, reject) => {
    if (!files || files.length === 0) {
      console.error('[uploadImages] No files uploaded');
      return reject(new Error('No files uploaded'));
    }

    try {
      const fileUrls = files.map((file) => {
        if (!file.location) {
          throw new Error('File location is not available');
        }
        // console.log(`[uploadImages] File uploaded: ${file.location}`)
        return file.location;
      });
      // console.log('[uploadImages] Uploaded file URLs:', fileUrls)
      resolve(fileUrls);
    } catch (error) {
      console.error('[uploadImages] Error processing files:', error);
      reject(new Error('Error processing files'));
    }
  });
};

/**
 * Middleware to handle image uploads
 * @param {Function} folderPathFunc - A function that takes req and returns the folder path
 * @param {string} fieldName - The field name for images in the request body
 * @param {number} maxFiles - Maximum number of files to upload
 * @returns {Function} - Multer middleware function
 */
export const uploadMiddleware = (folderPathFunc, fieldName, maxFiles) => {
  // console.log(`[uploadMiddleware] Initializing middleware for fieldName: ${fieldName}, maxFiles: ${maxFiles}`)

  return (req, res, next) => {
    const folderPath = folderPathFunc(req);
    // console.log(`[uploadMiddleware] Determined folderPath: ${folderPath}`)

    const uploadInstance = upload(folderPath);

    uploadInstance.array(fieldName, maxFiles)(req, res, (err) => {
      if (err) {
        console.error('[uploadMiddleware] Error during file upload:', err);
        return next(err);
      }
      // console.log('[uploadMiddleware] File upload completed successfully')
      next();
    });
  };
};
