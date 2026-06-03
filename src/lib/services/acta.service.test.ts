import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for the Acta Service Layer (Read Operations).
 *
 * Validates: Requirements 5.2, 5.3
 */

// Mock Prisma
const mockFindMany = vi.fn();
const mockCount = vi.fn();
const mockFindUnique = vi.fn();

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    acta: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

// Import after mocks
import { listActas, getActaById, getActaWithAttachments } from './acta.service';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_USER_RELATION = {
  id: 'user-1',
  nombreCompleto: 'Carlos Figueroa',
};

const MOCK_ACTA = {
  id: 'acta-1',
  numeroActa: 'ACTA-CUR-2025-0001',
  secuencia: 1,
  anio: 2025,
  fechaGeneracion: new Date('2025-07-01T10:00:00Z'),
  ciudad: 'Bogotá D.C.',
  horaInicio: '10:00',
  horaFin: '12:00',
  lugar: 'Sala de reuniones',
  tipoComite: 'Curricular',
  areaPrograma: 'Ingeniería Industrial',
  ordenDia: '1. Apertura\n2. Revisión de temas',
  asistentesJson: [{ nombre: 'Ana López', cargo: 'Profesor' }],
  desarrolloGenerado: 'Desarrollo generado...',
  presidenteNombre: null,
  presidenteCargo: null,
  elaboradoPorUsuarioId: 'user-1',
  elaboradoPorNombre: 'Carlos Figueroa',
  elaboradoPorCargo: 'Coordinador',
  copia: null,
  proyecto: 'Carlos Figueroa',
  reviso: 'Ana López',
  estado: 'Generada' as const,
  docxPath: '/path/to/file.docx',
  docxFilename: 'ACTA-CUR-2025-0001-Comite-Curricular-Ingenieria-Industrial.docx',
  createdAt: new Date('2025-07-01'),
  updatedAt: new Date('2025-07-01'),
  elaboradoPor: MOCK_USER_RELATION,
};

const MOCK_ACTA_2 = {
  ...MOCK_ACTA,
  id: 'acta-2',
  numeroActa: 'ACTA-INV-2025-0001',
  tipoComite: 'Investigación',
  fechaGeneracion: new Date('2025-06-15T08:00:00Z'),
  estado: 'Borrador' as const,
};

const MOCK_ATTACHMENT = {
  id: 'att-1',
  actaId: 'acta-1',
  nombreArchivo: 'soporte.pdf',
  tipoMime: 'application/pdf',
  extension: '.pdf',
  sizeBytes: 102400,
  storagePath: '/uploads/soporte.pdf',
  estadoCarga: 'completado' as const,
  estadoProcesamiento: 'completado' as const,
  textoExtraido: 'Texto extraído...',
  errorProcesamiento: null,
  createdAt: new Date('2025-07-01'),
  updatedAt: new Date('2025-07-01'),
};

// ---------------------------------------------------------------------------
// listActas
// ---------------------------------------------------------------------------

