const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const URI = process.env.MONGODB_URI;
const PORT = process.env.PORT;

const client = new MongoClient(URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let JWKS;

async function initJWKS() {
  JWKS = await createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
  );
  console.log("JWKS initialized ✅");
}

// ── Auth middleware ───────────────────────────────────────────────
const verifyToken = async (req, res, next) => {
    console.log("=== verifyToken called ===");
  console.log("All headers:", req.headers);        
  console.log("Auth header:", req.headers.authorization); 


  const authHeader = req.headers.authorization;
  console.log("Auth header received:", authHeader);

  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized — no auth header" });
  }

  const token = authHeader.split(" ")[1];
    console.log("Extracted token:", token);

  if (!token) {
    return res.status(401).json({ message: "Unauthorized — no token" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    console.log("✅ Token valid. Payload:", payload); // ✅ now you'll see payload
    req.user = payload; // ✅ attach to request so routes can use it
    next();
  } catch (error) {
    console.error("❌ Token verification failed:", error.message);
    return res.status(403).json({ message: "Forbidden — invalid token" });
  }
};

async function run() {
  await initJWKS();

  try {
    await client.connect();

    const database = client.db("studynook-db");
    const roomsCollection = database.collection("rooms");
    const bookingsCollection = database.collection("bookings");
    const listingsCollection = database.collection("listings");

    // ── Public routes ─────────────────────────────────────────────

    app.get("/", (req, res) => {
      res.send("StudyNook Backend Server is running");
    });

    app.get("/available-rooms", async (req, res) => {
      const result = await roomsCollection.find({}).limit(6).toArray();
      res.json(result);
    });

    app.get("/rooms", async (req, res) => {
      try {
        const rooms = await roomsCollection.find({}).toArray();
        res.status(200).json(rooms);
      } catch (error) {
        console.error("Error fetching rooms:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    app.get("/rooms/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const room = await roomsCollection.findOne({ _id: new ObjectId(id) });

        if (!room) {
          return res.status(404).json({ message: "Room not found" });
        }

        res.status(200).json(room);
      } catch (error) {
        console.error("Error fetching room:", error.message);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // ── Protected routes (verifyToken applied) ────────────────────

    // POST /rooms — add a new room
    app.post("/rooms", verifyToken, async (req, res) => {
      try {
        const newRoomData = req.body;
        console.log("New room data:", newRoomData);
        console.log("Requested by user:", req.user); // ✅ payload available here

        const result = await roomsCollection.insertOne(newRoomData);
        res.status(201).json({
          message: "Room added successfully",
          roomId: result.insertedId,
        });
      } catch (error) {
        console.error("Error creating room:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // PUT /rooms/:id — update room in both collections
    app.put("/rooms/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const updatedRoomData = req.body;
        console.log("Updating room:", id, "by user:", req.user);

        await roomsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedRoomData }
        );

        await listingsCollection.updateOne(
          { roomId: id },
          { $set: updatedRoomData }
        );

        res.status(200).json({ message: "Updated in both collections" });
      } catch (error) {
        console.error("Error updating room:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // DELETE /rooms/:id — delete from roomsCollection
    app.delete("/rooms/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        console.log("Deleting room:", id, "by user:", req.user);

        const roomResult = await roomsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        console.log("roomsCollection deletedCount:", roomResult.deletedCount);

        res.status(200).json({ message: "Deleted from rooms" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // GET /listings — get listings by userId
    app.get("/listings", verifyToken, async (req, res) => {
      try {
        const { userId } = req.query;

        if (!userId) {
          return res.status(400).json({ message: "userId is required" });
        }

        const listings = await listingsCollection.find({ userId }).toArray();
        res.status(200).json(listings);
      } catch (error) {
        console.error("Error fetching listings:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // POST /listings — create listing in both collections
    app.post("/listings", verifyToken, async (req, res) => {
      try {
        const listing = req.body;
        console.log("Creating listing by user:", req.user); // ✅ payload logged

        if (!listing.userId) {
          return res.status(400).json({ message: "userId is required" });
        }

        const roomResult = await roomsCollection.insertOne(listing);
        const roomId = roomResult.insertedId.toString();

        const listingWithRoomId = { ...listing, roomId };
        const listingResult = await listingsCollection.insertOne(listingWithRoomId);

        res.status(201).json({
          message: "Room listed successfully",
          insertedId: listingResult.insertedId,
          roomId,
        });
      } catch (error) {
        console.error("Error creating listing:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // PUT /listings/:id — update listing by its own _id
    app.put("/listings/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const updatedData = req.body;

        const result = await listingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        console.log("listingsCollection matchedCount:", result.matchedCount);

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Listing not found" });
        }

        res.status(200).json({ message: "Listing updated successfully" });
      } catch (error) {
        console.error("Error updating listing:", error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // DELETE /listings/:id — delete from listingsCollection
    app.delete("/listings/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;

        const listingResult = await listingsCollection.deleteOne({
          _id: new ObjectId(id),
        });
        console.log("listingsCollection deletedCount:", listingResult.deletedCount);

        if (listingResult.deletedCount === 0) {
          return res.status(404).json({ message: "Listing not found" });
        }

        res.status(200).json({ message: "Deleted from listings" });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
      }
    });

    // GET /bookings — get bookings by userId
    app.get("/bookings", verifyToken, async (req, res) => {
      try {
        const { userId } = req.query;

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

    // POST /bookings — create a booking
    app.post("/bookings", verifyToken, async (req, res) => {
      try {
        const bookingData = req.body;
        const { roomId, date, startTime, endTime } = bookingData;

        const conflict = await bookingsCollection.findOne({
          roomId,
          date,
          $and: [
            { startTime: { $lt: endTime } },
            { endTime: { $gt: startTime } },
          ],
        });

        if (conflict) {
          return res.status(409).json({
            message: `Room already booked from ${conflict.startTime} to ${conflict.endTime}`,
          });
        }

        const bookingWithStatus = {
          ...bookingData,
          status: "confirmed",
          createdAt: new Date(),
        };

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

    // PATCH /booking/:bookingId — cancel a booking
    app.patch("/booking/:bookingId", verifyToken, async (req, res) => {
      try {
        const { bookingId } = req.params;

        const result = await bookingsCollection.updateOne(
          { _id: new ObjectId(bookingId) },
          { $set: { status: "cancelled" } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).json({ message: "Booking not found" });
        }

        return res.status(200).json({ message: "Booking cancelled successfully" });
      } catch (error) {
        console.error("Error cancelling booking:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("You successfully connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB connection failed:", error);
  }
}

run();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});