const multer = require("multer");

// Store files in memory for direct Cloudinary uploads
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  const imageTypes = /jpeg|jpg|png|gif|webp/;
  const videoTypes = /mp4|webm|ogg|quicktime/;
  const isVideoField = file.fieldname === "video" || file.fieldname === "videos";
  const mimetype = isVideoField
    ? videoTypes.test(file.mimetype)
    : imageTypes.test(file.mimetype);

  if (mimetype) {
    return cb(null, true);
  }
  cb(
    new Error(
      "Only product images (jpeg, jpg, png, gif, webp) and up to 3 product videos (mp4, webm, ogg, mov) are allowed",
    ),
  );
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
