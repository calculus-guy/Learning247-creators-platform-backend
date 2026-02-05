const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

/**
 * AWS S3 Service for handling thumbnail uploads
 * 
 * Handles thumbnail uploads for videos and live classes to S3
 * Returns public URLs that can be stored in database
 */

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

/**
 * Multer configuration for S3 uploads
 * All thumbnails are stored in uploads/photos/ folder
 */
const uploadToS3 = multer({
  storage: multerS3({
    s3: s3,
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'public-read', // Make files publicly readable
    key: function (req, file, cb) {
      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const extension = path.extname(file.originalname);
      
      // All thumbnails go to uploads/photos/ folder
      const filename = `upload/photos/${timestamp}-${randomString}${extension}`;
      cb(null, filename);
    }
  }),
  // File size limit (5MB)
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  // File filter - only images
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
    }
  }
});

/**
 * Direct S3 upload function (alternative to multer)
 * Use this for programmatic uploads
 */
const uploadFileToS3 = async (fileBuffer, fileName, contentType) => {
  try {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = path.extname(fileName);
    const key = `uploads/photos/${timestamp}-${randomString}${extension}`;
    
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'public-read'
    };
    
    const result = await s3.upload(params).promise();
    
    return {
      success: true,
      url: result.Location,
      key: result.Key,
      bucket: result.Bucket
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw error;
  }
};

/**
 * Delete file from S3
 */
const deleteFileFromS3 = async (fileUrl) => {
  try {
    // Extract key from URL
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // Remove leading slash
    
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    };
    
    await s3.deleteObject(params).promise();
    
    return {
      success: true,
      message: 'File deleted successfully'
    };
  } catch (error) {
    console.error('S3 delete error:', error);
    throw error;
  }
};

/**
 * Get signed URL for temporary access (if needed for private files)
 */
const getSignedUrl = (key, expiresIn = 3600) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Expires: expiresIn // seconds
    };
    
    return s3.getSignedUrl('getObject', params);
  } catch (error) {
    console.error('S3 signed URL error:', error);
    throw error;
  }
};

/**
 * Check if S3 is properly configured
 */
const validateS3Configuration = () => {
  const requiredEnvVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_S3_BUCKET'
  ];
  
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    return {
      valid: false,
      missing: missing,
      message: `Missing required environment variables: ${missing.join(', ')}`
    };
  }
  
  return {
    valid: true,
    message: 'S3 configuration is valid',
    bucket: process.env.AWS_S3_BUCKET,
    region: process.env.AWS_REGION
  };
};

module.exports = {
  uploadToS3,
  uploadFileToS3,
  deleteFileFromS3,
  getSignedUrl,
  validateS3Configuration,
  s3
};
