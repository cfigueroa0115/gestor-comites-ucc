import 'dotenv/config';
import { GroqProvider } from '../src/lib/services/ai/groq.provider';

const DOCUMENT_CONTENT = `Comité Curricular-20260309_151417-Grabación de la reunión
9 de marzo de 2026, 8:13p.m. - 2 h 15 min 17 s

Sandra Patricia Rodriguez Acevedo ha iniciado la transcripción.

TEMAS TRATADOS:

1. CLASES ESPEJO E INTERNACIONALIZACIÓN:
Se discutió el formato para clases espejo. El decano nacional Edgar solicita que se registren las clases y horarios. Se explicó que para obtener certificación de internacionalización se requiere aval previo. Si un profesor consigue una clase espejo por cuenta propia, debe informar con anterioridad para que se valide con María de internacionalización. Los soportes necesarios están en el formato enviado: presentación, video, clase, asistencia, nombres.

2. LABORATORIOS VIRTUALES:
Se reenvió correo sobre laboratorios virtuales disponibles de la empresa Alcaté. Los profesores deben revisar el catálogo y confirmar cuáles podrían funcionar en sus cursos. Aplica para modalidad presencial y virtual. Los profesores que no pueden ingresar deben reportarlo para gestionar con Rubén el acceso.

3. MIS NOTAS DE ORIENTACIÓN - TUTORÍAS:
Las horas de tutoría deben quedar registradas en "Mis notas de orientación" en Timonel. Es un indicador de permanencia. Se aclaró que la tutoría es un tiempo ADICIONAL a la clase, no durante la clase. Los profesores deben comunicar a estudiantes los horarios de tutoría. Se debe considerar horarios accesibles para población nocturna (4-6pm o 6-7pm). Se proporcionará paso a paso para el registro.

4. MOVILIDAD Y RECURSOS DE EXTENSIÓN:
La facultad tiene meta de 250 millones de pesos para el programa y 1200 millones como facultad para 2026. Se invita a investigadores a buscar proyectos de regalías, licitaciones, alianzas. Se debe informar por correo a Rubén y Sandra cualquier posibilidad. Para salidas se requiere notificación previa con plan de trabajo, actividad prevista y resultados esperados en términos de: impacto, producto e ingreso.

5. ACTAS DEL COMITÉ:
Se acordó que las actas serán rotadas entre profesores de tiempo completo en orden alfabético: Figueroa, Hidalgo, Pérez, Pulido, Suárez, Trujillo, Oscaris y Velásquez. Las actas deben entregarse en 8 días, revisarse por todos, subirse al gestor y al drive.

6. CASO ESTUDIANTE ALEXANDRA PALACIOS:
La estudiante solicitó cambio de asesor (de German Ramos a Gustaris). Ahora solicita cambio de modalidad de grado a seminario. Ha tenido múltiples cambios de asesor. Se le orientó sobre las responsabilidades del seminario. Se dejó en acta pendiente de solicitud formal.

7. CASO ESTUDIANTE LAURA ROCA:
Transferencia interna desde Neiva, plan por objetivos a plan de competencias. Tiene 3 cursos pendientes no ofertados: Optativa 2, Electiva 3, Ingeniería de la calidad y confiabilidad. Se aprobó que pueda hacer los 3 como cursos dirigidos. Los cursos dirigidos no son clases regulares sino productos entregables con evaluación.

8. VALIDACIONES:
Se informó que hay varias solicitudes de validación pendientes. Se aclaró que las validaciones deben ser responsables y que los profesores deben socializar resultados con estudiantes. No hay obligación de aprobar automáticamente.

9. TEMAS VARIOS:
- PEP 2025: Se solicita revisión y aprobación del documento en el siguiente comité.
- Correos institucionales: Se reportó nuevamente el caso del profesor Freddy sin acceso.
- Indicadores: Se recordó la importancia de mostrar resultados en investigación, extensión, proyección social e internacionalización.
- Permanencia: Los profesores deben reportar estudiantes que faltan a segunda/tercera clase al enlace y a la jefe de programa.
- Bienestar: Reportar situaciones psicosociales o de salud mental de estudiantes.`;

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PRUEBA COMPLETA: Groq IA + Lectura de Documento Adjunto');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const groq = new GroqProvider();
  console.log('✅ Proveedor: Groq (Llama 3.3-70b-versatile)');
  console.log('✅ Disponible:', await groq.isAvailable());
  console.log(`✅ Documento adjunto: ${DOCUMENT_CONTENT.length} caracteres leídos\n`);

  console.log('⏳ Generando acta con IA... (puede tomar 15-30 segundos)\n');

  const startTime = Date.now();

  const result = await groq.generateActaContent({
    ordenDia: `1. Verificación del quórum e instalación del comité
2. Clases espejo e internacionalización
3. Laboratorios virtuales
4. Mis notas de orientación - Tutorías
5. Movilidad y recursos de extensión
6. Rotación de actas del comité
7. Caso estudiante Alexandra Palacios
8. Caso estudiante Laura Roca - Cursos dirigidos
9. Validaciones
10. Varios: PEP, correos, indicadores, permanencia`,
    asistentes: [
      { nombre: 'Sandra Patricia Rodríguez Acevedo', cargo: 'Directora de Programa' },
      { nombre: 'Carlos Alberto Figueroa Martínez', cargo: 'Profesor' },
      { nombre: 'Henry (Profesor TC)', cargo: 'Profesor' },
      { nombre: 'Carolina (Investigadora)', cargo: 'Investigador' },
      { nombre: 'Emiro (Profesor TC)', cargo: 'Profesor' },
      { nombre: 'Pablo (Profesor TC)', cargo: 'Profesor' },
      { nombre: 'Freddy (Profesor TC)', cargo: 'Profesor' },
    ],
    attachmentTexts: [DOCUMENT_CONTENT],
    tipoComite: 'Curricular',
    areaPrograma: 'Ingeniería Industrial',
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${result.success ? '✅ ÉXITO' : '❌ ERROR'}`);
  console.log(`  Proveedor: ${result.provider}`);
  console.log(`  Tiempo: ${elapsed} segundos`);
  console.log(`  Longitud del acta: ${result.desarrollo.length} caracteres`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (result.success) {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║            ACTA GENERADA POR INTELIGENCIA ARTIFICIAL         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    console.log(result.desarrollo);
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  FIN DEL ACTA');
    console.log('═══════════════════════════════════════════════════════════════');
  } else {
    console.error('ERROR:', result.error);
  }
}

main().catch(e => { console.error('Error fatal:', e.message); process.exit(1); });
