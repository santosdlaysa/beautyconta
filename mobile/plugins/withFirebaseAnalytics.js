const { withAppBuildGradle } = require('expo/config-plugins');

// googleServicesFile lets Expo configure the Google Services plugin and JSON.
// This plugin adds the native SDK for automatic Android Analytics events.
module.exports = function withFirebaseAnalytics(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('Firebase Analytics requires a Groovy app/build.gradle.');
    }
    const contents = config.modResults.contents;
    if (!contents.includes('com.google.firebase:firebase-analytics')) {
      if (!/dependencies\s*\{/.test(contents)) {
        throw new Error('Cannot find Android dependencies for Firebase Analytics.');
      }
      config.modResults.contents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {
    implementation(platform("com.google.firebase:firebase-bom:34.19.0"))
    implementation("com.google.firebase:firebase-analytics")`,
      );
    }
    return config;
  });
};
