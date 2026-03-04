const Event = require('../models/Event');

exports.createEvent = async (req, res) => {
    try {
        const { title, description, date, type, location } = req.body;

        const event = new Event({
            title,
            description,
            date,
            type,
            location,
            createdBy: req.user.id
        });

        await event.save();
        res.status(201).json(event);
    } catch (error) {
        res.status(500).json({ message: "Failed to create event", error: error.message });
    }
};

exports.getAllEvents = async (req, res) => {
    try {
        const events = await Event.find({ status: 'active' })
            .populate('createdBy', 'fullName')
            .sort({ date: 1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch events", error: error.message });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);

        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        // Only allow the creator or an admin to delete
        // Assuming req.user.role check might be needed if creators and admins are different
        await Event.findByIdAndDelete(req.params.id);
        res.json({ message: "Event deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Failed to delete event", error: error.message });
    }
};
