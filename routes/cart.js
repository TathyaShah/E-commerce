const mongoose = require('mongoose');

const cartSchema = mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
  products:[{
    product:{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'products',
      required: true,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
      max: 10
    },
    price:{
      type : Number ,
      ref:'products'
    },
    name:{
      type:String,
      ref:'products'
    },
    image:{
      type:String,
      ref:'products'
    }
  }]
});

module.exports = mongoose.model("cart", cartSchema);
