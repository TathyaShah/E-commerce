const  mongoose = require("mongoose");
const plm=require("passport-local-mongoose")

mongoose.connect("mongodb://127.0.0.1:27017/ecommerce")
const userSchema=mongoose.Schema({
  username:String,
  password:String,
  email: { type: String, required: true, unique: true },
  fullname:String,
  mobile:Number,
  orders:{
    type:Array,
    default:[]
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },
  cart:[
    {
      type:mongoose.Schema.Types.ObjectId, 
      ref:"products"
    }
  ]
})
userSchema.plugin(plm)
module.exports=mongoose.model("user", userSchema)