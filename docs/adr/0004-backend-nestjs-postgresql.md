# ADR-0004: Backend con NestJS (TypeScript) + PostgreSQL

- **Estado:** Aceptado (confirmado el 2026-10-13)
- **Fecha:** 2026-10-13

## Contexto
Hace falta una API para usuarios, economías compartidas (households), movimientos, presupuestos, deudas y, más adelante, un asesor con IA. Tengo experiencia en Node.js y en Kotlin. Objetivo prioritario: dominar el stack TypeScript/React Native cuanto antes y tener un proyecto de portfolio coherente.

## Opciones consideradas
1. **Kotlin + Ktor / Spring Boot**
   - ✅ Mi lenguaje más fuerte; tipado excelente; corrutinas; Spring es estándar enterprise.
   - ❌ Dos lenguajes en el repo; no se pueden compartir tipos/validaciones con la app; menos práctica de TypeScript.
2. **Node.js + NestJS (TypeScript)**
   - ✅ Mismo lenguaje que la app → contratos compartidos (esquemas Zod en un paquete común), cambio de contexto mínimo.
   - ✅ Arquitectura de NestJS (módulos, inyección de dependencias por constructor, decoradores, guards, pipes) es **casi Spring Boot**: curva baja viniendo de Kotlin.
   - ✅ Ecosistema de IA con SDKs TypeScript de primera clase (Anthropic SDK) para la fase de asesor financiero.
   - ❌ `number` es IEEE-754 → mitigado con dinero en unidades menores ([ADR-0007](0007-dinero-en-unidades-menores.md)) y `NUMERIC`/`BIGINT` en BD.
3. **BaaS (Supabase / Firebase)**
   - ✅ Rapidísimo para arrancar (auth, BD, realtime).
   - ❌ La lógica de negocio acaba en reglas/funciones dispersas; luce menos en un portfolio de ingeniería.

## Decisión
**NestJS + PostgreSQL**, con Clean Architecture por módulo (domain / application / infrastructure / interface). ORM a decidir en su propio ADR (Prisma vs Drizzle).

## Por qué
- Full-stack TypeScript acelera el objetivo de aprendizaje y permite compartir contratos tipados.
- PostgreSQL: datos financieros = relacionales y transaccionales (ACID). Un movimiento compartido, su reparto entre miembros y el saldo deben ser consistentes.
- NestJS aporta estructura de "framework de verdad" (frente a Express a pelo) y es reconocible en entrevistas.

## Consecuencias
- Paso a npm workspaces cuando exista el backend ([ADR-0001](0001-estructura-monorepo.md)).
- Si en algún momento se prefiere demostrar Kotlin, el backend es sustituible: la app depende de puertos (`TransactionRepository`), no de la tecnología del servidor.

## Para la entrevista
"Elegí NestJS por tener TypeScript extremo a extremo y compartir contratos validados con Zod entre API y app, y porque su modelo de módulos y DI es equivalente a Spring. PostgreSQL porque el dominio es contable: necesito transacciones ACID e integridad referencial para los repartos de gastos compartidos."
