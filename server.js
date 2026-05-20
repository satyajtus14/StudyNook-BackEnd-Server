const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

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
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("studynook-db");
    const roomsCollection = database.collection("rooms");
    const bookingsCollection = database.collection("bookings");

    // Example: API for Insert a new room document
    app.post("/rooms", async (req, res) => {
      try {
        const newRoomData = req.body; // Assuming the room data is sent in the request body
        console.log(newRoomData);

        const result = await roomsCollection.insertOne(newRoomData);

        res
          .status(201)
          .json({
            message: "Room added successfully",
            roomId: result.insertedId,
          });
      } catch (error) {
        console.error("Error creating room:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Example: API for Get all rooms
    app.get("/rooms", async (req, res) => {
      try {
        const rooms = await roomsCollection.find({}).toArray();
        res.status(200).json(rooms);
      } catch (error) {
        console.error("Error fetching rooms:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Example: API for Get a room by ID
    app.get("/rooms", async (req, res) => {
      try {
        const rooms = await roomsCollection.find({}).toArray();
        res.status(200).json(rooms);
      } catch (error) {
        console.error("Error fetching rooms:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // GET — Get a single room by ID
    app.get("/rooms/:id", async (req, res) => {
      try {
        const { id } = req.params;
        console.log("Received ID:", id);

        console.log("ID type:", typeof id); // ✅ should be "string"

        // ✅ See ALL rooms and their _id types
        const allRooms = await roomsCollection.find({}).toArray();
        console.log("First room _id:", allRooms[0]._id);
        console.log("First room _id type:", typeof allRooms[0]._id); // ✅ is it string or object?
        console.log("Do they match?", allRooms[0]._id === id); // ✅ true or false?

        // ✅ Your _id is a plain string — no ObjectId conversion needed
        const room = await roomsCollection.findOne({ _id: new ObjectId(id) });
        console.log("Found room:", room);

        if (!room) {
          return res.status(404).json({ message: "Room not found" });
        }

        res.status(200).json(room);
      } catch (error) {
        console.error("Error fetching room:", error.message);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Example: API for Update a room by ID
    app.put("/rooms/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updatedRoomData = req.body; // Assuming the updated room data is sent in the request body

        const result = await roomsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedRoomData },
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Room not found" });
        }

        res.status(200).json({ message: "Room updated successfully" });
      } catch (error) {
        console.error("Error updating room:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Example: API for Delete a room by ID
    app.delete("/rooms/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await roomsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Room not found" });
        }

        res.status(200).json({ message: "Room deleted successfully" });
      } catch (error) {
        console.error("Error deleting room:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    //Example: API for Booking a room
    app.post("/bookings", async (req, res) => {
      try {
        const bookingData = req.body;

      // ✅ Add status before saving
    const bookingWithStatus = {
      ...bookingData,
      status: "confirmed", // ← add this
      createdAt: new Date() // ← optional but useful
    };
        console.log("Received booking data:", bookingWithStatus);

        const result = await bookingsCollection.insertOne(bookingWithStatus);

        return res.status(201).json({
          message: "Room booked successfully",
          bookingId: result.insertedId,
        });
      } catch (error) {
        console.error("Error creating booking:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    // Example: API for Get bookings by user ID to show in "My Bookings" page
    app.get("/bookings", async (req, res) => {
      // ← remove /:userId
      try {
        const { userId } = req.query; // ← reads ?userId=xxx

        if (!userId) {
          return res.status(400).json({ message: "userId is required" });
        }

        const bookings = await bookingsCollection.find({ userId }).toArray();
        return res.json(bookings);
      } catch (error) {
        console.error("Error fetching bookings:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    // Example: API for Cancel a booking by ID
    app.delete("/booking/:bookingId", async (req, res) => {
      try {
        const { bookingId } = req.params;

        const result = await bookingsCollection.deleteOne({
          _id: new ObjectId(bookingId),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Booking not found" });
        }

        res.status(200).json({ message: "Booking cancelled successfully" });
      } catch (error) {
        console.error("Error cancelling booking:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");
  } catch (error) {
    // ✅ closes try correctly
    console.error(" MongoDB connection failed:", error);
  }
}
run();

app.get("/", (req, res) => {
  res.send("StudyNook Backend Server is running");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
