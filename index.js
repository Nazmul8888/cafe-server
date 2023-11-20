const express = require('express');
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;




const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}


app.use(cors(corsOptions))
app.use(express.json())


// cafeUser Tt1RNqNLALovoDY4


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6nodxbc.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
   


    const userCollection = client.db("cafee").collection("users");
    const menuCollection = client.db("cafee").collection("menu");
    const reviewsCollection = client.db("cafee").collection("reviews");
    const cartCollection = client.db("cafee").collection("carts");

  //  token related api

    app.post('/jwt', async(req,res)=>{
      const user = req.body;
      console.log(user,'user')
      if(!user) return
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    // middleware 

    const verifyToken = (req,res,next)=>{
      // console.log('inside verify token', req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message: 'forbidden access '});
      }

      const token = req.headers.authorization.split(' ')[1];
      // console.log(token)
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err, decoded) =>{
        if(err){
          return res.status(401).send({message: 'forbidden access'})
        }
        req.decoded = decoded;
        next();
      })
      
    }

    // verify token

    const verifyAdmin = async(req,res,next)=>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role ==='admin';
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access '})
      }
      next();
    }

    
    // users api related
    app.get('/users',verifyToken,verifyAdmin, async(req,res)=>{
      const result = await userCollection.find().toArray();
        res.send(result);
    })

    app.get('/users/admin/:email', verifyToken, async(req,res)=>{
      const email = req.params.email;
      // console.log(email)
      if(email !== req.decoded.email){
        return res.status(403).send({message:'unauthorized access'})
      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      // console.log(user)
      let admin = false;
      if(user){
        admin = user?.role === 'admin';
      }
      res.send({admin}); 
    })

    app.post('/users', async(req,res)=>{
      const user = req.body;
      console.log(user, 'safe')
      const query = {email: user?.email}
      const existingUser = await userCollection.findOne(query);
      if(existingUser){
        return res.send({message:'user already exist ', insertedId: null})
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    app.patch('users/admin/:id', async(req,res)=>{
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);

    })



    app.delete('/users/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await userCollection.deleteOne(query);
      res.send(result);
    })



 

       // menu related api
    app.get('/menu', async(req,res)=>{
        const result = await menuCollection.find().toArray();
      //   console.log(result)
      //  console.log( 'this is')
        res.send(result)
    })

    app.post('/menu', verifyToken, verifyAdmin, async(req,res)=>{
      const item = req.body;
      const result = await menuCollection.insertOne(item);
      res.send(result)
    })
    // update

    app.patch('/menu/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }

      const result = await menuCollection.updateOne(filter, updatedDoc)
      res.send(result);
    })


    app.delete('/menu/:id', verifyToken, verifyAdmin, async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

 
    app.get('/reviews', async(req,res)=>{
        const result = await reviewsCollection.find().toArray();
        res.send(result)
    })

    // cart collection

    app.get('/carts', async(req,res)=>{
      const email = req.query.email;
      const query = {email: email};
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })


    app.post('/carts', async(req,res)=>{
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    })

    app.delete('/carts/:id', async (req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

    // payment intent 
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      console.log(amount, 'amount inside the intent')

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    });
 





    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.use(cors());
app.use(express.json());


app.get('/', (req,res)=>{
    res.send('cafe is running')
})

app.listen(port,()=>{
    console.log(`cafe is coming on port ${port}`);
})