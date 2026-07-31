const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("los cuatro roles contractuales existen en backend y frontend", () => {
    const backend = read("backend/src/modules/rolesPermisos/permisos.catalog.js");
    const frontend = read("frontend-web/src/components/Layout.jsx");
    for (const role of ["Administrador", "Optometra", "Cajero", "Vendedor"]) {
        assert.match(backend, new RegExp(role));
        assert.match(frontend, new RegExp(role));
    }
});

test("el dashboard deniega roles fuera del catalogo interno", () => {
    const dashboard = read("backend/src/modules/dashboard/dashboard.routes.js");
    assert.match(dashboard, /rol\(\["Administrador", "Optometra", "Cajero", "Vendedor"\]\)/);
    const frontend = read("frontend-web/src/pages/Dashboard.jsx");
    assert.match(frontend, /RESTRICTED_CONTENT/);
    assert.doesNotMatch(frontend, /\|\| ROLE_CONTENT\.Vendedor/);
});

test("administracion de usuarios esta protegida en backend y frontend", () => {
    assert.match(read("backend/src/modules/usuarios/usuarios.routes.js"), /Administrador/);
    assert.match(read("frontend-web/src/App.jsx"), /roles-permisos[\s\S]*Administrador/);
});

test("rutas clinicas exigen optometra o administrador", () => {
    const routes = read("backend/src/modules/historiaClinica/historia.routes.js");
    assert.match(routes, /Administrador/);
    assert.match(routes, /Optometra/);
});

test("rutas financieras no incluyen vendedor", () => {
    const caja = read("backend/src/modules/caja/caja.routes.js");
    assert.match(caja, /Administrador/);
    assert.match(caja, /Cajero/);
    assert.doesNotMatch(caja, /Vendedor/);
});
