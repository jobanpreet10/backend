import { asyncHandler } from "../utils/asyncHandler.js";
import bcrypt from "bcryptjs";
import Apierror from "../utils/Apierror.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"

const generateAccessTokenAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new Apierror(500, "Something went wrong while generating refresh and access token");
  }
};

const registerUser = asyncHandler(async (req, res) => {
   const { fullName, email, username, password } = req.body;
 
   // Check for empty fields
   if ([fullName, email, password, username].some((field) => field?.trim() === "")) {
     throw new Apierror(400, "All fields are required");
   }
 
   // Check if user already exists
   const existedUser = await User.findOne({
     $or: [{ email }, { username }],
   });
 
   if (existedUser) {
     throw new Apierror(409, "User with email or username already exists");
   }
 
   // Hash the password
   const hashedPassword = await bcrypt.hash(password, 10);
   console.log("Original password:", password);  // Log the plain text password
   console.log("Hashed password to be saved:", hashedPassword);  // Log the hashed password
 
   // Handle file uploads
   const avatarLocalPath = req.files?.avatar?.[0]?.path;
   let coverImageLocalPath;
   if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
     coverImageLocalPath = req.files.coverImage[0].path;
   }
 
   if (!avatarLocalPath) {
     throw new Apierror(400, "Avatar file is required");
   }
 
   const avatar = await uploadOnCloudinary(avatarLocalPath);
   const coverImage = await uploadOnCloudinary(coverImageLocalPath);
 
   if (!avatar) {
     throw new Apierror(400, "Avatar file is required");
   }
 
   // Create the user with the hashed password
   const user = await User.create({
     fullName,
     avatar: avatar.url,
     coverImage: coverImage?.url || "",
     email,
     password: hashedPassword,  // Save the hashed password
     username,
   });
 
   // Check user creation
   const createdUser = await User.findById(user._id).select("-password -refreshToken");
   if (!createdUser) {
     throw new Apierror(500, "Something went wrong while registering the user");
   }
 
   return res.status(201).json(
     new ApiResponse(200, createdUser, "User registered successfully")
   );
 });

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  if (!(username || email)) {
    throw new Apierror(400, "Username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new Apierror(400, "User is not registered");
  }

  // Compare entered password with stored hashed password
  const isPasswordValid = await bcrypt.compare(password, user.password);
  console.log("Entered password:", password);  // Log entered password
  console.log("Stored password (hashed):", user.password);  // Log hashed password
  console.log("Password comparison result:", isPasswordValid);

  if (!isPasswordValid) {
    throw new Apierror(401, "Password is incorrect");
  }

  // Generate access and refresh tokens
  const { accessToken, refreshToken } = await generateAccessTokenAndRefreshTokens(user._id);

  // Fetch logged-in user without sensitive data
  const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

  // Cookie options
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "User logged in successfully")
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $set: { refreshToken: undefined } }, { new: true });

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

  // If no refresh token is provided, throw an error
  if (!incomingRefreshToken) {
    throw new Apierror(401, "Unauthorized refresh");
  }

  try {
    // Verify the refresh token
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    // Find the user by ID from the decoded token
    const user = await User.findById(decodedToken?._id);

    // If no user is found, throw an error
    if (!user) {
      throw new Apierror(401, "Invalid refresh token");
    }

    // Check if the incoming refresh token matches the user's stored token
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new Apierror(401, "Refresh token is expired or used");
    }

    // Generate new access and refresh tokens
    const { accessToken, newrefreshToken } = await generateAccessTokenAndRefreshTokens(user._id);

    // Set cookies for the new tokens
    res
      .status(200)
      .cookie("accessToken", accessToken, { httpOnly: true, secure: true })
      .cookie("refreshToken", newrefreshToken, { httpOnly: true, secure: true })
      .json(
        new ApiResponse({
          statusCode: 200,
          data: { accessToken, refreshToken: newrefreshToken },
          message: "Access token refreshed"
        })
      );
  } catch (error) {
    // Handle any errors that occur during token verification or user lookup
    throw new Apierror(401, error?.message || "Invalid refresh token");
  }
});


export { registerUser, loginUser, logoutUser , refreshAccessToken};
