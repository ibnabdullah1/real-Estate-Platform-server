const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://realestatecommunity-99b97.web.app",
      "https://real-estate-community.web.app",
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
const stripe = require("stripe")(`${process.env.STRIPE_TEST_SECRET_KEY}`);
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rjnekog.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middlewares
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access " });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    } else {
      req.decoded = decoded;
      next();
    }
  });
};
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("realEstateDB").collection("users");
    const reportCollection = client.db("realEstateDB").collection("reports");
    const paymentCollection = client.db("realEstateDB").collection("payments");
    const requestedPropertiesCollection = client
      .db("realEstateDB")
      .collection("requestedProperties");
    const reviewsCollection = client.db("realEstateDB").collection("reviews");
    const wishlistsCollection = client
      .db("realEstateDB")
      .collection("wishlists");
    const offersCollection = client.db("realEstateDB").collection("offers");
    const advertiseCollection = client
      .db("realEstateDB")
      .collection("advertises");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "3h",
      });

      res.send({ token });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      res.clearCookie("token", { maxAge: 0 }).send({ success: true });
    });

    // Save or modify user email, status in DB
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const isExist = await usersCollection.findOne(query);
      if (isExist) return res.send(isExist);
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...user, timestamp: Date.now() },
        },
        options
      );
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/agents", async (req, res) => {
      const query = { role: "agent" };
      const result = await usersCollection.find(query).toArray();

      res.send(result);
    });

    // properties saving in database
    app.post("/requestedProperties", async (req, res) => {
      const requestProperty = req.body;
      const result = await requestedPropertiesCollection.insertOne(
        requestProperty
      );
      res.send(result);
    });

    // Get all properties
    app.get("/requestedProperties", async (req, res) => {
      const result = await requestedPropertiesCollection.find().toArray();
      res.send(result);
    });

    app.get("/requestedProperty", async (req, res) => {
      const query = { status: "verified", isDeleted: { $ne: true } };
      const result = await requestedPropertiesCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/requestedProperty/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestedPropertiesCollection.findOne(query);
      res.send(result);
    });
    // requestedProperty

    // Agent properties updated api
    app.put("/updateStatus/:id", async (req, res) => {
      const id = req.params.id;
      const message = await req.body;

      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: message.status,
        },
      };
      const result = await requestedPropertiesCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });
    // Agent properties updated api
    app.put("/requestedProperty/:id", async (req, res) => {
      const id = req.params.id;
      const property = await req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          location: property.location,
          title: property.title,
          price: property.price,
          image: property.image,
        },
      };
      const result = await requestedPropertiesCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    // admin ads properties collection
    app.put("/addAdsStatus/:id", async (req, res) => {
      const id = req.params.id;
      const message = await req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          adsStatus: message.adsStatus,
        },
      };

      const result = await requestedPropertiesCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    // Agent properties deleted api
    app.put("/agentPropertyDeletedStatus/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          isDeleted: true,
        },
      };
      const result = await requestedPropertiesCollection.updateOne(
        query,
        updateDoc
      );
      res.send(result);
    });

    app.get("/properties/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestedPropertiesCollection.findOne(query);
      res.send(result);
    });
    //get properties for agent
    app.get("/addedProperty/agent/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await requestedPropertiesCollection
        .find({ "agent.email": email, isDeleted: { $ne: true } })
        .toArray();
      res.send(result);
    });

    app.get("/addedProperty/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestedPropertiesCollection.findOne(query);
      res.send(result);
    });

    // search input based get properties
    app.get("/searchProperties/:name", async (req, res) => {
      const name = req.params.name;

      const result = await requestedPropertiesCollection
        .find({
          $or: [{ name: { $regex: name, $options: "i" } }],
        })
        .toArray();

      res.send(result);
    });

    // Users related api methods

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // Users Role updated methods
    app.put("/user/:id", async (req, res) => {
      const id = req.params.id;
      const message = await req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: message.role,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Fraud user data deleted all databases collections
    app.post("/fraudUserData", async (req, res) => {
      const data = req.body;
      const deleteAds = await advertiseCollection.deleteMany({
        _id: { $in: data },
      });

      const query = {
        _id: {
          $in: data.map((id) => new ObjectId(id)),
        },
      };
      const deleteProperties = await requestedPropertiesCollection.deleteMany(
        query
      );
      res.send({ deleteAds, deleteProperties });
    });

    // wishlist  api
    app.post("/wishlists", async (req, res) => {
      const wishlists = req.body;
      const id = wishlists._id;
      const query = { _id: id };
      const isExist = await wishlistsCollection.findOne(query);
      if (isExist) {
        return res.send({ message: "Is already added in wishlist " });
      }
      const result = await wishlistsCollection.insertOne(wishlists);
      res.send(result);
    });
    app.get("/wishlists/:email", async (req, res) => {
      const email = req.params.email;
      const query = { buyerEmail: email };
      const result = await wishlistsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/wishlist/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await wishlistsCollection.findOne(query);
      res.send(result);
    });

    app.delete("/wishlist/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await wishlistsCollection.deleteOne(query);
      res.send(result);
    });

    app.put("/property-review/:id", async (req, res) => {
      const id = req.params.id;
      const data = await req.body;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $push: {
          reviewsCollection: data,
        },
      };
      const result = await requestedPropertiesCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    // reviews related api
    // Save user reviews in DB
    app.post("/reviews", async (req, res) => {
      const review = req.body;
      const result = await reviewsCollection.insertOne(review);
      res.send(result);
    });
    // specific user reviews
    app.get("/reviews/:username", async (req, res) => {
      const username = req.params.username;
      const query = { reviewerName: username };
      const result = await reviewsCollection.find(query).toArray();
      res.send(result);
    });
    // Get all reviews
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result);
    });

    app.delete("/review/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await reviewsCollection.deleteOne(query);
      res.send(result);
    });

    // Report related api
    app.post("/reports", async (req, res) => {
      const review = req.body;
      const result = await reportCollection.insertOne(review);
      res.send(result);
    });
    // Get all reports
    app.get("/reports", async (req, res) => {
      const result = await reportCollection.find().toArray();
      res.send(result);
    });

    app.delete("/reportProperty/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestedPropertiesCollection.deleteOne(query);
      res.send(result);
    });

    // user  offer related api

    // // add offersItem
    app.post("/addedOffers", verifyToken, async (req, res) => {
      const offerItem = req.body;

      const result = await offersCollection.insertOne(offerItem);
      res.send(result);
    });

    // All coffer item(get method)

    app.get("/addedOfferPayment/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await offersCollection.findOne(query);
      res.send(result);
    });

    app.get("/addedOffer/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { buyerEmail: email };
      const result = await offersCollection.find(query).toArray();
      res.send(result);
    });

    // Requested properties in offers collection(agent)
    app.get("/requestOffer/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { "agent.email": email };
      const result = await offersCollection.find(query).toArray();
      res.send(result);
    });

    // Agent sold properties
    app.get("/soldProperties/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        status: "bought",
        "agent.email": email,
      };
      const result = await offersCollection.find(query).toArray();
      res.send(result);
    });

    // New field added
    app.put("/offerDataUpdate/:id", async (req, res) => {
      const id = req.params.id;
      const data = await req.body;
      const filter = { _id: id };
      const updateDoc = {
        $set: {
          status: data.status,
          transactionId: data.transactionId,
        },
      };
      const result = await offersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // status update
    app.put("/requestOffer/:id", async (req, res) => {
      const id = req.params.id;
      const message = await req.body;
      const filter = { _id: id };
      const updateDoc = {
        $set: {
          status: message.status,
        },
      };
      const result = await offersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //payment intended
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const Result = await paymentCollection.insertOne(payment);
      res.send(Result);
    });

    // Advertisement related api
    // added property for advertisement
    app.post("/advertisement", async (req, res) => {
      try {
        const advertisement = req.body;
        const collectionLength =
          await advertiseCollection.estimatedDocumentCount();
        if (collectionLength < 6) {
          const result = await advertiseCollection.insertOne(advertisement);
          res.send({ message: "success" });
        } else {
          res.send({
            message: "Advertisement collection must have more than 6 items.",
          });
        }
      } catch (error) {
        console.error(error.message);
      }
    });
    app.get("/advertisementProperties", async (req, res) => {
      const result = await advertiseCollection.find().toArray();
      res.send(result);
    });

    app.delete("/removeAds/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: id };
      const result = await advertiseCollection.deleteOne(query);
      res.send(result);
    });

    // fraud agent api

    app.get("/fraudAgent/:email", async (req, res) => {
      const email = req.params.email;
      const result = await requestedPropertiesCollection
        .find({ "agent.email": email })
        .toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Real Estate Community  is running");
});

app.listen(port, () => {
  console.log(`Real Estate Community Server is running on port ${port}`);
});
