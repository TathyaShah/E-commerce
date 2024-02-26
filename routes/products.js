const mongoose=require("mongoose")
const productSchema=new mongoose.Schema({
    name:String,
    price:Number,
    image:String,
    categories: {
        type: String,
        default: "",
    },
    sub_categories: {
        type: String,
        default: "",
    },
    rating:[
        {
            user:{
                type:mongoose.Schema.Types.ObjectId,
                ref:'user'
            }, 
            value:{
                type:Number,
                min:0,
                max:5
            }
        }
    ],
    total_rating:{
        type:Number,
        min:0,
        max:5,
        default:0
    }
})
module.exports=mongoose.model("products", productSchema)