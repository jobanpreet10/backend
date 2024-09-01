 const asynchandler = (requesthandler) => {
    (req,res,next) =>{
        Promise.resolve(requesthandler(req,res,next)).catch((err) => next(err)).
        catch((err) => next(err))
    }
 }



 export{asynchandler}









//  const asynchandler = () => {}
//  const asynchandler = (func) => () => {}
//  const asynchandler = (func) => async() => {}



    
//  const asynchandler = (fn) => async (req,res,next) => {
//     try{
//         await fn(req,res,next)
//     }
//     catch (error){
//         res.status(err.code || 500).json({
//             sucess: false,
//             message :err.message
//         })
//     }
//  }