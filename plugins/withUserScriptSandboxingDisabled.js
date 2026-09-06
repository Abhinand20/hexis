const { withXcodeProject } = require('@expo/config-plugins');

/**
 * React Native's bundle phase writes build metadata into the app bundle.
 * Xcode's user-script sandbox blocks that write on device builds, so disable
 * the sandbox for the application target in every generated iOS project.
 */
function withUserScriptSandboxingDisabled(config) {
  return withXcodeProject(config, (config) => {
    for (const configuration of ['Debug', 'Release']) {
      config.modResults.updateBuildProperty(
        'ENABLE_USER_SCRIPT_SANDBOXING',
        'NO',
        configuration,
        config.name
      );
    }

    return config;
  });
}

module.exports = withUserScriptSandboxingDisabled;
