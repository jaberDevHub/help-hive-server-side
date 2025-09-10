import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import process from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({
    origin: [
        'http://localhost:5175',
        'https://help-hive-client-side.vercel.app'
        
    ],
    credentials: true
}));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    next();
});

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.osatkz4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Collections
let eventsCollection;
let joinedEvents;

// Sample data
const sampleEvents = [
    {
        title: "Beach Cleanup Drive",
        description: "Join us for a community beach cleanup to protect marine life and keep our shores beautiful.",
        eventType: "Cleanup",
        thumbnail: "https://images.unsplash.com/photo-1618477461853-cf6ed80faba5",
        location: "Miami Beach",
        eventDate: new Date("2025-12-20"),
        email: "organizer@example.com",
        createdAt: new Date()
    },
    {
        title: "Urban Tree Plantation",
        description: "Help us make our city greener by participating in our tree plantation drive.",
        eventType: "Plantation",
        thumbnail: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09",
        location: "Central Park",
        eventDate: new Date("2025-09-15"),
        email: "green@example.com",
        createdAt: new Date()
    },
    {
        title: "Plastic-Free Campaign",
        description: "Awareness campaign about reducing plastic usage and adopting sustainable alternatives.",
        eventType: "Awareness Campaign",
        thumbnail: "https://images.unsplash.com/photo-1610336016836-d5c2d53fced7",
        location: "Community Center",
        eventDate: new Date("2025-10-01"),
        email: "environment@example.com",
        createdAt: new Date()
    },
    {
        title: "Food Drive for Homeless",
        description: "Help us collect and distribute food to those in need in our community.",
        eventType: "Donation",
        thumbnail: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c",
        location: "Downtown Shelter",
        eventDate: new Date("2025-08-30"),
        email: "helper@example.com",
        createdAt: new Date()
    },
    {
        title: "River Cleanup Project",
        description: "Join our initiative to clean up the river and protect our water resources.",
        eventType: "Cleanup",
        thumbnail: "https://images.unsplash.com/photo-1567095761054-7a02e69e5c43",
        location: "River Park",
        eventDate: new Date("2025-11-05"),
        email: "watercare@example.com",
        createdAt: new Date()
    }
];

// Server and DB initialization
async function startServer() {
    try {
        await client.connect();
        console.log("Connected to MongoDB");

        const db = client.db("events_db");
        eventsCollection = db.collection("events");
        joinedEvents = db.collection("joined_events");

        const eventCount = await eventsCollection.countDocuments();
        if (eventCount === 0) {
            await eventsCollection.insertMany(sampleEvents);
            console.log("Sample events inserted");

            const sampleJoined = [
                {
                    eventId: null, // this will be updated below
                    participantEmail: "participant1@example.com",
                    joinedAt: new Date(),
                    event: sampleEvents[0]
                },
                {
                    eventId: null, // this will be updated below
                    participantEmail: "participant2@example.com",
                    joinedAt: new Date(),
                    event: sampleEvents[1]
                }
            ];

            const insertedEvents = await eventsCollection.find({}).toArray();

            sampleJoined[0].eventId = insertedEvents[0]._id.toString();
            sampleJoined[1].eventId = insertedEvents[1]._id.toString();

            await joinedEvents.insertMany(sampleJoined);
            console.log("Sample joined events inserted");
        }

        // Start server
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });

    } catch (error) {
        console.error("Startup error:", error);
        process.exit(1);
    }
}

// Routes
app.get('/', (req, res) => {
    res.send("Hello World!");
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/events', async (req, res) => {
    try {
        const { title, eventDate } = req.body;
        if (!title || !eventDate) {
            return res.status(400).json({ message: "Title and event date are required" });
        }

        const event = {
            ...req.body,
            eventDate: new Date(eventDate),
            createdAt: new Date()
        };

        const result = await eventsCollection.insertOne(event);
        res.status(201).json({ message: "Event created", eventId: result.insertedId });
    } catch (error) {
        console.error("Create event error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get('/api/events', async (req, res) => {
    try {
        const { eventType, search } = req.query;
        const query = { eventDate: { $gte: new Date() } };

        if (eventType && eventType !== "All") query.eventType = eventType;
        if (search) query.title = { $regex: search, $options: "i" };

        const events = await eventsCollection.find(query).sort({ eventDate: 1 }).toArray();
        res.json(events);
    } catch (error) {
        console.error("Fetch events error:", error);
        res.status(500).json({ message: "Failed to fetch events" });
    }
});

app.get('/api/events/:id', async (req, res) => {
    try {
        const event = await eventsCollection.findOne({ _id: new ObjectId(req.params.id) });
        if (!event) return res.status(404).json({ message: "Event not found" });
        res.json(event);
    } catch (error) {
        console.error("Get event error:", error);
        res.status(500).json({ message: "Failed to fetch event" });
    }
});

app.patch('/api/events/:id', async (req, res) => {
    try {
        const result = await eventsCollection.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { ...req.body, updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) return res.status(404).json({ message: "Event not found" });
        res.json({ message: "Event updated" });
    } catch (error) {
        console.error("Update event error:", error);
        res.status(500).json({ message: "Failed to update event" });
    }
});

app.delete('/api/events/:id', async (req, res) => {
    try {
        const result = await eventsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.status(404).json({ message: "Event not found" });
        res.json({ message: "Event deleted" });
    } catch (error) {
        console.error("Delete event error:", error);
        res.status(500).json({ message: "Failed to delete event" });
    }
});

app.get('/api/events/user/:email', async (req, res) => {
    try {
        const events = await eventsCollection
            .find({ email: req.params.email })
            .sort({ createdAt: -1 })
            .toArray();
        res.json(events);
    } catch (error) {
        console.error("User events error:", error);
        res.status(500).json({ message: "Failed to fetch user events" });
    }
});

app.post('/api/events/:id/join', async (req, res) => {
    try {
        const eventId = req.params.id;
        const { email } = req.body;

        if (!email) return res.status(400).json({ message: "Email is required" });

        const event = await eventsCollection.findOne({ _id: new ObjectId(eventId) });
        if (!event) return res.status(404).json({ message: "Event not found" });

        const alreadyJoined = await joinedEvents.findOne({ eventId, participantEmail: email });
        if (alreadyJoined) return res.status(400).json({ message: "Already joined this event" });

        await joinedEvents.insertOne({
            eventId,
            participantEmail: email,
            joinedAt: new Date(),
            event
        });

        res.status(201).json({ message: "Successfully joined event" });
    } catch (error) {
        console.error("Join event error:", error);
        res.status(500).json({ message: "Failed to join event" });
    }
});

app.get('/api/events/user/:email/joined', async (req, res) => {
    try {
        const joined = await joinedEvents
            .find({ participantEmail: req.params.email })
            .sort({ joinedAt: -1 })
            .toArray();
        res.json(joined);
    } catch (error) {
        console.error("Fetch joined events error:", error);
        res.status(500).json({ message: "Failed to fetch joined events" });
    }
});

// Global error handler
app.use((err, req, res) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ message: "Internal server error" });
});

// Start server
startServer();