describe('listActas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated actas sorted by fechaGeneracion DESC', async () => {
    mockFindMany.mockResolvedValue([MOCK_ACTA, MOCK_ACTA_2]);
    mockCount.mockResolvedValue(2);

    const result = await listActas();

    expect(result.success).toBe(true);
    expect(result.data!.actas).toHaveLength(2);
    expect(result.data!.total).toBe(2);
    expect(result.data!.page).toBe(1);
    expect(result.data!.totalPages).toBe(1);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { fechaGeneracion: 'desc' },
        skip: 0,
        take: 10,
      }),
    );
  });

  it('uses default page size of 10 (ACTAS_PER_PAGE)', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await listActas({}, 1);

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it('calculates correct skip for pagination', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(25);

    const result = await listActas({}, 3, 10);

    expect(result.data!.totalPages).toBe(3);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it('includes elaboradoPor relation with id and nombreCompleto', async () => {
    mockFindMany.mockResolvedValue([MOCK_ACTA]);
    mockCount.mockResolvedValue(1);

    await listActas();

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          elaboradoPor: { select: { id: true, nombreCompleto: true } },
        },
      }),
    );
  });

  it('filters by numeroActa using partial match (contains, insensitive)', async () => {
    mockFindMany.mockResolvedValue([MOCK_ACTA]);
    mockCount.mockResolvedValue(1);

    await listActas({ numeroActa: 'CUR-2025' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          numeroActa: { contains: 'CUR-2025', mode: 'insensitive' },
        },
      }),
    );
  });

  it('filters by fechaDesde using gte on fechaGeneracion', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const fechaDesde = new Date('2025-06-01');
    await listActas({ fechaDesde });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fechaGeneracion: { gte: fechaDesde },
        },
      }),
    );
  });

  it('filters by fechaHasta using lte on fechaGeneracion', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const fechaHasta = new Date('2025-12-31');
    await listActas({ fechaHasta });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fechaGeneracion: { lte: fechaHasta },
        },
      }),
    );
  });

  it('filters by date range using both gte and lte', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const fechaDesde = new Date('2025-01-01');
    const fechaHasta = new Date('2025-06-30');
    await listActas({ fechaDesde, fechaHasta });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fechaGeneracion: { gte: fechaDesde, lte: fechaHasta },
        },
      }),
    );
  });

  it('filters by tipoComite with exact match', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await listActas({ tipoComite: 'Curricular' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tipoComite: 'Curricular' },
      }),
    );
  });

  it('filters by estado with exact match', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await listActas({ estado: 'Generada' });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { estado: 'Generada' },
      }),
    );
  });

  it('combines multiple filters', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    const fechaDesde = new Date('2025-01-01');
    await listActas({
      numeroActa: 'ACTA',
      fechaDesde,
      tipoComite: 'Investigación',
      estado: 'Borrador',
    });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          numeroActa: { contains: 'ACTA', mode: 'insensitive' },
          fechaGeneracion: { gte: fechaDesde },
          tipoComite: 'Investigación',
          estado: 'Borrador',
        },
      }),
    );
  });

  it('passes empty where clause when no filters are provided', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await listActas({});

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('uses same where clause for findMany and count', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await listActas({ tipoComite: 'Decanatura' });

    const findManyWhere = mockFindMany.mock.calls[0][0].where;
    const countWhere = mockCount.mock.calls[0][0].where;
    expect(findManyWhere).toEqual(countWhere);
  });
});

// ---------------------------------------------------------------------------
// getActaById
// ---------------------------------------------------------------------------

describe('getActaById', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns acta with elaboradoPor relation when found', async () => {
    mockFindUnique.mockResolvedValue(MOCK_ACTA);

    const result = await getActaById('acta-1');

    expect(result.success).toBe(true);
    expect(result.data!.id).toBe('acta-1');
    expect(result.data!.elaboradoPor.nombreCompleto).toBe('Carlos Figueroa');
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'acta-1' },
      include: {
        elaboradoPor: { select: { id: true, nombreCompleto: true } },
      },
    });
  });

  it('returns NOT_FOUND error when acta does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getActaById('nonexistent');

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('NOT_FOUND');
    expect(result.error!.message).toBe('Acta no encontrada.');
  });
});

// ---------------------------------------------------------------------------
// getActaWithAttachments
// ---------------------------------------------------------------------------

describe('getActaWithAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns acta with elaboradoPor and attachments relations when found', async () => {
    const actaWithAttachments = {
      ...MOCK_ACTA,
      attachments: [MOCK_ATTACHMENT],
    };
    mockFindUnique.mockResolvedValue(actaWithAttachments);

    const result = await getActaWithAttachments('acta-1');

    expect(result.success).toBe(true);
    expect(result.data!.id).toBe('acta-1');
    expect(result.data!.elaboradoPor.nombreCompleto).toBe('Carlos Figueroa');
    expect(result.data!.attachments).toHaveLength(1);
    expect(result.data!.attachments[0].nombreArchivo).toBe('soporte.pdf');
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'acta-1' },
      include: {
        elaboradoPor: { select: { id: true, nombreCompleto: true } },
        attachments: true,
      },
    });
  });

  it('returns NOT_FOUND error when acta does not exist', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getActaWithAttachments('nonexistent');

    expect(result.success).toBe(false);
    expect(result.error!.code).toBe('NOT_FOUND');
    expect(result.error!.message).toBe('Acta no encontrada.');
  });

  it('returns empty attachments array when acta has no attachments', async () => {
    const actaNoAttachments = {
      ...MOCK_ACTA,
      attachments: [],
    };
    mockFindUnique.mockResolvedValue(actaNoAttachments);

    const result = await getActaWithAttachments('acta-1');

    expect(result.success).toBe(true);
    expect(result.data!.attachments).toHaveLength(0);
  });
});
