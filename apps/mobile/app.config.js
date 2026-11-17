function validateProductionApiUrl(value) {
  if (!value) {
    throw new Error(
      'Configure EXPO_PUBLIC_API_URL como variable de entorno de producción de EAS antes de compilar.'
    );
  }

  let apiUrl;
  try {
    apiUrl = new URL(value);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL debe ser una URL HTTPS válida en producción.');
  }

  if (apiUrl.protocol !== 'https:' || !apiUrl.hostname) {
    throw new Error('EXPO_PUBLIC_API_URL debe usar HTTPS en producción.');
  }
}

module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE === 'production') {
    validateProductionApiUrl(process.env.EXPO_PUBLIC_API_URL);
  }

  return config;
};
