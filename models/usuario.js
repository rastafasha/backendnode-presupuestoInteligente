'use strict'
var mongoose = require('mongoose');
const { Schema, model } = require('mongoose');

const usuarioSchema = Schema({
    username: { type: String, require: true },
    email: { type: String, require: true, unique: true },
    password: { type: String, require: true },
    role: { type: String, require: true, default: 'USER' },
    terminos: { type: Boolean, require: false },
    google: { type: Boolean, default: false },
    profile: { type: Schema.Types.ObjectId, ref: 'Profile' },
    project: { type: Schema.Types.ObjectId, ref: 'Project' },
    createdAt: { type: Date, default: Date.now, required: true },
    updatedAt: { type: Date, default: Date.now, required: true }
}, { collection: 'usuarios' });

usuarioSchema.method('toJSON', function() { // modificar el _id a uid, esconde el password
    const { __v, _id, password, ...object } = this.toObject();
    // const { __v, _id,  ...object } = this.toObject();
    object.uid = _id;
    return object;
});

module.exports = mongoose.model('Usuario', usuarioSchema);