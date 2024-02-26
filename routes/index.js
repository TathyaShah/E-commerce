const express = require('express');
const userModel = require('./users');
const productModel = require('./products');
const cartModel=require('./cart')
const discountModel=require("./discount")
const localStrategy = require('passport-local');
const passport = require('passport');
const stripe=require("stripe")("sk_test_51ObfOoSH4dlrgVdSfJrulVDWlTjMx0mFIQjT6FDd9AAZoZBPw1oQVA09hmpUnyhgwcHnMjbIwwvO3wOtLSHuxZ1m00VhkOUEIR")
const upload = require('./multer');

const router = express.Router();

passport.use(new localStrategy(userModel.authenticate()));

router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get("/auth/google/callback", passport.authenticate("google", { failureRedirect: "/login" }), (req, res) => {
  res.redirect("/");
});

router.post("/register", async (req, res) => {
  const { username, email, password, fullname, mobile } = req.body;

  const existingUser = await userModel.findOne({ email });
  if (existingUser) return res.status(409).json({ message: "Email already exists!" });

  const newUser = new userModel({
    username,
    email,
    fullname,
    mobile,
  });

  await userModel.register(newUser, password);
  res.redirect('/')
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await userModel.findOne({ email });
  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Invalid email or password!" });
  }

  req.login(user, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal Server Error" });
    }
    req.flash("success",`Welcome ${user.fullname}`)
    return res.redirect('/');
  });
});

function isAdmin(req, res, next) {
  if (req.user.role === 'admin') {
    return next();
  } else {
    res.redirect('/');
  }
}

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}
// router.get('/dis', async function(req, res){
//   const dis=await discountModel.findOne({_id:"65d36c1f173e2226ed809fae"})
//   const code=dis.code
//   console.log(code)
//   await code.push("BOGO10")
//   await dis.save()
//   res.send("Done successfully")
// });

router.get('/', isLoggedIn, async (req, res) => {
  try {
    const successMessage = req.flash('success')[0];
    const user = await userModel.findOne({ _id: req.session.passport.user });
    const products = await productModel.find();

    // Check if a filter parameter is present in the query
    const filter = parseInt(req.query.filter);
    const filteredProducts = filter ? products.filter(product => product.total_rating >= filter) : products;

    res.render('index', { user, products: filteredProducts, successMessage });
  } catch (error) {
    console.error(error);
    res.status(500).render('error');
  }
});

router.post('/discount', async function(req, res){
  try {
    const code = req.body.discount;
    const discount = await discountModel.findOne({ code: code });
    req.flash("code",code)
    if(discount){
    req.flash("success",discount)
  }
    res.redirect(`/cart?coupon_code=${code}`);
  }
  catch (error) {
    console.error("Error finding discount code:", error);
    res.status(500).send("Internal Server Error");
  }
});

router.get('/login', (req, res) => {
  res.render('login');
});

router.get('/register', async (req, res) => {
  res.render('register');
});

router.get('/admin', isAdmin, (req, res) => {
  res.render('admin/admin');
});

router.get('/admin/products', isAdmin, (req, res) => {
  res.render('admin/add_products');
});

router.get('/cart', isLoggedIn, async (req, res) => {
  const username=req.session.passport.user
  const user = await userModel.findOne({ _id: username }).populate('cart');
  const cartProducts=user.cart
  const cart=await cartModel.findOne({user:username})
  const products = cart.products
  const codeStr=req.flash("code")[0]
  console.log(codeStr)
  const discount=req.flash("success")[0]
  console.log(discount)
  res.render("cart",{cartProducts, products, cart, discount, codeStr});
});

router.get('/category/:category', isLoggedIn, async (req, res) => {
  const category = req.params.category;
  const products=await productModel.find()
  const subcategories = await productModel.find({ categories: category }).distinct('sub_categories');
  
  res.render('category', {subcategories, category , products});
});

router.get('/category/:category/:subcategory', async function(req,res){
  const category = req.params.category;
  const subcategory=req.params.subcategory
  const products=await productModel.find({sub_categories:subcategory})
  res.render('subcategory',{category,products,subcategory})
})

router.get('/category/:category/:subcategory/:productId', isLoggedIn, async (req, res) => {
  const username=req.session.passport.user
  const productId = req.params.productId;
  const category = req.params.category;
  const product = await productModel.findById(productId);
  const subcategory = product.sub_categories;
  const rating = product.total_rating;
  const currentUserId = req.session.passport.user;
  const userRatingObj = product.rating.find(ratingObj => ratingObj.user.toString() === currentUserId.toString());
  const cart=await cartModel.findOne({user:username})
  const products = cart.products.find(product => product.product.toString() === productId);
  const userRating = userRatingObj ? userRatingObj.value : null;
  res.render('product', { product, products, category, subcategory, rating, userRating });
});

router.post('/searchProducts', async (req, res) => {
  try {
    const payload = req.body.payload.trim();
    const search = await productModel.find({ name: { $regex: new RegExp('^' + payload + '.*', 'i') } }).exec();
    const slicedSearch = search.slice(0, 10);
    res.send({ payload: slicedSearch });
  } catch (error) {
    console.error(error);
    res.status(404).send('Internal Server Error');
  }
});

