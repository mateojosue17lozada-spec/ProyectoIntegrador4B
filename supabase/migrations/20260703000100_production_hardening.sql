-- Production hardening for the optometry workflow.
-- Idempotent because this project may already have the bootstrap schema applied.

ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS lugar_nacimiento VARCHAR(150);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS genero VARCHAR(30);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS ocupacion VARCHAR(120);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS procedencia VARCHAR(150);
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS uso_lentes BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS ultimo_control DATE;
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE citas ADD COLUMN IF NOT EXISTS consultorio VARCHAR(80);
ALTER TABLE citas ADD COLUMN IF NOT EXISTS tarifa NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE citas ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE historias_clinicas ADD COLUMN IF NOT EXISTS consultorio VARCHAR(80);
ALTER TABLE historias_clinicas ADD COLUMN IF NOT EXISTS consentimiento_informado BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE historias_clinicas ADD COLUMN IF NOT EXISTS firma_paciente TEXT;
ALTER TABLE historias_clinicas ADD COLUMN IF NOT EXISTS nombre_examinador VARCHAR(180);
ALTER TABLE historias_clinicas ADD COLUMN IF NOT EXISTS nivel_paralelo VARCHAR(80);
ALTER TABLE historias_clinicas ADD COLUMN IF NOT EXISTS jornada VARCHAR(40);

ALTER TABLE productos ADD COLUMN IF NOT EXISTS sku VARCHAR(100);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tipo_lente VARCHAR(80);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS filtro VARCHAR(80);

ALTER TABLE recetas ADD COLUMN IF NOT EXISTS detalles JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE pedidos_laboratorio ADD COLUMN IF NOT EXISTS actualizado_en TIMESTAMP NOT NULL DEFAULT NOW();

ALTER TABLE facturas ADD COLUMN IF NOT EXISTS id_promocion INTEGER REFERENCES promociones(id_promocion);
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS impuestos NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS autorizacion_fiscal VARCHAR(100);

CREATE TABLE IF NOT EXISTS cie10_catalogo (
    codigo VARCHAR(12) PRIMARY KEY,
    descripcion VARCHAR(255) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO cie10_catalogo(codigo, descripcion) VALUES
('H52.0','Hipermetropía'),
('H52.1','Miopía'),
('H52.2','Astigmatismo'),
('H52.4','Presbicia'),
('H53.0','Ambliopía'),
('H50.0','Estrabismo convergente'),
('H50.1','Estrabismo divergente'),
('H10.9','Conjuntivitis no especificada'),
('H04.1','Otros trastornos de la glándula lagrimal'),
('Z01.0','Examen de ojos y de la visión')
ON CONFLICT (codigo) DO UPDATE SET descripcion=EXCLUDED.descripcion;

CREATE OR REPLACE FUNCTION validar_pago_atencion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    cita_record citas%ROWTYPE;
    total_pagado NUMERIC(10,2);
BEGIN
    IF NEW.id_cita IS NULL THEN
        RAISE EXCEPTION 'La atención requiere una cita';
    END IF;

    SELECT * INTO cita_record FROM citas WHERE id_cita=NEW.id_cita;
    IF NOT FOUND OR cita_record.id_paciente <> NEW.id_paciente THEN
        RAISE EXCEPTION 'La cita no corresponde al paciente';
    END IF;

    SELECT COALESCE(SUM(monto),0) INTO total_pagado
    FROM pagos_previos WHERE id_cita=NEW.id_cita;

    IF NOT cita_record.pago_previo OR total_pagado <= 0 THEN
        RAISE EXCEPTION 'Se requiere pago previo confirmado antes de la atención';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS historias_validar_pago ON historias_clinicas;
CREATE TRIGGER historias_validar_pago
BEFORE INSERT OR UPDATE OF id_cita,id_paciente ON historias_clinicas
FOR EACH ROW EXECUTE FUNCTION validar_pago_atencion();

DROP TRIGGER IF EXISTS examenes_validar_pago ON examen_visual;
CREATE TRIGGER examenes_validar_pago
BEFORE INSERT OR UPDATE OF id_cita,id_paciente ON examen_visual
FOR EACH ROW EXECUTE FUNCTION validar_pago_atencion();

CREATE OR REPLACE FUNCTION proteger_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION 'Los registros de auditoría son inmutables';
END;
$$;

DROP TRIGGER IF EXISTS auditoria_inmutable ON auditoria;
CREATE TRIGGER auditoria_inmutable
BEFORE UPDATE OR DELETE ON auditoria
FOR EACH ROW EXECUTE FUNCTION proteger_auditoria();

CREATE UNIQUE INDEX IF NOT EXISTS caja_un_turno_abierto_cajero_idx
ON caja_turnos(id_cajero) WHERE estado='Abierta';

CREATE UNIQUE INDEX IF NOT EXISTS historias_una_por_cita_idx
ON historias_clinicas(id_cita) WHERE id_cita IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS productos_sku_idx
ON productos(sku) WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS citas_pago_fecha_idx
ON citas(pago_previo,fecha_cita,estado);

CREATE INDEX IF NOT EXISTS cie10_descripcion_idx
ON cie10_catalogo USING gin (to_tsvector('spanish', descripcion));

REVOKE ALL ON cie10_catalogo FROM anon, authenticated;
ALTER TABLE cie10_catalogo ENABLE ROW LEVEL SECURITY;
