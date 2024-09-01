import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { DB_name } from '../constants.js';

dotenv.config();

const connectDB = async () => {
    try {
        console.log('MongoDB URI:', process.env.MONGODB_URI); // Log the URI to verify it's loaded
        const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, {
            dbName: DB_name,
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`\nMongoDB connected!! DB HOST: ${connectionInstance.connection.host}`); 
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        console.error("Stack trace:", error.stack);
        process.exit(1);
    }
};

export default connectDB;
