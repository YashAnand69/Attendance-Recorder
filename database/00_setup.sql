-- Attendly / Attendance Recorder
-- Master installer for Oracle SQL*Plus / SQLcl / SQL Developer "Run Script".

WHENEVER SQLERROR EXIT SQL.SQLCODE;
SET SERVEROUTPUT ON;
SET DEFINE OFF;

PROMPT ============================================================
PROMPT Attendly Oracle Database Setup
PROMPT ============================================================

@01_schema.sql
@02_sample_data.sql
@03_plsql_program_units.sql

PROMPT ============================================================
PROMPT Setup complete.
PROMPT Run @04_queries.sql for analytical queries.
PROMPT Run @05_demo.sql for the project demonstration.
PROMPT ============================================================
