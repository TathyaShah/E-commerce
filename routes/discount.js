const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema({
    code: [{
        type: String,
        minlength: 6,
        maxlength: 6
    }]
});

module.exports = mongoose.model("discount", discountSchema);
