import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
    try {
        // console.log("MongoDB URI:", process.env.MONGODB_URI); // Debugging line
        const connectionInstance = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`\nMongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("MongoDB connection failed", error);
        process.exit(1); // Exit the process with failure
    }
};

export default connectDB;

