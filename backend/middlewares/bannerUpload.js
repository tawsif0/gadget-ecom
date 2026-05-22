const multer = require("multer");

// Store files in memory for direct Cloudinary uploads
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype) {
    return cb(null, true);
  }
  cb(new Error("Only images are allowed (jpeg, jpg, png, gif, webp)"));
};

// Create upload middleware (no file size limits)
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});

// Error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

module.exports = { upload, handleMulterError };
