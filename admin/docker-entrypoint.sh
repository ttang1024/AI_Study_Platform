#!/bin/sh
set -e

# Substitute only API_BACKEND_URL, leaving nginx's own $variables intact.
envsubst '${API_BACKEND_URL}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
