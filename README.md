# Sistema de Gestión para Centro Optométrico

Sistema web desarrollado como proyecto integrador para la administración de un centro optométrico, permitiendo gestionar pacientes, citas médicas, exámenes visuales y usuarios mediante una arquitectura cliente-servidor basada en APIs REST.

---

## Descripción

El proyecto tiene como objetivo optimizar los procesos administrativos y clínicos de un centro optométrico, centralizando la información de pacientes y automatizando el registro de consultas y exámenes visuales.

Actualmente el sistema se encuentra en desarrollo y está siendo construido utilizando tecnologías modernas de desarrollo web.

---

## Objetivos

- Digitalizar los procesos administrativos del centro optométrico.
- Gestionar pacientes y su historial clínico.
- Administrar citas médicas.
- Registrar exámenes visuales.
- Implementar autenticación segura.
- Desarrollar una API REST para la comunicación entre frontend y backend.
- Utilizar una base de datos en la nube mediante Supabase.

---

# Tecnologías utilizadas

## Frontend

- React
- JavaScript
- HTML5
- CSS3

## Backend

- Node.js
- Express.js

## Base de Datos

- PostgreSQL
- Supabase

## Herramientas

- Git
- GitHub
- Postman
- Visual Studio Code

## Gestión del proyecto

- Jira

---

# Arquitectura

El proyecto sigue una arquitectura cliente-servidor.

React (Frontend)

↓

API REST (Node.js + Express)

↓

PostgreSQL (Supabase)

---

# Funcionalidades

## Autenticación

- Inicio de sesión
- Registro de usuarios
- Encriptación de contraseñas
- JWT
- Control de acceso

---

## Pacientes

- Registrar pacientes
- Editar información
- Buscar pacientes
- Actualizar datos
- Eliminar registros

---

## Citas

- Registrar citas
- Consultar agenda
- Editar citas
- Cancelar citas

---

## Exámenes Visuales

- Registro del examen
- Información del ojo izquierdo
- Información del ojo derecho
- Observaciones clínicas

---

## Validaciones

El sistema implementa validaciones tanto en el frontend como en el backend.

Entre ellas:

- Validación de cédula ecuatoriana
- Correos electrónicos
- Contraseñas seguras
- Campos obligatorios
- Longitud mínima y máxima
- Prevención de datos inválidos

---

# API REST

El backend expone diferentes endpoints para cada módulo.

Ejemplos:

GET /api/pacientes

POST /api/pacientes

PUT /api/pacientes/:id

DELETE /api/pacientes/:id

GET /api/citas

POST /api/citas

GET /api/examenes

POST /api/examenes

---

# Base de Datos

Motor:

PostgreSQL

Servicio:

Supabase

Tablas principales

- Usuarios
- Pacientes
- Citas
- Exámenes Visuales

Relaciones mediante claves primarias y foráneas para garantizar la integridad de la información.

---

# Pruebas realizadas

Durante el desarrollo se realizaron pruebas funcionales utilizando Postman.

Entre ellas:

- Inicio de sesión
- Registro de usuarios
- CRUD de pacientes
- CRUD de citas
- CRUD de exámenes
- Validación de respuestas HTTP
- Validación de errores
- Verificación de reglas de negocio

---

# Seguridad

- Contraseñas encriptadas
- JSON Web Token (JWT)
- Validaciones del lado cliente
- Validaciones del lado servidor
- Protección de rutas

---

# Metodología

El proyecto se desarrolla utilizando una metodología ágil con organización de tareas mediante Jira.

Se trabaja mediante Git y GitHub utilizando control de versiones para facilitar el desarrollo colaborativo.

---

# Estado del proyecto

🚧 En desarrollo

Actualmente se continúa implementando nuevos módulos y mejorando la arquitectura del sistema.

---

# Aprendizajes

Durante el desarrollo de este proyecto se fortalecieron conocimientos en:

- React
- Node.js
- Express
- PostgreSQL
- Supabase
- APIs REST
- Git
- GitHub
- Postman
- Jira
- Arquitectura Cliente-Servidor
- Desarrollo Full Stack

---

# Autor

Mateo Josué Lozada Intriago

Estudiante de Tecnología Superior en Desarrollo de Software

Instituto Tecnológico Superior Cordillera

GitHub:
https://github.com/mateojosue17lozada-spec
