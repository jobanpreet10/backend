import {asyncHandler} from "../utils/asyncHandler.js"

import {Apierror} from "../utils/Apierror.js"
import { User } from "../models/user.model.js"
import {uploadOnCloudinary} from "..utils.cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const registerUser = asyncHandler ( async (req,res ) => {
   // get user details from frontend 
   //validation - not empty
   //check if user exists or not : username , email 
   // check for images ,check for avatar
   // upload them to cloudinary , avatar
   // create user object  : create entry in db
   //remove password and refresh token form response
   // check for user creation
   // return res
   const {fullName,email,username,password} = req.body
   console.log("email :",email );
   if(
    [fullName,email,password,username].some((field) => field?.trim() == "")
   ){
    throw new Apierror(400,"All fields are required")
   }

   const existedUser = User.findOne({
    $or:[{email},{username}]
   })
   console.log("existed user",existedUser);
   
   if(existedUser){
    throw new Apierror(409, "User with email or username already exists")
   }

   const avatarLocalPath = req.files?.avatar[0]?.path;
   const coverImageLocalPath = req.files?.coverImage[0].path;
     
   if(!avatarLocalPath){
    throw new Apierror(400,"Avatar file is required")
   } 

   const avatar = await uploadOnCloudinary(avatarLocalPath)
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)

   if(!avatar){
    throw new Apierror(400,"Avatar file is required")
   }
   const user = await User.create({
    fullName,
    avatar : avatar.url,
    coverImage : coverImage?.url || "",
    email,
    password,
    username:username.tolowercase()

   })
   // check user created or not
   const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"                // write the entries u want not select
   )
   if(!createdUser){
    throw new Apierror(500,"something went wrong while registering the user")
   }

   return res.status(201).json(
    new ApiResponse(200, createdUser ,"User registered sucessfully")
   )

})

export {registerUser}