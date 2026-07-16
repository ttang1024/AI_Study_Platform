/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'StudyWidget',
  displayName: 'toto.ai',
  colors: {
    $accent: { color: '#059669', darkColor: '#10b981' },
  },
  frameworks: ['SwiftUI', 'WidgetKit'],
  deploymentTarget: '16.0',
  entitlements: {
    'com.apple.security.application-groups':
      config.ios?.entitlements?.['com.apple.security.application-groups'] ?? ['group.com.totoai.app.widget'],
  },
});
