const mongoose = require('mongoose');

const SuscripcionPushSchema = new mongoose.Schema({
    endpoint: { type: String, required: true, unique: true },
    expirationTime: { type: Number, default: null },
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
    },
    fechaRegistro: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SuscripcionPush', SuscripcionPushSchema);
