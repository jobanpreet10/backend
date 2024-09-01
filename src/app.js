import express from "express"
import cors from "cors"
import cookieParser  from "cookie-parser"  // cookie ko read kr ske 
const app = express()

app.use(cors ({
    origin : process.env.CORS_ORIGIN,
    credentials : true
}))


app.use(express.json({limit: "10kb"}))           // form se data aayega
app.use(express.urlencoded({extended :true ,limit: "10kb"})) // to make understand that data will come from the url also so to encode itn properly
app.use(express.static("public"))   // file folder stored for  public acess

app.use(cookieParser())
export {app}