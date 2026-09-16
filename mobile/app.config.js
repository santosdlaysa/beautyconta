// O esquema de retorno do Google é derivado do ID público do cliente iOS.
module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const plugins = [...(config.plugins || [])];
  if (iosClientId) {
    if (!iosClientId.endsWith('.apps.googleusercontent.com')) throw new Error('ID OAuth iOS do Google inválido.');
    const prefix = iosClientId.slice(0, -'.apps.googleusercontent.com'.length);
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: `com.googleusercontent.apps.${prefix}` }]);
  }
  if (process.env.EAS_BUILD_PLATFORM === 'ios' && webClientId && !iosClientId) {
    throw new Error('Configure EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID para incluir o login Google no iOS.');
  }
  return { ...config, plugins };
};
