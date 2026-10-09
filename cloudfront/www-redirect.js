// CloudFront Function (cloudfront-js-2.0), viewer-request on every behavior of the web distribution.
// Installed and kept up to date by deploy.sh (ensure_www_redirect).
//
// www.<domain> and <domain> are aliases of the same distribution, so without this both answer 200
// with the same page. A 301 to the bare domain keeps search engines from splitting the site's
// ranking signals across two hostnames. Path and query string are preserved so deep links and
// share links pasted with www still land where they should.
function handler(event) {
  var request = event.request;
  var host = request.headers.host ? request.headers.host.value : '';
  if (host.indexOf('www.') !== 0) return request;

  var query = [];
  for (var key in request.querystring) {
    var param = request.querystring[key];
    var values = param.multiValue ? param.multiValue : [param];
    for (var i = 0; i < values.length; i++) {
      query.push(values[i].value === '' ? key : key + '=' + values[i].value);
    }
  }

  return {
    statusCode: 301,
    statusDescription: 'Moved Permanently',
    headers: {
      location: { value: 'https://' + host.substring(4) + request.uri + (query.length ? '?' + query.join('&') : '') },
      'cache-control': { value: 'max-age=86400' },
    },
  };
}
