const pool = require("../../config/database");
const { PERMISOS, ROLES } = require("./permisos.catalog");

exports.listar = async () => {
    const result = await pool.query("SELECT id_rol,nombre_rol,descripcion FROM roles ORDER BY id_rol");
    const roles = result.rows.length ? result.rows.map((rol) => rol.nombre_rol) : ROLES;

    const permisosPorRol = roles.map((rol) => ({
        rol,
        permisos: PERMISOS
            .filter((permiso) => permiso.roles.includes(rol))
            .map(({ modulo, accion }) => ({ modulo, accion }))
    }));

    return {
        roles: result.rows,
        modulos: PERMISOS,
        permisosPorRol
    };
};
