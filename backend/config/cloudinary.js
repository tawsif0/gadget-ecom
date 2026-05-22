const cloudinary = require("cloudinary").v2;

const {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
  secure: true,
});

const uploadImageBuffer = (buffer, options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      return resolve(result);
    });
    stream.end(buffer);
  });

const deleteImage = async (publicId, options = {}) => {
  if (!publicId) return null;
  try {
    return await cloudinary.uploader.destroy(publicId, options);
  } catch (error) {
    return null;
  }
};

module.exports = {
  cloudinary,
  uploadImageBuffer,
  deleteImage,
};
