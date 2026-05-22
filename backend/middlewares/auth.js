const jwt = require("jsonwebtoken");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    // Check if Authorization header exists
    const authHeader = req.header("Authorization");

    if (!authHeader) {
      return res
        .status(401)
        .json({ error: "Please authenticate. No token provided." });
    }

    // Extract token
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ error: "Please authenticate. Invalid token format." });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user with token
    const user = await User.findOne({
      _id: decoded._id,
      "tokens.token": token,
    });

    if (!user) {
      return res
        .status(401)
        .json({ error: "Please authenticate. User not found." });
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);

    if (error.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json({ error: "Please authenticate. Invalid token." });
    }

    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Please authenticate. Token expired." });
    }

    res.status(401).json({ error: "Please authenticate" });
  }
};

module.exports = auth;
