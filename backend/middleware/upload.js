const multer = require('multer');
const path = require('path');

// Allowed file extensions (lowercase with leading dot)
const ALLOWED_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
]);

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  // PDF
  'application/pdf',
  // Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Generic fallback for binary office streams sent by some clients
  'application/octet-stream',
]);

// 10 MB file size limit
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10,485,760 bytes

// Multer memory storage (holds file in RAM buffer temporarily before uploading to Cloudinary)
const storage = multer.memoryStorage();

// File filter function
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  // Validate extension first
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      new Error(
        `File extension "${ext}" is not supported. Allowed formats: PNG, JPG, JPEG, GIF, WEBP, PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX.`
      ),
      false
    );
  }

  // Validate MIME type (if extension is valid and MIME is known/supported)
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return cb(
      new Error(
        `File type "${mime}" is not allowed. Only images, PDFs, Word, Excel, and PowerPoint documents up to 10 MB are permitted.`
      ),
      false
    );
  }

  return cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
}).single('file'); // Expected form-data key: 'file'

/**
 * Middleware wrapper around Multer to handle upload validation errors gracefully.
 */
function uploadAttachment(req, res, next) {
  upload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File size exceeds the 10 MB limit. Please upload a smaller file.',
        });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please attach a file under key "file".' });
    }

    next();
  });
}

module.exports = { uploadAttachment };
