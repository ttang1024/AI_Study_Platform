{{/*
Base name for resources.
*/}}
{{- define "study-platform.name" -}}
{{- .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Fully qualified app name, prefixed with the release name (unless the release
name already contains the chart name, matching the `helm create` convention).
*/}}
{{- define "study-platform.fullname" -}}
{{- if contains (include "study-platform.name" .) .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "study-platform.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{/*
Common labels.
*/}}
{{- define "study-platform.labels" -}}
app.kubernetes.io/name: {{ include "study-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/*
Selector labels for a given component (pass (dict "root" . "component" "api")).
*/}}
{{- define "study-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "study-platform.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/*
Name of the app Secret — either the user-managed existingSecretName, or the
one this chart creates.
*/}}
{{- define "study-platform.secretName" -}}
{{- if .Values.secrets.existingSecretName -}}
{{- .Values.secrets.existingSecretName -}}
{{- else -}}
{{- printf "%s-app-secrets" (include "study-platform.fullname" .) -}}
{{- end -}}
{{- end -}}
