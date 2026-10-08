const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const Usuario = require('../models/usuario');

const usuariosData = [
    {
        first_name: 'Super',
        last_name: 'Admin',
        email: 'superadmin@superadmin.com',
        password: 'password',
        role: 'SUPERADMIN',
        pais: 'VE',
        ciudad: 'Caracas'
    },
    {
        first_name: 'Admin',
        last_name: 'Admin',
        email: 'admin@admin.com',
        password: 'password',
        role: 'ADMIN',
        pais: 'VE',
        ciudad: 'Caracas'
    },
    {
        first_name: 'User',
        last_name: 'User',
        email: 'user@user.com',
        password: 'password',
        role: 'USER',
        pais: 'VE',
        ciudad: 'Caracas'
    }
];

const seedUsuarios = async () => {
    try {
        // Conectar a la base de datos
        await mongoose.connect(process.env.DB_MONGO);
        console.log('✅ Conectado a la base de datos');

        // Eliminar usuarios existentes
        await Usuario.deleteMany({});
        console.log('✅ Usuarios existentes eliminados');

        // Hashear contraseñas e insertar usuarios
        const usuariosConHash = await Promise.all(
            usuariosData.map(async (usuario) => {
                const salt = bcrypt.genSaltSync();
                usuario.password = bcrypt.hashSync(usuario.password, salt);
                return usuario;
            })
        );

        await Usuario.insertMany(usuariosConHash);
        console.log('✅ Usuarios insertados correctamente');
        console.log('   - superadmin@superadmin.com (SUPERADMIN)');
        console.log('   - admin@admin.com (ADMIN)');
        console.log('   - user@user.com (USER)');

        mongoose.connection.close();
        console.log('✅ Conexión cerrada');
    } catch (error) {
        console.error('❌ Error al ejecutar el seeder:', error);
        process.exit(1);
    }
};

seedUsuarios();

