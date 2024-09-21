//require('dotenv').config({path :'./env'})
import dotenv from "dotenv"
import connectDB from "./db/index.js";
import { app } from "./app.js";


dotenv.config({
    path: './env'
}) 

connectDB()

.then(() => {
    const PORT = process.env.PORT || 8000;
     app.listen(PORT, () => {
    console.log(`Server is running at port: ${PORT}`);
});

})
.catch((err) => {
    console.log("MONGO db coneection failed !!!",err);
    
})



















/*

// IFEE

import express from "express";
const app = express()

( async () => {
    try{
       await  mongoose.connect(`{$process.env.MONOGODB_URI}/${DB_name}`)
       app.on("error",(error) => {
        console.log("ERR:" ,error);
        throw error
       })
    

    app.listen(process.env.PORT,() => {
        console.log(`App is listening on port $ {process.env.PORT}`);
        
    })
  }  catch(error){
        console.log("ERROR :" , error)
        throw error
    }
} )()    */