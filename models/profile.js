'use strict'
var mongoose = require('mongoose');
const { Schema, model } = require('mongoose');

const profileSchema = Schema({
    first_name: { type: String, require: true },
    last_name: { type: String, require: true },
    img: { type: String, require: false },
    pais: { type: Schema.ObjectId, ref: "pais" },
    estado: { type: String, require: false },
    ciudad: { type: String, require: false },
    telhome: { type: String, require: false },
    telmovil: { type: String, require: false },
    facebook: { type: String, require: false },
    instagram: { type: String, require: false },
    usuario: { type: Schema.Types.ObjectId, ref: 'Usuario' },
}, { collection: 'profiles' });



module.exports = mongoose.model('Profile', profileSchema);