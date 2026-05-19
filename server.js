const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');


const app = express();
app.use(cors());
app.use(express.json());



const URI = process.env.MONGODB_URI;
const PORT = process.env.PORT;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("studynook-db");
    const roomsCollection = database.collection("rooms");

    // Example: API for Insert a new room document
   app.post('/rooms', async (req, res) => {
      try {
        const newRoomData = req.body; // Assuming the room data is sent in the request body
        console.log(newRoomData);
        
        const result = await roomsCollection.insertOne(newRoomData);

        res.status(201).json({ message: 'Room added successfully', roomId: result.insertedId });
      } catch (error) {
        console.error('Error creating room:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

    // Example: API for Get all rooms
    app.get('/rooms', async (req, res) => {
      try {
        const rooms = await roomsCollection.find({}).toArray();
        res.status(200).json(rooms);
      } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    });

  // Example: API for Get a room by ID
    app.get('/rooms/:id', async (req, res) => {
      try {
        const roomId = req.params.id;
        const room = await roomsCollection.findOne({ _id: new ObjectId(roomId) });

        if (!room) {
          return res.status(404).json({ message: 'Room not found' });
        }

        res.status(200).json(room);
      } catch (error) {
        console.error('Error fetching room:', error);
        res.status(500).json({ message: 'Internal server error' });
      }
    }); 

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");
  } 
  
catch (error) {                                    // ✅ closes try correctly
    console.error(" MongoDB connection failed:", error);
  }
}
run();


app.get('/', (req, res) => {
    res.send('StudyNook Backend Server is running');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});