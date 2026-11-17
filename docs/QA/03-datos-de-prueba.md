# DATOS DE PRUEBA Y PUBLICACIONES (ETAPA 2)
## DATA_CIRCULAR • Fundación IMARA
**Documento Técnico Oficial: QA-DOC-03**  
**Versión:** 2.0.0 (Actualizado y Certificado en Ejecución Real)  
**Fecha:** 2026-11-06  

---

## 1. RESUMEN DE PUBLICACIONES DE OFERTA CREADAS

Conforme a las directrices de la Sección 4 de la Etapa 2, se crearon formalmente tres (3) ofertas de materiales aprovechables utilizando exclusivamente a los usuarios de perfil generador (`GeneradorPrueba1` y `GeneradorPrueba2`).

Todas las ofertas fueron creadas a través del endpoint oficial `POST /api/v1/publications`, utilizando subcategorías activas del catálogo oficial precargado por la Fundación IMARA y unidades de medida estandarizadas.

---

## 2. DETALLE DE LAS TRES OFERTAS DE PRUEBA

### Oferta 1 — GeneradorPrueba1 (PET Cristal)
- **Identificador Único (UUID):** `84591486-48cd-4987-97a9-4d4088c0d20a`
- **Usuario Propietario:** `GeneradorPrueba1` (`70efd92d-8874-472d-97c2-573fcb5768fd`)
- **Tipo de Publicación:** `OFFER` (Oferta)
- **Material del Catálogo:** `PET (1)` (Categoría padre: *Plásticos*)
- **ID Categoría:** `286920c8-a05a-43ac-add4-94492c211493`
- **Cantidad:** `450.00 kg`
- **Unidad de Medida:** `Kilogramo (kg)`
- **Ubicación:** Calle 17 # 92-30, Bodega 4, Fontibón, Bogotá D.C.
- **Condición:** Limpio y prensado en pacas de 50 kg
- **Descripción:** *"Oferta 1: 450 kg de botellas PET cristal en pacas de 50 kg para recolección en bodega industrial."*
- **Requiere Transporte:** `false` (disponible para retiro en sitio o negociación)
- **Estado:** `ACTIVE`
- **Destinatarios Compatibles:** RecicladorPrueba1, TransformadorPrueba1, TransportadorPrueba1

---

### Oferta 2 — GeneradorPrueba1 (Cartón Corrugado)
- **Identificador Único (UUID):** `58ae39ac-3eaa-439f-8b7c-c093e10cca07`
- **Usuario Propietario:** `GeneradorPrueba1` (`70efd92d-8874-472d-97c2-573fcb5768fd`)
- **Tipo de Publicación:** `OFFER` (Oferta)
- **Material del Catálogo:** `Cartón corrugado` (Categoría padre: *Papel y cartón*)
- **ID Categoría:** `57f18b95-f8e1-43f4-b6f9-7d0ed9958ec0`
- **Cantidad:** `600.00 kg`
- **Unidad de Medida:** `Kilogramo (kg)`
- **Ubicación:** Calle 17 # 92-30, Bodega 4, Fontibón, Bogotá D.C.
- **Condición:** Seco y desarmado en atados planos
- **Descripción:** *"Oferta 2: 600 kg de cartón corrugado de embalaje limpio en atados planos para reciclaje."*
- **Requiere Transporte:** `false`
- **Estado:** `ACTIVE`
- **Destinatarios Compatibles:** RecicladorPrueba1, RecicladorPrueba2, TransportadorPrueba1

---

### Oferta 3 — GeneradorPrueba2 (Aluminio de Alta Pureza)
- **Identificador Único (UUID):** `89fbaf4c-14ad-4740-8c7e-f81baca69747`
- **Usuario Propietario:** `GeneradorPrueba2` (`27f5cc85-4a91-4c3f-9d9f-0c6d4a4ff2f5`)
- **Tipo de Publicación:** `OFFER` (Oferta)
- **Material del Catálogo:** `Aluminio: lámina gruesa / perfiles` (Categoría padre: *Metales*)
- **ID Categoría:** `38241d7f-e3d4-47bd-b575-ad33184a2135`
- **Cantidad:** `300.00 kg`
- **Unidad de Medida:** `Kilogramo (kg)`
- **Ubicación:** Carrera 78 # 42 Sur, Zona Industrial, Kennedy, Bogotá D.C.
- **Condición:** Clasificado y prensado en fardos
- **Descripción:** *"Oferta 3: 300 kg de latas de aluminio prensadas y clasificadas en fardos para fundición o valorización."*
- **Requiere Transporte:** `false`
- **Estado:** `ACTIVE`
- **Destinatarios Compatibles:** RecicladorPrueba2, TransformadorPrueba2, TransportadorPrueba1, TransportadorPrueba2

---

## 3. COMPATIBILIDAD CON EL MOTOR DE COINCIDENCIAS (MATCHING)

Se comprobó que las tres ofertas son indexadas de inmediato por el motor determinista de sugerencias (`GET /api/v1/matches/my-suggestions`), sumando puntaje por:
- Coincidencia exacta de subcategoría (+50 puntos).
- Misma zona geográfica (+20 puntos).
- Disponibilidad y volumen compatible.

**Evidencias de respaldo:**
- `docs/QA/evidencias/04-publicaciones/etapa2-ofertas-creadas.json`
- `docs/QA/evidencias/05-coincidencias/etapa2-condiciones-verificadas.json`