/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AttachmentManager, formatFileSize } from './AttachmentManager';
import { MAX_FILE_COUNT, DEFAULT_MAX_FILE_SIZE_MB } from '@/lib/utils/constants';

// Mock the file actions module so we don't hit the server
vi.mock('@/actions/file.actions', () => ({
  uploadFileAction: vi.fn().mockResolvedValue({ success: true, data: { id: 'server-id-1' } }),
  deleteFileAction: vi.fn().mockResolvedValue({ success: true }),
}));

// Helper to create a mock File object
function createMockFile(name: string, size: number, type: string): File {
  const content = new Uint8Array(size);
  return new File([content], name, { type });
}

describe('AttachmentManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no files are attached', () => {
    render(<AttachmentManager />);
    expect(screen.getByText('No hay archivos adjuntos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adjuntar archivos/ })).toBeInTheDocument();
  });

  it('displays the file count indicator', () => {
    render(<AttachmentManager />);
    expect(screen.getByText(`0/${MAX_FILE_COUNT} archivos adjuntos`)).toBeInTheDocument();
  });

  it('shows the accepted file formats in empty state', () => {
    render(<AttachmentManager />);
    expect(screen.getByText(/Formatos:/)).toBeInTheDocument();
  });

  it('shows max file size info in empty state', () => {
    render(<AttachmentManager />);
    expect(screen.getByText(new RegExp(`${DEFAULT_MAX_FILE_SIZE_MB} MB por archivo`))).toBeInTheDocument();
  });

  it('rejects files with invalid extensions', async () => {
    render(<AttachmentManager />);

    const input = screen.getByLabelText('Seleccionar archivos para adjuntar');
    const file = createMockFile('virus.exe', 1024, 'application/octet-stream');

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      // The error message appears in the error section below the table
      expect(screen.getByText(/no está permitida/)).toBeInTheDocument();
    });
  });

  it('rejects files exceeding size limit', async () => {
    render(<AttachmentManager />);

    const input = screen.getByLabelText('Seleccionar archivos para adjuntar');
    // Create a file larger than DEFAULT_MAX_FILE_SIZE_MB (10 MB)
    const oversizedBytes = (DEFAULT_MAX_FILE_SIZE_MB + 1) * 1024 * 1024;
    const file = createMockFile('big-file.pdf', oversizedBytes, 'application/pdf');

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/tamaño máximo/)).toBeInTheDocument();
    });
  });

  it('shows error when exceeding MAX_FILE_COUNT', async () => {
    render(<AttachmentManager />);

    const input = screen.getByLabelText('Seleccionar archivos para adjuntar');
    // Create more than MAX_FILE_COUNT files
    const tooManyFiles = Array.from({ length: MAX_FILE_COUNT + 1 }, (_, i) =>
      createMockFile(`file-${i}.pdf`, 1024, 'application/pdf')
    );

    Object.defineProperty(input, 'files', {
      value: tooManyFiles,
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(
        screen.getByText(new RegExp(`No puede adjuntar más de ${MAX_FILE_COUNT} archivos`))
      ).toBeInTheDocument();
    });
  });

  it('calls onUploadStatusChange when upload starts and ends', async () => {
    const onUploadStatusChange = vi.fn();
    render(<AttachmentManager onUploadStatusChange={onUploadStatusChange} />);

    const input = screen.getByLabelText('Seleccionar archivos para adjuntar');
    const file = createMockFile('test.pdf', 1024, 'application/pdf');

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(onUploadStatusChange).toHaveBeenCalledWith(true);
    });

    await waitFor(() => {
      expect(onUploadStatusChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows blocking spinner during upload', async () => {
    // Delay the mock so we can observe spinner
    const { uploadFileAction } = await import('@/actions/file.actions');
    (uploadFileAction as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: { id: 'x' } }), 100))
    );

    render(<AttachmentManager />);

    const input = screen.getByLabelText('Seleccionar archivos para adjuntar');
    const file = createMockFile('test.pdf', 1024, 'application/pdf');

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(
        screen.getByText('Por favor espere, estamos cargando los soportes...')
      ).toBeInTheDocument();
    });
  });

  it('renders attachment table after successful upload', async () => {
    render(<AttachmentManager />);

    const input = screen.getByLabelText('Seleccionar archivos para adjuntar');
    const file = createMockFile('documento.pdf', 2048, 'application/pdf');

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      // Table headers should appear
      expect(screen.getByText('Nombre')).toBeInTheDocument();
      expect(screen.getByText('Tipo')).toBeInTheDocument();
      expect(screen.getByText('Tamaño')).toBeInTheDocument();
    });

    await waitFor(() => {
      // File should be shown in the table
      expect(screen.getByText('documento.pdf')).toBeInTheDocument();
      expect(screen.getByText('PDF')).toBeInTheDocument();
    });
  });

  it('handles delete action with confirmation', async () => {
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AttachmentManager />);

    const input = screen.getByLabelText('Seleccionar archivos para adjuntar');
    const file = createMockFile('to-delete.pdf', 1024, 'application/pdf');

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    // Wait for upload to complete (file shows "Completado" status)
    await waitFor(() => {
      expect(screen.getByText('Completado')).toBeInTheDocument();
    });

    // Click delete button
    const deleteButton = screen.getByLabelText(/Eliminar to-delete.pdf/);
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining('to-delete.pdf')
    );

    // File should be removed
    await waitFor(() => {
      expect(screen.queryByText('to-delete.pdf')).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('does not delete when confirmation is cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<AttachmentManager />);

    const input = screen.getByLabelText('Seleccionar archivos para adjuntar');
    const file = createMockFile('keep-me.pdf', 1024, 'application/pdf');

    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    // Wait for upload to complete
    await waitFor(() => {
      expect(screen.getByText('Completado')).toBeInTheDocument();
    });

    const deleteButton = screen.getByLabelText(/Eliminar keep-me.pdf/);
    fireEvent.click(deleteButton);

    // File should still be present
    expect(screen.getByText('keep-me.pdf')).toBeInTheDocument();

    confirmSpy.mockRestore();
  });
});

describe('formatFileSize', () => {
  it('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('formats bytes under 1KB', () => {
    expect(formatFileSize(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.50 MB');
  });

  it('formats exactly 1 KB', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('formats exactly 1 MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
  });
});
