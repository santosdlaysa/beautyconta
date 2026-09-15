const { withAppBuildGradle } = require('expo/config-plugins');

function configureReleaseSigning(contents) {
  if (contents.includes('// BeautyConta local release signing')) return contents;
  const androidBlock = /\bandroid\s*\{/;
  const signingBlock = /signingConfigs\s*\{/;
  const releaseSigning = /(buildTypes\s*\{[\s\S]*?\brelease\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug/;
  if (!androidBlock.test(contents) || !signingBlock.test(contents) || !releaseSigning.test(contents)) {
    throw new Error('Cannot configure Android release signing: unexpected Gradle structure.');
  }
  return contents
    .replace(androidBlock, `// BeautyConta local release signing
def releaseCredentialsFile = new File(rootDir.parentFile, "credentials.json")
if (!releaseCredentialsFile.exists()) {
    throw new GradleException("Missing credentials.json for BeautyConta release signing")
}
def releaseCredentials = new groovy.json.JsonSlurper().parse(releaseCredentialsFile).android.keystore

android {`)
    .replace(signingBlock, `signingConfigs {
        release {
            storeFile new File(rootDir.parentFile, releaseCredentials.keystorePath)
            storePassword releaseCredentials.keystorePassword
            keyAlias releaseCredentials.keyAlias
            keyPassword releaseCredentials.keyPassword
        }`)
    .replace(releaseSigning, '$1signingConfigs.release');
}

module.exports = function withAndroidReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('BeautyConta release signing requires Groovy build.gradle.');
    }
    config.modResults.contents = configureReleaseSigning(config.modResults.contents);
    return config;
  });
};

module.exports.configureReleaseSigning = configureReleaseSigning;
