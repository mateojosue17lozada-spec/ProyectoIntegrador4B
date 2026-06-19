const { poolPromise, sql } = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {

        const pool = await poolPromise;

        const result = await pool.request()
            .input('username', sql.VarChar, username)
            .query('SELECT * FROM Usuarios WHERE username = @username');


        if (result.recordset.length === 0) {
            return res.status(401).json({ 
                message: 'Usuario o contraseña incorrectos' 
            });
        }


        const user = result.recordset[0];


        const isMatch = await bcrypt.compare(password, user.password);


        if (!isMatch) {
            return res.status(401).json({ 
                message: 'Usuario o contraseña incorrectos' 
            });
        }


        const token = jwt.sign(
            { 
                id: user.id, 
                rol: user.rol, 
                nombre: user.nombre 
            },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );


        res.json({
            token,
            user: {
                nombre: user.nombre,
                usuario: user.usuario,
                rol: user.rol
            }
        });


    } catch (error) {

        console.error('Error en el login:', error);

        res.status(500).json({ 
            message: 'Error en el servidor' 
        });

    }
};