//jshint esversion:6
require('dotenv').config();
const express = require("express");
const multer = require("multer");
const path = require("path");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB", {useNewUrlParser: true});
mongoose.set("useCreateIndex", true);

var Storage = multer.diskStorage({
  destination: "./public/uploads/",
  filename: (req, file, cb)=>{
    cb(null, file.fieldname+ "_" + Date.now()+path.extname(file.originalname));
  }
});

var upload = multer({
  storage: Storage
}).single('file');

const userSchema = new mongoose.Schema ({
  email: String,
  password: String,
  googleId: String,
  senioremail: String
});

const imageSchema = new mongoose.Schema({
  image_path_id: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);
const Image = new mongoose.model("Image",imageSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);

    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
  });

app.get("/login", function(req, res){
  res.render("login");
});

app.get("/register", function(req, res){
  res.render("register");
});

app.get("/upload", function(req, res){
  User.find({"secret": {$ne: null}}, function(err, foundUsers){
    if (err){
      console.log(err);
    } else {
      if (foundUsers) {
        res.render("upload",{senioremail: "",email: ""});
      }
    }
  });
});


app.post("/upload", upload, function(req, res, next){
  // var imageFile = req.file.filename;
  // var success = req.file.filename+ "uploaded successfully";
  //
  // var image = new Image({
  //   image_path_id: imageFile
  // });
  //
  // image.save();
  // res.render("upload")
  if (req.isAuthenticated())
  {
     User.findById(req.user.id, function(err, foundUser){
     if (err)
     {
       console.log(err);
     }else
     {
       if (foundUser)
       {
          var imageFile = req.file.filename;
          var success = req.file.filename+ "uploaded successfully";

          var image = new Image({
          image_path_id: imageFile
          });

          image.save();
          res.render("upload",{
            senioremail: foundUser.senioremail,
            email: foundUser.email
          })
        }
    }
  });
  } else
  {
    res.redirect("/login");
  }
});

app.get("/submit", function(req, res){
  if (req.isAuthenticated()){
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});


app.get("/logout", function(req, res){
  req.logout();
  res.redirect("/");
});

app.post("/register", function(req, res){

  User.register({username: req.body.username,senioremail: req.body.senioremail}, req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/upload");
      });
    }
  });

});

app.post("/login", function(req, res){

  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/upload");
      });
    }
  });

});




app.listen(3000, function() {
  console.log("Server started on port 3000.");
});
