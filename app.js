var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
const bodyParser=require('body-parser')
var logger = require('morgan');
const cors=require('cors')
const expressSession=require('express-session')
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const passport = require('passport');
const flash=require('connect-flash')
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const stripe=require("stripe")("sk_test_51ObfOoSH4dlrgVdSfJrulVDWlTjMx0mFIQjT6FDd9AAZoZBPw1oQVA09hmpUnyhgwcHnMjbIwwvO3wOtLSHuxZ1m00VhkOUEIR")
const publishable_key="pk_test_51ObfOoSH4dlrgVdSNbJAVrRUbzkYz79LS7G3RBSYCp3VOpsx3Z9fWQEPRBrTOqngZZ1vBqYmPDI4kCTzMpv5LzTC00C8yGitrR"
var app = express();


passport.use(new GoogleStrategy({
  clientID: '1074249057722-96kv5f90qahgtp29ht1kvbthm04r1cij.apps.googleusercontent.com',
  clientSecret: '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',
  callbackURL: '/auth/google/callback',
  scope: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile']
}, async (accessToken, refreshToken, profile, done) => {
  const email = profile.emails[0].value;
  const existingUser = await usersRouter.findOne({ email });
  console.log(existingUser)

  if (existingUser) {
    existingUser.fullname = profile.displayName;
    await existingUser.save();
    return done(null, existingUser);
  }
  
  const newUser = new usersRouter({
    email,
    fullname: profile.displayName,
  });
  
  await newUser.save();
  done(null, newUser);
})
);
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  usersRouter.findById(id)
  .then(user => done(null, user))
  .catch(error => done(error));
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressSession({
  saveUninitialized: false,
  resave:false,
  secret:'12345789'
}))

app.use(cors())
app.use(flash());
app.use(passport.initialize())
app.use(passport.session())
passport.serializeUser(usersRouter.serializeUser())
passport.deserializeUser(usersRouter.deserializeUser())

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/payment',function(req,res){
  stripe.customers.create({
    email:req.body.stripeEmail,
    source:req.body.stripeToken,
    name:'Tathya Shah',
    address:{
      city:'gurgao',
      state:'delhi',
      country:'India',
    }
  })
  .then((customer)=>{
    return stripe.charges.create({
      amount:7000,
      description:'ecommerce',
      currency:'inr',
      customer:customer.id
    })
  })
  .then((charge)=>{
    console.log(charge)
    res.send('Success')
  })
  .catch((err)=>{
    res.send(err)
  })
})

app.use('/', indexRouter);
app.use('/users', usersRouter);



// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 404);
  res.render('error');
});

module.exports = app;