router.post('/cart/update', async function (req, res) {
  try {
    const userId = req.session.passport.user;
    const productId = req.query.productId;
    const quantity = parseInt(req.body.quantity);
    const cart = await cartModel.findOne({ user: userId });
    
    if (cart) {
      const productIndex = cart.products.findIndex(product => product.product.equals(productId));
      if (productIndex !== -1) {
        cart.products[productIndex].quantity = quantity;
        await cart.save();
        res.redirect('/cart');
      } else {
        console.error('Product not found in the cart');
        res.status(404).send('Product not found in the cart');
      }
    } else {
      console.error('Cart not found for the user');
      res.status(404).send('Cart not found for the user');
    }
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/cart/updates', async function (req, res) {
    const userId = req.session.passport.user;
    const user=await userModel.findOne({_id:userId})
    const productId = req.query.productId;
    const product=await productModel.findOne({_id:productId})
    const category=product.categories
    const subcategory=product.sub_categories
    const quantity = parseInt(req.body.quantity);
    const cart = await cartModel.findOne({ user: userId });
    const productIndex = cart.products.findIndex(product => product.product.equals(productId));
    
    if (!cart) {
      // If the user doesn't have a cart, create a new one
      cart = await cartModel.create({
        user: username,
        products: [{
          product: productId,
          quantity:quantity,
          price: product.price,
          name:product.name,
          image:product.image
        }],
      });
    } else {
      if (productIndex !== -1) {
        cart.products[productIndex].quantity = quantity;
        await cart.save();
      }else{
      cart.products.push({
        product: productId,
        price: product.price,
        quantity:quantity,
        name:product.name,
        image:product.image
      });
    }
  }
    await cart.save();
    user.cart.push(productId)
    await user.save()
    res.redirect(`/category/${category}/${subcategory}/${productId}`);
});

router.post('/sort', async (req, res) => {
  try {
    const username = req.session.passport.user;
    const filter = req.body.filter;
    const cart = await cartModel.findOne({ user: username }).populate('products.product');
    if (filter === 'ascending') {
      cart.products.sort((a, b) => a.product.price - b.product.price);
    } else if (filter === 'descending') {
      cart.products.sort((a, b) => b.product.price - a.product.price);
    }
    await cart.save();
    res.redirect('/cart');
  } catch (error) {
    console.error('Error sorting products:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/filter', async function(req, res){
  try {
    const selectedFilter = parseInt(req.body.filter);
    
    // Validate the selected filter
    if (isNaN(selectedFilter) || selectedFilter < 1 || selectedFilter > 5) {
      return res.status(400).send('Invalid filter value');
    }

    // Find products with a total rating greater than or equal to the selected filter
    const filteredProducts = await productModel.find({ total_rating: { $gte: selectedFilter } });

    // You can render the filteredProducts in your view or send it as JSON, depending on your needs
    res.redirect(`/?filter=${selectedFilter}`);
  } catch (error) {
    console.error('Error in filter route:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/cart/delete', isLoggedIn, async (req, res) => {
  const productId = req.body.productId;
  const username = req.session.passport.user;

  try {
    await cartModel.findOneAndUpdate(
      { user: username },
      { $pull: { 'products': { product: productId } } },
      { new: true }
    );    
    const user = await userModel.findOne({_id: username });
    user.cart = user.cart.filter(cartProductId => cartProductId.toString() !== productId);
    await user.save();
    res.redirect('/cart');
  } catch (error) {
      console.error('Error deleting product from cart:', error);
      res.status(500).send('Internal Server Error');
  }
});

router.post('/rating', async function(req,res){
  const category=req.body.category
  const subcategory=req.body.subcategory
  const productId=req.body.productId
  const username=req.session.passport.user
  const user=await userModel.findOne({_id:username})
  const rating=parseInt(req.body.rating)
  const product=await productModel.findOne({_id:productId})
  const existingRatingIndex = product.rating.findIndex(r => r.user.equals(user._id));
    if (existingRatingIndex !== -1) {
      product.rating[existingRatingIndex].value = rating;
    } else {
      product.rating.push({
        user: user._id,
        value: rating,
      });
    }
  const totalRating = product.rating.reduce((sum, rating) => sum + rating.value, 0);
  product.total_rating = product.rating.length > 0 ? totalRating / product.rating.length : 0;
  await product.save();
  res.redirect(`/category/${category}/${subcategory}/${productId}`)
})

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No files were uploaded');
    }

    const product = await productModel.create({
      image: req.file.filename,
      name: req.body.name,
      price: req.body.price,
      categories: req.body.category,
      sub_categories:req.body.subcategory
    });

    await product.save();
    res.redirect('/admin');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/register', async (req, res) => {
  try {
    const user = new userModel({
      username: req.body.username,
      email: req.body.email,
      mobile: req.body.mobile,
      fullname: req.body.name,
    });

    await userModel.register(user, req.body.password);
    passport.authenticate('local')(req, res, () => {
      res.redirect('/');
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
}), (req, res) => {});

router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.redirect('/login');
  });
});

module.exports = router;