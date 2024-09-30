import { asyncHandler } from "../utils/asyncHandler.js";
import bcrypt from "bcryptjs";
import Apierror from "../utils/Apierror.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

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
  await User.findByIdAndUpdate(
    req.user._id, 
    { 
      $unset: 
      { 
        refreshToken: 1
        // this removes the field from the document    
      }
  },
  { 
    new: true 
  }
);

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


const changeCurrentPassword = asyncHandler (async (req, res) => {
  const {oldPassword , newPassword} = req.body     // can also check if the password is not matching with the confirm password  by adding confpass

  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)        // isPasswordCorrect() is fucntion in user model to check password
  
  if(!isPasswordCorrect){
    throw new Apierror (401 , "Old Password is not correct")
  }

user.password = newPassword
await user.save({validateBeforeSave:false})

return res
.status(200)
.json(
  new ApiResponse(200,{},"Password changed successfully")
)


})

const getCurrentUser  = asyncHandler(async(req,res) =>{
  return res
  .status(200)
  .json( new ApiResponse(200,req.user, "curent user fetched succesfully"))
})

const updateAccountDetails = asyncHandler (async(req,res) => {
  const {fullName, email} = req.body                                      // for file check make another controller to acoid conjetion in network

  if(!fullName || email){
    throw new Apierror (400, "all details are required")
  }

  User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        fullName,
        email:email
      }
    },
    {new: true}  // the info return is after the update
  ).select("-password")

  return res
  .status(200)
  .json (new ApiResponse (200,user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler (async(req,res) =>{
  const avatarLocalPath = req.file?.path

  if(!avatarLocalPath){
    throw new Apierror(400,"Avatar file is missing")
  }

  const avatar = await uploadOnCloudinary
  (avatarLocalPath)

  if(!avatar.url){
    throw new Apierror(400,"Error while uploading on avatar")
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set:{
        avatar:avatar.url
      }
    },
    {new: true}
  ).select("-password")
  return res
  .status(200)
  .json(
    new ApiResponse(200,user,"Avatar image updated sucessfully")
  )
})

const updateUserCoverImage = asyncHandler (async(req,res) =>{
  const coverImageLocalPath = req.file?.path

  if(!coverImageLocalPath){
    throw new Apierror(400,"CoverImage file is missing")
  }

  const coverImage = await uploadOnCloudinary
  (coverImageLocalPath)

  if(!coverImage.url){
    throw new Apierror(400,"Error while uploading on CoverImageLocalPath")
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set:{
        coverImageLocalPath:coverImage.url
      }
    },
    {new: true}
  ).select("-password")
  return res
  .status(200)
  .json(
    new ApiResponse(200,user,"Cover image updated sucessfully")
  )
})

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  // Check if the username is provided and trimmed
  if (!username?.trim()) {
    throw new Apierror(400, "Username is missing");
  }

  // Perform aggregation on the User model
  const channel = await User.aggregate([
    {
      $match: {
        username: username.toLowerCase(), // Fixed toLowerCase()
      },
    },
    {
      $lookup: {
        from: "subscriptions", // Collection name for subscriptions
        localField: "_id",
        foreignField: "channel", // Assuming "channel" is a field in "subscriptions"
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber", // Assuming "subscriber" is the correct field
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  // Handle the case where no user/channel was found
  if (!channel || channel.length === 0) {
    throw new Apierror(404, "Channel not found");
  }

  // Send the first channel object (since aggregation returns an array)
  return res
  .status(200)
  .json(
    new ApiResponse(200, channel[0], "Channel profile fetched successfully")
  );
});

const getWatchHistory = asyncHandler(async(req,res) => {
  const user = await User.aggregate([
    {
      $match:{
        _id: new mongoose.Types.ObjectId(req.user._id)                         // making the object id of moongoose -> mongodb give string 
      }    
    },
    {
      $lookup:{
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline:[
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1 
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              owner:{
                $first: "$owner"
              }
            }
          }
        ]
      }
    }
  ])

  return  res
  .status(200)
  .json(
    new ApiResponse(
      200,
      user[0].watchHistory,
      "Watch history fetched sucessfully"
    )
  )
})



export { 
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory
};
