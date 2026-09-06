const fs = require('node:fs/promises');
const path = require('node:path');
const plist = require('@expo/plist').default;
const { withFinalizedMod } = require('@expo/config-plugins');

/**
 * `expo-notifications` automatically adds the APNs entitlement during prebuild.
 * Hexis only schedules local reminders, so remove that remote-push capability
 * after every iOS config plugin has run.
 */
function withLocalNotificationsOnly(config) {
  return withFinalizedMod(config, [
    'ios',
    async (config) => {
      const { platformProjectRoot, projectName } = config.modRequest;
      const entitlementsPath = path.join(
        platformProjectRoot,
        projectName,
        `${projectName}.entitlements`
      );
      const entitlements = plist.parse(await fs.readFile(entitlementsPath, 'utf8'));

      delete entitlements['aps-environment'];

      await fs.writeFile(entitlementsPath, plist.build(entitlements));
      return config;
    },
  ]);
}

module.exports = withLocalNotificationsOnly;
