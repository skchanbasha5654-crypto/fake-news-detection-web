export function notFound(req, res) { res.status(404).json({ message: 'Route not found' }); }
export function errorHandler(error, req, res, next) {
  console.error(error);
  if (error.name === 'ZodError') return res.status(400).json({ message: error.issues[0]?.message || 'Invalid request' });
  res.status(error.status || 500).json({ message: error.message || 'Something went wrong' });
}
