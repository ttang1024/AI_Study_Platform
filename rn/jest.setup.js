/* global jest */

// react-native-webview reaches for a TurboModule that only exists in a real
// app binary, so importing it anywhere in a component tree throws under jest.
// Components that render a WebView (the file preview, the KaTeX markdown
// renderer) get a plain View standing in for it, tagged so tests can tell the
// WebView branch apart from a natively-rendered one.
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockWebView = (props) => React.createElement(View, { ...props, testID: props.testID ?? 'webview' });
  return { WebView: MockWebView, default: MockWebView };
});
